import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.83.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Configuration with VERY conservative rate limiting to avoid 429 errors
const CONFIG = {
  MODELS: {
    PRIMARY: 'gemini-1.5-flash', // Use stable model, not experimental
    FALLBACK: 'gemini-1.5-flash', // Same model for consistency
  },
  BATCH_SIZE: 10,
  BASE_CONCURRENT: 1, // Process ONE at a time initially - VERY conservative
  MAX_CONCURRENT: 2, // Max 2 concurrent (was 8)
  MIN_CONCURRENT: 1,
  RETRY_ATTEMPTS: 5, // More retries with longer delays
  BASE_RETRY_DELAY_MS: 3000, // 3s base delay (was 1.5s)
  MAX_RETRY_DELAY_MS: 30000, // 30s max delay (was 15s)
  REQUEST_DELAY_MS: 1000, // 1s between requests (was 300ms)
  BATCH_DELAY_MS: 2000, // 2s between batches
  CACHE_EXPIRY_DAYS: 30,
};

interface Lead {
  id?: string;
  source: string;
  business_name: string;
  maps_url: string;
  website: string;
  phone: string;
  address: string;
  city: string;
  uf: string;
  raw_description: string;
  status_processamento: string;
}

interface AnalysisResult {
  icp_score: number;
  icp_level: string;
  faturamento_score: number;
  faturamento_estimado: string;
  faturamento_nivel: string;
  brecha: string;
  script_video: string;
  texto_direct: string;
  justificativa: string;
}

interface ProcessingStats {
  total: number;
  cached: number;
  successful: number;
  failed: number;
  rateLimitErrors: number;
  serverErrors: number;
  currentConcurrency: number;
}

const systemPrompt = `Você é um especialista em qualificação de leads B2B para o mercado de clínicas de estética e saúde no Brasil.

Sua tarefa é analisar cada lead e retornar SOMENTE um JSON válido, sem texto adicional, com esta estrutura exata:

{
  "icp_score": 0,
  "icp_level": "descartar",
  "faturamento_score": 0,
  "faturamento_estimado": "<100k",
  "faturamento_nivel": "baixo",
  "brecha": "string",
  "script_video": "string",
  "texto_direct": "string",
  "justificativa": "string"
}

REGRAS ICP SCORE (0-3):
- +1 se tem site profissional
- +1 se é clínica estruturada (não consultório individual)
- +1 se há sinais de marketing/tecnologia

ICP LEVELS:
- 0 = descartar
- 1 = N3
- 2 = N2
- 3 = N1

REGRAS FATURAMENTO SCORE (0-10) - FOCO EM >500k:
- +2 site premium (design moderno, múltiplas páginas)
- +2 estrutura física robusta (múltiplos profissionais, consultórios)
- +2 equipe/secretária (indícios de organização)
- +1 marketing ativo (blog, redes sociais, ads)
- +1 serviços premium (laser, harmonização, bioestimuladores)
- +1 reviews elevadas (muitas avaliações positivas)
- +1 localização premium (bairros nobres)

CLASSIFICAÇÃO FATURAMENTO:
- 8-10 pontos → >500k (premium)
- 6-7 pontos → 300k-500k (alto)
- 3-5 pontos → 100k-300k (médio)
- 0-2 pontos → <100k (baixo)

BRECHA:
Uma única oportunidade concreta relacionada a: eficiência, governança, jornada do paciente, posicionamento, captação ou experiência.

SCRIPT DE VÍDEO:
- Máximo 12 segundos
- Linguagem natural, primeira pessoa
- Tom consultivo, sem pressão
- Gancho leve e personalizado

TEXTO DIRECT:
- Curto e humano
- Zero pressão de venda
- Menciona a brecha identificada
- Convite leve para conversa

JUSTIFICATIVA:
Breve explicação lógica da classificação baseada nos dados analisados.

IMPORTANTE: Retorne APENAS o JSON, sem markdown, sem explicações.`;

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Generate cache key for a lead
function generateCacheKey(lead: Lead): string {
  const normalized = `${lead.business_name.toLowerCase().trim()}|${lead.city?.toLowerCase().trim() || ''}|${lead.uf?.toLowerCase().trim() || ''}|${lead.website?.toLowerCase().trim() || ''}`;
  return normalized;
}

// Check cache and return cached result if exists
async function checkCache(
  supabase: any,
  lead: Lead
): Promise<AnalysisResult | null> {
  try {
    const { data, error } = await supabase.rpc('get_cached_analysis', {
      p_business_name: lead.business_name,
      p_city: lead.city || '',
      p_uf: lead.uf || '',
      p_website: lead.website || '',
    });

    if (error) {
      console.error(`Cache lookup error for ${lead.business_name}:`, error);
      return null;
    }

    if (data && data.length > 0) {
      console.log(`✓ Cache HIT for ${lead.business_name}`);
      return data[0];
    }

    console.log(`✗ Cache MISS for ${lead.business_name}`);
    return null;
  } catch (error) {
    console.error(`Cache check failed for ${lead.business_name}:`, error);
    return null;
  }
}

// Save analysis result to cache
async function saveToCache(
  supabase: any,
  lead: Lead,
  result: AnalysisResult
): Promise<void> {
  try {
    await supabase.rpc('save_to_cache', {
      p_business_name: lead.business_name,
      p_city: lead.city || '',
      p_uf: lead.uf || '',
      p_website: lead.website || '',
      p_maps_url: lead.maps_url || '',
      p_icp_score: result.icp_score,
      p_icp_level: result.icp_level,
      p_faturamento_score: result.faturamento_score,
      p_faturamento_estimado: result.faturamento_estimado,
      p_faturamento_nivel: result.faturamento_nivel,
      p_brecha: result.brecha,
      p_script_video: result.script_video,
      p_texto_direct: result.texto_direct,
      p_justificativa: result.justificativa,
    });
    console.log(`✓ Cached result for ${lead.business_name}`);
  } catch (error) {
    console.error(`Failed to cache result for ${lead.business_name}:`, error);
  }
}

// Analyze a single lead with model fallback
async function analyzeSingleLead(
  lead: Lead,
  apiKey: string,
  supabase: any,
  usePrimaryModel: boolean = true,
  attempt: number = 1
): Promise<{ success: boolean; result?: AnalysisResult; error?: string; fromCache?: boolean; modelUsed?: string }> {
  try {
    // Check cache first
    const cachedResult = await checkCache(supabase, lead);
    if (cachedResult) {
      return {
        success: true,
        result: cachedResult,
        fromCache: true,
        modelUsed: 'cache',
      };
    }

    const userPrompt = `Analise este lead:

Nome: ${lead.business_name}
Cidade: ${lead.city} - ${lead.uf}
Website: ${lead.website || 'não informado'}
Endereço: ${lead.address}
Telefone: ${lead.phone || 'não informado'}
Descrição: ${lead.raw_description}
URL Maps: ${lead.maps_url}`;

    const model = usePrimaryModel ? CONFIG.MODELS.PRIMARY : CONFIG.MODELS.FALLBACK;
    console.log(`Analyzing ${lead.business_name} with ${model} (attempt ${attempt}/${CONFIG.RETRY_ATTEMPTS})`);

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: systemPrompt + '\n\n' + userPrompt }]
          }
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: usePrimaryModel ? 8192 : 4096,
          topP: 0.95,
          topK: 40,
        },
        safetySettings: [
          { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
        ],
      }),
    });

    // Handle rate limiting (429)
    if (response.status === 429) {
      if (attempt < CONFIG.RETRY_ATTEMPTS) {
        const delay = Math.min(
          CONFIG.BASE_RETRY_DELAY_MS * Math.pow(2, attempt - 1),
          CONFIG.MAX_RETRY_DELAY_MS
        );
        console.log(`⚠ Rate limited, retrying in ${delay}ms (${attempt}/${CONFIG.RETRY_ATTEMPTS})`);
        await sleep(delay);
        return analyzeSingleLead(lead, apiKey, supabase, usePrimaryModel, attempt + 1);
      }
      return { success: false, error: 'Rate limit exceeded after retries', modelUsed: model };
    }

    // Handle unauthorized (403)
    if (response.status === 403) {
      return { success: false, error: 'API key inválida ou sem permissão', modelUsed: model };
    }

    // Handle server errors (503, 500)
    if (response.status === 503 || response.status === 500) {
      // Try fallback model first if using primary
      if (usePrimaryModel && attempt === 1) {
        console.log(`⚠ ${response.status} error, trying fallback model`);
        await sleep(CONFIG.BASE_RETRY_DELAY_MS);
        return analyzeSingleLead(lead, apiKey, supabase, false, attempt + 1);
      }

      // Otherwise retry with exponential backoff
      if (attempt < CONFIG.RETRY_ATTEMPTS) {
        const delay = Math.min(
          CONFIG.BASE_RETRY_DELAY_MS * Math.pow(2, attempt - 1),
          CONFIG.MAX_RETRY_DELAY_MS
        );
        console.log(`⚠ ${response.status} error, retrying in ${delay}ms (${attempt}/${CONFIG.RETRY_ATTEMPTS})`);
        await sleep(delay);
        return analyzeSingleLead(lead, apiKey, supabase, usePrimaryModel, attempt + 1);
      }

      return { success: false, error: `Server error ${response.status} after retries`, modelUsed: model };
    }

    // Handle other errors
    if (!response.ok) {
      const errorText = await response.text();
      let errorDetails = errorText;
      try {
        const errorJson = JSON.parse(errorText);
        errorDetails = errorJson.error?.message || errorText;
      } catch { /* keep original */ }

      return { success: false, error: `API error: ${response.status} - ${errorDetails}`, modelUsed: model };
    }

    const data = await response.json();
    const analysisText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!analysisText) {
      const finishReason = data.candidates?.[0]?.finishReason;

      // If MAX_TOKENS with primary model, try fallback
      if (finishReason === 'MAX_TOKENS' && usePrimaryModel) {
        console.log(`⚠ MAX_TOKENS with primary model, trying fallback`);
        await sleep(CONFIG.BASE_RETRY_DELAY_MS);
        return analyzeSingleLead(lead, apiKey, supabase, false, attempt + 1);
      }

      // Otherwise retry
      if (attempt < CONFIG.RETRY_ATTEMPTS) {
        await sleep(CONFIG.BASE_RETRY_DELAY_MS);
        return analyzeSingleLead(lead, apiKey, supabase, usePrimaryModel, attempt + 1);
      }

      return { success: false, error: `Empty response. FinishReason: ${finishReason || 'unknown'}`, modelUsed: model };
    }

    // Parse JSON with error recovery
    let cleanText = analysisText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    try {
      const result = JSON.parse(cleanText);

      // Save to cache
      await saveToCache(supabase, lead, result);

      return { success: true, result, fromCache: false, modelUsed: model };
    } catch (parseError) {
      console.warn(`JSON parse error, attempting recovery...`);

      // Try to fix by finding last valid }
      try {
        const lastBraceIndex = cleanText.lastIndexOf('}');
        if (lastBraceIndex > 0) {
          cleanText = cleanText.substring(0, lastBraceIndex + 1);
          const result = JSON.parse(cleanText);
          console.log(`✓ JSON recovered successfully`);

          await saveToCache(supabase, lead, result);
          return { success: true, result, fromCache: false, modelUsed: model };
        }
      } catch { /* continue to retry */ }

      // Retry if attempts remain
      if (attempt < CONFIG.RETRY_ATTEMPTS) {
        console.log(`Retrying due to JSON parse error (${attempt}/${CONFIG.RETRY_ATTEMPTS})`);
        await sleep(CONFIG.BASE_RETRY_DELAY_MS);
        return analyzeSingleLead(lead, apiKey, supabase, usePrimaryModel, attempt + 1);
      }

      return {
        success: false,
        error: `JSON parse error: ${parseError instanceof Error ? parseError.message : 'Unknown'}`,
        modelUsed: model
      };
    }
  } catch (error) {
    if (attempt < CONFIG.RETRY_ATTEMPTS) {
      const delay = CONFIG.BASE_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
      console.log(`Error, retrying in ${delay}ms (${attempt}/${CONFIG.RETRY_ATTEMPTS}): ${error}`);
      await sleep(delay);
      return analyzeSingleLead(lead, apiKey, supabase, usePrimaryModel, attempt + 1);
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Save lead to database incrementally
async function saveLead(
  supabase: any,
  sessionId: string,
  userId: string,
  lead: Lead,
  analysis: { success: boolean; result?: AnalysisResult; error?: string; fromCache?: boolean; modelUsed?: string }
): Promise<void> {
  try {
    const leadData = {
      session_id: sessionId,
      user_id: userId,
      source: lead.source,
      business_name: lead.business_name,
      maps_url: lead.maps_url,
      website: lead.website,
      phone: lead.phone,
      address: lead.address,
      city: lead.city,
      uf: lead.uf,
      raw_description: lead.raw_description,
      status_processamento: lead.status_processamento,
      analysis_status: analysis.success ? 'completed' : 'error',
      error_message: analysis.error || null,
      from_cache: analysis.fromCache || false,
      cache_hit_at: analysis.fromCache ? new Date().toISOString() : null,
      ...(analysis.result ? {
        icp_score: analysis.result.icp_score,
        icp_level: analysis.result.icp_level,
        faturamento_score: analysis.result.faturamento_score,
        faturamento_estimado: analysis.result.faturamento_estimado,
        faturamento_nivel: analysis.result.faturamento_nivel,
        brecha: analysis.result.brecha,
        script_video: analysis.result.script_video,
        texto_direct: analysis.result.texto_direct,
        justificativa: analysis.result.justificativa,
        analyzed_at: new Date().toISOString(),
      } : {})
    };

    const { error: dbError } = await supabase
      .from('leads')
      .insert(leadData);

    if (dbError) {
      console.error(`Database error for ${lead.business_name}:`, dbError);
    }
  } catch (error) {
    console.error(`Failed to save lead ${lead.business_name}:`, error);
  }
}

// Dynamic concurrency adjustment based on error rate
function adjustConcurrency(stats: ProcessingStats): number {
  const errorRate = stats.total > 0 ? (stats.failed / stats.total) : 0;
  const rateLimitRate = stats.total > 0 ? (stats.rateLimitErrors / stats.total) : 0;

  let newConcurrency = stats.currentConcurrency;

  // If error rate is high, reduce concurrency
  if (errorRate > 0.3 || rateLimitRate > 0.2) {
    newConcurrency = Math.max(CONFIG.MIN_CONCURRENT, newConcurrency - 1);
    console.log(`⬇ Reducing concurrency to ${newConcurrency} (error rate: ${(errorRate * 100).toFixed(1)}%)`);
  }
  // If success rate is good, increase concurrency
  else if (errorRate < 0.1 && rateLimitRate < 0.05 && stats.total > 5) {
    newConcurrency = Math.min(CONFIG.MAX_CONCURRENT, newConcurrency + 1);
    console.log(`⬆ Increasing concurrency to ${newConcurrency} (success rate: ${((1 - errorRate) * 100).toFixed(1)}%)`);
  }

  return newConcurrency;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { leads, session_id, user_id } = await req.json();

    if (!leads || !Array.isArray(leads) || leads.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No leads provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const GOOGLE_AI_API_KEY = Deno.env.get('GOOGLE_AI_API_KEY');
    if (!GOOGLE_AI_API_KEY) {
      throw new Error('GOOGLE_AI_API_KEY não configurada');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`\n🚀 Starting optimized batch analysis of ${leads.length} leads`);
    console.log(`Configuration: Models: ${CONFIG.MODELS.PRIMARY} -> ${CONFIG.MODELS.FALLBACK}`);

    const stats: ProcessingStats = {
      total: 0,
      cached: 0,
      successful: 0,
      failed: 0,
      rateLimitErrors: 0,
      serverErrors: 0,
      currentConcurrency: CONFIG.BASE_CONCURRENT,
    };

    const results: Array<any> = [];

    // Process leads with dynamic concurrency
    for (let i = 0; i < leads.length; i += stats.currentConcurrency) {
      const batch = leads.slice(i, Math.min(i + stats.currentConcurrency, leads.length));
      console.log(`\n📦 Processing batch ${Math.floor(i / stats.currentConcurrency) + 1} (${batch.length} leads, concurrency: ${stats.currentConcurrency})`);

      const batchPromises = batch.map(async (lead: Lead, batchIndex: number) => {
        // Stagger requests
        if (batchIndex > 0) {
          await sleep(CONFIG.REQUEST_DELAY_MS * batchIndex);
        }

        const analysis = await analyzeSingleLead(lead, GOOGLE_AI_API_KEY, supabase);

        // Update stats
        stats.total++;
        if (analysis.fromCache) {
          stats.cached++;
        }
        if (analysis.success) {
          stats.successful++;
        } else {
          stats.failed++;
          if (analysis.error?.includes('Rate limit')) {
            stats.rateLimitErrors++;
          }
          if (analysis.error?.includes('503') || analysis.error?.includes('500')) {
            stats.serverErrors++;
          }
        }

        // Save incrementally to database
        if (session_id && user_id) {
          await saveLead(supabase, session_id, user_id, lead, analysis);
        }

        return {
          business_name: lead.business_name,
          success: analysis.success,
          from_cache: analysis.fromCache,
          model_used: analysis.modelUsed,
          ...(analysis.success ? analysis.result : { error: analysis.error }),
          ...lead
        };
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Adjust concurrency for next batch
      stats.currentConcurrency = adjustConcurrency(stats);

      // Longer delay between batches to respect rate limits
      if (i + stats.currentConcurrency < leads.length) {
        console.log(`⏳ Waiting ${CONFIG.BATCH_DELAY_MS}ms before next batch...`);
        await sleep(CONFIG.BATCH_DELAY_MS);
      }
    }

    const cacheHitRate = stats.total > 0 ? (stats.cached / stats.total * 100).toFixed(1) : '0.0';
    const successRate = stats.total > 0 ? (stats.successful / stats.total * 100).toFixed(1) : '0.0';

    console.log(`\n✅ Batch analysis complete!`);
    console.log(`📊 Stats: ${stats.successful} successful, ${stats.failed} failed`);
    console.log(`💾 Cache: ${stats.cached} hits (${cacheHitRate}% hit rate)`);
    console.log(`📈 Success rate: ${successRate}%`);
    console.log(`⚠️  Errors: ${stats.rateLimitErrors} rate limit, ${stats.serverErrors} server errors`);

    return new Response(
      JSON.stringify({
        total: results.length,
        successful: stats.successful,
        failed: stats.failed,
        cached: stats.cached,
        cache_hit_rate: parseFloat(cacheHitRate),
        success_rate: parseFloat(successRate),
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Batch analysis error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

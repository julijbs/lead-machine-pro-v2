import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.83.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Configuration for batch processing
const BATCH_SIZE = 10; // Process 10 leads at a time
const MAX_CONCURRENT = 5; // Max concurrent API calls (reduced to avoid rate limiting)
const RETRY_ATTEMPTS = 3; // Increased retries for 503 errors
const RETRY_DELAY_MS = 2000; // Base delay for exponential backoff
const MAX_RETRY_DELAY_MS = 10000; // Max delay for exponential backoff

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

async function analyzeSingleLead(
  lead: Lead,
  apiKey: string,
  attempt: number = 1
): Promise<{ success: boolean; result?: AnalysisResult; error?: string }> {
  try {
    const userPrompt = `Analise este lead:

Nome: ${lead.business_name}
Cidade: ${lead.city} - ${lead.uf}
Website: ${lead.website || 'não informado'}
Endereço: ${lead.address}
Telefone: ${lead.phone || 'não informado'}
Descrição: ${lead.raw_description}
URL Maps: ${lead.maps_url}`;

    // Use Google AI Studio API directly
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
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
          maxOutputTokens: 4096, // Increased to avoid MAX_TOKENS error
          topP: 0.95,
          topK: 40,
        },
        safetySettings: [
          {
            category: "HARM_CATEGORY_HARASSMENT",
            threshold: "BLOCK_NONE"
          },
          {
            category: "HARM_CATEGORY_HATE_SPEECH",
            threshold: "BLOCK_NONE"
          },
          {
            category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
            threshold: "BLOCK_NONE"
          },
          {
            category: "HARM_CATEGORY_DANGEROUS_CONTENT",
            threshold: "BLOCK_NONE"
          }
        ],
      }),
    });

    // Handle rate limiting (429)
    if (response.status === 429) {
      if (attempt < RETRY_ATTEMPTS) {
        const delay = Math.min(RETRY_DELAY_MS * Math.pow(2, attempt - 1), MAX_RETRY_DELAY_MS);
        console.log(`Rate limited on ${lead.business_name}, retrying in ${delay}ms (attempt ${attempt}/${RETRY_ATTEMPTS})`);
        await sleep(delay);
        return analyzeSingleLead(lead, apiKey, attempt + 1);
      }
      return { success: false, error: 'Rate limit exceeded after retries' };
    }

    // Handle unauthorized (403)
    if (response.status === 403) {
      return { success: false, error: 'API key inválida ou sem permissão' };
    }

    // Handle server overload (503) and other errors
    if (!response.ok) {
      const errorText = await response.text();
      let errorDetails = errorText;

      try {
        const errorJson = JSON.parse(errorText);
        errorDetails = errorJson.error?.message || errorText;
      } catch {
        // Keep original error text if not JSON
      }

      // Retry on 503 (overloaded) and 500 (server error) with exponential backoff
      if ((response.status === 503 || response.status === 500) && attempt < RETRY_ATTEMPTS) {
        const delay = Math.min(RETRY_DELAY_MS * Math.pow(2, attempt - 1), MAX_RETRY_DELAY_MS);
        console.log(`API ${response.status} on ${lead.business_name}, retrying in ${delay}ms (attempt ${attempt}/${RETRY_ATTEMPTS})`);
        await sleep(delay);
        return analyzeSingleLead(lead, apiKey, attempt + 1);
      }

      return { success: false, error: `API error: ${response.status} - ${errorDetails}` };
    }

    const data = await response.json();
    console.log(`Resposta da API para ${lead.business_name}:`, JSON.stringify(data).substring(0, 500));

    const analysisText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!analysisText) {
      const finishReason = data.candidates?.[0]?.finishReason;
      console.error(`Resposta vazia para ${lead.business_name}! FinishReason:`, finishReason);

      // If MAX_TOKENS, retry once with increased limit or accept partial result
      if (finishReason === 'MAX_TOKENS' && attempt < RETRY_ATTEMPTS) {
        console.log(`MAX_TOKENS on ${lead.business_name}, retrying (attempt ${attempt}/${RETRY_ATTEMPTS})`);
        await sleep(RETRY_DELAY_MS);
        return analyzeSingleLead(lead, apiKey, attempt + 1);
      }

      return { success: false, error: `Resposta vazia da API. FinishReason: ${finishReason || 'unknown'}` };
    }

    // Parse the JSON response with better error handling
    let cleanText = analysisText
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    // Try to fix common JSON issues
    try {
      // First attempt: direct parse
      const result = JSON.parse(cleanText);
      return { success: true, result };
    } catch (parseError) {
      // Second attempt: fix unterminated strings and try again
      console.warn(`JSON parse error for ${lead.business_name}, attempting to fix...`);

      try {
        // Fix unterminated strings by finding the last complete object
        const lastBraceIndex = cleanText.lastIndexOf('}');
        if (lastBraceIndex > 0) {
          cleanText = cleanText.substring(0, lastBraceIndex + 1);
          const result = JSON.parse(cleanText);
          console.log(`Successfully fixed JSON for ${lead.business_name}`);
          return { success: true, result };
        }
      } catch (secondError) {
        // If still fails, log and return error
        console.error(`Failed to parse JSON for ${lead.business_name}:`, cleanText.substring(0, 500));
        console.error(`Parse error:`, parseError);

        // Retry if we haven't exhausted attempts
        if (attempt < RETRY_ATTEMPTS) {
          console.log(`Retrying ${lead.business_name} due to JSON parse error (attempt ${attempt}/${RETRY_ATTEMPTS})`);
          await sleep(RETRY_DELAY_MS);
          return analyzeSingleLead(lead, apiKey, attempt + 1);
        }

        return {
          success: false,
          error: `JSON parse error: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`
        };
      }
    }
  } catch (error) {
    if (attempt < RETRY_ATTEMPTS) {
      const delay = RETRY_DELAY_MS * Math.pow(2, attempt - 1);
      console.log(`Error on ${lead.business_name}, retrying in ${delay}ms (attempt ${attempt}): ${error}`);
      await sleep(delay);
      return analyzeSingleLead(lead, apiKey, attempt + 1);
    }
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Process leads with controlled concurrency
async function processWithConcurrency<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  concurrency: number
): Promise<R[]> {
  const results: R[] = [];
  const executing: Promise<void>[] = [];

  for (const item of items) {
    const promise = processor(item).then(result => {
      results.push(result);
    });
    executing.push(promise);

    if (executing.length >= concurrency) {
      await Promise.race(executing);
      // Remove completed promises
      const completed = executing.filter(p => {
        // Check if promise is settled
        let settled = false;
        p.then(() => { settled = true; }).catch(() => { settled = true; });
        return !settled;
      });
      executing.length = 0;
      executing.push(...completed);
    }
  }

  await Promise.all(executing);
  return results;
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

    // Initialize Supabase client for database operations
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`Starting batch analysis of ${leads.length} leads with concurrency ${MAX_CONCURRENT}`);
    console.log(`Configuration: RETRY_ATTEMPTS=${RETRY_ATTEMPTS}, RETRY_DELAY_MS=${RETRY_DELAY_MS}`);

    const results: Array<{
      lead: Lead;
      success: boolean;
      result?: AnalysisResult;
      error?: string;
    }> = [];

    // Process leads with controlled concurrency
    const analysisPromises = leads.map((lead: Lead, index: number) => async () => {
      console.log(`Processing lead ${index + 1}/${leads.length}: ${lead.business_name}`);

      // Add small delay between requests to avoid overwhelming the API
      if (index > 0) {
        await sleep(200); // 200ms delay between requests
      }

      const analysis = await analyzeSingleLead(lead, GOOGLE_AI_API_KEY);

      // If we have session_id and user_id, save to database
      if (session_id && user_id) {
        const leadData = {
          session_id,
          user_id,
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
      }

      return {
        lead,
        success: analysis.success,
        result: analysis.result,
        error: analysis.error
      };
    });

    // Execute with concurrency control
    const processorFunctions = analysisPromises.map(fn => fn);
    for (let i = 0; i < processorFunctions.length; i += MAX_CONCURRENT) {
      const batch = processorFunctions.slice(i, i + MAX_CONCURRENT);
      const batchResults = await Promise.all(batch.map(fn => fn()));
      results.push(...batchResults);

      // Removed delay between batches for faster processing
      // The MAX_CONCURRENT limit already prevents API overwhelming
    }

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    console.log(`Batch analysis complete: ${successful} successful, ${failed} failed`);

    // Log failed leads for debugging
    if (failed > 0) {
      const failedLeads = results.filter(r => !r.success);
      console.error('Failed leads:', failedLeads.map(r => ({
        name: r.lead.business_name,
        error: r.error
      })));
    }

    return new Response(
      JSON.stringify({
        total: results.length,
        successful,
        failed,
        results: results.map(r => ({
          business_name: r.lead.business_name,
          success: r.success,
          ...(r.success ? r.result : { error: r.error }),
          // Include original lead data for frontend
          ...r.lead
        }))
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Batch analysis error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

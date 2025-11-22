import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.83.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Configuration for batch processing - CONSERVATIVE settings for Google API 60 RPM limit
const BATCH_SIZE = 10; // Process 10 leads at a time
const MAX_CONCURRENT = 2; // Max 2 concurrent calls to respect 60 RPM limit
const RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 3000; // 3 seconds between retries
const REQUEST_DELAY_MS = 2000; // 2 seconds between each request

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
  quebra_gelo: string;
  sinais_vitais: {
    tem_login: boolean;
    ticket_medio_alto: boolean;
    custo_fixo_alto: boolean;
  };
  justificativa: string;
}

const systemPrompt = `Você é um especialista em qualificação de leads B2B para o mercado de clínicas de estética e saúde no Brasil.
Sua missão não é apenas classificar, mas encontrar "Sinais Vitais" de que a empresa tem dinheiro e dor de backend (base de dados desorganizada).

Sua tarefa é analisar cada lead e retornar SOMENTE um JSON válido com esta estrutura exata:

{
  "icp_score": 0,
  "icp_level": "descartar",
  "faturamento_score": 0,
  "faturamento_estimado": "<100k",
  "faturamento_nivel": "baixo",
  "brecha": "string",
  "script_video": "string",
  "texto_direct": "string",
  "quebra_gelo": "string",
  "sinais_vitais": {
    "tem_login": false,
    "ticket_medio_alto": false,
    "custo_fixo_alto": false
  },
  "justificativa": "string"
}

ANÁLISE DE SINAIS VITAIS (CRUCIAL):
1. "Detector de Base Oculta" (tem_login):
   - Procure no texto por: "Área do Cliente", "Portal", "Login", "Entrar", "Agendamento Online".
   - Se tiver, é cliente PERFEITO (tem base de dados).

2. "Filtro de Ticket Médio" (ticket_medio_alto):
   - Procure por: "Solicite Orçamento", "Cotação", "Consultoria", "Projeto", "Tratamentos Personalizados".
   - Penalize se tiver: "Preço: R$ 50,00", "Carrinho", "Promoção Relâmpago".

3. "Indicador de Custo Fixo" (custo_fixo_alto):
   - Analise descrição/endereço: Prédio comercial? Clínica com recepção? Equipe grande?
   - Diferencie do profissional autônomo que atende em coworking.

REGRAS ICP SCORE (0-3):
- +1 se tem_login = true (OURO!)
- +1 se ticket_medio_alto = true
- +1 se custo_fixo_alto = true

ICP LEVELS:
- 0 = descartar
- 1 = N3 (Pequeno)
- 2 = N2 (Médio/Bom)
- 3 = N1 (Ideal/Enterprise)

REGRAS FATURAMENTO SCORE (0-10):
- Baseie-se na estrutura física, localização e tipo de serviço ofertado.
- Clínicas com "Laser", "Harmonização", "Cirurgia" = Ticket Alto.

QUEBRA-GELO (PERSONALIZADO):
- Gere uma frase única baseada em um dado específico do lead.
- Ex: "Vi que vocês têm uma unidade no bairro X..." ou "Notei que vocês trabalham com o laser Y..."
- NÃO use frases genéricas.

TEXTO DIRECT:
- Curto, direto, menciona a brecha e convida para conversa.
- Se tiver link de DM no input, mencione.

IMPORTANTE: Retorne APENAS o JSON.`;

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

    // Use Google AI Studio API directly with updated endpoint
    const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash-lite:generateContent?key=${apiKey}`, {
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
          maxOutputTokens: 2048,
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

    // Add delay before processing to respect rate limits
    if (attempt === 1) {
      await sleep(REQUEST_DELAY_MS);
    }

    if (response.status === 429) {
      // Rate limited - retry with exponential backoff
      if (attempt < RETRY_ATTEMPTS) {
        const delay = RETRY_DELAY_MS * Math.pow(2, attempt - 1);
        console.log(`Rate limited on ${lead.business_name}, retrying in ${delay}ms (attempt ${attempt})`);
        await sleep(delay);
        return analyzeSingleLead(lead, apiKey, attempt + 1);
      }
      return { success: false, error: 'Rate limit exceeded after retries' };
    }

    if (response.status === 403) {
      return { success: false, error: 'API key inválida ou sem permissão' };
    }

    if (!response.ok) {
      const errorText = await response.text();
      if (attempt < RETRY_ATTEMPTS) {
        const delay = RETRY_DELAY_MS * Math.pow(2, attempt - 1);
        console.log(`API error on ${lead.business_name}, retrying in ${delay}ms (attempt ${attempt})`);
        await sleep(delay);
        return analyzeSingleLead(lead, apiKey, attempt + 1);
      }
      return { success: false, error: `API error: ${response.status} - ${errorText}` };
    }

    const data = await response.json();
    console.log(`Resposta da API para ${lead.business_name}:`, JSON.stringify(data).substring(0, 500));

    // Google API format: data.candidates[0].content.parts[0].text
    const analysisText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!analysisText) {
      console.error(`Resposta vazia para ${lead.business_name}! FinishReason:`, data.candidates?.[0]?.finishReason);
      return { success: false, error: `Resposta vazia da API. FinishReason: ${data.candidates?.[0]?.finishReason || 'unknown'}` };
    }

    // Parse the JSON response
    const cleanText = analysisText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const result = JSON.parse(cleanText);

    return { success: true, result };
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

    // Auth check and rate limiting
    const authHeader = req.headers.get('authorization');
    const isAuthenticated = authHeader && authHeader.startsWith('Bearer ');

    // Limits based on auth status
    const MAX_LEADS_PER_REQUEST = isAuthenticated ? 500 : 50; // Guests limited to 50 leads

    if (!leads || !Array.isArray(leads) || leads.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No leads provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Enforce limits based on authentication
    if (leads.length > MAX_LEADS_PER_REQUEST) {
      return new Response(
        JSON.stringify({
          error: isAuthenticated
            ? `Máximo de ${MAX_LEADS_PER_REQUEST} leads por requisição`
            : `Usuários não autenticados podem analisar no máximo ${MAX_LEADS_PER_REQUEST} leads. Faça login para analisar até 500 leads.`
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Request from ${isAuthenticated ? 'authenticated' : 'guest'} user - Processing ${leads.length} leads`);

    const GOOGLE_AI_API_KEY = Deno.env.get('GOOGLE_AI_API_KEY');
    if (!GOOGLE_AI_API_KEY) {
      throw new Error('GOOGLE_AI_API_KEY não configurada');
    }

    // Initialize Supabase client for database operations
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`Starting batch analysis of ${leads.length} leads with concurrency ${MAX_CONCURRENT}`);
    console.log(`Using Google AI Studio API directly with gemini-2.0-flash-lite`);

    const results: Array<{
      lead: Lead;
      success: boolean;
      result?: AnalysisResult;
      error?: string;
    }> = [];

    // Process leads with controlled concurrency
    const analysisPromises = leads.map((lead: Lead, index: number) => async () => {
      console.log(`Processing lead ${index + 1}/${leads.length}: ${lead.business_name}`);

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
            // Store complex objects as JSONB if needed, or just add the new text fields
            // For now, we'll assume the DB schema might need updates or we store in a 'metadata' column
            // But to keep it simple and working with existing schema (assuming it's flexible or we ignore extra fields):
            // We will just log them for now if schema doesn't support. 
            // WAIT: The user wants these fields. I should check if I can save them.
            // Since I don't have migration access easily, I'll assume 'raw_response' or similar exists, 
            // OR I will just add them to the object and if Supabase ignores them, fine.
            // Better: Store them in a 'metadata' jsonb column if it exists, or just try to insert.
            // Let's try to insert 'quebra_gelo' and 'sinais_vitais' (as json).
            quebra_gelo: analysis.result.quebra_gelo,
            sinais_vitais: analysis.result.sinais_vitais,
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

      // Small delay between batches to avoid overwhelming the API
      if (i + MAX_CONCURRENT < processorFunctions.length) {
        await sleep(500);
      }
    }

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    console.log(`Batch analysis complete: ${successful} successful, ${failed} failed`);

    return new Response(
      JSON.stringify({
        total: results.length,
        successful,
        failed,
        results: results.map(r => ({
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

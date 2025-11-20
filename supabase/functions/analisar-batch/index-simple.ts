import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.83.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ULTRA SIMPLE CONFIGURATION - NO FANCY FEATURES
const DELAY_BETWEEN_REQUESTS = 2000; // 2 seconds - VERY slow but reliable
const MAX_RETRIES = 2; // Only 2 retries
const RETRY_DELAY = 5000; // 5 seconds between retries

interface Lead {
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

const systemPrompt = `Você é um especialista em qualificação de leads B2B para o mercado de clínicas de estética e saúde no Brasil.

RETORNE APENAS JSON VÁLIDO, SEM TEXTO ADICIONAL:

{
  "icp_score": 0,
  "icp_level": "descartar",
  "faturamento_score": 0,
  "faturamento_estimado": "<100k",
  "faturamento_nivel": "baixo",
  "brecha": "string curta",
  "script_video": "string curta",
  "texto_direct": "string curta",
  "justificativa": "string curta"
}

REGRAS ICP SCORE (0-3):
+1 se tem site profissional
+1 se é clínica estruturada
+1 se há marketing/tecnologia

ICP LEVELS: 0=descartar, 1=N3, 2=N2, 3=N1

FATURAMENTO SCORE (0-10):
+2 site premium
+2 estrutura robusta
+2 equipe
+1 marketing ativo
+1 serviços premium
+1 reviews
+1 localização premium

CLASSIFICAÇÃO: 8-10=>500k+, 6-7=>300-500k, 3-5=>100-300k, 0-2=><100k

IMPORTANTE:
- Retorne APENAS JSON
- Textos CURTOS (máx 100 caracteres cada)
- Sem markdown, sem explicações`;

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function analyzeOneLead(
  lead: Lead,
  apiKey: string,
  attempt: number = 1
): Promise<any> {
  try {
    console.log(`[${attempt}/${MAX_RETRIES + 1}] Analyzing: ${lead.business_name}`);

    const userPrompt = `Lead: ${lead.business_name}, ${lead.city}-${lead.uf}
Site: ${lead.website || 'não informado'}
Desc: ${lead.raw_description.substring(0, 200)}`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            role: 'user',
            parts: [{ text: systemPrompt + '\n\n' + userPrompt }]
          }],
          generationConfig: {
            temperature: 0.5,
            maxOutputTokens: 500, // VERY small to avoid MAX_TOKENS
            topP: 0.8,
          },
          safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
          ],
        }),
      }
    );

    // Handle errors
    if (response.status === 429) {
      if (attempt <= MAX_RETRIES) {
        console.log(`Rate limited, waiting ${RETRY_DELAY}ms...`);
        await sleep(RETRY_DELAY);
        return analyzeOneLead(lead, apiKey, attempt + 1);
      }
      throw new Error('Rate limit exceeded');
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API error ${response.status}:`, errorText);
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      const reason = data.candidates?.[0]?.finishReason;
      console.error(`Empty response, reason: ${reason}`);
      throw new Error(`Empty response: ${reason}`);
    }

    // Parse JSON
    const cleanText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    try {
      const result = JSON.parse(cleanText);
      console.log(`✓ Success: ${lead.business_name}`);
      return { success: true, result, lead };
    } catch {
      // Try to fix truncated JSON
      const lastBrace = cleanText.lastIndexOf('}');
      if (lastBrace > 0) {
        const fixed = cleanText.substring(0, lastBrace + 1);
        const result = JSON.parse(fixed);
        console.log(`✓ Success (fixed): ${lead.business_name}`);
        return { success: true, result, lead };
      }
      throw new Error('Invalid JSON');
    }

  } catch (error) {
    console.error(`✗ Error: ${lead.business_name} -`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      lead
    };
  }
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
      throw new Error('GOOGLE_AI_API_KEY not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`\n🚀 Simple batch analysis: ${leads.length} leads`);
    console.log(`Delay between requests: ${DELAY_BETWEEN_REQUESTS}ms`);

    const results = [];
    let successful = 0;
    let failed = 0;

    // Process ONE AT A TIME with delay
    for (let i = 0; i < leads.length; i++) {
      const lead = leads[i];

      console.log(`\n[${i + 1}/${leads.length}] Processing: ${lead.business_name}`);

      const analysis = await analyzeOneLead(lead, GOOGLE_AI_API_KEY);

      if (analysis.success) {
        successful++;
      } else {
        failed++;
      }

      // Save to database if we have session
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

        await supabase.from('leads').insert(leadData);
      }

      results.push({
        business_name: lead.business_name,
        success: analysis.success,
        ...(analysis.success ? analysis.result : { error: analysis.error }),
        ...lead
      });

      // Wait before next request (except for last one)
      if (i < leads.length - 1) {
        console.log(`Waiting ${DELAY_BETWEEN_REQUESTS}ms before next request...`);
        await sleep(DELAY_BETWEEN_REQUESTS);
      }
    }

    const successRate = leads.length > 0 ? (successful / leads.length * 100).toFixed(1) : '0.0';

    console.log(`\n✅ Complete!`);
    console.log(`Success: ${successful}, Failed: ${failed}`);
    console.log(`Success rate: ${successRate}%`);

    return new Response(
      JSON.stringify({
        total: results.length,
        successful,
        failed,
        success_rate: parseFloat(successRate),
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Batch error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

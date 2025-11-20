import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { lead } = await req.json();
    console.log('Analisando lead:', lead.business_name);

    const GOOGLE_AI_API_KEY = Deno.env.get('GOOGLE_AI_API_KEY');
    if (!GOOGLE_AI_API_KEY) {
      throw new Error('GOOGLE_AI_API_KEY não configurada');
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

    const userPrompt = `Analise este lead:

Nome: ${lead.business_name}
Cidade: ${lead.city} - ${lead.uf}
Website: ${lead.website || 'não informado'}
Endereço: ${lead.address}
Telefone: ${lead.phone || 'não informado'}
Descrição: ${lead.raw_description}
URL Maps: ${lead.maps_url}`;

    // Use Google AI Studio API directly
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GOOGLE_AI_API_KEY}`, {
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

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Erro na API Google AI:', response.status, errorText);

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Limite de taxa excedido. Tente novamente em alguns instantes.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (response.status === 403) {
        return new Response(
          JSON.stringify({ error: 'API key inválida ou sem permissão.' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      throw new Error('Erro ao chamar Google AI');
    }

    const data = await response.json();
    console.log('Resposta completa da API:', JSON.stringify(data));

    const analysisText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!analysisText) {
      console.error('Resposta vazia! Data:', JSON.stringify(data));
      console.error('Candidates:', data.candidates);
      console.error('Finish reason:', data.candidates?.[0]?.finishReason);
      throw new Error(`Resposta vazia da API. FinishReason: ${data.candidates?.[0]?.finishReason || 'unknown'}`);
    }

    console.log('Resposta da IA:', analysisText);

    // Parse o JSON da resposta
    let analysis;
    try {
      // Remove markdown code blocks se existirem
      const cleanText = analysisText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      analysis = JSON.parse(cleanText);
    } catch (parseError) {
      console.error('Erro ao fazer parse da resposta:', analysisText);
      throw new Error('Resposta da IA não está em formato JSON válido');
    }

    return new Response(
      JSON.stringify(analysis),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro na função analisar-lead:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

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

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY não configurada');
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

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Erro na API Lovable AI:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Limite de taxa excedido. Tente novamente em alguns instantes.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Créditos insuficientes. Adicione créditos na sua workspace Lovable.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      throw new Error('Erro ao chamar Lovable AI');
    }

    const data = await response.json();
    const analysisText = data.choices[0].message.content;
    
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

#!/bin/bash

# Script de Deploy da Edge Function com OpenRouter
# Execute no diretório do projeto

echo "🚀 Fazendo deploy da Edge Function analisar-batch..."
echo ""

cd "$(dirname "$0")/.."

echo "📦 Verificando se Supabase CLI está instalado..."
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI não encontrado!"
    echo "Instale com: brew install supabase/tap/supabase"
    exit 1
fi

echo "✅ Supabase CLI encontrado"
echo ""

echo "🔗 Fazendo login no Supabase..."
supabase login

echo ""
echo "📤 Fazendo deploy da função..."
supabase functions deploy analisar-batch --no-verify-jwt --project-ref bbgktklctixjlqubhajl

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Deploy concluído com sucesso!"
    echo ""
    echo "📋 Verificações finais:"
    echo "1. ✅ Código atualizado para usar OpenRouter"
    echo "2. ⏳ Secret OPENROUTER_API_KEY configurada?"
    echo "3. ⏳ Pronto para testar!"
    echo ""
    echo "🧪 Teste agora no frontend com 2-3 leads"
else
    echo ""
    echo "❌ Erro no deploy!"
    echo ""
    echo "Tente deploy manual:"
    echo "1. Copie o conteúdo de supabase/functions/analisar-batch/index.ts"
    echo "2. Cole no dashboard: https://supabase.com/dashboard/project/bbgktklctixjlqubhajl/functions/analisar-batch"
fi

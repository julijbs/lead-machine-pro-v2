#!/bin/bash

# Script para fazer deploy correto da Edge Function analisar-batch
# Lead Machine Pro - Deploy Helper

set -e  # Exit on error

echo "🚀 Lead Machine Pro - Deploy Helper"
echo "===================================="
echo ""

# Verificar se está no diretório correto
if [ ! -d "supabase/functions/analisar-batch" ]; then
    echo "❌ Erro: Execute este script da raiz do projeto"
    echo "   Diretório atual: $(pwd)"
    exit 1
fi

echo "📂 Diretório verificado: $(pwd)"
echo ""

# Verificar se Supabase CLI está instalado
if ! command -v supabase &> /dev/null; then
    echo "❌ Erro: Supabase CLI não está instalado"
    echo "   Instale com: brew install supabase/tap/supabase"
    exit 1
fi

echo "✅ Supabase CLI instalado: $(supabase --version)"
echo ""

# Verificar configuração atual da função
echo "📋 Verificando configuração da função analisar-batch:"
echo "   Arquivo: supabase/functions/analisar-batch/index.ts"
echo ""

# Extrair configurações importantes
echo "⚙️  Configurações detectadas:"
grep -A 10 "const CONFIG" supabase/functions/analisar-batch/index.ts | grep -E "(PRIMARY|FALLBACK|BASE_CONCURRENT|MAX_CONCURRENT|REQUEST_DELAY)" | head -5
echo ""

# Perguntar confirmação
read -p "🤔 Deseja fazer deploy desta função? (s/N): " confirm
if [ "$confirm" != "s" ] && [ "$confirm" != "S" ]; then
    echo "❌ Deploy cancelado pelo usuário"
    exit 0
fi

echo ""
echo "🔄 Fazendo deploy da função analisar-batch..."
echo ""

# Fazer deploy
if supabase functions deploy analisar-batch --no-verify-jwt; then
    echo ""
    echo "✅ Deploy realizado com sucesso!"
    echo ""
    echo "📊 Próximos passos:"
    echo "   1. Aguarde ~30 segundos para propagação"
    echo "   2. Teste com 5-10 leads primeiro"
    echo "   3. Verifique logs no Supabase Dashboard"
    echo ""
    echo "🔍 Para ver logs da função:"
    echo "   supabase functions logs analisar-batch"
    echo ""
else
    echo ""
    echo "❌ Erro no deploy!"
    echo ""
    echo "🔍 Possíveis causas:"
    echo "   1. Não está logado: execute 'supabase login'"
    echo "   2. Projeto não linkado: execute 'supabase link --project-ref SEU_REF'"
    echo "   3. Permissões insuficientes"
    echo ""
    echo "💡 Tente executar com --debug para mais detalhes:"
    echo "   supabase functions deploy analisar-batch --no-verify-jwt --debug"
    exit 1
fi

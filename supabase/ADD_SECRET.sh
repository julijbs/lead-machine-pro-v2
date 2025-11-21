#!/bin/bash

# Script para adicionar OPENROUTER_API_KEY no Supabase
# Execute no diretório do projeto

echo "🔐 Adicionando OPENROUTER_API_KEY ao Supabase..."

supabase secrets set OPENROUTER_API_KEY=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

if [ $? -eq 0 ]; then
    echo "✅ Secret adicionada com sucesso!"
    echo ""
    echo "📝 Próximo passo: Deploy da Edge Function"
    echo "Execute: ./DEPLOY.sh"
else
    echo "❌ Erro ao adicionar secret"
    echo "Tente adicionar manualmente pelo dashboard:"
    echo "https://supabase.com/dashboard/project/bbgktklctixjlqubhajl/settings/vault/secrets"
fi

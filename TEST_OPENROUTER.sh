#!/bin/bash

# Script para testar OpenRouter API manualmente

echo "🧪 Testando OpenRouter API..."
echo ""

API_KEY="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"

echo "📡 Fazendo request de teste..."

curl -X POST "https://openrouter.ai/api/v1/chat/completions" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -H "HTTP-Referer: https://leadmachinepro.com" \
  -H "X-Title: Lead Machine Pro" \
  -d '{
    "model": "google/gemini-2.0-flash-exp:free",
    "messages": [
      {
        "role": "user",
        "content": "Diga apenas: OK"
      }
    ],
    "max_tokens": 10
  }'

echo ""
echo ""
echo "✅ Se viu uma resposta JSON com 'choices', a API key está funcionando!"
echo "❌ Se viu erro 401/403, a API key está inválida"
echo "❌ Se viu erro 402, precisa adicionar créditos"
echo "❌ Se viu erro 429, está com rate limiting"

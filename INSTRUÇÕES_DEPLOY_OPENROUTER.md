# 🚀 Instruções de Deploy - OpenRouter Integration

## ✅ Status Atual

- [x] Código atualizado para usar OpenRouter API
- [x] API Key do OpenRouter adicionada aos secrets do Supabase
- [ ] **FALTA FAZER**: Deploy manual via dashboard

---

## 📝 Deploy Manual (Necessário)

Como o CLI não tem permissões suficientes, você precisa fazer deploy via dashboard:

### **Passo 1: Acessar o Dashboard**

Acesse: https://supabase.com/dashboard/project/bbgktklctixjlqubhajl/functions/analisar-batch

### **Passo 2: Copiar o Código**

1. Abra o arquivo: `DEPLOY_CODE_OPENROUTER.txt`
2. Selecione todo o conteúdo (Cmd+A)
3. Copie (Cmd+C)

### **Passo 3: Colar no Dashboard**

1. No dashboard do Supabase, localize o editor de código da função `analisar-batch`
2. Delete todo o código antigo
3. Cole o novo código (Cmd+V)
4. Clique em **"Deploy"** ou **"Save"**

### **Passo 4: Verificar Secrets**

Confirme que a secret `OPENROUTER_API_KEY` está configurada:

1. Vá em: https://supabase.com/dashboard/project/bbgktklctixjlqubhajl/settings/vault/secrets
2. Verifique se existe: `OPENROUTER_API_KEY` = `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`
3. Se não existir, adicione manualmente

---

## 🔍 Principais Mudanças Implementadas

### **1. Endpoint da API**
```typescript
// ANTES:
fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent...')

// DEPOIS (OpenRouter):
fetch('https://openrouter.ai/api/v1/chat/completions')
```

### **2. Modelo**
```typescript
// Usando modelo gratuito do Gemini via OpenRouter
model: 'google/gemini-2.0-flash-exp:free'
```

### **3. Formato de Request (agora compatível com OpenAI)**
```typescript
{
  messages: [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ],
  temperature: 0.7,
  max_tokens: 2048,
  response_format: { type: 'json_object' }
}
```

### **4. Parsing de Resposta**
```typescript
// ANTES (Google format):
const text = data.candidates?.[0]?.content?.parts?.[0]?.text

// DEPOIS (OpenAI format):
const text = data.choices?.[0]?.message?.content
```

### **5. Tratamento de Erros**
- Adicionado: Status 402 (créditos insuficientes)
- Mantido: Status 429 (rate limiting)
- Mantido: Status 401/403 (autenticação)

---

## 🧪 Após Deploy - Teste

### **Teste 1: Batch Pequeno (2-3 leads)**

1. Abra a aplicação frontend
2. Envie 2-3 leads para análise
3. Verifique nos logs do Supabase:
   - `Using OpenRouter API for better reliability`
   - Mensagens de sucesso para cada lead

### **Teste 2: Batch Médio (10-20 leads)**

Se o teste pequeno funcionar:
1. Envie 10-20 leads
2. Monitore a taxa de sucesso
3. Esperado: **>90% de sucesso**

---

## 🎯 Benefícios da Migração

### **Antes (Google Direct)**
- ❌ Possível bloqueio de IP
- ❌ Quota limitada (1.500/dia grátis)
- ❌ Rate limiting agressivo (60 RPM)
- ❌ Modelo deprecado (gemini-2.5-flash)

### **Depois (OpenRouter)**
- ✅ **Rotação de IPs** automática
- ✅ **Sem quota diária** (paga por uso)
- ✅ **Rate limiting gerenciado** pelo OpenRouter
- ✅ **Modelo atualizado** (gemini-2.0-flash-exp:free)
- ✅ **Fallback** para outros modelos (se necessário)
- ✅ **Custo**: ~$0.17 por 1000 leads

---

## 💰 Custos Estimados

### **Com OpenRouter (gemini-2.0-flash-exp:free)**
Atualmente usando modelo **GRATUITO** do Gemini via OpenRouter!

Se precisar migrar para modelo pago:
- Input: ~500 tokens/lead
- Output: ~300 tokens/lead
- **Custo**: ~$0.17 por 1000 leads

---

## 🐛 Troubleshooting

### **Erro: "OPENROUTER_API_KEY não configurada"**
- Verifique se a secret foi adicionada corretamente no Supabase
- Link: https://supabase.com/dashboard/project/bbgktklctixjlqubhajl/settings/vault/secrets

### **Erro: "API key inválida"**
- Confirme que a API key está correta
- Teste manualmente: https://openrouter.ai/docs/api-keys

### **Erro: "Créditos insuficientes"**
- Adicione créditos na conta OpenRouter
- Link: https://openrouter.ai/credits

### **Taxa de sucesso baixa (<50%)**
- Verifique logs no Supabase Functions
- Pode ser necessário ajustar MAX_CONCURRENT ou RETRY_DELAY_MS

---

## 📊 Monitoramento

### **Logs do Supabase**
https://supabase.com/dashboard/project/bbgktklctixjlqubhajl/functions/analisar-batch/logs

Procure por:
- `Using OpenRouter API for better reliability` ✅
- `Batch analysis complete: X successful, Y failed` ✅
- Mensagens de erro específicas ❌

### **Dashboard OpenRouter**
https://openrouter.ai/activity

Monitore:
- Número de requests
- Custos por request
- Rate limiting
- Modelos utilizados

---

## ✅ Checklist Final

Antes de testar em produção:

- [ ] Deploy do código feito via dashboard
- [ ] Secret OPENROUTER_API_KEY configurada
- [ ] Teste com 2-3 leads bem-sucedido
- [ ] Logs do Supabase mostram "Using OpenRouter API"
- [ ] Taxa de sucesso > 90%

---

## 🎉 Próximos Passos

Após validar que tudo funciona:

1. **Testar com batch grande** (50+ leads)
2. **Monitorar custos** no OpenRouter
3. **Ajustar concorrência** se necessário (MAX_CONCURRENT)
4. **Considerar modelo pago** se precisar de mais features
5. **Implementar cache** (se necessário para reduzir custos)

---

**🚀 Agora é só fazer o deploy manual e testar!**

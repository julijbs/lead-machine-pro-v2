# Teste da API Key do Gemini

## Problema Diagnosticado

Se TODOS os leads retornam "rate limit exceeded" IMEDIATAMENTE (mesmo com delay de 2s), o problema é com sua API key do Google Gemini.

## Teste 1: Verificar API Key Diretamente

Execute este comando no terminal (substitua `SUA_API_KEY`):

```bash
curl -X POST \
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=SUA_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
    "contents": [{
      "parts": [{"text": "Olá, como vai?"}]
    }]
  }'
```

### Resultado Esperado (API Key OK):

```json
{
  "candidates": [{
    "content": {
      "parts": [{"text": "Olá! Estou bem..."}]
    }
  }]
}
```

### Resultado Erro (API Key com Problema):

```json
{
  "error": {
    "code": 429,
    "message": "Resource has been exhausted (e.g. quota limit).",
    "status": "RESOURCE_EXHAUSTED"
  }
}
```

## Possíveis Causas

### 1. Quota Diária Excedida

**Gemini API Free Tier:**
- 60 requests por minuto
- **1,500 requests por dia**

**Verificar:**
1. Acesse: https://aistudio.google.com/app/apikey
2. Clique na sua API key
3. Veja "Usage" ou "Quota"
4. Se atingiu 1,500 requests hoje: aguarde 24h ou upgrade

**Solução:**
- Aguardar reset (meia-noite PST)
- OU criar nova API key
- OU fazer upgrade para tier pago

### 2. API Key Inválida ou Expirada

**Verificar:**
1. Acesse: https://aistudio.google.com/app/apikey
2. Verifique se a key está ativa
3. Status deve ser "Active"

**Solução:**
- Gerar nova API key
- Atualizar no Supabase (variável GOOGLE_AI_API_KEY)

### 3. Limite de Região

**Gemini pode não estar disponível em todas regiões.**

**Verificar:**
- Lista de regiões suportadas: https://ai.google.dev/gemini-api/docs/available-regions

**Solução:**
- Usar VPN de região suportada
- OU criar API key de conta em região suportada

### 4. Projeto Google Cloud com Limite

Se você criou a API key via Google Cloud Console:

**Verificar:**
1. Acesse: https://console.cloud.google.com/apis/api/generativelanguage.googleapis.com/quotas
2. Veja quotas do projeto
3. Pode estar limitado a 0 RPM se billing não configurado

**Solução:**
- Habilitar billing no projeto
- OU criar API key via AI Studio (não requer billing para tier free)

## Teste 2: Verificar com Postman/Insomnia

Use um cliente HTTP para testar:

**URL:**
```
POST https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=SUA_API_KEY
```

**Headers:**
```
Content-Type: application/json
```

**Body:**
```json
{
  "contents": [{
    "parts": [{"text": "Teste"}]
  }]
}
```

## Teste 3: Verificar Logs do Supabase

1. Acesse Supabase Dashboard
2. Functions → analisar-batch → Logs
3. Procure por mensagens de erro da API
4. Se aparecer "429" logo na primeira request: quota excedida

## Soluções

### Solução 1: Nova API Key (RECOMENDADO)

1. Acesse: https://aistudio.google.com/app/apikey
2. Clique "Create API Key"
3. Selecione ou crie um projeto
4. Copie a nova key
5. No Supabase:
   - Dashboard → Settings → Edge Functions
   - Secrets → Add secret
   - Nome: `GOOGLE_AI_API_KEY`
   - Valor: sua nova API key
6. Redeploy a função: `./deploy-function.sh`

### Solução 2: Aguardar Reset de Quota

- Quota reseta à meia-noite PST (Pacific Standard Time)
- Calcule horário no seu fuso
- Aguarde e teste novamente

### Solução 3: Upgrade para Tier Pago

**Gemini API Pay-as-you-go:**
- Custo muito baixo ($0.00025 per 1K chars)
- Sem limite diário
- 360 RPM (vs 60 free)

**Como:**
1. Acesse: https://aistudio.google.com/app/apikey
2. Selecione sua API key
3. "Upgrade to pay-as-you-go"
4. Configure billing

### Solução 4: Usar Modelo Diferente Temporariamente

Se Gemini não funcionar, considere:

**OpenAI GPT-3.5-turbo:**
- Mais estável
- Quota generosa
- Custo baixo

**Anthropic Claude Haiku:**
- Muito rápido
- Barato
- Confiável

(Requer modificar código da Edge Function)

## Teste 4: Verificar se Problema é Regional

Execute de um servidor em região diferente:

```bash
# Via proxy/VPN
curl --proxy socks5://proxy-us:1080 \
  -X POST \
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=SUA_API_KEY" \
  ...
```

## Checklist de Diagnóstico

```
☐ 1. Testei API key com curl (resultado?)
☐ 2. Acessei AI Studio e vi quota
☐ 3. Quota restante: _____ de 1,500
☐ 4. API key está ativa? Sim/Não
☐ 5. Região: _____ (suportada?)
☐ 6. Projeto Cloud tem billing? Sim/Não
☐ 7. Última vez que funcionou: _____
☐ 8. Quantos requests hoje: _____
```

## Próximos Passos

Baseado no resultado do teste com curl:

### Se retornar 200 OK:
→ Problema na Edge Function (improvável)
→ Verificar logs do Supabase

### Se retornar 429:
→ Quota excedida
→ Criar nova API key OU aguardar reset

### Se retornar 403:
→ API key inválida
→ Criar nova API key

### Se retornar 404:
→ Modelo não existe
→ Verificar nome do modelo

## Suporte

- Gemini API Docs: https://ai.google.dev/docs
- Support: https://support.google.com/
- Community: https://discuss.ai.google.dev/

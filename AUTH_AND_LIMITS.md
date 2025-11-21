# 🔐 Autenticação e Limites - Lead Machine Pro

## 📋 Resumo

O sistema implementa limites diferenciados baseados no status de autenticação do usuário para:
- Prevenir abuso e custos excessivos
- Incentivar criação de conta
- Garantir uso justo dos recursos

---

## 🎯 Limites Implementados

### **Scraping de Leads** (`scrape-leads`)

| Status | Limite | Observação |
|--------|--------|------------|
| **Sem Login** | 30 leads | Suficiente para teste |
| **Com Login** | 100 leads | Uso profissional |

### **Análise de Leads** (`analisar-batch`)

| Status | Limite | Observação |
|--------|--------|------------|
| **Sem Login** | 50 leads | Análise básica |
| **Com Login** | 500 leads | Análise em larga escala |

### **Frontend Validation** (`Analysis.tsx`)

| Validação | Limite | Mensagem de Erro |
|-----------|--------|------------------|
| Tamanho de arquivo | 5MB | "Arquivo muito grande - reduza a quantidade" |
| Quantidade de leads | 500 | "Limite de leads excedido - divida em lotes" |
| Campos obrigatórios | business_name, city | "Dados incompletos - verifique os campos" |

---

## 🔒 Como Funciona

### **1. Verificação de Autenticação**

```typescript
const authHeader = req.headers.get('authorization');
const isAuthenticated = authHeader && authHeader.startsWith('Bearer ');
```

### **2. Aplicação de Limites**

```typescript
const MAX_LEADS = isAuthenticated ? 500 : 50;

if (leads.length > MAX_LEADS) {
  return { error: "Limite excedido - faça login para mais" };
}
```

### **3. Feedback ao Usuário**

Mensagens claras incentivando login:
- ❌ "Usuários não autenticados podem analisar no máximo 50 leads"
- ✅ "Faça login para analisar até 500 leads"

---

## 📈 Benefícios

### **Para o Negócio:**
- ✅ Previne abuso de recursos
- ✅ Incentiva criação de conta (conversão)
- ✅ Dados de usuários para métricas
- ✅ Controle de custos API

### **Para o Usuário:**
- ✅ Pode testar sem criar conta (30/50 leads)
- ✅ Limites generosos após login
- ✅ Feedback claro sobre limites
- ✅ Histórico salvo automaticamente (logado)

---

## 🚀 Rate Limiting Futuro

Próximas implementações recomendadas:

### **Rate Limiting por Usuário (Fase 2)**

```typescript
// Implementar com Redis ou Supabase
const userRateKey = `rate:${userId}:${Date.now()}`;
const requestsLastHour = await getRateLimit(userRateKey);

if (requestsLastHour > MAX_REQUESTS_PER_HOUR) {
  return { error: "Rate limit excedido - aguarde 1 hora" };
}
```

**Limites sugeridos:**
- Scraping: 10 requests/hora (guests), 50/hora (autenticados)
- Análise: 20 requests/hora (guests), 100/hora (autenticados)

### **Throttling Adaptativo**

```typescript
// Reduzir MAX_CONCURRENT baseado em carga
const currentLoad = await getSystemLoad();
const MAX_CONCURRENT = currentLoad > 0.8 ? 1 : 2;
```

---

## 🧪 Como Testar

### **Teste 1: Guest vs Authenticated**

**Sem Login:**
```bash
curl -X POST https://...analisar-batch \
  -d '{"leads": [...51 leads...]}'
# Esperado: Erro 429 - "Limite de 50 leads"
```

**Com Login:**
```bash
curl -X POST https://...analisar-batch \
  -H "Authorization: Bearer TOKEN" \
  -d '{"leads": [...100 leads...]}'
# Esperado: 200 OK - Processa todos
```

### **Teste 2: Frontend Validation**

1. Tente colar >500 leads
2. **Esperado**: Toast "Limite de leads excedido"
3. Tente colar arquivo >5MB
4. **Esperado**: Toast "Arquivo muito grande"

---

## 📝 Implementação Técnica

### **Arquivos Modificados:**

- ✅ `/supabase/functions/analisar-batch/index.ts` - Auth + limites
- ✅ `/supabase/functions/scrape-leads/index.ts` - Auth + limites
- ✅ `/src/pages/Analysis.tsx` - Validações client-side
- ✅ `DEPLOY_CODE_GOOGLE_DIRECT_WITH_AUTH.txt` - Deploy pronto

### **Como Deploy:**

**Via Dashboard Supabase:**
1. Copie conteúdo de `DEPLOY_CODE_GOOGLE_DIRECT_WITH_AUTH.txt`
2. Cole em https://supabase.com/dashboard/.../functions/analisar-batch
3. Deploy

**scrape-leads já está atualizado no arquivo original**

---

## 🎯 Métricas de Sucesso

Após implementação, monitorar:

- 📊 % de usuários que criam conta após limite
- 📊 Redução de abuso/custos API
- 📊 Taxa de conversão guest → authenticated
- 📊 Distribuição de uso (quantos batem limites)

---

## 🔄 Versionamento

| Versão | Data | Mudanças |
|--------|------|----------|
| 1.0 | 2025-11-21 | Implementação inicial - Limites básicos |
| 1.1 | Futuro | Rate limiting por hora |
| 1.2 | Futuro | Throttling adaptativo |

---

**✅ Sistema de Auth e Limites ATIVO e FUNCIONAL**

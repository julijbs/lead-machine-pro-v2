# Deploy Instructions - Lead Machine Pro

## Pré-requisitos

1. Conta no Supabase (https://supabase.com)
2. Conta no Netlify (https://netlify.com)
3. Supabase CLI instalado (`npm install -g supabase`)
4. Node.js 18+ instalado
5. API Key do Google AI Studio

## Passo 1: Configurar Supabase

### 1.1 Login no Supabase CLI
```bash
supabase login
```

### 1.2 Vincular ao projeto
```bash
cd /Users/julianabarcellos/Documents/GitHub/lead-machine-pro
supabase link --project-ref sitlneuatboibajcczto
```

### 1.3 Aplicar migrações do banco de dados
```bash
supabase db push
```

Isso vai criar:
- Tabela `profiles` (usuários)
- Tabela `analysis_sessions` (sessões de análise)
- Tabela `leads` (leads com análises)
- Row Level Security (RLS) policies
- Triggers para atualização automática

### 1.4 Configurar Secrets das Edge Functions
```bash
# Para a análise de leads com Google Gemini (obrigatório)
supabase secrets set GOOGLE_AI_API_KEY=sua_chave_google_ai_aqui

# Para scraping real com Google Places (opcional - usa mock sem ela)
supabase secrets set GOOGLE_PLACES_API_KEY=sua_chave_google_places_aqui
```

### 1.5 Deploy das Edge Functions
```bash
supabase functions deploy scrape-leads
supabase functions deploy analisar-lead
supabase functions deploy analisar-batch
```

## Passo 2: Configurar Autenticação

No Supabase Dashboard:

1. Vá em **Authentication > Providers**
2. Habilite **Email** provider
3. Configure **Email Templates** para português (opcional)
4. Em **URL Configuration**, adicione o domínio do Netlify

## Passo 3: Deploy no Netlify

### 3.1 Conectar Repositório

1. Acesse https://app.netlify.com
2. Clique em "Add new site" > "Import an existing project"
3. Conecte ao GitHub e selecione `lead-machine-pro`
4. Configure:
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`

### 3.2 Variáveis de Ambiente no Netlify

Em Site Settings > Environment Variables, adicione:

```
VITE_SUPABASE_PROJECT_ID=sitlneuatboibajcczto
VITE_SUPABASE_URL=https://sitlneuatboibajcczto.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sua_anon_key_aqui
```

### 3.3 Deploy

Clique em "Deploy site" - o deploy será automático a cada push no repositório.

## Passo 4: Obter API Keys

### Google AI Studio (Gemini) - Obrigatório
1. Acesse https://aistudio.google.com/
2. Clique em "Get API Key" no menu lateral
3. Selecione ou crie um projeto do Google Cloud
4. Copie a API Key gerada
5. Configure no Supabase: `supabase secrets set GOOGLE_AI_API_KEY=sua_chave`

### Google Places API - Opcional
Para usar scraping real em vez de mock data:

1. Acesse https://console.cloud.google.com
2. Crie um projeto ou use existente
3. Habilite as APIs:
   - Places API
   - Geocoding API
4. Crie uma API Key em Credentials
5. Configure no Supabase: `supabase secrets set GOOGLE_PLACES_API_KEY=sua_chave`

## Testando

### Testes Unitários
```bash
npm run test:run
```

### Teste Manual
1. Acesse o site no Netlify
2. Crie uma conta em `/auth`
3. Vá para `/scraper` e gere alguns leads
4. Copie o JSON dos leads
5. Vá para `/analysis` e cole o JSON
6. Execute a análise
7. Verifique o histórico em `/history`

## Performance

Com as melhorias implementadas:

- **Antes**: 600 leads = ~30+ minutos (sequencial, 1 por vez)
- **Depois**: 600 leads = ~3-5 minutos (batch de 50, 5 concurrent)

A nova arquitetura:
- Processa 50 leads por batch
- 5 chamadas de API simultâneas
- Retry automático com backoff exponencial
- Persiste resultados no banco automaticamente
- Permite pausar e retomar análises

## Secrets Necessários no Supabase

| Secret | Obrigatório | Descrição |
|--------|-------------|-----------|
| `GOOGLE_AI_API_KEY` | Sim | Chave do Google AI Studio para Gemini 1.5 Flash |
| `GOOGLE_PLACES_API_KEY` | Não | Chave do Google Places API (scraping real) |

## Troubleshooting

### Erro 403 na análise
API key inválida ou sem permissão. Verifique se a key está correta.

### Erro 429 na análise
Rate limit excedido. O sistema já faz retry automático, mas pode ajustar `MAX_CONCURRENT` em `analisar-batch/index.ts`.

### Leads não salvam
Verifique se:
1. Está logado
2. As migrações foram aplicadas (`supabase db push`)
3. O usuário existe na tabela `profiles`

### Autenticação não funciona
Verifique se:
1. Email provider está habilitado no Supabase
2. As URLs estão configuradas corretamente
3. O projeto está vinculado corretamente

### Build falha no Netlify
Verifique se:
1. Todas as variáveis de ambiente estão configuradas
2. Node version está correta (18+)
3. `npm run build` funciona localmente

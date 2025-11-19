# Lead Machine Pro

Plataforma de geração e qualificação de leads com IA para clínicas de estética e saúde.

**Desenvolvido por JB Digital Consulting**

## Funcionalidades

- **Scraper de Leads**: Busca leads do Google Places API com dados completos
- **Análise com IA**: Qualificação ICP (N1-N3) e estimativa de faturamento usando Google Gemini
- **Histórico**: Salva análises anteriores com possibilidade de retomar
- **Export CSV**: Exporta resultados para planilhas

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **UI**: shadcn/ui + Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Edge Functions)
- **IA**: Google Gemini 1.5 Flash
- **Deploy**: Netlify

## Instalação Local

```bash
# Clone o repositório
git clone https://github.com/julijbs/lead-machine-pro.git
cd lead-machine-pro

# Instale as dependências
npm install

# Configure as variáveis de ambiente
cp .env.example .env
# Edite o .env com suas credenciais

# Inicie o servidor de desenvolvimento
npm run dev
```

## Deploy

### Netlify

1. Conecte seu repositório ao Netlify
2. Configure as variáveis de ambiente:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
3. Deploy automático a cada push

### Supabase

```bash
# Login
supabase login

# Link ao projeto
supabase link --project-ref seu_project_id

# Aplicar migrações
supabase db push

# Configurar secrets
supabase secrets set GOOGLE_AI_API_KEY=sua_chave_aqui
supabase secrets set GOOGLE_PLACES_API_KEY=sua_chave_aqui

# Deploy das functions
supabase functions deploy
```

## Variáveis de Ambiente

### Frontend (.env)
```
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJ...
```

### Supabase Secrets
```
GOOGLE_AI_API_KEY=       # Google AI Studio API Key (obrigatório)
GOOGLE_PLACES_API_KEY=   # Google Places API Key (opcional - usa mock sem ela)
```

## Como obter as API Keys

### Google AI Studio (Gemini)
1. Acesse https://aistudio.google.com/
2. Clique em "Get API Key"
3. Crie ou selecione um projeto
4. Copie a API Key

### Google Places API
1. Acesse https://console.cloud.google.com
2. Crie um projeto
3. Habilite: Places API, Geocoding API
4. Crie uma API Key em Credentials

## Testes

```bash
npm run test        # Watch mode
npm run test:run    # Single run
```

## Licença

Proprietário - JB Digital Consulting

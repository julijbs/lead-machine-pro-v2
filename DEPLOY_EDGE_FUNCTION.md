# Como Fazer Deploy da Edge Function

## Problema
Edge Functions do Supabase **NÃO são deployadas automaticamente via Git push**.
Elas precisam ser deployadas manualmente via Supabase CLI.

## Solução: Deploy Manual

### 1. Login no Supabase CLI

```bash
cd ~/Documents/GitHub/lead-machine-pro
supabase login
```

Isso abrirá seu navegador para autenticação. Siga as instruções.

### 2. Link ao Projeto (se necessário)

Se ainda não linkado:

```bash
supabase link --project-ref SEU_PROJECT_REF
```

Para encontrar seu `PROJECT_REF`:
- Acesse Supabase Dashboard
- URL será: `https://supabase.com/dashboard/project/[PROJECT_REF]`
- Copie o PROJECT_REF da URL

### 3. Deploy da Edge Function

```bash
supabase functions deploy analisar-batch --no-verify-jwt
```

Esse comando:
- Faz upload do código de `supabase/functions/analisar-batch/`
- Deploya no Supabase
- Torna a função disponível imediatamente

### 4. Verificar Deploy

Após deploy bem-sucedido, você verá:

```
Deployed Function analisar-batch on project [PROJECT_REF]
Function URL: https://[PROJECT_REF].supabase.co/functions/v1/analisar-batch
```

### 5. Testar

Acesse:
```
https://lead-machine-pro.netlify.app/analysis
```

Cole seus leads e teste!

## Alternativa: Deploy via Dashboard

Se preferir usar interface gráfica:

1. Acesse Supabase Dashboard → Functions
2. Clique em "analisar-batch"
3. Clique em "Deploy"
4. Cole o conteúdo de `supabase/functions/analisar-batch/index.ts`
5. Clique em "Deploy Function"

## Comandos Úteis

```bash
# Listar functions deployadas
supabase functions list

# Ver logs da function
supabase functions logs analisar-batch

# Testar localmente antes de deploy
supabase functions serve analisar-batch
```

## Troubleshooting

### "Access token not provided"
Execute: `supabase login`

### "Project ref is required"
Execute: `supabase link --project-ref SEU_PROJECT_REF`

### Function não encontrada no dashboard
Verifique se o deploy foi bem-sucedido com:
```bash
supabase functions list
```

#!/bin/bash

# Configuration
# Replace these with your actual values
SUPABASE_URL="YOUR_SUPABASE_URL" # e.g., https://xyz.supabase.co
ANON_KEY="YOUR_ANON_KEY"

echo "Testing 'analisar-batch' function..."

curl -i --location --request POST "${SUPABASE_URL}/functions/v1/analisar-batch" \
  --header "Authorization: Bearer ${ANON_KEY}" \
  --header "Content-Type: application/json" \
  --data '{
    "leads": [
      {
        "business_name": "Clínica Teste",
        "city": "São Paulo",
        "uf": "SP",
        "raw_description": "Clínica de estética avançada"
      }
    ]
  }'

echo -e "\n\nDone."

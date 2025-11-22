-- Add new columns for "Vital Signs" and "Technical Verification"

ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS quebra_gelo text,
ADD COLUMN IF NOT EXISTS sinais_vitais jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS has_pixel boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS site_tech text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS instagram text;

-- Optional: Add comment to explain columns
COMMENT ON COLUMN leads.sinais_vitais IS 'Stores JSON with flags: tem_login, ticket_medio_alto, custo_fixo_alto';
COMMENT ON COLUMN leads.site_tech IS 'Array of detected technologies (WordPress, HubSpot, etc)';

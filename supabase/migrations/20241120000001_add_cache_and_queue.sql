-- Migration: Add cache and queue system for lead analysis
-- Created: 2024-11-20

-- Create lead_cache table for caching analysis results
CREATE TABLE lead_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Cache key (hash of business data)
  cache_key TEXT NOT NULL UNIQUE,

  -- Business identifier
  business_name TEXT NOT NULL,
  maps_url TEXT,
  website TEXT,

  -- Cached analysis results
  icp_score INTEGER,
  icp_level icp_level,
  faturamento_score INTEGER,
  faturamento_estimado TEXT,
  faturamento_nivel faturamento_nivel,
  brecha TEXT,
  script_video TEXT,
  texto_direct TEXT,
  justificativa TEXT,

  -- Cache metadata
  hit_count INTEGER DEFAULT 0,
  last_hit_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '30 days')
);

-- Create processing_queue table for async job processing
CREATE TABLE processing_queue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES analysis_sessions(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,

  -- Queue status
  status TEXT DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
  priority INTEGER DEFAULT 0,

  -- Lead data (JSON)
  lead_data JSONB NOT NULL,

  -- Processing metadata
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 5,
  last_error TEXT,
  last_attempt_at TIMESTAMP WITH TIME ZONE,

  -- Model fallback tracking
  model_used TEXT,
  fallback_attempted BOOLEAN DEFAULT false,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Create rate_limiting_stats table for dynamic rate limiting
CREATE TABLE rate_limiting_stats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Time window
  window_start TIMESTAMP WITH TIME ZONE NOT NULL,
  window_end TIMESTAMP WITH TIME ZONE NOT NULL,

  -- Stats
  total_requests INTEGER DEFAULT 0,
  successful_requests INTEGER DEFAULT 0,
  failed_requests INTEGER DEFAULT 0,
  rate_limit_errors INTEGER DEFAULT 0,
  server_error_503 INTEGER DEFAULT 0,
  avg_response_time_ms INTEGER,

  -- Current rate limit (requests per minute)
  current_rps INTEGER DEFAULT 5,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_lead_cache_cache_key ON lead_cache(cache_key);
CREATE INDEX idx_lead_cache_expires_at ON lead_cache(expires_at);
CREATE INDEX idx_lead_cache_business_name ON lead_cache(business_name);

CREATE INDEX idx_processing_queue_status ON processing_queue(status);
CREATE INDEX idx_processing_queue_session_id ON processing_queue(session_id);
CREATE INDEX idx_processing_queue_priority ON processing_queue(priority DESC);
CREATE INDEX idx_processing_queue_created_at ON processing_queue(created_at);

CREATE INDEX idx_rate_limiting_stats_window_start ON rate_limiting_stats(window_start DESC);

-- Function to generate cache key from lead data
CREATE OR REPLACE FUNCTION generate_cache_key(
  p_business_name TEXT,
  p_city TEXT,
  p_uf TEXT,
  p_website TEXT
) RETURNS TEXT AS $$
BEGIN
  -- Create a hash from normalized business identifiers
  RETURN encode(
    digest(
      LOWER(TRIM(COALESCE(p_business_name, ''))) || '|' ||
      LOWER(TRIM(COALESCE(p_city, ''))) || '|' ||
      LOWER(TRIM(COALESCE(p_uf, ''))) || '|' ||
      LOWER(TRIM(COALESCE(p_website, ''))),
      'sha256'
    ),
    'hex'
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to get or create cached analysis
CREATE OR REPLACE FUNCTION get_cached_analysis(
  p_business_name TEXT,
  p_city TEXT,
  p_uf TEXT,
  p_website TEXT
) RETURNS TABLE (
  icp_score INTEGER,
  icp_level icp_level,
  faturamento_score INTEGER,
  faturamento_estimado TEXT,
  faturamento_nivel faturamento_nivel,
  brecha TEXT,
  script_video TEXT,
  texto_direct TEXT,
  justificativa TEXT
) AS $$
DECLARE
  v_cache_key TEXT;
BEGIN
  -- Generate cache key
  v_cache_key := generate_cache_key(p_business_name, p_city, p_uf, p_website);

  -- Try to get from cache and update hit count
  RETURN QUERY
  UPDATE lead_cache
  SET
    hit_count = hit_count + 1,
    last_hit_at = NOW()
  WHERE cache_key = v_cache_key
    AND expires_at > NOW()
  RETURNING
    lead_cache.icp_score,
    lead_cache.icp_level,
    lead_cache.faturamento_score,
    lead_cache.faturamento_estimado,
    lead_cache.faturamento_nivel,
    lead_cache.brecha,
    lead_cache.script_video,
    lead_cache.texto_direct,
    lead_cache.justificativa;
END;
$$ LANGUAGE plpgsql;

-- Function to save analysis to cache
CREATE OR REPLACE FUNCTION save_to_cache(
  p_business_name TEXT,
  p_city TEXT,
  p_uf TEXT,
  p_website TEXT,
  p_maps_url TEXT,
  p_icp_score INTEGER,
  p_icp_level icp_level,
  p_faturamento_score INTEGER,
  p_faturamento_estimado TEXT,
  p_faturamento_nivel faturamento_nivel,
  p_brecha TEXT,
  p_script_video TEXT,
  p_texto_direct TEXT,
  p_justificativa TEXT
) RETURNS UUID AS $$
DECLARE
  v_cache_key TEXT;
  v_id UUID;
BEGIN
  -- Generate cache key
  v_cache_key := generate_cache_key(p_business_name, p_city, p_uf, p_website);

  -- Insert or update cache
  INSERT INTO lead_cache (
    cache_key,
    business_name,
    maps_url,
    website,
    icp_score,
    icp_level,
    faturamento_score,
    faturamento_estimado,
    faturamento_nivel,
    brecha,
    script_video,
    texto_direct,
    justificativa
  ) VALUES (
    v_cache_key,
    p_business_name,
    p_maps_url,
    p_website,
    p_icp_score,
    p_icp_level,
    p_faturamento_score,
    p_faturamento_estimado,
    p_faturamento_nivel,
    p_brecha,
    p_script_video,
    p_texto_direct,
    p_justificativa
  )
  ON CONFLICT (cache_key)
  DO UPDATE SET
    icp_score = EXCLUDED.icp_score,
    icp_level = EXCLUDED.icp_level,
    faturamento_score = EXCLUDED.faturamento_score,
    faturamento_estimado = EXCLUDED.faturamento_estimado,
    faturamento_nivel = EXCLUDED.faturamento_nivel,
    brecha = EXCLUDED.brecha,
    script_video = EXCLUDED.script_video,
    texto_direct = EXCLUDED.texto_direct,
    justificativa = EXCLUDED.justificativa,
    expires_at = NOW() + INTERVAL '30 days'
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- Function to clean expired cache entries
CREATE OR REPLACE FUNCTION clean_expired_cache() RETURNS INTEGER AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  DELETE FROM lead_cache
  WHERE expires_at < NOW();

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get next queue item for processing
CREATE OR REPLACE FUNCTION get_next_queue_item()
RETURNS TABLE (
  id UUID,
  session_id UUID,
  user_id UUID,
  lead_data JSONB,
  attempts INTEGER
) AS $$
BEGIN
  RETURN QUERY
  UPDATE processing_queue
  SET
    status = 'processing',
    started_at = NOW(),
    attempts = attempts + 1,
    last_attempt_at = NOW()
  WHERE processing_queue.id = (
    SELECT processing_queue.id
    FROM processing_queue
    WHERE status = 'queued'
      AND attempts < max_attempts
    ORDER BY priority DESC, created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING
    processing_queue.id,
    processing_queue.session_id,
    processing_queue.user_id,
    processing_queue.lead_data,
    processing_queue.attempts;
END;
$$ LANGUAGE plpgsql;

-- Enable RLS on new tables
ALTER TABLE lead_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE processing_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limiting_stats ENABLE ROW LEVEL SECURITY;

-- RLS policies for lead_cache (public read for efficiency)
CREATE POLICY "Anyone can read cache"
  ON lead_cache FOR SELECT
  USING (true);

-- RLS policies for processing_queue
CREATE POLICY "Users can view their own queue items"
  ON processing_queue FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own queue items"
  ON processing_queue FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own queue items"
  ON processing_queue FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS policies for rate_limiting_stats (service role only)
CREATE POLICY "Service role can manage rate limiting stats"
  ON rate_limiting_stats FOR ALL
  USING (true);

-- Add new column to leads table for cache tracking
ALTER TABLE leads ADD COLUMN IF NOT EXISTS from_cache BOOLEAN DEFAULT false;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS cache_hit_at TIMESTAMP WITH TIME ZONE;

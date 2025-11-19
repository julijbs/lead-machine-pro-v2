-- Enable UUID extension (using pgcrypto for gen_random_uuid)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create enum types
CREATE TYPE icp_level AS ENUM ('N1', 'N2', 'N3', 'descartar');
CREATE TYPE faturamento_nivel AS ENUM ('baixo', 'médio', 'alto', 'premium');
CREATE TYPE analysis_status AS ENUM ('pending', 'processing', 'completed', 'error');

-- Create profiles table (extends auth.users)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create analysis_sessions table
CREATE TABLE analysis_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  total_leads INTEGER DEFAULT 0,
  processed_leads INTEGER DEFAULT 0,
  successful_leads INTEGER DEFAULT 0,
  failed_leads INTEGER DEFAULT 0,
  status analysis_status DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Create leads table
CREATE TABLE leads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES analysis_sessions(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,

  -- Original lead data
  source TEXT,
  business_name TEXT NOT NULL,
  maps_url TEXT,
  website TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  uf TEXT,
  raw_description TEXT,
  status_processamento TEXT,

  -- Analysis results
  icp_score INTEGER,
  icp_level icp_level,
  faturamento_score INTEGER,
  faturamento_estimado TEXT,
  faturamento_nivel faturamento_nivel,
  brecha TEXT,
  script_video TEXT,
  texto_direct TEXT,
  justificativa TEXT,

  -- Processing metadata
  analysis_status analysis_status DEFAULT 'pending',
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  analyzed_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for better query performance
CREATE INDEX idx_leads_session_id ON leads(session_id);
CREATE INDEX idx_leads_user_id ON leads(user_id);
CREATE INDEX idx_leads_analysis_status ON leads(analysis_status);
CREATE INDEX idx_leads_icp_level ON leads(icp_level);
CREATE INDEX idx_leads_faturamento_nivel ON leads(faturamento_nivel);
CREATE INDEX idx_analysis_sessions_user_id ON analysis_sessions(user_id);
CREATE INDEX idx_analysis_sessions_status ON analysis_sessions(status);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE analysis_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Analysis sessions policies
CREATE POLICY "Users can view their own sessions"
  ON analysis_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own sessions"
  ON analysis_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sessions"
  ON analysis_sessions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sessions"
  ON analysis_sessions FOR DELETE
  USING (auth.uid() = user_id);

-- Leads policies
CREATE POLICY "Users can view their own leads"
  ON leads FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own leads"
  ON leads FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own leads"
  ON leads FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own leads"
  ON leads FOR DELETE
  USING (auth.uid() = user_id);

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update session statistics
CREATE OR REPLACE FUNCTION update_session_stats()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE analysis_sessions
  SET
    processed_leads = (
      SELECT COUNT(*) FROM leads
      WHERE session_id = COALESCE(NEW.session_id, OLD.session_id)
      AND analysis_status IN ('completed', 'error')
    ),
    successful_leads = (
      SELECT COUNT(*) FROM leads
      WHERE session_id = COALESCE(NEW.session_id, OLD.session_id)
      AND analysis_status = 'completed'
    ),
    failed_leads = (
      SELECT COUNT(*) FROM leads
      WHERE session_id = COALESCE(NEW.session_id, OLD.session_id)
      AND analysis_status = 'error'
    ),
    updated_at = NOW(),
    status = CASE
      WHEN (SELECT COUNT(*) FROM leads WHERE session_id = COALESCE(NEW.session_id, OLD.session_id) AND analysis_status = 'pending') > 0
        OR (SELECT COUNT(*) FROM leads WHERE session_id = COALESCE(NEW.session_id, OLD.session_id) AND analysis_status = 'processing') > 0
      THEN 'processing'::analysis_status
      ELSE 'completed'::analysis_status
    END,
    completed_at = CASE
      WHEN (SELECT COUNT(*) FROM leads WHERE session_id = COALESCE(NEW.session_id, OLD.session_id) AND analysis_status IN ('pending', 'processing')) = 0
      THEN NOW()
      ELSE NULL
    END
  WHERE id = COALESCE(NEW.session_id, OLD.session_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update session stats when lead status changes
CREATE TRIGGER on_lead_status_change
  AFTER INSERT OR UPDATE OF analysis_status ON leads
  FOR EACH ROW EXECUTE FUNCTION update_session_stats();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_analysis_sessions_updated_at
  BEFORE UPDATE ON analysis_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

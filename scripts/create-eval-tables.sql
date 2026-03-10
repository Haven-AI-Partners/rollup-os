-- Create eval_runs and eval_iterations tables for consistency evals

CREATE TABLE IF NOT EXISTS eval_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_slug TEXT NOT NULL,
  file_id UUID NOT NULL REFERENCES files(id),
  file_name TEXT NOT NULL,
  iterations INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'running',
  score_variance JSONB,
  overall_score_std_dev NUMERIC,
  flag_agreement_rate NUMERIC,
  name_consistent TEXT,
  error TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS eval_iterations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  eval_run_id UUID NOT NULL REFERENCES eval_runs(id) ON DELETE CASCADE,
  iteration INTEGER NOT NULL,
  company_name TEXT,
  overall_score NUMERIC,
  scores JSONB,
  red_flag_ids JSONB,
  info_gap_ids JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

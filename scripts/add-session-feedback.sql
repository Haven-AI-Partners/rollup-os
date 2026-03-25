-- Add feedback columns to discovery_sessions
ALTER TABLE discovery_sessions ADD COLUMN IF NOT EXISTS feedback_rating integer;
ALTER TABLE discovery_sessions ADD COLUMN IF NOT EXISTS feedback_tags jsonb;
ALTER TABLE discovery_sessions ADD COLUMN IF NOT EXISTS feedback_comment text;
ALTER TABLE discovery_sessions ADD COLUMN IF NOT EXISTS feedback_at timestamptz;
ALTER TABLE discovery_sessions ADD COLUMN IF NOT EXISTS prompt_version_id uuid;

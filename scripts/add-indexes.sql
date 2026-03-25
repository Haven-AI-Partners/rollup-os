-- Performance indexes for frequently queried FK columns
-- Run against your Supabase DB via the SQL Editor

-- deal_red_flags
CREATE INDEX IF NOT EXISTS idx_red_flags_deal ON deal_red_flags (deal_id);
CREATE INDEX IF NOT EXISTS idx_red_flags_deal_resolved ON deal_red_flags (deal_id, resolved, severity);

-- deal_tasks
CREATE INDEX IF NOT EXISTS idx_tasks_deal ON deal_tasks (deal_id);
CREATE INDEX IF NOT EXISTS idx_tasks_deal_status ON deal_tasks (deal_id, status);

-- deal_activity_log
CREATE INDEX IF NOT EXISTS idx_activity_deal ON deal_activity_log (deal_id);
CREATE INDEX IF NOT EXISTS idx_activity_deal_ts ON deal_activity_log (deal_id, created_at);

-- files
CREATE INDEX IF NOT EXISTS idx_files_gdrive ON files (gdrive_file_id);
CREATE INDEX IF NOT EXISTS idx_files_portco_status ON files (portco_id, processing_status);

-- deals
CREATE INDEX IF NOT EXISTS idx_deals_portco_status ON deals (portco_id, status);
CREATE INDEX IF NOT EXISTS idx_deals_portco_stage ON deals (portco_id, stage_id);

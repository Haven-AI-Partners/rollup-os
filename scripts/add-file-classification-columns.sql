-- Add columns for recursive GDrive scanning and file classification

-- Make dealId nullable (files can be discovered before matching to a deal)
ALTER TABLE files ALTER COLUMN deal_id DROP NOT NULL;

-- Folder breadcrumb path (e.g. "Root/CompanyA/DD/Financial")
ALTER TABLE files ADD COLUMN IF NOT EXISTS gdrive_parent_path TEXT;

-- Who classified the file type: 'auto' (LLM) or 'manual' (user)
ALTER TABLE files ADD COLUMN IF NOT EXISTS classified_by TEXT;

-- LLM classification confidence (0-1 as text)
ALTER TABLE files ADD COLUMN IF NOT EXISTS classification_confidence TEXT;

ALTER TABLE "files" ADD COLUMN IF NOT EXISTS "suggested_company_name" text;--> statement-breakpoint
ALTER TABLE "files" ADD COLUMN IF NOT EXISTS "classification_tier" text;--> statement-breakpoint
ALTER TABLE "company_profiles" ADD COLUMN IF NOT EXISTS "external_enrichment" jsonb;--> statement-breakpoint
ALTER TABLE "company_profiles" ADD COLUMN IF NOT EXISTS "source_attributions" jsonb;--> statement-breakpoint
ALTER TABLE "company_profiles" ADD COLUMN IF NOT EXISTS "raw_content_extraction" jsonb;--> statement-breakpoint
ALTER TABLE "company_profiles" ADD COLUMN IF NOT EXISTS "pipeline_version" text DEFAULT 'v1';
ALTER TABLE "files" ADD COLUMN "suggested_company_name" text;--> statement-breakpoint
ALTER TABLE "files" ADD COLUMN "classification_tier" text;--> statement-breakpoint
ALTER TABLE "company_profiles" ADD COLUMN "external_enrichment" jsonb;--> statement-breakpoint
ALTER TABLE "company_profiles" ADD COLUMN "source_attributions" jsonb;--> statement-breakpoint
ALTER TABLE "company_profiles" ADD COLUMN "raw_content_extraction" jsonb;--> statement-breakpoint
ALTER TABLE "company_profiles" ADD COLUMN "pipeline_version" text DEFAULT 'v1';
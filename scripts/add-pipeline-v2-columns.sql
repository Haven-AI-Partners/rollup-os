-- Add pipeline v2 columns to company_profiles
ALTER TABLE "company_profiles" ADD COLUMN IF NOT EXISTS "external_enrichment" jsonb;
ALTER TABLE "company_profiles" ADD COLUMN IF NOT EXISTS "source_attributions" jsonb;
ALTER TABLE "company_profiles" ADD COLUMN IF NOT EXISTS "pipeline_version" text DEFAULT 'v1';
ALTER TABLE "company_profiles" ADD COLUMN IF NOT EXISTS "generated_at" timestamp with time zone;
ALTER TABLE "company_profiles" ADD COLUMN IF NOT EXISTS "model_version" text;

-- Add file_extractions table if not exists
CREATE TABLE IF NOT EXISTS "file_extractions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "file_id" uuid UNIQUE NOT NULL REFERENCES "files"("id") ON DELETE CASCADE,
  "content_extraction" jsonb NOT NULL,
  "translation" jsonb,
  "extraction_model" text,
  "translation_model" text,
  "pipeline_version" text DEFAULT 'v2',
  "extracted_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

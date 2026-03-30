CREATE TABLE "file_extractions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_id" uuid NOT NULL,
	"content_extraction" jsonb NOT NULL,
	"translation" jsonb,
	"extraction_model" text,
	"translation_model" text,
	"pipeline_version" text DEFAULT 'v2',
	"extracted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "file_extractions_file_id_unique" UNIQUE("file_id")
);
--> statement-breakpoint
ALTER TABLE "file_extractions" ADD CONSTRAINT "file_extractions_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_profiles" DROP COLUMN "raw_content_extraction";
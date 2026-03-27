CREATE TABLE "gdrive_file_cache" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"portco_id" uuid NOT NULL,
	"gdrive_file_id" text NOT NULL,
	"file_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" bigint,
	"modified_time" timestamp with time zone,
	"web_view_link" text,
	"parent_path" text DEFAULT '' NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "gdrive_file_cache" ADD CONSTRAINT "gdrive_file_cache_portco_id_portcos_id_fk" FOREIGN KEY ("portco_id") REFERENCES "public"."portcos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_gdrive_cache_portco_file" ON "gdrive_file_cache" USING btree ("portco_id","gdrive_file_id");--> statement-breakpoint
CREATE INDEX "idx_gdrive_cache_portco_mime" ON "gdrive_file_cache" USING btree ("portco_id","mime_type");--> statement-breakpoint
CREATE INDEX "idx_gdrive_cache_portco_seen" ON "gdrive_file_cache" USING btree ("portco_id","last_seen_at");
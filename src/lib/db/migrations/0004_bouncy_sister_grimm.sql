CREATE TABLE "gdrive_scan_folders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"portco_id" uuid NOT NULL,
	"gdrive_folder_id" text NOT NULL,
	"parent_path" text DEFAULT '' NOT NULL,
	"depth" integer DEFAULT 0 NOT NULL,
	"last_scanned_at" timestamp with time zone,
	"scan_generation" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "portcos" ADD COLUMN "gdrive_scan_generation" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "portcos" ADD COLUMN "gdrive_last_complete_scan_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "gdrive_scan_folders" ADD CONSTRAINT "gdrive_scan_folders_portco_id_portcos_id_fk" FOREIGN KEY ("portco_id") REFERENCES "public"."portcos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_gdrive_scan_folders_portco_folder" ON "gdrive_scan_folders" USING btree ("portco_id","gdrive_folder_id");--> statement-breakpoint
CREATE INDEX "idx_gdrive_scan_folders_portco_scanned" ON "gdrive_scan_folders" USING btree ("portco_id","last_scanned_at");
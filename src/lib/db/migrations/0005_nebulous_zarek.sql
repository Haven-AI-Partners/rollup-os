CREATE TABLE "gdrive_api_errors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"portco_id" uuid NOT NULL,
	"http_status" integer NOT NULL,
	"context" text NOT NULL,
	"attempt" integer NOT NULL,
	"exhausted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "gdrive_api_errors" ADD CONSTRAINT "gdrive_api_errors_portco_id_portcos_id_fk" FOREIGN KEY ("portco_id") REFERENCES "public"."portcos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_gdrive_api_errors_portco_created" ON "gdrive_api_errors" USING btree ("portco_id","created_at");
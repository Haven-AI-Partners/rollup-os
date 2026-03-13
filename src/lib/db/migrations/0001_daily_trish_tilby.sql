CREATE TABLE "org_chart_nodes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version_id" uuid NOT NULL,
	"parent_id" uuid,
	"name" text NOT NULL,
	"title" text,
	"department" text,
	"role" text,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "org_chart_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deal_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"label" text,
	"is_active" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "eval_iterations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"eval_run_id" uuid NOT NULL,
	"iteration" integer NOT NULL,
	"company_name" text,
	"overall_score" numeric,
	"scores" jsonb,
	"red_flag_ids" jsonb,
	"info_gap_ids" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "eval_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_slug" text NOT NULL,
	"file_id" uuid NOT NULL,
	"file_name" text NOT NULL,
	"iterations" integer NOT NULL,
	"prompt_version_id" uuid,
	"prompt_version_label" text,
	"model_id" text,
	"status" text DEFAULT 'running' NOT NULL,
	"score_variance" jsonb,
	"overall_score_std_dev" numeric,
	"flag_agreement_rate" numeric,
	"name_consistent" text,
	"error" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "currency" text DEFAULT 'JPY';--> statement-breakpoint
ALTER TABLE "org_chart_nodes" ADD CONSTRAINT "org_chart_nodes_version_id_org_chart_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."org_chart_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_chart_versions" ADD CONSTRAINT "org_chart_versions_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_chart_versions" ADD CONSTRAINT "org_chart_versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eval_iterations" ADD CONSTRAINT "eval_iterations_eval_run_id_eval_runs_id_fk" FOREIGN KEY ("eval_run_id") REFERENCES "public"."eval_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eval_runs" ADD CONSTRAINT "eval_runs_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eval_runs" ADD CONSTRAINT "eval_runs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_deals_portco_status" ON "deals" USING btree ("portco_id","status");--> statement-breakpoint
CREATE INDEX "idx_deals_portco_stage" ON "deals" USING btree ("portco_id","stage_id");--> statement-breakpoint
CREATE INDEX "idx_activity_deal" ON "deal_activity_log" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "idx_activity_deal_ts" ON "deal_activity_log" USING btree ("deal_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_tasks_deal" ON "deal_tasks" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "idx_tasks_deal_status" ON "deal_tasks" USING btree ("deal_id","status");--> statement-breakpoint
CREATE INDEX "idx_red_flags_deal" ON "deal_red_flags" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "idx_red_flags_deal_resolved" ON "deal_red_flags" USING btree ("deal_id","resolved","severity");--> statement-breakpoint
CREATE INDEX "idx_files_gdrive" ON "files" USING btree ("gdrive_file_id");--> statement-breakpoint
CREATE INDEX "idx_files_portco_status" ON "files" USING btree ("portco_id","processing_status");
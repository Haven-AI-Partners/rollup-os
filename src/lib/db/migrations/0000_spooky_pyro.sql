CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_id" text NOT NULL,
	"email" text NOT NULL,
	"full_name" text,
	"avatar_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_clerk_id_unique" UNIQUE("clerk_id"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "portco_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"portco_id" uuid NOT NULL,
	"role" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "portco_memberships_user_id_portco_id_unique" UNIQUE("user_id","portco_id")
);
--> statement-breakpoint
CREATE TABLE "portcos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"logo_url" text,
	"description" text,
	"industry" text,
	"focus_areas" jsonb,
	"target_geography" jsonb,
	"investment_thesis" text,
	"target_revenue_min" numeric,
	"target_revenue_max" numeric,
	"target_ebitda_min" numeric,
	"target_ebitda_max" numeric,
	"target_deal_size_min" numeric,
	"target_deal_size_max" numeric,
	"acquisition_criteria" jsonb,
	"scoring_rubric" jsonb,
	"gdrive_folder_id" text,
	"gdrive_service_account_enc" text,
	"slack_webhook_url" text,
	"slack_channel_id" text,
	"allowed_domains" jsonb,
	"settings" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "portcos_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "deal_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deal_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deal_financials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deal_id" uuid NOT NULL,
	"portco_id" uuid NOT NULL,
	"period" text NOT NULL,
	"period_type" text NOT NULL,
	"revenue" numeric,
	"ebitda" numeric,
	"net_income" numeric,
	"gross_margin_pct" numeric,
	"ebitda_margin_pct" numeric,
	"cash_flow" numeric,
	"customer_count" integer,
	"employee_count" integer,
	"arr" numeric,
	"purchase_price" numeric,
	"purchase_multiple" numeric,
	"source" text,
	"notes" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deal_transfers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deal_id" uuid NOT NULL,
	"from_portco_id" uuid NOT NULL,
	"to_portco_id" uuid NOT NULL,
	"transferred_by" uuid NOT NULL,
	"reason" text,
	"transferred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"portco_id" uuid NOT NULL,
	"stage_id" uuid NOT NULL,
	"company_name" text NOT NULL,
	"description" text,
	"source" text,
	"source_url" text,
	"asking_price" numeric,
	"revenue" numeric,
	"ebitda" numeric,
	"location" text,
	"industry" text,
	"employee_count" integer,
	"status" text DEFAULT 'active' NOT NULL,
	"assigned_to" uuid,
	"broker_firm_id" uuid,
	"broker_contact_id" uuid,
	"kanban_position" integer DEFAULT 0 NOT NULL,
	"closed_at" timestamp with time zone,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pipeline_stages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"portco_id" uuid NOT NULL,
	"name" text NOT NULL,
	"phase" text NOT NULL,
	"position" integer NOT NULL,
	"color" text
);
--> statement-breakpoint
CREATE TABLE "deal_activity_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deal_id" uuid NOT NULL,
	"portco_id" uuid NOT NULL,
	"user_id" uuid,
	"action" text NOT NULL,
	"description" text,
	"reference_type" text,
	"reference_id" uuid,
	"changes" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deal_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deal_id" uuid NOT NULL,
	"portco_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"category" text NOT NULL,
	"status" text DEFAULT 'todo' NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"assigned_to" uuid,
	"due_date" date,
	"completed_at" timestamp with time zone,
	"parent_task_id" uuid,
	"position" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deal_red_flags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deal_id" uuid NOT NULL,
	"portco_id" uuid NOT NULL,
	"flag_id" text NOT NULL,
	"severity" text NOT NULL,
	"category" text NOT NULL,
	"notes" text,
	"resolved" boolean DEFAULT false NOT NULL,
	"resolved_at" timestamp with time zone,
	"flagged_by" uuid,
	"resolved_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "broker_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"broker_firm_id" uuid NOT NULL,
	"full_name" text NOT NULL,
	"email" text,
	"phone" text,
	"title" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "broker_firms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"website" text,
	"listing_url" text,
	"scrape_config" jsonb,
	"region" text,
	"specialty" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "broker_interactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"broker_contact_id" uuid NOT NULL,
	"deal_id" uuid,
	"portco_id" uuid NOT NULL,
	"type" text NOT NULL,
	"direction" text,
	"subject" text,
	"body" text,
	"metadata" jsonb,
	"occurred_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "broker_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"broker_firm_id" uuid NOT NULL,
	"broker_contact_id" uuid,
	"period" text NOT NULL,
	"avg_response_time_h" numeric,
	"deals_sent" integer,
	"deals_progressed" integer,
	"deal_quality_score" numeric,
	"im_request_to_recv" numeric,
	"computed_at" timestamp with time zone NOT NULL,
	CONSTRAINT "broker_metrics_broker_firm_id_broker_contact_id_period_unique" UNIQUE("broker_firm_id","broker_contact_id","period")
);
--> statement-breakpoint
CREATE TABLE "files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deal_id" uuid NOT NULL,
	"portco_id" uuid NOT NULL,
	"uploaded_by" uuid,
	"file_name" text NOT NULL,
	"file_type" text,
	"mime_type" text,
	"gdrive_file_id" text,
	"gdrive_folder_id" text,
	"gdrive_url" text,
	"size_bytes" bigint,
	"processing_status" text DEFAULT 'pending' NOT NULL,
	"processed_at" timestamp with time zone,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "company_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deal_id" uuid NOT NULL,
	"summary" text,
	"business_model" text,
	"market_position" text,
	"financial_highlights" jsonb,
	"key_risks" jsonb,
	"strengths" jsonb,
	"industry_trends" text,
	"ai_overall_score" numeric,
	"scoring_breakdown" jsonb,
	"raw_extraction" jsonb,
	"generated_at" timestamp with time zone,
	"model_version" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "company_profiles_deal_id_unique" UNIQUE("deal_id")
);
--> statement-breakpoint
CREATE TABLE "document_embeddings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_id" uuid NOT NULL,
	"deal_id" uuid NOT NULL,
	"portco_id" uuid NOT NULL,
	"chunk_index" integer NOT NULL,
	"chunk_text" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_definitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"phase" text NOT NULL,
	"trigger_task_id" text NOT NULL,
	"input_schema" jsonb,
	"config_schema" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agent_definitions_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "agent_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_definition_id" uuid NOT NULL,
	"portco_id" uuid NOT NULL,
	"deal_id" uuid,
	"trigger_job_id" text,
	"langfuse_trace_id" text,
	"status" text DEFAULT 'queued' NOT NULL,
	"input" jsonb,
	"output" jsonb,
	"error" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portco_agent_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"portco_id" uuid NOT NULL,
	"agent_definition_id" uuid NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"config" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "portco_agent_configs_portco_id_agent_definition_id_unique" UNIQUE("portco_id","agent_definition_id")
);
--> statement-breakpoint
CREATE TABLE "prompt_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_slug" text NOT NULL,
	"version" integer NOT NULL,
	"template" text NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"change_note" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kpi_definitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"phase" text NOT NULL,
	"category" text,
	"unit" text,
	"direction" text,
	"target_value" numeric,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "kpi_definitions_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "kpi_values" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kpi_definition_id" uuid NOT NULL,
	"portco_id" uuid NOT NULL,
	"deal_id" uuid,
	"agent_run_id" uuid,
	"value" numeric NOT NULL,
	"target_value" numeric,
	"period" text,
	"metadata" jsonb,
	"measured_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"portco_id" uuid NOT NULL,
	"user_id" uuid,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"reference_type" text,
	"reference_id" uuid,
	"read" boolean DEFAULT false NOT NULL,
	"slack_sent" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "portco_memberships" ADD CONSTRAINT "portco_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portco_memberships" ADD CONSTRAINT "portco_memberships_portco_id_portcos_id_fk" FOREIGN KEY ("portco_id") REFERENCES "public"."portcos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_comments" ADD CONSTRAINT "deal_comments_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_comments" ADD CONSTRAINT "deal_comments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_financials" ADD CONSTRAINT "deal_financials_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_financials" ADD CONSTRAINT "deal_financials_portco_id_portcos_id_fk" FOREIGN KEY ("portco_id") REFERENCES "public"."portcos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_transfers" ADD CONSTRAINT "deal_transfers_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_transfers" ADD CONSTRAINT "deal_transfers_from_portco_id_portcos_id_fk" FOREIGN KEY ("from_portco_id") REFERENCES "public"."portcos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_transfers" ADD CONSTRAINT "deal_transfers_to_portco_id_portcos_id_fk" FOREIGN KEY ("to_portco_id") REFERENCES "public"."portcos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_transfers" ADD CONSTRAINT "deal_transfers_transferred_by_users_id_fk" FOREIGN KEY ("transferred_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_portco_id_portcos_id_fk" FOREIGN KEY ("portco_id") REFERENCES "public"."portcos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_stage_id_pipeline_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."pipeline_stages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pipeline_stages" ADD CONSTRAINT "pipeline_stages_portco_id_portcos_id_fk" FOREIGN KEY ("portco_id") REFERENCES "public"."portcos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_activity_log" ADD CONSTRAINT "deal_activity_log_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_activity_log" ADD CONSTRAINT "deal_activity_log_portco_id_portcos_id_fk" FOREIGN KEY ("portco_id") REFERENCES "public"."portcos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_activity_log" ADD CONSTRAINT "deal_activity_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_tasks" ADD CONSTRAINT "deal_tasks_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_tasks" ADD CONSTRAINT "deal_tasks_portco_id_portcos_id_fk" FOREIGN KEY ("portco_id") REFERENCES "public"."portcos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_tasks" ADD CONSTRAINT "deal_tasks_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_red_flags" ADD CONSTRAINT "deal_red_flags_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_red_flags" ADD CONSTRAINT "deal_red_flags_portco_id_portcos_id_fk" FOREIGN KEY ("portco_id") REFERENCES "public"."portcos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_red_flags" ADD CONSTRAINT "deal_red_flags_flagged_by_users_id_fk" FOREIGN KEY ("flagged_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_red_flags" ADD CONSTRAINT "deal_red_flags_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "broker_contacts" ADD CONSTRAINT "broker_contacts_broker_firm_id_broker_firms_id_fk" FOREIGN KEY ("broker_firm_id") REFERENCES "public"."broker_firms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "broker_interactions" ADD CONSTRAINT "broker_interactions_broker_contact_id_broker_contacts_id_fk" FOREIGN KEY ("broker_contact_id") REFERENCES "public"."broker_contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "broker_interactions" ADD CONSTRAINT "broker_interactions_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "broker_interactions" ADD CONSTRAINT "broker_interactions_portco_id_portcos_id_fk" FOREIGN KEY ("portco_id") REFERENCES "public"."portcos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "broker_metrics" ADD CONSTRAINT "broker_metrics_broker_firm_id_broker_firms_id_fk" FOREIGN KEY ("broker_firm_id") REFERENCES "public"."broker_firms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "broker_metrics" ADD CONSTRAINT "broker_metrics_broker_contact_id_broker_contacts_id_fk" FOREIGN KEY ("broker_contact_id") REFERENCES "public"."broker_contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_portco_id_portcos_id_fk" FOREIGN KEY ("portco_id") REFERENCES "public"."portcos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_profiles" ADD CONSTRAINT "company_profiles_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_embeddings" ADD CONSTRAINT "document_embeddings_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_embeddings" ADD CONSTRAINT "document_embeddings_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_embeddings" ADD CONSTRAINT "document_embeddings_portco_id_portcos_id_fk" FOREIGN KEY ("portco_id") REFERENCES "public"."portcos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_agent_definition_id_agent_definitions_id_fk" FOREIGN KEY ("agent_definition_id") REFERENCES "public"."agent_definitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_portco_id_portcos_id_fk" FOREIGN KEY ("portco_id") REFERENCES "public"."portcos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portco_agent_configs" ADD CONSTRAINT "portco_agent_configs_portco_id_portcos_id_fk" FOREIGN KEY ("portco_id") REFERENCES "public"."portcos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portco_agent_configs" ADD CONSTRAINT "portco_agent_configs_agent_definition_id_agent_definitions_id_fk" FOREIGN KEY ("agent_definition_id") REFERENCES "public"."agent_definitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prompt_versions" ADD CONSTRAINT "prompt_versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kpi_values" ADD CONSTRAINT "kpi_values_kpi_definition_id_kpi_definitions_id_fk" FOREIGN KEY ("kpi_definition_id") REFERENCES "public"."kpi_definitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kpi_values" ADD CONSTRAINT "kpi_values_portco_id_portcos_id_fk" FOREIGN KEY ("portco_id") REFERENCES "public"."portcos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kpi_values" ADD CONSTRAINT "kpi_values_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kpi_values" ADD CONSTRAINT "kpi_values_agent_run_id_agent_runs_id_fk" FOREIGN KEY ("agent_run_id") REFERENCES "public"."agent_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_portco_id_portcos_id_fk" FOREIGN KEY ("portco_id") REFERENCES "public"."portcos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_embeddings_portco" ON "document_embeddings" USING btree ("portco_id");--> statement-breakpoint
CREATE INDEX "idx_embeddings_deal" ON "document_embeddings" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "idx_embeddings_file" ON "document_embeddings" USING btree ("file_id");--> statement-breakpoint
CREATE INDEX "idx_kpi_values_lookup" ON "kpi_values" USING btree ("portco_id","kpi_definition_id","deal_id","period");
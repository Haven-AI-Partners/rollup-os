CREATE TABLE "company_employees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deal_id" uuid NOT NULL,
	"portco_id" uuid NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"department" text,
	"job_title" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discovery_campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deal_id" uuid NOT NULL,
	"portco_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"campaign_type" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"prompt_config" jsonb,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discovery_dependencies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workflow_id" uuid NOT NULL,
	"depends_on_workflow_id" uuid,
	"dependency_type" text NOT NULL,
	"description" text,
	"external_system" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discovery_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discovery_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"password_hash" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"sentiment_score" numeric,
	"sentiment_notes" text,
	"workflow_count" integer DEFAULT 0 NOT NULL,
	"feedback_rating" integer,
	"feedback_tags" jsonb,
	"feedback_comment" text,
	"feedback_at" timestamp with time zone,
	"prompt_version_id" uuid,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"last_active_at" timestamp with time zone,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discovery_workflows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"campaign_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"title" text NOT NULL,
	"short_description" text,
	"frequency" text,
	"volume" text,
	"time_spent_per_cycle" text,
	"time_spent_minutes" integer,
	"trigger" text,
	"people_involved" text,
	"tools_involved" text,
	"inputs_required" text,
	"output_produced" text,
	"output_destination" text,
	"rule_based_nature" integer,
	"standardization_level" text,
	"steps_repetitive" text,
	"steps_requiring_judgment" text,
	"data_quality_requirements" text,
	"risk_level" text,
	"compliance_sensitivity" text,
	"bottlenecks" text,
	"error_prone_steps" text,
	"ideal_automation_outcome" text,
	"steps_must_stay_human" text,
	"notes" text,
	"automation_score" numeric,
	"business_impact" text DEFAULT 'medium',
	"is_confirmed" boolean DEFAULT false NOT NULL,
	"overlap_group_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deal_thesis_nodes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deal_id" uuid NOT NULL,
	"portco_id" uuid NOT NULL,
	"parent_id" uuid,
	"label" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'unknown' NOT NULL,
	"value" text,
	"source" text,
	"source_detail" text,
	"notes" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"template_node_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "files" ALTER COLUMN "deal_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_login_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "deal_financials" ADD COLUMN "full_time_count" integer;--> statement-breakpoint
ALTER TABLE "deal_financials" ADD COLUMN "contractor_count" integer;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "full_time_count" integer;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "contractor_count" integer;--> statement-breakpoint
ALTER TABLE "files" ADD COLUMN "gdrive_parent_path" text;--> statement-breakpoint
ALTER TABLE "files" ADD COLUMN "classified_by" text;--> statement-breakpoint
ALTER TABLE "files" ADD COLUMN "classification_confidence" text;--> statement-breakpoint
ALTER TABLE "company_employees" ADD CONSTRAINT "company_employees_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_employees" ADD CONSTRAINT "company_employees_portco_id_portcos_id_fk" FOREIGN KEY ("portco_id") REFERENCES "public"."portcos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovery_campaigns" ADD CONSTRAINT "discovery_campaigns_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovery_campaigns" ADD CONSTRAINT "discovery_campaigns_portco_id_portcos_id_fk" FOREIGN KEY ("portco_id") REFERENCES "public"."portcos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovery_campaigns" ADD CONSTRAINT "discovery_campaigns_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovery_dependencies" ADD CONSTRAINT "discovery_dependencies_workflow_id_discovery_workflows_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."discovery_workflows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovery_dependencies" ADD CONSTRAINT "discovery_dependencies_depends_on_workflow_id_discovery_workflows_id_fk" FOREIGN KEY ("depends_on_workflow_id") REFERENCES "public"."discovery_workflows"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovery_messages" ADD CONSTRAINT "discovery_messages_session_id_discovery_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."discovery_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovery_sessions" ADD CONSTRAINT "discovery_sessions_campaign_id_discovery_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."discovery_campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovery_sessions" ADD CONSTRAINT "discovery_sessions_employee_id_company_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."company_employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovery_workflows" ADD CONSTRAINT "discovery_workflows_session_id_discovery_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."discovery_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovery_workflows" ADD CONSTRAINT "discovery_workflows_campaign_id_discovery_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."discovery_campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovery_workflows" ADD CONSTRAINT "discovery_workflows_employee_id_company_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."company_employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_thesis_nodes" ADD CONSTRAINT "deal_thesis_nodes_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_thesis_nodes" ADD CONSTRAINT "deal_thesis_nodes_portco_id_portcos_id_fk" FOREIGN KEY ("portco_id") REFERENCES "public"."portcos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_company_employees_deal" ON "company_employees" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "idx_company_employees_portco" ON "company_employees" USING btree ("portco_id");--> statement-breakpoint
CREATE INDEX "idx_discovery_campaigns_deal" ON "discovery_campaigns" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "idx_discovery_campaigns_portco" ON "discovery_campaigns" USING btree ("portco_id");--> statement-breakpoint
CREATE INDEX "idx_discovery_deps_workflow" ON "discovery_dependencies" USING btree ("workflow_id");--> statement-breakpoint
CREATE INDEX "idx_discovery_messages_session" ON "discovery_messages" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_discovery_sessions_campaign" ON "discovery_sessions" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "idx_discovery_sessions_employee" ON "discovery_sessions" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "idx_discovery_workflows_campaign" ON "discovery_workflows" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "idx_discovery_workflows_session" ON "discovery_workflows" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_discovery_workflows_employee" ON "discovery_workflows" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "idx_thesis_deal" ON "deal_thesis_nodes" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "idx_thesis_deal_parent" ON "deal_thesis_nodes" USING btree ("deal_id","parent_id");--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_broker_firm_id_broker_firms_id_fk" FOREIGN KEY ("broker_firm_id") REFERENCES "public"."broker_firms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_broker_contact_id_broker_contacts_id_fk" FOREIGN KEY ("broker_contact_id") REFERENCES "public"."broker_contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_tasks" ADD CONSTRAINT "deal_tasks_parent_task_id_deal_tasks_id_fk" FOREIGN KEY ("parent_task_id") REFERENCES "public"."deal_tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_chart_nodes" ADD CONSTRAINT "org_chart_nodes_parent_id_org_chart_nodes_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."org_chart_nodes"("id") ON DELETE no action ON UPDATE no action;
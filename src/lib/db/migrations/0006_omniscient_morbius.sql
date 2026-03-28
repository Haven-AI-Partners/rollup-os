ALTER TABLE "deal_comments" DROP CONSTRAINT "deal_comments_deal_id_deals_id_fk";
--> statement-breakpoint
ALTER TABLE "deal_financials" DROP CONSTRAINT "deal_financials_deal_id_deals_id_fk";
--> statement-breakpoint
ALTER TABLE "deal_transfers" DROP CONSTRAINT "deal_transfers_deal_id_deals_id_fk";
--> statement-breakpoint
ALTER TABLE "deal_activity_log" DROP CONSTRAINT "deal_activity_log_deal_id_deals_id_fk";
--> statement-breakpoint
ALTER TABLE "deal_tasks" DROP CONSTRAINT "deal_tasks_deal_id_deals_id_fk";
--> statement-breakpoint
ALTER TABLE "deal_red_flags" DROP CONSTRAINT "deal_red_flags_deal_id_deals_id_fk";
--> statement-breakpoint
ALTER TABLE "broker_interactions" DROP CONSTRAINT "broker_interactions_deal_id_deals_id_fk";
--> statement-breakpoint
ALTER TABLE "files" DROP CONSTRAINT "files_deal_id_deals_id_fk";
--> statement-breakpoint
ALTER TABLE "company_profiles" DROP CONSTRAINT "company_profiles_deal_id_deals_id_fk";
--> statement-breakpoint
ALTER TABLE "document_embeddings" DROP CONSTRAINT "document_embeddings_file_id_files_id_fk";
--> statement-breakpoint
ALTER TABLE "document_embeddings" DROP CONSTRAINT "document_embeddings_deal_id_deals_id_fk";
--> statement-breakpoint
ALTER TABLE "agent_runs" DROP CONSTRAINT "agent_runs_deal_id_deals_id_fk";
--> statement-breakpoint
ALTER TABLE "kpi_values" DROP CONSTRAINT "kpi_values_deal_id_deals_id_fk";
--> statement-breakpoint
ALTER TABLE "org_chart_versions" DROP CONSTRAINT "org_chart_versions_deal_id_deals_id_fk";
--> statement-breakpoint
ALTER TABLE "company_employees" DROP CONSTRAINT "company_employees_deal_id_deals_id_fk";
--> statement-breakpoint
ALTER TABLE "discovery_campaigns" DROP CONSTRAINT "discovery_campaigns_deal_id_deals_id_fk";
--> statement-breakpoint
ALTER TABLE "discovery_sessions" DROP CONSTRAINT "discovery_sessions_campaign_id_discovery_campaigns_id_fk";
--> statement-breakpoint
ALTER TABLE "discovery_workflows" DROP CONSTRAINT "discovery_workflows_campaign_id_discovery_campaigns_id_fk";
--> statement-breakpoint
ALTER TABLE "deal_thesis_nodes" DROP CONSTRAINT "deal_thesis_nodes_deal_id_deals_id_fk";
--> statement-breakpoint
ALTER TABLE "deal_comments" ADD CONSTRAINT "deal_comments_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_financials" ADD CONSTRAINT "deal_financials_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_transfers" ADD CONSTRAINT "deal_transfers_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_activity_log" ADD CONSTRAINT "deal_activity_log_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_tasks" ADD CONSTRAINT "deal_tasks_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_red_flags" ADD CONSTRAINT "deal_red_flags_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "broker_interactions" ADD CONSTRAINT "broker_interactions_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_profiles" ADD CONSTRAINT "company_profiles_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_embeddings" ADD CONSTRAINT "document_embeddings_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_embeddings" ADD CONSTRAINT "document_embeddings_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kpi_values" ADD CONSTRAINT "kpi_values_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_chart_versions" ADD CONSTRAINT "org_chart_versions_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_employees" ADD CONSTRAINT "company_employees_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovery_campaigns" ADD CONSTRAINT "discovery_campaigns_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovery_sessions" ADD CONSTRAINT "discovery_sessions_campaign_id_discovery_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."discovery_campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovery_workflows" ADD CONSTRAINT "discovery_workflows_campaign_id_discovery_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."discovery_campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_thesis_nodes" ADD CONSTRAINT "deal_thesis_nodes_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;
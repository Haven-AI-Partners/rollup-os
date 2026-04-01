DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'eval_runs_prompt_version_id_prompt_versions_id_fk') THEN
    ALTER TABLE "eval_runs" ADD CONSTRAINT "eval_runs_prompt_version_id_prompt_versions_id_fk" FOREIGN KEY ("prompt_version_id") REFERENCES "public"."prompt_versions"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'discovery_sessions_prompt_version_id_prompt_versions_id_fk') THEN
    ALTER TABLE "discovery_sessions" ADD CONSTRAINT "discovery_sessions_prompt_version_id_prompt_versions_id_fk" FOREIGN KEY ("prompt_version_id") REFERENCES "public"."prompt_versions"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'deal_thesis_nodes_parent_id_deal_thesis_nodes_id_fk') THEN
    ALTER TABLE "deal_thesis_nodes" ADD CONSTRAINT "deal_thesis_nodes_parent_id_deal_thesis_nodes_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."deal_thesis_nodes"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;
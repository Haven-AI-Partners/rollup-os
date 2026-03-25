-- Add full-time and contractor count columns to deals and deal_financials tables
ALTER TABLE "deals" ADD COLUMN IF NOT EXISTS "full_time_count" integer;
ALTER TABLE "deals" ADD COLUMN IF NOT EXISTS "contractor_count" integer;
ALTER TABLE "deal_financials" ADD COLUMN IF NOT EXISTS "full_time_count" integer;
ALTER TABLE "deal_financials" ADD COLUMN IF NOT EXISTS "contractor_count" integer;

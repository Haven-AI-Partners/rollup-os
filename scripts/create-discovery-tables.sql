-- Discovery Interviews: create all tables

CREATE TABLE IF NOT EXISTS company_employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id),
  portco_id UUID NOT NULL REFERENCES portcos(id),
  name TEXT NOT NULL,
  email TEXT,
  department TEXT,
  job_title TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_company_employees_deal ON company_employees(deal_id);
CREATE INDEX IF NOT EXISTS idx_company_employees_portco ON company_employees(portco_id);

CREATE TABLE IF NOT EXISTS discovery_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id),
  portco_id UUID NOT NULL REFERENCES portcos(id),
  name TEXT NOT NULL,
  description TEXT,
  campaign_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  prompt_config JSONB,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_discovery_campaigns_deal ON discovery_campaigns(deal_id);
CREATE INDEX IF NOT EXISTS idx_discovery_campaigns_portco ON discovery_campaigns(portco_id);

CREATE TABLE IF NOT EXISTS discovery_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES discovery_campaigns(id),
  employee_id UUID NOT NULL REFERENCES company_employees(id),
  password_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  sentiment_score NUMERIC,
  sentiment_notes TEXT,
  workflow_count INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  last_active_at TIMESTAMPTZ,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_discovery_sessions_campaign ON discovery_sessions(campaign_id);
CREATE INDEX IF NOT EXISTS idx_discovery_sessions_employee ON discovery_sessions(employee_id);

CREATE TABLE IF NOT EXISTS discovery_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES discovery_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_discovery_messages_session ON discovery_messages(session_id);

CREATE TABLE IF NOT EXISTS discovery_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES discovery_sessions(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES discovery_campaigns(id),
  employee_id UUID NOT NULL REFERENCES company_employees(id),
  title TEXT NOT NULL,
  short_description TEXT,
  frequency TEXT,
  volume TEXT,
  time_spent_per_cycle TEXT,
  time_spent_minutes INTEGER,
  trigger TEXT,
  people_involved TEXT,
  tools_involved TEXT,
  inputs_required TEXT,
  output_produced TEXT,
  output_destination TEXT,
  rule_based_nature INTEGER,
  standardization_level TEXT,
  steps_repetitive TEXT,
  steps_requiring_judgment TEXT,
  data_quality_requirements TEXT,
  risk_level TEXT,
  compliance_sensitivity TEXT,
  bottlenecks TEXT,
  error_prone_steps TEXT,
  ideal_automation_outcome TEXT,
  steps_must_stay_human TEXT,
  notes TEXT,
  automation_score NUMERIC,
  business_impact TEXT DEFAULT 'medium',
  is_confirmed BOOLEAN NOT NULL DEFAULT false,
  overlap_group_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_discovery_workflows_campaign ON discovery_workflows(campaign_id);
CREATE INDEX IF NOT EXISTS idx_discovery_workflows_session ON discovery_workflows(session_id);
CREATE INDEX IF NOT EXISTS idx_discovery_workflows_employee ON discovery_workflows(employee_id);

CREATE TABLE IF NOT EXISTS discovery_dependencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES discovery_workflows(id) ON DELETE CASCADE,
  depends_on_workflow_id UUID REFERENCES discovery_workflows(id) ON DELETE SET NULL,
  dependency_type TEXT NOT NULL,
  description TEXT,
  external_system TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_discovery_deps_workflow ON discovery_dependencies(workflow_id);

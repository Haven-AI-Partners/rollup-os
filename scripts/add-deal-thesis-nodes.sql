-- Deal thesis nodes: per-deal DD tree for tracking diligence completeness
CREATE TABLE IF NOT EXISTS deal_thesis_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id),
  portco_id UUID NOT NULL REFERENCES portcos(id),
  parent_id UUID,
  label TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'unknown',
  value TEXT,
  source TEXT,
  source_detail TEXT,
  notes TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  template_node_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_thesis_deal ON deal_thesis_nodes(deal_id);
CREATE INDEX IF NOT EXISTS idx_thesis_deal_parent ON deal_thesis_nodes(deal_id, parent_id);

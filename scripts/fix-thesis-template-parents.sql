-- Fix thesis tree template: move organization + legal from external to internal,
-- move customer_satisfaction from existing_financials to revenue,
-- then delete empty existing_financials nodes.

BEGIN;

-- 1. Move "organization" nodes under "internal" (was under "external")
UPDATE deal_thesis_nodes AS child
SET parent_id = internal_node.id,
    sort_order = 5
FROM deal_thesis_nodes AS internal_node
WHERE child.template_node_id = 'organization'
  AND internal_node.template_node_id = 'internal'
  AND internal_node.deal_id = child.deal_id;

-- 2. Move "legal" nodes under "internal" (was under "external")
UPDATE deal_thesis_nodes AS child
SET parent_id = internal_node.id,
    sort_order = 6
FROM deal_thesis_nodes AS internal_node
WHERE child.template_node_id = 'legal'
  AND internal_node.template_node_id = 'internal'
  AND internal_node.deal_id = child.deal_id;

-- 3. Move "customer_satisfaction" under "revenue" (was under "existing_financials")
UPDATE deal_thesis_nodes AS child
SET parent_id = revenue_node.id,
    sort_order = 5
FROM deal_thesis_nodes AS revenue_node
WHERE child.template_node_id = 'customer_satisfaction'
  AND revenue_node.template_node_id = 'revenue'
  AND revenue_node.deal_id = child.deal_id;

-- 4. Delete now-empty "existing_financials" nodes (no longer have children)
DELETE FROM deal_thesis_nodes
WHERE template_node_id = 'existing_financials'
  AND id NOT IN (
    SELECT DISTINCT parent_id FROM deal_thesis_nodes WHERE parent_id IS NOT NULL
  );

COMMIT;

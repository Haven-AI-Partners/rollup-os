-- Backfill "Missing: ..." notes on leaf nodes (partial/unknown) that have no notes.
-- A leaf node is one that has no children.

UPDATE deal_thesis_nodes AS n
SET notes = CONCAT('Missing: ', n.description)
WHERE n.notes IS NULL
  AND n.status IN ('unknown', 'partial')
  AND n.description IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM deal_thesis_nodes child WHERE child.parent_id = n.id
  );

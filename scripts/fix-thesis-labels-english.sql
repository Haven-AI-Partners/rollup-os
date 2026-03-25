-- Update all template-based thesis node labels from Japanese to English

BEGIN;

UPDATE deal_thesis_nodes SET label = 'Investment Recovery within 5 Years' WHERE template_node_id = 'root';
UPDATE deal_thesis_nodes SET label = 'Internal Assessment' WHERE template_node_id = 'internal';
UPDATE deal_thesis_nodes SET label = 'External Assessment' WHERE template_node_id = 'external';
UPDATE deal_thesis_nodes SET label = 'Revenue' WHERE template_node_id = 'revenue';
UPDATE deal_thesis_nodes SET label = 'Revenue Composition' WHERE template_node_id = 'revenue_composition';
UPDATE deal_thesis_nodes SET label = 'Deal Sourcing Channels' WHERE template_node_id = 'revenue_channels';
UPDATE deal_thesis_nodes SET label = 'Customer Retention' WHERE template_node_id = 'retention';
UPDATE deal_thesis_nodes SET label = 'Revenue per Employee' WHERE template_node_id = 'revenue_per_employee';
UPDATE deal_thesis_nodes SET label = 'Product Profitability' WHERE template_node_id = 'product_profitability';
UPDATE deal_thesis_nodes SET label = 'Customer Satisfaction' WHERE template_node_id = 'customer_satisfaction';
UPDATE deal_thesis_nodes SET label = 'Financial DD' WHERE template_node_id = 'finance';
UPDATE deal_thesis_nodes SET label = 'Cost Structure' WHERE template_node_id = 'costs';
UPDATE deal_thesis_nodes SET label = 'Owner/Private Expenses' WHERE template_node_id = 'private_expenses';
UPDATE deal_thesis_nodes SET label = 'Capital Expenditure' WHERE template_node_id = 'capex';
UPDATE deal_thesis_nodes SET label = 'Cash Flow' WHERE template_node_id = 'cashflow';
UPDATE deal_thesis_nodes SET label = '5-Year Recovery Viability' WHERE template_node_id = 'financial_viability';
UPDATE deal_thesis_nodes SET label = 'Working Capital' WHERE template_node_id = 'working_capital';
UPDATE deal_thesis_nodes SET label = 'Upside Potential' WHERE template_node_id = 'upside';
UPDATE deal_thesis_nodes SET label = 'Existing Segments' WHERE template_node_id = 'existing_segments';
UPDATE deal_thesis_nodes SET label = 'New Segments' WHERE template_node_id = 'new_segments';
UPDATE deal_thesis_nodes SET label = 'Product & Technology' WHERE template_node_id = 'product';
UPDATE deal_thesis_nodes SET label = 'Competitive Advantage' WHERE template_node_id = 'competitive_advantage';
UPDATE deal_thesis_nodes SET label = 'New Product Development' WHERE template_node_id = 'new_development';
UPDATE deal_thesis_nodes SET label = 'Product End-of-Life' WHERE template_node_id = 'product_eol';
UPDATE deal_thesis_nodes SET label = 'Regulatory Compliance' WHERE template_node_id = 'regulatory_compliance';
UPDATE deal_thesis_nodes SET label = 'Market Trends' WHERE template_node_id = 'market';
UPDATE deal_thesis_nodes SET label = 'Market Size' WHERE template_node_id = 'market_size';
UPDATE deal_thesis_nodes SET label = 'Target Segments' WHERE template_node_id = 'target_segments';
UPDATE deal_thesis_nodes SET label = 'Competitive Landscape' WHERE template_node_id = 'competition';
UPDATE deal_thesis_nodes SET label = 'Direct Competitors' WHERE template_node_id = 'direct_competition';
UPDATE deal_thesis_nodes SET label = 'Indirect Competitors' WHERE template_node_id = 'indirect_competition';
UPDATE deal_thesis_nodes SET label = 'Organization & People' WHERE template_node_id = 'organization';
UPDATE deal_thesis_nodes SET label = 'Human Resources' WHERE template_node_id = 'human_resources';
UPDATE deal_thesis_nodes SET label = 'Utilization Rate' WHERE template_node_id = 'utilization';
UPDATE deal_thesis_nodes SET label = 'Hiring Needs' WHERE template_node_id = 'hiring_needs';
UPDATE deal_thesis_nodes SET label = 'Workforce Sustainability' WHERE template_node_id = 'sustainability';
UPDATE deal_thesis_nodes SET label = 'Labor Costs' WHERE template_node_id = 'labor_cost';
UPDATE deal_thesis_nodes SET label = 'Key Person Risk' WHERE template_node_id = 'key_people';
UPDATE deal_thesis_nodes SET label = 'Legal & Compliance' WHERE template_node_id = 'legal';
UPDATE deal_thesis_nodes SET label = 'Litigation Risk' WHERE template_node_id = 'litigation';
UPDATE deal_thesis_nodes SET label = 'Contract Risk' WHERE template_node_id = 'contracts';
UPDATE deal_thesis_nodes SET label = 'Intellectual Property' WHERE template_node_id = 'ip_rights';

COMMIT;

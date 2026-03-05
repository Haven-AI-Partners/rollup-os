/**
 * M&A Red Flags for Japanese IT Services Companies.
 * Organized by severity and category.
 */

export type RedFlagSeverity = "critical" | "serious" | "moderate" | "info_gap";
export type RedFlagCategory =
  | "financial"
  | "clients"
  | "legal_regulatory"
  | "people"
  | "operations"
  | "technology"
  | "business_model"
  | "compliance_governance"
  | "japan_specific";

export interface RedFlagDefinition {
  id: string;
  severity: RedFlagSeverity;
  category: RedFlagCategory;
  title: string;
  description: string;
}

export const SEVERITY_CONFIG: Record<RedFlagSeverity, { label: string; color: string; bgColor: string }> = {
  critical: { label: "Critical", color: "text-red-700", bgColor: "bg-red-50 border-red-200" },
  serious: { label: "Serious", color: "text-amber-700", bgColor: "bg-amber-50 border-amber-200" },
  moderate: { label: "Moderate", color: "text-yellow-700", bgColor: "bg-yellow-50 border-yellow-200" },
  info_gap: { label: "Info Gap", color: "text-blue-700", bgColor: "bg-blue-50 border-blue-200" },
};

export const CATEGORY_LABELS: Record<RedFlagCategory, string> = {
  financial: "Financial",
  clients: "Clients",
  legal_regulatory: "Legal / Regulatory",
  people: "People & Culture",
  operations: "Operations",
  technology: "Technology",
  business_model: "Business Model",
  compliance_governance: "Compliance & Governance",
  japan_specific: "Japan-Specific",
};

/** Decision framework thresholds */
export const DECISION_FRAMEWORK = {
  critical: { threshold: 1, action: "High risk, likely pass unless exceptional strategic rationale" },
  serious: { threshold: 3, action: "Marginal deal, deep dive required" },
  moderate: { threshold: 5, action: "Acceptable but requires robust integration plan" },
  info_gap: { threshold: 1, action: "Incomplete IM, request supplemental information before scoring" },
} as const;

export const RED_FLAG_DEFINITIONS: RedFlagDefinition[] = [
  // ── CRITICAL: Financial ──
  { id: "crit_fin_neg_cashflow", severity: "critical", category: "financial", title: "Persistent negative cash flow", description: "2+ years of negative cash flow despite profitable P&L" },
  { id: "crit_fin_rev_decline", severity: "critical", category: "financial", title: "Revenue decline >20% YoY", description: "Revenue decline >20% year-over-year without clear recovery plan" },
  { id: "crit_fin_debt_breach", severity: "critical", category: "financial", title: "Debt covenants breached", description: "Debt covenants already breached or waived multiple times" },
  { id: "crit_fin_hidden_liab", severity: "critical", category: "financial", title: "Hidden liabilities discovered", description: "Undisclosed guarantees, pending litigation, or off-balance-sheet items" },
  { id: "crit_fin_fake_rev", severity: "critical", category: "financial", title: "Fake revenue recognition", description: "Premature booking, bill-and-hold schemes, or aggressive recognition" },
  { id: "crit_fin_client_loss", severity: "critical", category: "financial", title: "Major client loss (>30% revenue)", description: "Lost >30% of revenue from a single client within past 12 months" },

  // ── CRITICAL: Clients ──
  { id: "crit_cli_single_50pct", severity: "critical", category: "clients", title: "Single client >50% of revenue", description: "Single client >50% of revenue with no contract beyond 12 months" },
  { id: "crit_cli_multi_nonrenew", severity: "critical", category: "clients", title: "Multiple major clients not renewing", description: "Multiple clients (>15% revenue each) not renewing or threatening non-renewal" },
  { id: "crit_cli_disputes", severity: "critical", category: "clients", title: "Client disputes", description: "Client disputes involving material amounts or relationship breakdown" },
  { id: "crit_cli_illegal_sub", severity: "critical", category: "clients", title: "Illegal subcontracting", description: "Dependence on illegal subcontracting (tajuu ukesuke violations)" },

  // ── CRITICAL: Legal/Regulatory ──
  { id: "crit_leg_investigation", severity: "critical", category: "legal_regulatory", title: "Ongoing regulatory investigation", description: "Tax, labor law, or subcontracting law investigation underway" },
  { id: "crit_leg_litigation", severity: "critical", category: "legal_regulatory", title: "Major pending litigation", description: ">5% of company value at risk from pending litigation" },
  { id: "crit_leg_labor_viol", severity: "critical", category: "legal_regulatory", title: "Labor law violations", description: "Unpaid overtime, misclassification, or illegal dispatch arrangements" },
  { id: "crit_leg_ip_disputes", severity: "critical", category: "legal_regulatory", title: "IP ownership disputes", description: "Lack of clear IP rights to key assets or active IP disputes" },

  // ── CRITICAL: People ──
  { id: "crit_ppl_ceo_exit", severity: "critical", category: "people", title: "Founder/CEO sudden exit", description: "Founder/CEO sudden exit with no succession plan in place" },
  { id: "crit_ppl_mass_resign", severity: "critical", category: "people", title: "Mass resignation of key staff", description: ">20% of engineers or key technical staff resigned recently" },
  { id: "crit_ppl_union", severity: "critical", category: "people", title: "Union labor action", description: "Union labor action threatened or ongoing" },
  { id: "crit_ppl_key_person", severity: "critical", category: "people", title: "Key person dependency (>40% revenue)", description: ">40% of revenue tied to 1-2 individuals" },

  // ── CRITICAL: Operations ──
  { id: "crit_ops_sys_failure", severity: "critical", category: "operations", title: "Critical system failure", description: "Major security breach or critical system failure in past year" },
  { id: "crit_ops_data_breach", severity: "critical", category: "operations", title: "Client data breach", description: "Client data breach with regulatory consequences" },
  { id: "crit_ops_project_fail", severity: "critical", category: "operations", title: "Failed major project", description: "Failed major project resulting in >50M loss or litigation" },
  { id: "crit_ops_pirated_sw", severity: "critical", category: "operations", title: "Pirated software reliance", description: "Reliance on pirated software or unlicensed technology" },

  // ── SERIOUS: Financial ──
  { id: "ser_fin_high_de", severity: "serious", category: "financial", title: "Debt-to-equity >2.5x", description: "Debt-to-equity >2.5x without clear deleveraging path" },
  { id: "ser_fin_low_margin", severity: "serious", category: "financial", title: "Operating margin <5%", description: "Operating margin <5% persistently" },
  { id: "ser_fin_wc_deterioration", severity: "serious", category: "financial", title: "Working capital deterioration", description: "DSO increasing >20 days year-over-year" },
  { id: "ser_fin_non_recurring", severity: "serious", category: "financial", title: "Heavy non-recurring revenue", description: ">40% of revenue from one-time projects" },
  { id: "ser_fin_unusual_acctg", severity: "serious", category: "financial", title: "Unusual accounting practices", description: "Aggressive revenue recognition, off-balance-sheet items" },
  { id: "ser_fin_tax_liab", severity: "serious", category: "financial", title: "Significant tax liabilities", description: "Unresolved tax disputes or significant tax liabilities" },

  // ── SERIOUS: Clients ──
  { id: "ser_cli_top3_60pct", severity: "serious", category: "clients", title: "Top 3 clients >60% of revenue", description: "Top 3 clients represent >60% of total revenue" },
  { id: "ser_cli_short_contracts", severity: "serious", category: "clients", title: "Client contracts <12 months", description: "Majority of revenue from contracts shorter than 12 months" },
  { id: "ser_cli_declining_retention", severity: "serious", category: "clients", title: "Declining client retention", description: "Client retention <80% year-over-year" },
  { id: "ser_cli_declining_industry", severity: "serious", category: "clients", title: "Concentration in declining industry", description: "Heavy exposure to declining industry (e.g., newspapers, traditional manufacturing)" },
  { id: "ser_cli_verbal", severity: "serious", category: "clients", title: "Verbal agreements >10% revenue", description: "Verbal agreements for clients representing >10% revenue" },
  { id: "ser_cli_payment_extending", severity: "serious", category: "clients", title: "Payment terms extending", description: "Clients demanding Net 90+ when Net 60 was standard" },

  // ── SERIOUS: Technology ──
  { id: "ser_tech_legacy", severity: "serious", category: "technology", title: "Legacy unsupported platforms", description: "Critical systems on Windows 2008, IE6, or similar unsupported platforms" },
  { id: "ser_tech_no_source", severity: "serious", category: "technology", title: "No source code access", description: "Vendor-locked with no source code access for key systems" },
  { id: "ser_tech_no_dr", severity: "serious", category: "technology", title: "No disaster recovery", description: "Lack of disaster recovery or backup systems" },
  { id: "ser_tech_no_cloud", severity: "serious", category: "technology", title: "Zero cloud adoption", description: "Zero cloud adoption with no migration plan" },
  { id: "ser_tech_debt", severity: "serious", category: "technology", title: "Heavy technical debt", description: "Technical debt estimated >6 months to address" },
  { id: "ser_tech_vendor_lock", severity: "serious", category: "technology", title: "Single vendor dependency", description: "Critical dependency on a single vendor (lock-in risk)" },

  // ── SERIOUS: People & Culture ──
  { id: "ser_ppl_founder_resist", severity: "serious", category: "people", title: "Founder resisting transition", description: "Founder wanting veto power or resisting handoff" },
  { id: "ser_ppl_no_retention", severity: "serious", category: "people", title: "No retention agreements", description: "Key employees without retention agreements or incentives to stay" },
  { id: "ser_ppl_culture_mismatch", severity: "serious", category: "people", title: "Significant cultural mismatch", description: "Rigid hierarchy vs. flat structure or similar fundamental mismatch" },
  { id: "ser_ppl_high_turnover", severity: "serious", category: "people", title: "High employee turnover (>25%)", description: ">25% annual turnover for technical staff" },
  { id: "ser_ppl_no_succession", severity: "serious", category: "people", title: "No succession planning", description: "No succession planning for critical roles" },
  { id: "ser_ppl_resist_change", severity: "serious", category: "people", title: "Resistance to change", description: "Documented failed innovation attempts or change resistance" },

  // ── SERIOUS: Business Model ──
  { id: "ser_biz_pure_ses", severity: "serious", category: "business_model", title: "Pure SES model (>60%)", description: ">60% of revenue from SES with no upmarket plan" },
  { id: "ser_biz_declining_rates", severity: "serious", category: "business_model", title: "Declining bill rates", description: "Bill rates declining >10% over 2 years" },
  { id: "ser_biz_heavy_subcon", severity: "serious", category: "business_model", title: "Heavy subcontractor reliance", description: ">50% of delivery capacity from subcontractors" },
  { id: "ser_biz_commodity", severity: "serious", category: "business_model", title: "Commodity services", description: "No differentiation, easily replaced by competitors" },
  { id: "ser_biz_geo_concentration", severity: "serious", category: "business_model", title: "Geographic concentration", description: ">80% revenue from single region vulnerable to downturn" },

  // ── SERIOUS: Compliance ──
  { id: "ser_comp_weak_controls", severity: "serious", category: "compliance_governance", title: "Weak internal controls", description: "No segregation of duties, poor documentation" },
  { id: "ser_comp_related_party", severity: "serious", category: "compliance_governance", title: "Related-party transactions", description: "Not at arm's length" },
  { id: "ser_comp_stock_issues", severity: "serious", category: "compliance_governance", title: "Stock option issues", description: "Unregistered options or tax problems" },
  { id: "ser_comp_missing_contracts", severity: "serious", category: "compliance_governance", title: "Missing key contracts", description: "Lost, verbal, or never documented contracts" },
  { id: "ser_comp_environmental", severity: "serious", category: "compliance_governance", title: "Environmental liabilities", description: "Environmental liabilities at owned properties" },

  // ── MODERATE: Financial ──
  { id: "mod_fin_moderate_de", severity: "moderate", category: "financial", title: "Debt-to-equity 1.0-2.5x", description: "Moderate leverage requiring monitoring" },
  { id: "mod_fin_modest_decline", severity: "moderate", category: "financial", title: "Modest revenue decline (<10%)", description: "Revenue decline <10% YoY with explanation" },
  { id: "mod_fin_wc_strain", severity: "moderate", category: "financial", title: "Working capital strain", description: "Occasional cash flow timing issues" },
  { id: "mod_fin_thin_margins", severity: "moderate", category: "financial", title: "Thin margins (5-10%)", description: "5-10% operating margin in competitive segment" },

  // ── MODERATE: Clients ──
  { id: "mod_cli_top_30_40", severity: "moderate", category: "clients", title: "Top client 30-40% of revenue", description: "With multi-year contract mitigating risk" },
  { id: "mod_cli_some_concentration", severity: "moderate", category: "clients", title: "Some client concentration", description: "Top 5 clients represent 50-65% of revenue" },
  { id: "mod_cli_industry_conc", severity: "moderate", category: "clients", title: "Industry concentration", description: ">50% revenue from single industry" },
  { id: "mod_cli_key_personnel", severity: "moderate", category: "clients", title: "Client dependency on key personnel", description: "Account manager relationships critical to retention" },

  // ── MODERATE: Technology ──
  { id: "mod_tech_mixed_stack", severity: "moderate", category: "technology", title: "Mixed legacy/modern stack", description: "Requires modernization effort but manageable" },
  { id: "mod_tech_limited_cloud", severity: "moderate", category: "technology", title: "Limited cloud adoption (<30%)", description: "Strategy exists but execution still early" },
  { id: "mod_tech_moderate_debt", severity: "moderate", category: "technology", title: "Moderate technical debt", description: "2-4 months to address" },
  { id: "mod_tech_outsourced_dev", severity: "moderate", category: "technology", title: "Outsourced development >30%", description: ">30% of development capacity outsourced" },

  // ── MODERATE: People ──
  { id: "mod_ppl_key_person", severity: "moderate", category: "people", title: "Key person dependencies (3-5)", description: "3-5 critical employees with concentrated knowledge" },
  { id: "mod_ppl_short_founder", severity: "moderate", category: "people", title: "Founder staying 1-2 years", description: "Shorter than ideal but manageable transition" },
  { id: "mod_ppl_culture_diff", severity: "moderate", category: "people", title: "Some cultural differences", description: "Requiring change management but not deal-breaking" },
  { id: "mod_ppl_moderate_turnover", severity: "moderate", category: "people", title: "Moderate turnover (15-25%)", description: "15-25% annual turnover for technical staff" },

  // ── MODERATE: Business Model ──
  { id: "mod_biz_ses_30_50", severity: "moderate", category: "business_model", title: "SES 30-50% of revenue", description: "Acceptable if moving upmarket with clear plan" },
  { id: "mod_biz_project_heavy", severity: "moderate", category: "business_model", title: "Project-based revenue >60%", description: "Low recurring revenue but addressable" },
  { id: "mod_biz_commoditization", severity: "moderate", category: "business_model", title: "Some commoditization pressure", description: "Need for differentiation strategy" },

  // ── INFO GAPS: Financial ──
  { id: "gap_fin_no_audit", severity: "info_gap", category: "financial", title: "Missing audited financials", description: "No audited financials for any of past 3 years" },
  { id: "gap_fin_no_cashflow", severity: "info_gap", category: "financial", title: "No cash flow statement", description: "Only P&L provided, no cash flow statement" },
  { id: "gap_fin_unexplained_charges", severity: "info_gap", category: "financial", title: "Unexplained one-time charges", description: "One-time charges or adjustments without explanation" },
  { id: "gap_fin_no_wc_detail", severity: "info_gap", category: "financial", title: "No working capital details", description: "AR aging, AP terms not disclosed" },
  { id: "gap_fin_no_budget", severity: "info_gap", category: "financial", title: "Missing budget vs. actual", description: "No budget vs. actual comparisons provided" },

  // ── INFO GAPS: Clients ──
  { id: "gap_cli_no_list", severity: "info_gap", category: "clients", title: "No client list", description: "Client list or concentrations obscured" },
  { id: "gap_cli_no_terms", severity: "info_gap", category: "clients", title: "No contract terms disclosed", description: "Length, renewal, and pricing terms not shared" },
  { id: "gap_cli_no_churn", severity: "info_gap", category: "clients", title: "Client churn data absent", description: "No historical client retention/churn data" },
  { id: "gap_cli_no_losses", severity: "info_gap", category: "clients", title: "No disclosure of recent losses", description: "Recent client losses not mentioned" },

  // ── INFO GAPS: Technology ──
  { id: "gap_tech_no_stack", severity: "info_gap", category: "technology", title: "No technology stack description", description: "Technology stack not described in IM" },
  { id: "gap_tech_no_ip", severity: "info_gap", category: "technology", title: "No information on IP ownership", description: "IP ownership unclear or not addressed" },
  { id: "gap_tech_no_certs", severity: "info_gap", category: "technology", title: "Security certifications absent", description: "No ISO 27001, P-Mark, or similar certifications mentioned" },
  { id: "gap_tech_no_process", severity: "info_gap", category: "technology", title: "No development process description", description: "Development methodology not described" },

  // ── INFO GAPS: People ──
  { id: "gap_ppl_no_org", severity: "info_gap", category: "people", title: "No org chart", description: "No org chart or reporting structure provided" },
  { id: "gap_ppl_no_details", severity: "info_gap", category: "people", title: "Key employee details omitted", description: "Names, tenures, compensation of key staff not shared" },
  { id: "gap_ppl_no_succession", severity: "info_gap", category: "people", title: "No succession plan discussed", description: "Succession planning not addressed" },
  { id: "gap_ppl_no_turnover", severity: "info_gap", category: "people", title: "Employee turnover data missing", description: "No turnover or retention metrics provided" },

  // ── INFO GAPS: Legal ──
  { id: "gap_leg_no_litigation", severity: "info_gap", category: "legal_regulatory", title: "No disclosure of litigation", description: "Litigation history not mentioned, even minor" },
  { id: "gap_leg_no_related_party", severity: "info_gap", category: "legal_regulatory", title: "Related-party transactions not mentioned", description: "No disclosure of related-party dealings" },
  { id: "gap_leg_no_contracts", severity: "info_gap", category: "legal_regulatory", title: "No list of material contracts", description: "Material contracts not enumerated" },
  { id: "gap_leg_no_compliance", severity: "info_gap", category: "legal_regulatory", title: "Compliance certifications absent", description: "Compliance status and certifications not mentioned" },

  // ── JAPAN-SPECIFIC ──
  { id: "jp_labor_misclass", severity: "serious", category: "japan_specific", title: "Employee misclassification", description: "Misclassification of employees as contractors to avoid benefits" },
  { id: "jp_labor_gisou_ukeoi", severity: "critical", category: "japan_specific", title: "Illegal worker dispatch (gisou ukeoi)", description: "Illegal worker dispatch arrangements" },
  { id: "jp_labor_service_zangyo", severity: "serious", category: "japan_specific", title: "Unpaid overtime (service zangyo)", description: "Service zangyo culture with systemic unpaid overtime" },
  { id: "jp_labor_power_hara", severity: "serious", category: "japan_specific", title: "Power harassment (pawa-hara)", description: "Power harassment or workplace culture issues" },
  { id: "jp_labor_karoshi", severity: "critical", category: "japan_specific", title: "Karoshi risk indicators", description: "Overwork death risk indicators in workforce data" },
  { id: "jp_cli_keiretsu", severity: "moderate", category: "japan_specific", title: "Keiretsu dependencies", description: "Too reliant on keiretsu relationships vs. performance" },
  { id: "jp_cli_gift_obligations", severity: "moderate", category: "japan_specific", title: "Excessive gift/entertainment obligations", description: "Gift/entertainment obligations exceeding normal business norms" },
  { id: "jp_cli_informal", severity: "serious", category: "japan_specific", title: "Informal arrangements", description: "Significant business arrangements not captured in contracts" },
  { id: "jp_biz_tajuu_ukesuke", severity: "serious", category: "japan_specific", title: "Multi-layer subcontracting (tajuu ukesuke)", description: "Multi-layer subcontracting below legal thresholds" },
  { id: "jp_biz_zangyo_daikokuko", severity: "serious", category: "japan_specific", title: "Unlimited overtime agreement abuse", description: "Zangyo daikokuko (unlimited overtime agreements) abuse" },
  { id: "jp_biz_fake_secondment", severity: "serious", category: "japan_specific", title: "Fake secondment arrangements", description: "Fake secondment to hide true employment relationships" },
  { id: "jp_reg_pmark", severity: "moderate", category: "japan_specific", title: "P-Mark violations", description: "Privacy mark violations or lapses" },
  { id: "jp_reg_construction", severity: "moderate", category: "japan_specific", title: "Construction industry permit issues", description: "Construction industry permit issues for SI work" },
  { id: "jp_reg_shitauke", severity: "serious", category: "japan_specific", title: "Subcontracting law (shitauke-hou) violations", description: "Subcontracting law violations or complaints" },
];

/** Group red flags by severity */
export function groupBySeverity(flags: RedFlagDefinition[]) {
  return {
    critical: flags.filter((f) => f.severity === "critical"),
    serious: flags.filter((f) => f.severity === "serious"),
    moderate: flags.filter((f) => f.severity === "moderate"),
    info_gap: flags.filter((f) => f.severity === "info_gap"),
  };
}

/** Group red flags by category */
export function groupByCategory(flags: RedFlagDefinition[]) {
  const groups: Record<string, RedFlagDefinition[]> = {};
  for (const flag of flags) {
    if (!groups[flag.category]) groups[flag.category] = [];
    groups[flag.category].push(flag);
  }
  return groups;
}

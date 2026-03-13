/**
 * Seed a demo rollup company ("Kaizen Capital") with realistic M&A pipeline data.
 * New users with no portco membership are auto-assigned here as analysts.
 *
 * Usage: pnpm tsx scripts/seed-demo.ts
 */
import "dotenv/config";
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  portcos,
  pipelineStages,
  deals,
  dealTasks,
  dealActivityLog,
  dealFinancials,
  dealRedFlags,
  companyProfiles,
  brokerFirms,
  brokerContacts,
} from "../src/lib/db/schema";

config({ path: ".env.local" });

const DEMO_SLUG = "demo";

async function seed() {
  const client = postgres(process.env.DATABASE_URL!, { prepare: false });
  const db = drizzle(client);

  console.log("Seeding demo portco...");

  // ── PortCo ──

  const [portco] = await db
    .insert(portcos)
    .values({
      name: "Kaizen Capital",
      slug: DEMO_SLUG,
      description:
        "Japan-focused roll-up platform acquiring profitable SMB services companies. Targeting businesses with ¥100M–¥1B revenue, strong recurring revenue, and integration upside through shared back-office and AI-driven operations.",
      industry: "Business Services",
      focusAreas: ["IT Managed Services", "HR & Staffing", "Facility Management", "Accounting & BPO"],
      targetGeography: ["Japan", "South Korea"],
      investmentThesis:
        "Japan's aging population is accelerating SMB succession crises. 1.27M businesses face closure by 2030 with no successor. We acquire healthy, profitable companies at 3–5x EBITDA, consolidate back-office ops, and deploy AI to improve margins by 5–10pp within 18 months.",
      targetRevenueMin: "100000000",
      targetRevenueMax: "1000000000",
      targetEbitdaMin: "20000000",
      targetEbitdaMax: "200000000",
      targetDealSizeMin: "60000000",
      targetDealSizeMax: "500000000",
      scoringRubric: {
        dimensions: [
          { id: "financial_stability", weight: 0.20 },
          { id: "client_concentration", weight: 0.20 },
          { id: "technology", weight: 0.15 },
          { id: "debt_leverage", weight: 0.12 },
          { id: "business_model", weight: 0.12 },
          { id: "ai_readiness", weight: 0.10 },
          { id: "org_complexity", weight: 0.06 },
          { id: "integration_risk", weight: 0.05 },
        ],
        recommendationBands: [
          { min: 4.0, max: 5.0, label: "Strong Candidate" },
          { min: 3.5, max: 3.99, label: "Good Candidate" },
          { min: 3.0, max: 3.49, label: "Acceptable" },
          { min: 2.5, max: 2.99, label: "Marginal" },
          { min: 0, max: 2.49, label: "High Risk - Pass" },
        ],
      },
    })
    .onConflictDoNothing()
    .returning();

  if (!portco) {
    console.log("Demo portco already exists, skipping.");
    await client.end();
    return;
  }

  console.log(`Created PortCo: ${portco.name} (slug: ${portco.slug})`);

  // ── Pipeline Stages ──

  const stageData = [
    { name: "Sourced", phase: "sourcing" as const, position: 0, color: "#94a3b8" },
    { name: "IM Review", phase: "evaluation" as const, position: 1, color: "#60a5fa" },
    { name: "Initial Call", phase: "evaluation" as const, position: 2, color: "#818cf8" },
    { name: "LOI", phase: "evaluation" as const, position: 3, color: "#a78bfa" },
    { name: "Due Diligence", phase: "diligence" as const, position: 4, color: "#f59e0b" },
    { name: "Closing", phase: "closing" as const, position: 5, color: "#10b981" },
    { name: "Closed Won", phase: "closing" as const, position: 6, color: "#22c55e" },
    { name: "Passed", phase: "closing" as const, position: 7, color: "#ef4444" },
  ];

  const stages = await db
    .insert(pipelineStages)
    .values(stageData.map((s) => ({ ...s, portcoId: portco.id })))
    .returning();

  const stageMap = Object.fromEntries(stages.map((s) => [s.name, s.id]));
  console.log(`Created ${stages.length} pipeline stages`);

  // ── Broker Firms ──

  const [nihonMA, tokyoBiz, osakaCap] = await db
    .insert(brokerFirms)
    .values([
      {
        name: "Nihon M&A Center",
        website: "https://nihon-ma.co.jp",
        region: "Japan - National",
        specialty: "SMB succession advisory",
      },
      {
        name: "Tokyo Business Transfer",
        website: "https://tokyo-biz-transfer.jp",
        region: "Kanto",
        specialty: "IT services & SaaS",
      },
      {
        name: "Osaka Capital Partners",
        website: "https://osaka-cap.jp",
        region: "Kansai",
        specialty: "Manufacturing & facility management",
      },
    ])
    .returning();

  await db.insert(brokerContacts).values([
    { brokerFirmId: nihonMA.id, fullName: "Tanaka Yuki", email: "tanaka@nihon-ma.co.jp", title: "Managing Director" },
    { brokerFirmId: nihonMA.id, fullName: "Suzuki Haruto", email: "suzuki@nihon-ma.co.jp", title: "Associate" },
    { brokerFirmId: tokyoBiz.id, fullName: "Watanabe Aoi", email: "watanabe@tokyo-biz.jp", title: "Partner" },
    { brokerFirmId: osakaCap.id, fullName: "Yamamoto Ren", email: "yamamoto@osaka-cap.jp", title: "Director" },
  ]);

  console.log("Created 3 broker firms with 4 contacts");

  // ── Deals ──

  const dealData = [
    // Sourced (3 fresh leads)
    {
      companyName: "NextGen IT Solutions",
      description: "Osaka-based managed IT services provider. 45 corporate clients, 80% recurring revenue.",
      industry: "IT Services",
      location: "Osaka",
      revenue: "340000000",
      ebitda: "58000000",
      askingPrice: "250000000",
      employeeCount: 42,
      source: "broker_referral" as const,
      stage: "Sourced",
      kanbanPosition: 0,
    },
    {
      companyName: "Sakura Staffing",
      description: "Temp & perm staffing for manufacturing sector. Strong Aichi presence. Founder retiring at 68.",
      industry: "HR & Staffing",
      location: "Nagoya",
      revenue: "520000000",
      ebitda: "41000000",
      askingPrice: "180000000",
      employeeCount: 28,
      source: "agent_scraped" as const,
      stage: "Sourced",
      kanbanPosition: 1,
    },
    {
      companyName: "Hoshi Cleaning Services",
      description: "Commercial cleaning and facility management. 120+ contracts across Kanto region.",
      industry: "Facility Management",
      location: "Tokyo",
      revenue: "280000000",
      ebitda: "35000000",
      askingPrice: "160000000",
      employeeCount: 95,
      source: "broker_referral" as const,
      stage: "Sourced",
      kanbanPosition: 2,
    },
    // IM Review (2)
    {
      companyName: "Fujimoto Accounting",
      description: "Full-service accounting & tax advisory. 200+ SMB clients in Fukuoka. Cloud-first practice using freee.",
      industry: "Accounting & BPO",
      location: "Fukuoka",
      revenue: "190000000",
      ebitda: "52000000",
      askingPrice: "230000000",
      employeeCount: 18,
      source: "broker_referral" as const,
      stage: "IM Review",
      kanbanPosition: 0,
    },
    {
      companyName: "CloudBridge Systems",
      description: "AWS migration & cloud ops for mid-market. Top-tier AWS partner. 92% client retention.",
      industry: "IT Services",
      location: "Tokyo",
      revenue: "480000000",
      ebitda: "86000000",
      askingPrice: "420000000",
      employeeCount: 55,
      source: "manual" as const,
      stage: "IM Review",
      kanbanPosition: 1,
    },
    // Initial Call (1)
    {
      companyName: "Tanaka HR Partners",
      description: "Payroll outsourcing and labor consulting. Deep expertise in Japanese labor law compliance.",
      industry: "HR & Staffing",
      location: "Tokyo",
      revenue: "310000000",
      ebitda: "62000000",
      askingPrice: "280000000",
      employeeCount: 35,
      source: "broker_referral" as const,
      stage: "Initial Call",
      kanbanPosition: 0,
    },
    // LOI (1)
    {
      companyName: "Kanto IT Support",
      description: "Helpdesk and on-site IT support for 80+ companies. 24/7 NOC. ISO 27001 certified.",
      industry: "IT Services",
      location: "Yokohama",
      revenue: "420000000",
      ebitda: "75000000",
      askingPrice: "350000000",
      employeeCount: 68,
      source: "broker_referral" as const,
      stage: "LOI",
      kanbanPosition: 0,
    },
    // Due Diligence (1)
    {
      companyName: "Shibuya Digital Agency",
      description: "Web development and digital marketing. Transition from project to retainer model underway.",
      industry: "IT Services",
      location: "Tokyo",
      revenue: "260000000",
      ebitda: "44000000",
      askingPrice: "200000000",
      employeeCount: 30,
      source: "manual" as const,
      stage: "Due Diligence",
      kanbanPosition: 0,
    },
    // Closed Won (1)
    {
      companyName: "ProNet Managed Services",
      description: "First acquisition. Network infrastructure & managed IT for SMBs in Saitama/Tokyo corridor.",
      industry: "IT Services",
      location: "Saitama",
      revenue: "380000000",
      ebitda: "68000000",
      askingPrice: "300000000",
      employeeCount: 48,
      source: "broker_referral" as const,
      stage: "Closed Won",
      status: "closed_won" as const,
      kanbanPosition: 0,
    },
    // Passed (2)
    {
      companyName: "Global Outsource KK",
      description: "Offshore BPO to Vietnam. Passed due to regulatory complexity and key-man risk.",
      industry: "Accounting & BPO",
      location: "Tokyo",
      revenue: "150000000",
      ebitda: "18000000",
      askingPrice: "100000000",
      employeeCount: 12,
      source: "agent_scraped" as const,
      stage: "Passed",
      status: "passed" as const,
      kanbanPosition: 0,
    },
    {
      companyName: "Meguro Print & Design",
      description: "Traditional print shop pivoting to digital. Revenue declining 15% YoY. Passed.",
      industry: "Other",
      location: "Tokyo",
      revenue: "90000000",
      ebitda: "8000000",
      askingPrice: "50000000",
      employeeCount: 15,
      source: "broker_referral" as const,
      stage: "Passed",
      status: "passed" as const,
      kanbanPosition: 1,
    },
  ];

  const insertedDeals = await db
    .insert(deals)
    .values(
      dealData.map((d) => ({
        portcoId: portco.id,
        stageId: stageMap[d.stage],
        companyName: d.companyName,
        description: d.description,
        industry: d.industry,
        location: d.location,
        revenue: d.revenue,
        ebitda: d.ebitda,
        askingPrice: d.askingPrice,
        employeeCount: d.employeeCount,
        source: d.source,
        status: ("status" in d ? d.status : "active") as "active" | "passed" | "closed_won" | "closed_lost",
        kanbanPosition: d.kanbanPosition,
        closedAt: "status" in d && (d.status === "closed_won" || d.status === "passed") ? new Date("2026-01-15") : null,
      }))
    )
    .returning();

  const dealMap = Object.fromEntries(insertedDeals.map((d) => [d.companyName, d]));
  console.log(`Created ${insertedDeals.length} deals`);

  // ── Company Profiles (for deals past Sourced) ──

  const profileData = [
    {
      dealName: "Fujimoto Accounting",
      summary: "Well-run cloud-first accounting practice in Fukuoka with 200+ loyal SMB clients and 27% EBITDA margins. Founder (age 64) is motivated to sell within 6 months. Strong fit for our BPO consolidation thesis.",
      businessModel: "Monthly retainer-based accounting, tax filing, and advisory services. 85% recurring revenue. Average client tenure of 7 years.",
      marketPosition: "Top 3 independent accounting firm in Fukuoka prefecture by SMB client count. Strong referral network with local banks.",
      strengths: ["High recurring revenue (85%)", "Cloud-native on freee platform", "Low client churn (4% annual)", "Clean financials"],
      keyRisks: ["Founder dependency on key client relationships", "Fukuoka geographic concentration", "Salary compression in tight labor market"],
      aiOverallScore: "4.1",
      scoringBreakdown: {
        financial_stability: { score: 4.5, rationale: "27% EBITDA margin, consistent growth, no debt" },
        client_concentration: { score: 3.8, rationale: "Top 5 clients = 22% of revenue. Acceptable." },
        technology: { score: 4.2, rationale: "Already on freee (cloud). API integrations in place." },
        debt_leverage: { score: 5.0, rationale: "Zero debt. Cash reserves of ¥40M." },
        business_model: { score: 4.0, rationale: "85% recurring. Retainer model with annual contracts." },
        ai_readiness: { score: 4.5, rationale: "Cloud-first; ideal candidate for AI bookkeeping automation." },
        org_complexity: { score: 3.5, rationale: "Flat org. 3 senior accountants can run independently." },
        integration_risk: { score: 3.8, rationale: "Moderate. Client migration requires trust-building." },
      },
    },
    {
      dealName: "CloudBridge Systems",
      summary: "High-quality AWS consultancy with elite talent and strong margins. Premium valuation at 4.9x EBITDA reflects competitive interest from strategic buyers. Key risk is talent retention post-acquisition.",
      businessModel: "Project-based AWS migration (40%) and managed cloud operations retainers (60%). Moving toward higher-margin managed services.",
      marketPosition: "One of 12 AWS Premier Partners in Japan. Strong reputation in mid-market financial services vertical.",
      strengths: ["92% client retention rate", "AWS Premier Partner status", "60% recurring managed services revenue", "High-caliber engineering team"],
      keyRisks: ["Premium valuation (4.9x EBITDA)", "Key-man risk: CTO built all internal tooling", "Competitive talent market for cloud engineers"],
      aiOverallScore: "3.8",
      scoringBreakdown: {
        financial_stability: { score: 4.0, rationale: "18% EBITDA margin, strong growth trajectory" },
        client_concentration: { score: 3.2, rationale: "Top client = 18% revenue. Needs diversification." },
        technology: { score: 4.8, rationale: "Best-in-class cloud infra and internal automation." },
        debt_leverage: { score: 4.5, rationale: "Minimal debt. Strong cash conversion." },
        business_model: { score: 3.5, rationale: "60% recurring, 40% project. Improving mix." },
        ai_readiness: { score: 4.0, rationale: "Already uses AI for infrastructure monitoring." },
        org_complexity: { score: 3.0, rationale: "CTO dependency is a concern." },
        integration_risk: { score: 3.0, rationale: "Talent retention risk. Culture-sensitive." },
      },
    },
    {
      dealName: "Tanaka HR Partners",
      summary: "Established payroll outsourcing firm with deep labor law expertise. Sticky client base. Good platform acquisition for HR vertical entry.",
      businessModel: "Monthly payroll processing fees (70%) + hourly labor consulting (30%). Long contract cycles.",
      marketPosition: "Mid-tier player in Tokyo payroll outsourcing. Known for complex compliance cases (foreign worker visas, shift workers).",
      strengths: ["Deep regulatory expertise", "90% client retention", "Counter-cyclical demand", "Long contract durations (avg 5 years)"],
      keyRisks: ["Manual processes could be disrupted by cloud payroll (SmartHR, freee HR)", "Aging workforce (avg age 52)"],
      aiOverallScore: "3.6",
      scoringBreakdown: {
        financial_stability: { score: 3.8, rationale: "20% EBITDA margin. Steady but low growth." },
        client_concentration: { score: 4.0, rationale: "Well-diversified. No client > 8% revenue." },
        technology: { score: 2.5, rationale: "Legacy on-prem systems. Major upgrade needed." },
        debt_leverage: { score: 4.0, rationale: "Low debt. Conservative balance sheet." },
        business_model: { score: 4.0, rationale: "70% recurring payroll fees. Very sticky." },
        ai_readiness: { score: 2.8, rationale: "Low. Manual workflows. Significant AI opportunity." },
        org_complexity: { score: 3.5, rationale: "Simple org but aging team needs succession plan." },
        integration_risk: { score: 3.5, rationale: "Moderate. Tech migration is main risk." },
      },
    },
    {
      dealName: "Kanto IT Support",
      summary: "Solid IT helpdesk and on-site support business with 24/7 NOC. ISO certified. Excellent complement to ProNet (our first acquisition). Synergies in NOC consolidation and cross-selling.",
      businessModel: "Monthly SLA-based support contracts (75%) + time & materials break-fix (25%). Average contract value ¥4.8M/year.",
      marketPosition: "Leading independent IT support provider in Yokohama/Kanagawa. Strong SMB and mid-market presence.",
      strengths: ["ISO 27001 certified", "24/7 NOC operations", "75% recurring SLA revenue", "Natural synergy with ProNet acquisition"],
      keyRisks: ["Margin pressure from rising labor costs", "Some overlap with ProNet service area"],
      aiOverallScore: "4.3",
      scoringBreakdown: {
        financial_stability: { score: 4.2, rationale: "18% EBITDA margin. Growing steadily at 8% YoY." },
        client_concentration: { score: 4.5, rationale: "80+ clients. Top 5 = 15% revenue. Excellent." },
        technology: { score: 3.8, rationale: "Modern ITSM stack. ConnectWise + custom dashboards." },
        debt_leverage: { score: 4.0, rationale: "Small term loan, easily serviceable." },
        business_model: { score: 4.5, rationale: "75% recurring SLA revenue. Very predictable." },
        ai_readiness: { score: 4.0, rationale: "Good data foundation. Ticket automation opportunity." },
        org_complexity: { score: 4.0, rationale: "Clean org. 3 team leads, clear succession." },
        integration_risk: { score: 4.8, rationale: "Low. Natural fit with ProNet. NOC synergies." },
      },
    },
    {
      dealName: "Shibuya Digital Agency",
      summary: "Creative digital agency in transition from project to retainer model. Revenue mix improving but still 55% project-based. Needs 12–18 months to stabilize recurring revenue before full integration value unlocks.",
      businessModel: "Web development projects (55%) + monthly digital marketing retainers (45%). Transitioning to retainer-first model.",
      marketPosition: "Mid-tier digital agency in Shibuya. Known for e-commerce builds on Shopify. Competes with freelancers and larger agencies.",
      strengths: ["Strong design reputation", "Growing retainer base (up from 30% to 45% in 2 years)", "Young, adaptable team"],
      keyRisks: ["Still majority project revenue", "Competitive market with low barriers", "Client acquisition cost rising"],
      aiOverallScore: "3.2",
      scoringBreakdown: {
        financial_stability: { score: 3.0, rationale: "17% EBITDA margin. Improving but volatile." },
        client_concentration: { score: 3.5, rationale: "Top client = 12%. Acceptable." },
        technology: { score: 3.5, rationale: "Modern stack (Next.js, Shopify) but no proprietary IP." },
        debt_leverage: { score: 4.5, rationale: "Debt-free." },
        business_model: { score: 2.8, rationale: "55% project revenue. Transition in progress." },
        ai_readiness: { score: 3.5, rationale: "Using AI for content generation. Room to expand." },
        org_complexity: { score: 3.0, rationale: "Flat but founder handles all sales." },
        integration_risk: { score: 3.0, rationale: "Creative culture may clash with ops-focused platform." },
      },
    },
    {
      dealName: "ProNet Managed Services",
      summary: "First platform acquisition. Network infrastructure and managed IT for SMBs. Strong operator with clean financials. Integration complete — NOC consolidated, back-office migrated to shared services.",
      businessModel: "Managed network services (65%) + hardware procurement (20%) + project work (15%). Transitioning hardware to leasing model.",
      marketPosition: "Dominant in Saitama SMB IT market. Expanding into north Tokyo corridor post-acquisition.",
      strengths: ["First-mover platform for IT vertical", "Clean integration completed", "Strong local brand", "Cross-sell pipeline building"],
      keyRisks: ["Hardware margin erosion", "Geographic concentration in Saitama"],
      aiOverallScore: "4.0",
      scoringBreakdown: {
        financial_stability: { score: 4.0, rationale: "18% EBITDA margin. Stable cash flows." },
        client_concentration: { score: 4.2, rationale: "Well diversified. 60+ clients." },
        technology: { score: 3.5, rationale: "Solid but aging monitoring stack." },
        debt_leverage: { score: 3.8, rationale: "Acquisition financing in place. Manageable." },
        business_model: { score: 3.8, rationale: "65% recurring. Moving hardware to leasing." },
        ai_readiness: { score: 3.5, rationale: "Good data. Implementing AI ticket routing." },
        org_complexity: { score: 4.0, rationale: "Integrated into platform structure cleanly." },
        integration_risk: { score: 5.0, rationale: "Already integrated. Reference case for future deals." },
      },
    },
  ];

  await db.insert(companyProfiles).values(
    profileData.map((p) => ({
      dealId: dealMap[p.dealName].id,
      summary: p.summary,
      businessModel: p.businessModel,
      marketPosition: p.marketPosition,
      strengths: p.strengths,
      keyRisks: p.keyRisks,
      aiOverallScore: p.aiOverallScore,
      scoringBreakdown: p.scoringBreakdown,
      generatedAt: new Date(),
      modelVersion: "gemini-2.5-pro",
    }))
  );
  console.log(`Created ${profileData.length} company profiles`);

  // ── Red Flags ──

  const redFlagData = [
    { dealName: "CloudBridge Systems", flagId: "key_man_risk", severity: "serious", category: "organization", notes: "CTO built all internal tooling and holds key client relationships. No documented succession plan." },
    { dealName: "CloudBridge Systems", flagId: "premium_valuation", severity: "serious", category: "financial", notes: "4.9x EBITDA is above our target range of 3–5x. Competitive pressure from strategic buyers." },
    { dealName: "Tanaka HR Partners", flagId: "technology_obsolescence", severity: "moderate", category: "technology", notes: "Legacy on-prem payroll system. Migration to cloud will cost est. ¥15M and take 6–12 months." },
    { dealName: "Tanaka HR Partners", flagId: "aging_workforce", severity: "moderate", category: "organization", notes: "Average employee age is 52. Need to hire younger talent within 2 years." },
    { dealName: "Shibuya Digital Agency", flagId: "revenue_concentration", severity: "serious", category: "financial", notes: "55% project-based revenue creates quarterly volatility. Pipeline visibility limited to 2 months." },
    { dealName: "Shibuya Digital Agency", flagId: "founder_dependency", severity: "moderate", category: "organization", notes: "Founder handles all major client sales. No sales team or documented process." },
    { dealName: "Kanto IT Support", flagId: "labor_cost_pressure", severity: "moderate", category: "financial", notes: "Technician salaries up 12% in 2 years. SLA pricing hasn't kept pace." },
    { dealName: "Fujimoto Accounting", flagId: "geographic_concentration", severity: "info_gap", category: "market", notes: "100% of clients in Fukuoka prefecture. Expansion strategy unclear." },
  ];

  await db.insert(dealRedFlags).values(
    redFlagData.map((f) => ({
      dealId: dealMap[f.dealName].id,
      portcoId: portco.id,
      flagId: f.flagId,
      severity: f.severity as "critical" | "serious" | "moderate" | "info_gap",
      category: f.category,
      notes: f.notes,
    }))
  );
  console.log(`Created ${redFlagData.length} red flags`);

  // ── Tasks ──

  const taskData = [
    { dealName: "Kanto IT Support", title: "Review financial statements (3 years)", category: "dd_financial" as const, status: "completed" as const, priority: "high" as const },
    { dealName: "Kanto IT Support", title: "Assess NOC consolidation synergies with ProNet", category: "dd_operational" as const, status: "completed" as const, priority: "high" as const },
    { dealName: "Kanto IT Support", title: "Client contract review — key SLA terms", category: "dd_legal" as const, status: "in_progress" as const, priority: "high" as const },
    { dealName: "Kanto IT Support", title: "Employee interviews (team leads)", category: "dd_hr" as const, status: "todo" as const, priority: "medium" as const },
    { dealName: "Kanto IT Support", title: "IT infrastructure audit", category: "dd_it" as const, status: "todo" as const, priority: "medium" as const },
    { dealName: "Shibuya Digital Agency", title: "Revenue quality analysis — project vs retainer split", category: "dd_financial" as const, status: "in_progress" as const, priority: "high" as const },
    { dealName: "Shibuya Digital Agency", title: "Client retention analysis (24 months)", category: "evaluation" as const, status: "completed" as const, priority: "medium" as const },
    { dealName: "Shibuya Digital Agency", title: "Tax compliance review", category: "dd_tax" as const, status: "todo" as const, priority: "medium" as const },
    { dealName: "Tanaka HR Partners", title: "Request employee roster and org chart", category: "evaluation" as const, status: "completed" as const, priority: "medium" as const },
    { dealName: "Tanaka HR Partners", title: "Schedule management presentation", category: "evaluation" as const, status: "in_progress" as const, priority: "high" as const },
    { dealName: "Fujimoto Accounting", title: "Request last 3 years financials", category: "evaluation" as const, status: "todo" as const, priority: "high" as const },
    { dealName: "CloudBridge Systems", title: "Review IM document", category: "evaluation" as const, status: "completed" as const, priority: "high" as const },
    { dealName: "ProNet Managed Services", title: "Post-acquisition integration review (Q1)", category: "pmi_reporting" as const, status: "completed" as const, priority: "medium" as const },
  ];

  await db.insert(dealTasks).values(
    taskData.map((t, i) => ({
      dealId: dealMap[t.dealName].id,
      portcoId: portco.id,
      title: t.title,
      category: t.category,
      status: t.status,
      priority: t.priority,
      position: i,
      completedAt: t.status === "completed" ? new Date("2026-02-28") : null,
    }))
  );
  console.log(`Created ${taskData.length} tasks`);

  // ── Financials (for deals in DD+) ──

  const financialData = [
    { dealName: "Kanto IT Support", period: "FY2023", periodType: "annual" as const, revenue: "380000000", ebitda: "65000000", netIncome: "42000000", ebitdaMarginPct: "17.1", employeeCount: 62 },
    { dealName: "Kanto IT Support", period: "FY2024", periodType: "annual" as const, revenue: "400000000", ebitda: "70000000", netIncome: "46000000", ebitdaMarginPct: "17.5", employeeCount: 65 },
    { dealName: "Kanto IT Support", period: "FY2025", periodType: "annual" as const, revenue: "420000000", ebitda: "75000000", netIncome: "50000000", ebitdaMarginPct: "17.9", employeeCount: 68 },
    { dealName: "Shibuya Digital Agency", period: "FY2023", periodType: "annual" as const, revenue: "210000000", ebitda: "32000000", netIncome: "20000000", ebitdaMarginPct: "15.2", employeeCount: 25 },
    { dealName: "Shibuya Digital Agency", period: "FY2024", periodType: "annual" as const, revenue: "240000000", ebitda: "38000000", netIncome: "24000000", ebitdaMarginPct: "15.8", employeeCount: 28 },
    { dealName: "Shibuya Digital Agency", period: "FY2025", periodType: "annual" as const, revenue: "260000000", ebitda: "44000000", netIncome: "28000000", ebitdaMarginPct: "16.9", employeeCount: 30 },
    { dealName: "ProNet Managed Services", period: "FY2023", periodType: "annual" as const, revenue: "340000000", ebitda: "58000000", netIncome: "38000000", ebitdaMarginPct: "17.1", employeeCount: 42 },
    { dealName: "ProNet Managed Services", period: "FY2024", periodType: "annual" as const, revenue: "360000000", ebitda: "63000000", netIncome: "41000000", ebitdaMarginPct: "17.5", employeeCount: 45 },
    { dealName: "ProNet Managed Services", period: "FY2025", periodType: "annual" as const, revenue: "380000000", ebitda: "68000000", netIncome: "45000000", ebitdaMarginPct: "17.9", employeeCount: 48 },
  ];

  await db.insert(dealFinancials).values(
    financialData.map((f) => ({
      dealId: dealMap[f.dealName].id,
      portcoId: portco.id,
      period: f.period,
      periodType: f.periodType,
      revenue: f.revenue,
      ebitda: f.ebitda,
      netIncome: f.netIncome,
      ebitdaMarginPct: f.ebitdaMarginPct,
      employeeCount: f.employeeCount,
      source: "im_extracted" as const,
    }))
  );
  console.log(`Created ${financialData.length} financial records`);

  // ── Activity Log ──

  const now = new Date();
  const daysAgo = (n: number) => new Date(now.getTime() - n * 86400000);

  const activityData = [
    { dealName: "Kanto IT Support", action: "deal_created", description: "Created deal \"Kanto IT Support\"", createdAt: daysAgo(45) },
    { dealName: "Kanto IT Support", action: "stage_changed", description: "Moved from \"Sourced\" to \"IM Review\"", createdAt: daysAgo(40) },
    { dealName: "Kanto IT Support", action: "profile_generated", description: "AI profile generated (score: 4.3/5)", createdAt: daysAgo(38) },
    { dealName: "Kanto IT Support", action: "stage_changed", description: "Moved from \"IM Review\" to \"Initial Call\"", createdAt: daysAgo(30) },
    { dealName: "Kanto IT Support", action: "stage_changed", description: "Moved from \"Initial Call\" to \"LOI\"", createdAt: daysAgo(15) },
    { dealName: "Shibuya Digital Agency", action: "deal_created", description: "Created deal \"Shibuya Digital Agency\"", createdAt: daysAgo(60) },
    { dealName: "Shibuya Digital Agency", action: "stage_changed", description: "Moved from \"Sourced\" to \"IM Review\"", createdAt: daysAgo(55) },
    { dealName: "Shibuya Digital Agency", action: "stage_changed", description: "Moved from \"IM Review\" to \"Due Diligence\"", createdAt: daysAgo(35) },
    { dealName: "Shibuya Digital Agency", action: "comment_added", description: "Added a comment", createdAt: daysAgo(20) },
    { dealName: "ProNet Managed Services", action: "deal_created", description: "Created deal \"ProNet Managed Services\"", createdAt: daysAgo(120) },
    { dealName: "ProNet Managed Services", action: "stage_changed", description: "Moved from \"LOI\" to \"Closing\"", createdAt: daysAgo(90) },
    { dealName: "ProNet Managed Services", action: "status_changed", description: "Status changed to \"closed_won\"", createdAt: daysAgo(75) },
    { dealName: "ProNet Managed Services", action: "task_completed", description: "Completed task: Post-acquisition integration review (Q1)", createdAt: daysAgo(10) },
    { dealName: "Fujimoto Accounting", action: "deal_created", description: "Created deal \"Fujimoto Accounting\"", createdAt: daysAgo(14) },
    { dealName: "Fujimoto Accounting", action: "profile_generated", description: "AI profile generated (score: 4.1/5)", createdAt: daysAgo(12) },
    { dealName: "CloudBridge Systems", action: "deal_created", description: "Created deal \"CloudBridge Systems\"", createdAt: daysAgo(10) },
    { dealName: "CloudBridge Systems", action: "profile_generated", description: "AI profile generated (score: 3.8/5)", createdAt: daysAgo(8) },
    { dealName: "NextGen IT Solutions", action: "deal_created", description: "Created deal \"NextGen IT Solutions\"", createdAt: daysAgo(3) },
    { dealName: "Sakura Staffing", action: "deal_created", description: "Scraped from broker listing", createdAt: daysAgo(2) },
    { dealName: "Hoshi Cleaning Services", action: "deal_created", description: "Created deal \"Hoshi Cleaning Services\"", createdAt: daysAgo(1) },
  ];

  await db.insert(dealActivityLog).values(
    activityData.map((a) => ({
      dealId: dealMap[a.dealName].id,
      portcoId: portco.id,
      action: a.action,
      description: a.description,
      createdAt: a.createdAt,
    }))
  );
  console.log(`Created ${activityData.length} activity log entries`);

  console.log("\nDemo seed complete! Slug: /demo/pipeline");
  await client.end();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});

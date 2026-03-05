import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq, asc } from "drizzle-orm";
import {
  portcos,
  pipelineStages,
  users,
  deals,
  dealComments,
  dealTasks,
  dealActivityLog,
  dealFinancials,
  companyProfiles,
  files,
  dealRedFlags,
} from "./schema";

const client = postgres(process.env.DATABASE_URL!, { prepare: false });
const db = drizzle(client);

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomBetween(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function seedDemoData() {
  console.log("Seeding demo data...");

  // Get existing portco and stages
  const [portco] = await db.select().from(portcos).where(eq(portcos.slug, "haven-ai-partners")).limit(1);
  if (!portco) {
    console.error("PortCo 'haven-ai-partners' not found. Run db:seed first.");
    process.exit(1);
  }

  const stages = await db
    .select()
    .from(pipelineStages)
    .where(eq(pipelineStages.portcoId, portco.id))
    .orderBy(asc(pipelineStages.position));

  // Get first user as deal owner
  const [user] = await db.select().from(users).limit(1);
  if (!user) {
    console.error("No users found. Sign in first to create a user.");
    process.exit(1);
  }

  // Japanese SMB target companies
  const demoDeals = [
    {
      companyName: "Sakura IT Solutions",
      description: "Mid-market IT managed services provider in Osaka with 200+ SMB clients. Strong recurring revenue from maintenance contracts.",
      industry: "IT Services",
      location: "Osaka, Japan",
      askingPrice: "350000000",
      revenue: "280000000",
      ebitda: "56000000",
      employeeCount: 120,
      source: "broker_referral" as const,
      stageIdx: 4, // Due Diligence
    },
    {
      companyName: "TechBridge Corp",
      description: "Systems integration and cloud migration firm serving mid-market enterprises in Tokyo. Growing 20% YoY.",
      industry: "IT Services",
      location: "Tokyo, Japan",
      askingPrice: "500000000",
      revenue: "420000000",
      ebitda: "84000000",
      employeeCount: 200,
      source: "agent_scraped" as const,
      stageIdx: 2, // Initial Call
    },
    {
      companyName: "Nippon HR Partners",
      description: "HR outsourcing and staffing agency focused on manufacturing sector. 15-year track record with blue-chip clients.",
      industry: "HR Services",
      location: "Nagoya, Japan",
      askingPrice: "220000000",
      revenue: "180000000",
      ebitda: "36000000",
      employeeCount: 85,
      source: "manual" as const,
      stageIdx: 3, // LOI
    },
    {
      companyName: "CleanPro Facilities",
      description: "Commercial cleaning and facility management company operating across Kanto region. 500+ active contracts.",
      industry: "Facility Management",
      location: "Tokyo, Japan",
      askingPrice: "180000000",
      revenue: "150000000",
      ebitda: "30000000",
      employeeCount: 300,
      source: "broker_referral" as const,
      stageIdx: 1, // IM Review
    },
    {
      companyName: "Kansai Logistics Co.",
      description: "Regional last-mile delivery and warehousing business serving e-commerce companies in Western Japan.",
      industry: "Logistics",
      location: "Kobe, Japan",
      askingPrice: "280000000",
      revenue: "240000000",
      ebitda: "38000000",
      employeeCount: 160,
      source: "agent_scraped" as const,
      stageIdx: 0, // Sourced
    },
    {
      companyName: "Digital Marketing Japan",
      description: "SEO, SEM, and social media agency with proprietary analytics platform. Strong margins and low churn.",
      industry: "Marketing Services",
      location: "Tokyo, Japan",
      askingPrice: "120000000",
      revenue: "95000000",
      ebitda: "28000000",
      employeeCount: 45,
      source: "manual" as const,
      stageIdx: 0, // Sourced
    },
    {
      companyName: "Yamato Accounting Group",
      description: "Accounting and tax advisory firm serving 800+ SMB clients. Highly recurring fee-based revenue.",
      industry: "Professional Services",
      location: "Fukuoka, Japan",
      askingPrice: "200000000",
      revenue: "160000000",
      ebitda: "48000000",
      employeeCount: 70,
      source: "broker_referral" as const,
      stageIdx: 1, // IM Review
    },
    {
      companyName: "Green Energy Systems",
      description: "Solar panel installation and maintenance for commercial buildings. Government subsidies driving growth.",
      industry: "Energy Services",
      location: "Sapporo, Japan",
      askingPrice: "150000000",
      revenue: "130000000",
      ebitda: "22000000",
      employeeCount: 55,
      source: "agent_scraped" as const,
      stageIdx: 0, // Sourced
    },
    {
      companyName: "MedSupply Tokyo",
      description: "Medical supplies distributor with exclusive contracts in 3 prefectures. Aging founder looking to exit.",
      industry: "Healthcare Services",
      location: "Tokyo, Japan",
      askingPrice: "400000000",
      revenue: "320000000",
      ebitda: "64000000",
      employeeCount: 90,
      source: "broker_referral" as const,
      stageIdx: 5, // Closing
    },
    {
      companyName: "Shikoku Security Services",
      description: "Physical security and monitoring company with proprietary IoT platform. Dominant market share in Shikoku region.",
      industry: "Security Services",
      location: "Takamatsu, Japan",
      askingPrice: "250000000",
      revenue: "200000000",
      ebitda: "44000000",
      employeeCount: 180,
      source: "manual" as const,
      stageIdx: 2, // Initial Call
    },
    {
      companyName: "Pacific Payroll Services",
      description: "Cloud-based payroll processing for SMBs. 2,000+ active clients with 95% retention rate.",
      industry: "HR Services",
      location: "Yokohama, Japan",
      askingPrice: "300000000",
      revenue: "190000000",
      ebitda: "57000000",
      employeeCount: 60,
      source: "agent_scraped" as const,
      stageIdx: 6, // Closed Won
      status: "closed_won" as const,
    },
    {
      companyName: "Kyushu Waste Management",
      description: "Industrial waste collection and recycling. Regulatory moat with hard-to-obtain permits.",
      industry: "Environmental Services",
      location: "Kumamoto, Japan",
      askingPrice: "180000000",
      revenue: "140000000",
      ebitda: "35000000",
      employeeCount: 110,
      source: "manual" as const,
      stageIdx: 7, // Passed
      status: "passed" as const,
    },
  ];

  const createdDeals: Array<typeof deals.$inferSelect> = [];

  for (let i = 0; i < demoDeals.length; i++) {
    const d = demoDeals[i];
    const stage = stages[d.stageIdx] ?? stages[0];
    const [deal] = await db
      .insert(deals)
      .values({
        portcoId: portco.id,
        stageId: stage.id,
        companyName: d.companyName,
        description: d.description,
        source: d.source,
        askingPrice: d.askingPrice,
        revenue: d.revenue,
        ebitda: d.ebitda,
        location: d.location,
        industry: d.industry,
        employeeCount: d.employeeCount,
        assignedTo: user.id,
        kanbanPosition: i,
        status: (d as any).status ?? "active",
        closedAt: (d as any).status === "closed_won" || (d as any).status === "passed" ? new Date() : null,
      })
      .returning();
    createdDeals.push(deal);
    console.log(`  Created deal: ${d.companyName} (${stage.name})`);
  }

  // Add comments to some deals
  const commentTexts = [
    "Had a productive call with the founder. They're motivated to close within 6 months.",
    "Financial documents look clean. Revenue growth is consistent with broker claims.",
    "Concerns about key-man dependency. Need to assess management depth.",
    "Broker mentioned there are 2 other interested parties. We should move quickly.",
    "Comparable transactions in this space suggest 5-7x EBITDA is fair.",
    "Initial due diligence findings are positive. No red flags so far.",
    "Customer concentration is a risk — top 3 clients represent 40% of revenue.",
    "Spoke with industry expert. Market is expected to grow 8% CAGR over next 5 years.",
    "NDA signed. Waiting for data room access.",
    "Integration synergies could add 15% to EBITDA within 18 months.",
  ];

  for (const deal of createdDeals.slice(0, 8)) {
    const numComments = randomBetween(1, 3);
    for (let i = 0; i < numComments; i++) {
      await db.insert(dealComments).values({
        dealId: deal.id,
        userId: user.id,
        content: randomFrom(commentTexts),
      });
    }
  }
  console.log("  Added comments to deals");

  // Add tasks to deals in active stages
  const taskTemplates = [
    { title: "Review Information Memorandum", category: "evaluation" as const, priority: "high" as const },
    { title: "Schedule management call", category: "evaluation" as const, priority: "medium" as const },
    { title: "Build financial model", category: "dd_financial" as const, priority: "high" as const },
    { title: "Review customer contracts", category: "dd_legal" as const, priority: "high" as const },
    { title: "Assess IT infrastructure", category: "dd_it" as const, priority: "medium" as const },
    { title: "Analyze employee retention data", category: "dd_hr" as const, priority: "medium" as const },
    { title: "Verify tax compliance", category: "dd_tax" as const, priority: "high" as const },
    { title: "Draft LOI terms", category: "closing" as const, priority: "critical" as const },
    { title: "Competitive landscape analysis", category: "evaluation" as const, priority: "low" as const },
    { title: "Site visit planning", category: "dd_operational" as const, priority: "medium" as const },
    { title: "Create integration playbook", category: "pmi_integration" as const, priority: "medium" as const },
    { title: "Setup KPI dashboards", category: "pmi_reporting" as const, priority: "low" as const },
  ];

  const statuses: Array<"todo" | "in_progress" | "completed" | "blocked"> = ["todo", "in_progress", "completed", "blocked"];

  for (const deal of createdDeals.slice(0, 6)) {
    const numTasks = randomBetween(3, 6);
    const selected = [...taskTemplates].sort(() => Math.random() - 0.5).slice(0, numTasks);
    for (let i = 0; i < selected.length; i++) {
      const t = selected[i];
      const status = i < 2 ? "completed" : randomFrom(statuses);
      await db.insert(dealTasks).values({
        dealId: deal.id,
        portcoId: portco.id,
        title: t.title,
        category: t.category,
        priority: t.priority,
        status,
        completedAt: status === "completed" ? new Date() : null,
        position: i,
      });
    }
  }
  console.log("  Added tasks to deals");

  // Add activity log entries
  const actions = [
    { action: "deal_created", description: "Deal created" },
    { action: "stage_changed", description: "Moved to next stage" },
    { action: "comment_added", description: "Added a comment" },
    { action: "task_created", description: "Created a new task" },
    { action: "task_completed", description: "Completed a task" },
    { action: "file_uploaded", description: "Uploaded a document" },
    { action: "assigned", description: "Assigned to team member" },
  ];

  for (const deal of createdDeals) {
    const numEntries = randomBetween(3, 8);
    for (let i = 0; i < numEntries; i++) {
      const act = randomFrom(actions);
      const daysAgo = randomBetween(0, 30);
      await db.insert(dealActivityLog).values({
        dealId: deal.id,
        portcoId: portco.id,
        userId: user.id,
        action: act.action,
        description: `${act.description} for ${deal.companyName}`,
        createdAt: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000),
      });
    }
  }
  console.log("  Added activity log entries");

  // Add financial periods to deals in advanced stages
  const advancedDeals = createdDeals.filter((_, i) => [0, 2, 8, 10].includes(i));
  for (const deal of advancedDeals) {
    const baseRevenue = Number(deal.revenue) || 200000000;
    for (const year of ["FY2022", "FY2023", "FY2024"]) {
      const multiplier = year === "FY2022" ? 0.85 : year === "FY2023" ? 0.93 : 1;
      const rev = Math.round(baseRevenue * multiplier);
      const ebitdaMargin = randomBetween(15, 30);
      const ebitda = Math.round(rev * ebitdaMargin / 100);
      const netIncome = Math.round(ebitda * 0.65);
      await db.insert(dealFinancials).values({
        dealId: deal.id,
        portcoId: portco.id,
        period: year,
        periodType: "annual",
        revenue: rev.toString(),
        ebitda: ebitda.toString(),
        netIncome: netIncome.toString(),
        ebitdaMarginPct: ebitdaMargin.toString(),
        source: "manual",
      });
    }
  }
  console.log("  Added financial periods");

  // Add AI profile for the DD deal (Sakura IT Solutions)
  await db.insert(companyProfiles).values({
    dealId: createdDeals[0].id,
    summary:
      "Sakura IT Solutions is a well-established managed IT services provider headquartered in Osaka, serving over 200 SMB clients across the Kansai region. The company has built a strong reputation for reliable service delivery and maintains long-term contracts with high renewal rates. Revenue is predominantly recurring (~85%) from maintenance and support agreements.",
    businessModel:
      "Recurring managed services model with tiered service packages (Basic, Professional, Enterprise). Revenue split: 65% managed services, 20% project-based work, 15% hardware resale. Average contract length is 3.2 years with 92% renewal rate.",
    marketPosition:
      "Top 5 MSP in the Kansai region by revenue. Strong brand recognition among manufacturing and retail SMBs. Differentiator is bilingual (JP/EN) support team and proprietary monitoring platform.",
    strengths: [
      "High recurring revenue base (85% of total)",
      "Strong client retention (92% renewal rate)",
      "Proprietary monitoring platform reduces operational costs",
      "Experienced management team with 10+ year tenure",
      "Diversified client base across multiple industries",
    ],
    keyRisks: [
      "Key-man risk: founder handles top 20 client relationships",
      "Technology stack needs modernization (3-year investment cycle)",
      "Increasing competition from national MSP chains",
      "Labor market tightness in IT sector driving wage inflation",
    ],
    industryTrends:
      "The Japanese IT services market is growing at 5-7% annually, driven by DX (digital transformation) initiatives and increasing cloud adoption. SMBs are increasingly outsourcing IT management, creating tailwinds for managed service providers. Consolidation is accelerating as smaller players struggle with talent acquisition.",
    aiOverallScore: "3.9",
    scoringBreakdown: {
      financial_stability: 4.0,
      debt_leverage: 4.5,
      org_complexity: 4.0,
      technology: 3.5,
      client_concentration: 3.5,
      ai_readiness: 3.0,
      business_model: 4.0,
      integration_risk: 3.5,
    },
    generatedAt: new Date(),
    modelVersion: "claude-sonnet-4-5-20250514",
  });
  console.log("  Added AI profile for Sakura IT Solutions");

  // Add some files to the DD deal
  const demoFiles = [
    { fileName: "Sakura_IT_IM_2024.pdf", fileType: "im_pdf" as const, sizeBytes: 2450000, processingStatus: "completed" as const },
    { fileName: "Sakura_NDA_Signed.pdf", fileType: "nda" as const, sizeBytes: 180000, processingStatus: "completed" as const },
    { fileName: "Financial_Statements_FY2024.xlsx", fileType: "dd_financial" as const, sizeBytes: 890000, processingStatus: "completed" as const },
    { fileName: "Customer_Contract_Summary.pdf", fileType: "dd_legal" as const, sizeBytes: 1200000, processingStatus: "pending" as const },
    { fileName: "IT_Infrastructure_Audit.docx", fileType: "dd_it" as const, sizeBytes: 540000, processingStatus: "pending" as const },
  ];

  for (const f of demoFiles) {
    await db.insert(files).values({
      dealId: createdDeals[0].id,
      portcoId: portco.id,
      uploadedBy: user.id,
      fileName: f.fileName,
      fileType: f.fileType,
      sizeBytes: f.sizeBytes,
      processingStatus: f.processingStatus,
    });
  }
  console.log("  Added files to Sakura IT Solutions");

  // Add red flags to various deals
  const redFlagAssignments = [
    // Sakura IT (DD stage) - some moderate and info gap flags
    { dealIdx: 0, flags: [
      { flagId: "mod_ppl_key_person", severity: "moderate" as const, category: "people" },
      { flagId: "mod_tech_mixed_stack", severity: "moderate" as const, category: "technology" },
      { flagId: "gap_cli_no_churn", severity: "info_gap" as const, category: "clients" },
      { flagId: "ser_cli_top3_60pct", severity: "serious" as const, category: "clients" },
    ]},
    // TechBridge (Initial Call) - info gaps since early stage
    { dealIdx: 1, flags: [
      { flagId: "gap_fin_no_cashflow", severity: "info_gap" as const, category: "financial" },
      { flagId: "gap_ppl_no_org", severity: "info_gap" as const, category: "people" },
      { flagId: "gap_tech_no_stack", severity: "info_gap" as const, category: "technology" },
    ]},
    // Nippon HR (LOI) - some serious concerns
    { dealIdx: 2, flags: [
      { flagId: "ser_ppl_founder_resist", severity: "serious" as const, category: "people" },
      { flagId: "ser_biz_heavy_subcon", severity: "serious" as const, category: "business_model" },
      { flagId: "mod_fin_thin_margins", severity: "moderate" as const, category: "financial" },
      { flagId: "jp_labor_service_zangyo", severity: "serious" as const, category: "japan_specific" },
    ]},
    // MedSupply (Closing) - mostly resolved
    { dealIdx: 8, flags: [
      { flagId: "mod_cli_top_30_40", severity: "moderate" as const, category: "clients", resolved: true },
      { flagId: "gap_leg_no_related_party", severity: "info_gap" as const, category: "legal_regulatory", resolved: true },
      { flagId: "mod_ppl_short_founder", severity: "moderate" as const, category: "people" },
    ]},
    // Kyushu Waste (Passed) - critical flags that killed the deal
    { dealIdx: 11, flags: [
      { flagId: "crit_leg_investigation", severity: "critical" as const, category: "legal_regulatory" },
      { flagId: "crit_ops_data_breach", severity: "critical" as const, category: "operations" },
      { flagId: "ser_comp_weak_controls", severity: "serious" as const, category: "compliance_governance" },
    ]},
  ];

  for (const assignment of redFlagAssignments) {
    const deal = createdDeals[assignment.dealIdx];
    for (const flag of assignment.flags) {
      await db.insert(dealRedFlags).values({
        dealId: deal.id,
        portcoId: portco.id,
        flagId: flag.flagId,
        severity: flag.severity,
        category: flag.category,
        flaggedBy: user.id,
        resolved: (flag as any).resolved ?? false,
        resolvedAt: (flag as any).resolved ? new Date() : null,
        resolvedBy: (flag as any).resolved ? user.id : null,
      });
    }
  }
  console.log("  Added red flags to deals");

  console.log("\nDemo data seeding complete!");
  console.log(`  ${createdDeals.length} deals created across pipeline stages`);
  await client.end();
  process.exit(0);
}

seedDemoData().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});

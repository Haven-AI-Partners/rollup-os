import "dotenv/config";
import { db } from "./index";
import { brokerFirms, brokerContacts } from "./schema";
import { eq } from "drizzle-orm";

/** Upsert a broker firm by name, return its ID */
async function upsertFirm(data: {
  name: string;
  website: string | null;
  region: string;
  specialty: string;
  listingUrl?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<string> {
  const [existing] = await db
    .select({ id: brokerFirms.id })
    .from(brokerFirms)
    .where(eq(brokerFirms.name, data.name))
    .limit(1);

  if (existing) {
    await db
      .update(brokerFirms)
      .set({
        website: data.website,
        region: data.region,
        specialty: data.specialty,
        listingUrl: data.listingUrl ?? null,
        metadata: data.metadata ?? {},
        updatedAt: new Date(),
      })
      .where(eq(brokerFirms.id, existing.id));
    console.log(`  Updated: ${data.name}`);
    return existing.id;
  }

  const [created] = await db
    .insert(brokerFirms)
    .values({
      name: data.name,
      website: data.website,
      region: data.region,
      specialty: data.specialty,
      listingUrl: data.listingUrl ?? null,
      metadata: data.metadata ?? {},
    })
    .returning({ id: brokerFirms.id });
  console.log(`  Created: ${data.name}`);
  return created.id;
}

/** Add a contact if not already present (by name match within the firm) */
async function ensureContact(firmId: string, fullName: string, title?: string) {
  const contacts = await db
    .select({ fullName: brokerContacts.fullName })
    .from(brokerContacts)
    .where(eq(brokerContacts.brokerFirmId, firmId));

  if (contacts.some((c) => c.fullName === fullName)) {
    console.log(`    Contact already exists: ${fullName}`);
    return;
  }

  await db.insert(brokerContacts).values({
    brokerFirmId: firmId,
    fullName,
    title: title ?? null,
  });
  console.log(`    Added contact: ${fullName}`);
}

async function main() {
  console.log("Updating brokers with detailed metadata...\n");

  // 1. 日本M&Aセンター — Japan's largest M&A advisory by deal count
  await upsertFirm({
    name: "日本M&Aセンター",
    website: "https://www.nihon-ma.co.jp/",
    region: "Japan (nationwide, HQ: Tokyo Chiyoda-ku)",
    specialty: "M&A advisory & brokerage (market leader by deal count)",
    listingUrl: null,
    metadata: {
      type: "Advisory firm (listed)",
      nameEn: "Nihon M&A Center",
      publicOrPrivate: "Public (TSE Prime: 2127, via holding company)",
      holdingCompany: "日本M&Aセンターホールディングス (TSE: 2127)",
      employees: "1,086 (consolidated, as of Mar 2025)",
      revenue: "¥44.1B (~$300M) FY2025 consolidated",
      operatingMargin: "~40%",
      founded: "1991",
      avgDealSize: "¥100M–¥5B",
      dealFlow: "High volume, highest in Japan — 650+ deals/year, 10,000+ cumulative",
      feeModel: "Advisory + success fee (bilateral — fees from both buyer and seller)",
      cumulativeDeals: "10,000+ (Guinness World Record for 5 consecutive years)",
      domesticOffices: "7 major (Tokyo, Osaka, Nagoya, Hiroshima, Fukuoka, Sapporo, Okinawa) + 15 satellite offices",
      internationalOffices: "Singapore, Indonesia, Vietnam, Malaysia, Thailand",
      partnerNetwork: "95/97 regional banks, 221/254 credit unions, 1,072 accounting firms",
      subsidiaries: "Batonz (online M&A marketplace), others",
      services: "M&A brokerage, PMI support, corporate valuation, IPO support, MBO support, corporate restructuring",
      chairman: "Taku Miyake (三宅 卓)",
      president: "Naoki Takeuchi (竹内 直樹)",
      notes: "Japan's largest M&A advisory firm by deal count. Guinness World Record holder for most M&A deals handled annually (5 consecutive years). Parent company of Batonz. Dominant in SMB succession-driven M&A with unmatched network of regional banks, credit unions, and accounting firms. ~40% operating margins via bilateral fee model.",
      relevance: "The single most important broker relationship for Japan M&A. Unmatched deal sourcing network through regional bank/credit union/accounting firm partnerships. Premium pricing but best coverage of the market.",
      status: "紹介待ち (awaiting introduction)",
    },
  });

  // 2. M&Aキャピタルパートナーズ — add contact 前川さん
  const [macp] = await db
    .select({ id: brokerFirms.id })
    .from(brokerFirms)
    .where(eq(brokerFirms.name, "MA Capital Partners"))
    .limit(1);
  if (macp) {
    await ensureContact(macp.id, "前川さん");
  } else {
    console.log("  WARNING: MA Capital Partners not found in DB");
  }

  // 3. ストライク — already exists, no new contact

  // 4. M&A総合研究所 — add contact 田中稚拓さん
  const [masouken] = await db
    .select({ id: brokerFirms.id })
    .from(brokerFirms)
    .where(eq(brokerFirms.name, "株式会社M＆A総合研究所"))
    .limit(1);
  if (masouken) {
    await ensureContact(masouken.id, "田中稚拓さん");
  } else {
    console.log("  WARNING: 株式会社M＆A総合研究所 not found in DB");
  }

  // 5. FundBook — add contact 篠崎さん
  const [fundbook] = await db
    .select({ id: brokerFirms.id })
    .from(brokerFirms)
    .where(eq(brokerFirms.name, "FundBook"))
    .limit(1);
  if (fundbook) {
    await ensureContact(fundbook.id, "篠崎さん");
  } else {
    console.log("  WARNING: FundBook not found in DB");
  }

  // 6. CINC Capital — subsidiary of CINC (TSE: 4378)
  const cincId = await upsertFirm({
    name: "CINC Capital",
    website: "https://cinc-capital.co.jp/",
    region: "Japan (HQ: Tokyo Minato-ku, Toranomon)",
    specialty: "M&A advisory & brokerage (tech-driven)",
    listingUrl: null,
    metadata: {
      type: "Advisory firm (subsidiary of listed company)",
      nameJp: "株式会社シンクキャピタル",
      parentCompany: "CINC (TSE Growth: 4378)",
      publicOrPrivate: "Subsidiary of listed company",
      founded: "November 2024",
      employees: "Part of CINC group (114 consolidated employees)",
      avgDealSize: "SMB to mid-market",
      feeModel: "Complete success-based fee (着手金・中間金0円). Sellers pay flat 4% success fee only.",
      chairman: "Tomonori Ishimatsu (石松友典)",
      headquarters: "Tokyu Toranomon Building 6F, 1-21-19 Toranomon, Minato-ku, Tokyo",
      registrations: "Registered M&A support institution with SME Agency, M&A Support Institution Association member",
      technology: "Proprietary CAMM DB — M&A database for unlisted companies using AI and NLP",
      sectors: "Construction, staffing, IT, transportation, real estate, healthcare, and more",
      advisorProfile: "10+ years industry experience, average 30+ completed transactions per advisor",
      notes: "Young subsidiary (est. 2024) of CINC, a martech company. Differentiates with AI-powered proprietary database (CAMM DB) for unlisted company M&A data. Flat 4% success fee is competitive. Leverages parent company's AI/NLP technology for deal sourcing.",
      relevance: "Interesting for their tech-driven approach and AI-powered deal database. Flat 4% fee is seller-friendly. Still young but backed by listed parent company.",
    },
  });
  await ensureContact(cincId, "齋藤さん");

  // 7. ジャパンM&Aインキュベーション — founded May 2024, VC-backed
  const jmaiId = await upsertFirm({
    name: "ジャパンM&Aインキュベーション",
    website: "https://jmai.co.jp/",
    region: "Japan (HQ: Tokyo Minato-ku, Toranomon)",
    specialty: "M&A advisory + strategy consulting + talent placement",
    listingUrl: null,
    metadata: {
      type: "Advisory firm (VC-backed startup)",
      nameEn: "Japan M&A Incubation",
      founded: "May 2024",
      publicOrPrivate: "Private (VC-backed)",
      funding: "¥300M from Global Brain (Jun 2025)",
      headquarters: "Sumitomo Fudosan Toranomon Tower 19F, 2-2-1 Toranomon, Minato-ku, Tokyo",
      ceo: "Takumi Yura (由良 拓未) — ex-Deutsche Securities, ex-McKinsey, ex-Carlyle",
      coo: "Takuma Sakamoto (坂本 拓磨) — ex-Merrill Lynch/BofA Securities (investment banking, M&A & capital markets)",
      advisor: "Satoshi Ohuchi (大内 聡) — ex-Ministry of Finance, ex-METI",
      services: "M&A advisory, strategy consulting, PMI support, talent placement (licensed employment agency 13-ユ-317171)",
      vision: "Building 'management support infrastructure anyone can use' — systematizing professional knowledge with generative AI",
      differentiators: "Three-pillar approach: Strategy consulting (business), M&A advisory (capital), and talent placement (organization). Founded by elite team from Deutsche Securities, McKinsey, Carlyle, and Merrill Lynch.",
      notes: "Very young (May 2024) but exceptionally credentialed founding team. Raised ¥300M from Global Brain in Jun 2025 to build AI-powered platform. Unique positioning combining M&A, strategy consulting, and recruitment under one roof. AI-focused vision for professionalizing M&A advisory.",
      relevance: "High-caliber team with top-tier pedigree. Still early-stage but strong backers and differentiated model. Worth building relationship early. Contact: 由良さん (CEO/co-founder).",
    },
  });
  await ensureContact(jmaiId, "由良さん", "CEO / Co-founder");

  // 8. M&Aロイヤル — fast-growing, 240 employees
  const royalId = await upsertFirm({
    name: "M&Aロイヤル",
    website: "https://ma-la.co.jp/",
    region: "Japan (HQ: Tokyo Chiyoda-ku, Marunouchi)",
    specialty: "M&A advisory & brokerage",
    listingUrl: null,
    metadata: {
      type: "Advisory firm",
      nameEn: "M&A Loyal Advisory",
      officialName: "M&Aロイヤルアドバイザリー株式会社",
      founded: "November 2021",
      publicOrPrivate: "Private",
      employees: "240 (as of Mar 2026)",
      capital: "¥33.4M",
      president: "Ryo Hashiba (橋場 涼)",
      coRepresentative: "Ari Arakawa (荒川 有理)",
      headquarters: "Marunouchi Trust Tower Main Building 20F, 1-8-3 Marunouchi, Chiyoda-ku, Tokyo",
      offices: "Tokyo (Marunouchi HQ + Nihonbashi), Osaka",
      feeModel: "Complete success-based fee (完全成功報酬型) — no upfront, interim, or monthly fees for sellers",
      services: "M&A brokerage, business succession consulting, company valuation, transfer/acquisition advisory",
      registrations: "Member of Japan M&A Intermediaries Association (M&A仲介協会)",
      avgDealSize: "SMB to mid-market",
      notes: "Rapidly growing firm — from founding in Nov 2021 to 240 employees by Mar 2026. Complete success-fee model. Headquartered in prestigious Marunouchi Trust Tower. Among ~3,000 M&A intermediaries in Japan, selected by clients for quality service.",
      relevance: "Fast-growing with significant headcount (240 employees in ~4 years). Complete success-fee model is seller-friendly. Two contacts: 渡部歩さん, 白木大二郎さん.",
    },
  });
  await ensureContact(royalId, "渡部歩さん");
  await ensureContact(royalId, "白木大二郎さん");

  // 9. ACN経営研究所 — part of ACN Group, 87 employees
  const acnId = await upsertFirm({
    name: "ACN経営研究所",
    website: "https://www.acn-consulting.jp/",
    region: "Japan (HQ: Tokyo Chiyoda-ku, Kojimachi)",
    specialty: "M&A advisory & management consulting",
    listingUrl: null,
    metadata: {
      type: "Advisory firm (subsidiary)",
      nameEn: "ACN Business Consulting Institute",
      officialName: "株式会社ACN経営研究所",
      formerName: "株式会社日本経営総合研究所 (renamed Feb 2026 upon joining ACN Group)",
      parentCompany: "ACNグループ",
      founded: "2022",
      publicOrPrivate: "Private (subsidiary of ACN Group)",
      employees: "87",
      capital: "Not disclosed",
      president: "Naoki Tanaka (田中 直樹)",
      headquarters: "MFPR Kojimachi Building 5F, 5-7-2 Kojimachi, Chiyoda-ku, Tokyo",
      feeModel: "Complete success-based fee (完全成功報酬型) — no acquisition fees, interim payments, or monthly fees from sellers until final contract",
      services: "M&A advisory, company valuation, second opinion services, business succession seminars, growth strategy consulting",
      registrations: "Registered M&A support institution with SME Agency",
      team: "Lawyers, accountants, and former investment bankers",
      growthRate: "130%+ annual revenue growth since founding",
      goals: "Short-term: IPO. Medium-term (2030): Become Japan's #1 M&A intermediary",
      philosophy: "一蓮托生 (sharing fate with clients) — 'we don't charge until results are delivered'",
      notes: "Young but ambitious firm. Originally 日本経営総合研究所, renamed to ACN経営研究所 in Feb 2026 after becoming part of ACN Group. Targeting 130%+ annual growth with IPO ambitions. Team includes lawyers, accountants, and ex-investment bankers. Free second-opinion services on existing M&A transactions.",
      relevance: "Growing firm with 87 employees and aggressive growth targets. Part of ACN Group. Complete success-fee model. Contact: 田中さん.",
    },
  });
  await ensureContact(acnId, "田中さん");

  console.log("\nDone!");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

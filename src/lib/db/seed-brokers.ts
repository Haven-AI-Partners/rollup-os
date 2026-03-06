import "dotenv/config";
import { db } from "./index";
import { brokerFirms } from "./schema";
import { eq } from "drizzle-orm";

interface FirmUpdate {
  name: string;
  website: string;
  region: string;
  specialty: string;
  listingUrl: string | null;
  metadata: Record<string, unknown>;
}

const firms: FirmUpdate[] = [
  {
    name: "TRANBI",
    website: "https://www.tranbi.com/",
    region: "Japan (nationwide)",
    specialty: "SMB M&A marketplace",
    listingUrl: "https://www.tranbi.com/",
    metadata: {
      type: "Online marketplace",
      registeredUsers: "200,000+",
      avgDealSize: "¥10M–¥300M (~$70K–$2M)",
      dealFlow: "High volume, small deals — most listings ¥10M–¥100M revenue",
      feeModel: "Subscription-based, no success fee",
      partnerNetwork: "300+ financial institutions and M&A experts",
      founded: "2016",
      totalFunding: "$9.9M",
      publicOrPrivate: "Private",
      notes: "Japan's largest online M&A platform by user count. No success fees — differentiator vs traditional brokers. Plans to expand into Southeast Asia. Strong for sourcing high-volume small SMB deals.",
      relevance: "Primary sourcing channel for sub-¥300M deals. High volume but requires filtering — many lifestyle businesses mixed in.",
    },
  },
  {
    name: "Batonz",
    website: "https://batonz.jp/",
    region: "Japan (nationwide)",
    specialty: "SMB succession M&A",
    listingUrl: "https://batonz.jp/",
    metadata: {
      type: "Online marketplace",
      registeredUsers: "250,000+",
      avgDealSize: "¥5M–¥200M (~$35K–$1.4M)",
      dealFlow: "Very high volume, micro to small deals",
      feeModel: "Success fee only (2% of deal value, min ¥250K)",
      parentCompany: "Japan M&A Center (TSE: 2127)",
      founded: "2018 (spun out of Japan M&A Center)",
      publicOrPrivate: "Subsidiary of listed company",
      notes: "Originally opened by Japan M&A Center to allow partner tax accountants to post small deals. One of the top 3 platforms alongside TRANBI and BizReach Succeed. Very strong in succession-driven deals.",
      relevance: "Excellent for succession deals where aging owners need to sell. Platform quality is high since backed by Japan M&A Center's network of accountants and advisors.",
    },
  },
  {
    name: "Himawari M&A",
    website: "https://himawari-ma5.net/",
    region: "Japan",
    specialty: "M&A matching (buyer-focused)",
    listingUrl: "https://himawari-ma5.net/buyerSearch/",
    metadata: {
      type: "Matching platform",
      registeredUsers: "Unknown",
      avgDealSize: "¥50M–¥500M (~$350K–$3.5M)",
      dealFlow: "Moderate",
      feeModel: "Free registration, fee on deal close",
      operator: "Himawari Partners Inc.",
      founded: "Unknown",
      notes: "Differentiated by showing real buyer names (not anonymized). Two matching methods: browse seller non-name info and make offers, or receive inbound offers. Full-time M&A consultants provide free consultations. Free until deal closes.",
      relevance: "Smaller platform but useful for seeing active buyer landscape. Good for understanding competitive buyer interest.",
    },
  },
  {
    name: "MA Folova",
    website: "https://www.mafolova.biz/",
    region: "Japan",
    specialty: "Non-public M&A matching",
    listingUrl: "https://www.mafolova.biz/",
    metadata: {
      type: "Matching platform (passive)",
      registeredCompanies: "15,000+",
      avgDealSize: "¥100M–¥1B (~$700K–$7M)",
      dealFlow: "Moderate, curated",
      feeModel: "Success fee: 1.5% of deal value or ¥1M minimum (whichever higher)",
      parentCompany: "En Japan Co., Ltd. (TSE: 4849)",
      founded: "Unknown",
      notes: "Completely non-public service — register acquisition needs and wait for advisor recommendations. Only vetted advisors can post deals. Passive model means less work but also less control over deal flow. Backed by major HR company En Japan.",
      relevance: "Good for receiving curated deal flow without active searching. Quality tends to be higher due to advisor vetting, but volume is lower.",
    },
  },
  {
    name: "FundBook",
    website: "https://fundbook.co.jp/",
    region: "Japan (nationwide)",
    specialty: "Hybrid M&A platform + advisory",
    listingUrl: "https://fundbook.co.jp/cloud/login/",
    metadata: {
      type: "Hybrid (platform + advisory)",
      registeredCompanies: "4,500+",
      avgDealSize: "¥100M–¥2B (~$700K–$14M)",
      dealFlow: "Moderate-high, mid-market focus",
      feeModel: "Advisory fees + success fee",
      parentCompany: "CHANGE Holdings (acquired Dec 2024)",
      founded: "2017",
      publicOrPrivate: "Subsidiary (acquired)",
      notes: "Combines tech platform with experienced advisor team. Acquired by CHANGE Holdings in Dec 2024 to boost M&A intermediary business. Targets mid-market deals — higher quality than pure marketplace platforms. Strong tech/cloud infrastructure for deal management.",
      relevance: "Best for mid-market IT services targets. Hybrid model means better deal quality than pure marketplaces. Recently acquired — may see expanded capabilities.",
    },
  },
  {
    name: "SMERGERS",
    website: "https://www.smergers.com/",
    region: "Global (India-headquartered, international reach)",
    specialty: "SME M&A, PE, VC marketplace",
    listingUrl: "https://www.smergers.com/dashboard/",
    metadata: {
      type: "Online marketplace",
      registeredUsers: "100,000+",
      avgDealSize: "$100K–$10M",
      dealFlow: "High volume, global, mixed quality",
      feeModel: "Subscription + optional advisory services",
      founded: "2012",
      publicOrPrivate: "Private",
      services: "M&A, PE/VC fundraising, debt syndication, joint ventures, franchising",
      notes: "Broad platform covering M&A, fundraising, JVs, and franchising. Indian-headquartered with global reach. Provides ancillary services: valuation, due diligence, legal docs. Good for cross-border deal sourcing but quality varies widely.",
      relevance: "Useful for cross-border deal sourcing, especially India/SEA targets. Less relevant for Japan-specific deals. Quality requires heavy filtering.",
    },
  },
  {
    name: "DealStream",
    website: "https://dealstream.com/",
    region: "Global (US-headquartered)",
    specialty: "Main Street & lower mid-market M&A",
    listingUrl: "https://dealstream.com/m-and-a-opportunities-for-sale",
    metadata: {
      type: "Online marketplace",
      registeredUsers: "100,000+",
      avgDealSize: "$500K–$5M (Main Street focus)",
      dealFlow: "High volume, US-centric",
      feeModel: "Subscription-based",
      founded: "1995 (as M&A Marketplace — oldest online M&A marketplace)",
      publicOrPrivate: "Private",
      awards: "2025 Inc. Power Partner Award Winner",
      surveyInsights: "Q4 2025: 73% of participants are buyers, 19% sellers, 23% intermediaries. >50% expect increase in business sales heading into 2026.",
      notes: "Oldest online M&A marketplace (since 1995). Strong US focus on 'Main Street' businesses ($5M and under). Publishes quarterly market outlook surveys with useful market sentiment data. Won 2025 Inc. Power Partner Award.",
      relevance: "Primary channel for US Main Street deals if expanding beyond Japan. Less relevant for Japan IT services targets. Good market intelligence from their quarterly surveys.",
    },
  },
  {
    name: "STRIKE",
    website: "https://www.strike.co.jp/",
    region: "Japan (nationwide, HQ: Tokyo Chiyoda-ku)",
    specialty: "M&A advisory & brokerage",
    listingUrl: "https://www.strike.co.jp/en/smart/",
    metadata: {
      type: "Advisory firm (listed)",
      employees: "191",
      avgDealSize: "¥500M–¥5B (~$3.5M–$35M) — typical seller ~¥1B revenue",
      dealFlow: "Moderate volume, high quality",
      feeModel: "Advisory + success fee (Lehman formula typical)",
      founded: "1997",
      publicOrPrivate: "Public (TSE: 6196, IPO 2016)",
      typicalSeller: "Unlisted companies with ~¥1B revenue",
      typicalBuyer: "Listed/unlisted companies and investment funds",
      services: "Growth strategy M&A, business succession, cross-border, patent data matching (SMART platform)",
      notes: "One of Japan's leading listed M&A boutiques. Operates SMART — a proprietary online M&A matching platform with patent data matching technology. 191 employees, publicly traded since 2016. Focuses on mid-market deals with higher-quality targets.",
      relevance: "Key relationship for mid-market Japanese IT services targets. Higher deal quality and larger deal sizes than marketplace platforms. Worth building strong advisor relationships here.",
    },
  },
  {
    name: "MA Capital Partners",
    website: "https://www.ma-cp.com/",
    region: "Japan (nationwide, HQ: Tokyo)",
    specialty: "M&A advisory (market leader)",
    listingUrl: "https://www.ma-cp.com/deal/",
    metadata: {
      type: "Advisory firm (listed)",
      employees: "200+",
      avgDealSize: "¥500M–¥10B+ (~$3.5M–$70M+)",
      dealFlow: "High quality, mid to upper-market",
      feeModel: "Advisory + success fee",
      founded: "2005",
      publicOrPrivate: "Public (TSE: 6080)",
      marketPosition: "#1 in Japan M&A league tables",
      achievements: "No.1 in three LSEG league table categories (Q3 2025): Domestic Deals by Deal Volume, Completed Deals Involving Japanese Companies, Announced Deals Involving Japanese Companies. Triple crown in 2024 as well.",
      notes: "Japan's #1 ranked M&A advisory by deal volume (LSEG league tables 2024-2025). Publicly traded, 200+ employees. Dominant in domestic Japanese M&A. Consistently ranked top in multiple categories. Premium service with premium pricing.",
      relevance: "Most important advisory relationship for Japan M&A. Market leader by deal volume. Best source for high-quality, larger targets. Premium pricing but best deal flow quality.",
    },
  },
];

async function main() {
  console.log("Updating broker firms with detailed metadata...");
  for (const firm of firms) {
    const [existing] = await db
      .select({ id: brokerFirms.id })
      .from(brokerFirms)
      .where(eq(brokerFirms.name, firm.name))
      .limit(1);

    if (existing) {
      await db
        .update(brokerFirms)
        .set({
          website: firm.website,
          region: firm.region,
          specialty: firm.specialty,
          listingUrl: firm.listingUrl,
          metadata: firm.metadata,
          updatedAt: new Date(),
        })
        .where(eq(brokerFirms.id, existing.id));
      console.log(`  Updated: ${firm.name}`);
    } else {
      await db.insert(brokerFirms).values({
        name: firm.name,
        website: firm.website,
        region: firm.region,
        specialty: firm.specialty,
        listingUrl: firm.listingUrl,
        metadata: firm.metadata,
      });
      console.log(`  Created: ${firm.name}`);
    }
  }
  console.log("Done!");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

import "dotenv/config";
import { db } from "./index";
import { brokerFirms, brokerContacts } from "./schema";
import { eq } from "drizzle-orm";

async function main() {
  // Delete M&Aプライム (was created by mistake)
  const [maPrime] = await db
    .select({ id: brokerFirms.id })
    .from(brokerFirms)
    .where(eq(brokerFirms.name, "M&Aプライム"))
    .limit(1);

  if (maPrime) {
    await db.delete(brokerContacts).where(eq(brokerContacts.brokerFirmId, maPrime.id));
    await db.delete(brokerFirms).where(eq(brokerFirms.id, maPrime.id));
    console.log("Deleted: M&Aプライム");
  }

  // Update M&A総合研究所 with full details + add 川嶋様 as second contact
  const [masouken] = await db
    .select({ id: brokerFirms.id })
    .from(brokerFirms)
    .where(eq(brokerFirms.name, "M&A総合研究所"))
    .limit(1);

  if (masouken) {
    await db
      .update(brokerFirms)
      .set({
        name: "株式会社M＆A総合研究所",
        website: "https://masouken.com/",
        region: "Japan (nationwide, HQ: Tokyo)",
        specialty: "M&A advisory & brokerage",
        listingUrl: "https://masouken.com/en/successes",
        metadata: {
          type: "Advisory firm (listed)",
          nameEn: "M&A Research Institute",
          publicOrPrivate: "Public (TSE Prime: 9552)",
          employees: "690 (as of Sep 2025)",
          founded: "2018",
          revenue: "¥16.6B (~$115M) FY2025",
          operatingProfit: "¥4.96B (~$34M) FY2025",
          avgDealSize: "¥500M–¥5B (~$3.5M–$35M)",
          dealFlow: "High quality, mid-market",
          feeModel: "Complete success-based fee (no upfront, interim, or monthly fees for sellers). Fees calculated on equity value only, excluding liabilities.",
          avgClosingTime: "7.2 months average",
          sectors: "Construction, HR, IT, SaaS, Transportation, Real Estate, Healthcare, Finance, F&B, Education, Retail, Security, Manufacturing, Leisure, Environment",
          parentCompany: "M&A総研ホールディングス (TSE: 9552)",
          notes: "One of the fastest-growing M&A advisory firms in Japan. Founded 2018, IPO'd on TSE Prime. 690 employees, ¥16.6B revenue in FY2025. Complete success-based fee model differentiates from competitors. Tech-driven approach with AI/DX integration. Covers wide range of industries. Subsidiary M&Aプライムグループ has industry-specialized advisors (Manufacturing, Construction, IT, Healthcare).",
          relevance: "Major advisory firm with strong growth trajectory. Complete success-fee model is seller-friendly. Good for mid-market IT services targets. Contact: 大村様 (advisor), 川嶋様 (M&Aプライム division).",
        },
        updatedAt: new Date(),
      })
      .where(eq(brokerFirms.id, masouken.id));
    console.log("Updated: 株式会社M＆A総合研究所");

    // Add 川嶋様 as contact (大村様 already exists)
    const existing = await db
      .select({ id: brokerContacts.id })
      .from(brokerContacts)
      .where(eq(brokerContacts.brokerFirmId, masouken.id));

    if (!existing.some(() => false)) {
      await db.insert(brokerContacts).values({
        brokerFirmId: masouken.id,
        fullName: "川嶋様",
        title: "M&Aプライム",
      });
      console.log("  Added contact: 川嶋様 (M&Aプライム)");
    }
  }

  console.log("Done!");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

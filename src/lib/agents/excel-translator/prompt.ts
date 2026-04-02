import { db } from "@/lib/db";
import { promptVersions } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";

export const AGENT_SLUG = "excel-translator";

export const TRANSLATION_TEMPLATE = `You are a professional translator specializing in Japanese-to-English business document translation. You will receive a numbered list of cell values extracted from a spreadsheet.

## Critical Rules

1. **Translate faithfully.** Produce an accurate English translation of each cell value. Do not omit, summarize, or rephrase.
2. **Preserve all numbers exactly.** Monetary amounts, percentages, dates, employee counts, ratios — copy them verbatim. Do not convert currencies or units.
3. **Preserve company and person names in their original form.** Japanese names in kanji should be kept in kanji with a romanized reading in parentheses on first occurrence (e.g. "田中太郎 (Tanaka Taro)").
4. **Concise translations for short labels.** Column headers, category names, and short labels should be translated concisely — do not over-explain.
5. **Technical and legal terms:** Use standard M&A / financial English terminology where a clear equivalent exists.
6. **Do NOT add commentary, interpretation, or analysis.** Output only translations.
7. **Do NOT add information that is not in the source text.**
8. **For ambiguous terms, prefer the literal translation** over an interpretive one. Add the original term in parentheses if the translation might be ambiguous (e.g. "business outsourcing (業務委託)").
9. **Return exactly the same number of cells in the same order.** Each cell's id must match the input id.`;

async function loadPromptFromDb(fallback: string): Promise<string> {
  try {
    const [active] = await db
      .select({ template: promptVersions.template })
      .from(promptVersions)
      .where(
        and(
          eq(promptVersions.agentSlug, AGENT_SLUG),
          eq(promptVersions.isActive, true),
        )
      )
      .orderBy(desc(promptVersions.version))
      .limit(1);

    if (active) return active.template;
  } catch {
    // DB not available — use default
  }
  return fallback;
}

export async function buildExcelTranslationPrompt(): Promise<string> {
  return loadPromptFromDb(TRANSLATION_TEMPLATE);
}

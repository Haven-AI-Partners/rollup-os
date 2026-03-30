import { db } from "@/lib/db";
import { promptVersions } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";

export const AGENT_SLUG = "im-translator";

export const TRANSLATION_TEMPLATE = `You are a professional document translator. Your ONLY job is to translate each page of text from the source language to English.

## Critical Rules

1. **Translate faithfully.** Produce an accurate, complete English translation of every sentence. Do not omit, summarize, or rephrase — translate everything.
2. **Preserve all numbers exactly.** Monetary amounts, percentages, dates, employee counts, ratios — copy them verbatim. Do not convert currencies or units.
3. **Preserve company and person names in their original form.** Do not translate or romanize names unless a standard English name is already established (e.g. "Toyota" stays "Toyota"). Japanese names in kanji should be kept in kanji with a romanized reading in parentheses on first occurrence (e.g. "田中太郎 (Tanaka Taro)").
4. **Preserve markdown formatting.** Tables stay tables, headers stay headers, lists stay lists.
5. **Do NOT add commentary, interpretation, or analysis.** Your output is purely a translation.
6. **Do NOT add information that is not in the source text.**
7. **For ambiguous terms, prefer the literal translation** over an interpretive one. Add the original term in parentheses if the translation might be ambiguous (e.g. "business outsourcing (業務委託)").
8. **Technical and legal terms:** Use standard M&A / financial English terminology where a clear equivalent exists.

Translate all pages provided.`;

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

export async function buildTranslationPrompt(): Promise<string> {
  return loadPromptFromDb(TRANSLATION_TEMPLATE);
}

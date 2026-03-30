import { db } from "@/lib/db";
import { promptVersions } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";

export const AGENT_SLUG = "im-content-extractor";

export const CONTENT_EXTRACTION_TEMPLATE = `You are a document transcription system. Your ONLY job is to convert the visual content of each PDF page into accurate markdown text.

## Critical Rules

1. **Transcribe EXACTLY what you see.** Do not interpret, summarize, paraphrase, analyze, or add any information whatsoever. If you cannot read a word, write "[illegible]".
2. **One entry per page.** Output one object per PDF page, in order.
3. **Preserve all content faithfully:**
   - Tables → markdown tables
   - Headers/titles → markdown headings (# ## ###)
   - Bullet points → markdown lists
   - Numbers, dates, currency amounts → exactly as printed
   - Company names, person names → exactly as written (do not translate names)
   - Charts/graphs → describe the data labels and values visible, prefixed with "[Chart]:" or "[Graph]:"
   - Images/logos → note as "[Image: brief description]"
4. **Do NOT translate.** Output text in the original language of the document.
5. **Do NOT add commentary, analysis, or interpretation.**
6. **Detect the primary language** of the document and report it as an ISO 639-1 code.
7. **Report the document title** if one appears on a cover page or header. Otherwise set to null.

Transcribe all pages of the document provided.`;

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

export async function buildContentExtractionPrompt(): Promise<string> {
  return loadPromptFromDb(CONTENT_EXTRACTION_TEMPLATE);
}

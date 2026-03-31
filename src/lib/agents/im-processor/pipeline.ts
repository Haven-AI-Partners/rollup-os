import { extractContent, MODEL_ID as EXTRACTOR_MODEL } from "@/lib/agents/content-extractor";
import { type ContentExtractionResult } from "@/lib/agents/content-extractor/schema";
import { translateContent, skipTranslation, MODEL_ID as TRANSLATOR_MODEL } from "@/lib/agents/translator";
import { analyzeContent, MODEL_ID as ANALYZER_MODEL } from "./agents/analyzer";
import { enrichExternally, MODEL_ID as ENRICHER_MODEL, type EnrichmentInput } from "@/lib/agents/external-enricher";
import { flattenSourcedExtraction, collectSourceRefs, type AnalyzerExtractionResult } from "./schemas/analyzer";
import { type IMPipelineResult } from "./schemas/pipeline-result";
import { type IMAnalysisResult } from "./schema";

/**
 * Run the full 4-agent IM processing pipeline:
 *
 * 1. Content Extractor: PDF → raw markdown pages (multimodal, deterministic)
 * 2. Translator: pages → English translation (skip if already English)
 * 3. Analyzer: translated pages → structured extraction + scoring (consensus voting)
 * 4. External Enricher: company name → web search results
 *
 * Returns both the new pipeline result (with source attribution) and
 * a legacy-compatible IMAnalysisResult for backward compatibility.
 */
export async function runIMPipeline(
  pdfBuffer: Buffer,
  onProgress?: (step: string) => void,
): Promise<IMPipelineResult> {
  const progress = onProgress ?? (() => {});

  // Agent 1: Content Extraction
  progress("Extracting content from PDF...");
  const contentExtraction = await extractContent(pdfBuffer);

  // Agent 2: Translation
  // Use both the detected language AND a content check to decide whether to translate.
  // The language detector can misclassify bilingual Japanese IMs (with English headings/charts)
  // as "en", which would skip translation and pass Japanese text to the analyzer.
  const needsTranslation = contentExtraction.metadata.documentLanguage !== "en"
    || containsCJK(contentExtraction);

  if (!needsTranslation) {
    progress("Document is in English — skipping translation...");
  } else {
    const lang = contentExtraction.metadata.documentLanguage;
    progress(lang === "en"
      ? "Document detected as English but contains CJK text — translating..."
      : `Translating from ${lang} to English...`);
  }
  const translation = needsTranslation
    ? await translateContent(contentExtraction)
    : skipTranslation(contentExtraction);

  // Agent 3: Analysis (extraction + scoring with consensus)
  progress("Analyzing and scoring IM content...");
  const { extraction: analyzerExtraction, scoring: analyzerScoring } = await analyzeContent(translation);

  // Agent 4: External Enrichment
  progress("Fetching external information about the company...");
  const enrichmentInput = buildEnrichmentInput(analyzerExtraction);
  const externalEnrichment = await enrichExternally(enrichmentInput);

  // Build legacy-compatible IMAnalysisResult
  progress("Finalizing results...");
  const legacyAnalysis = buildLegacyAnalysis(analyzerExtraction, analyzerScoring);

  return {
    contentExtraction,
    translation,
    analyzerExtraction,
    analyzerScoring,
    externalEnrichment,
    legacyAnalysis,
    metadata: {
      pipelineVersion: "v2",
      processedAt: new Date().toISOString(),
      contentExtractionModel: EXTRACTOR_MODEL,
      translationModel: TRANSLATOR_MODEL,
      analyzerModel: ANALYZER_MODEL,
      enricherModel: ENRICHER_MODEL,
    },
  };
}

/** Extract enrichment input from IM analyzer extraction (IM-specific adapter) */
function buildEnrichmentInput(extraction: AnalyzerExtractionResult): EnrichmentInput {
  return {
    companyName: extraction.companyProfile.companyName.value ?? "Unknown",
    industry: extraction.companyProfile.industry.value,
    location: extraction.companyProfile.location.value,
  };
}

/** Build legacy IMAnalysisResult from new analyzer output for backward compatibility */
function buildLegacyAnalysis(
  extraction: IMPipelineResult["analyzerExtraction"],
  scoring: IMPipelineResult["analyzerScoring"],
): IMAnalysisResult {
  const flat = flattenSourcedExtraction(extraction);

  return {
    companyProfile: flat.companyProfile,
    financialHighlights: flat.financialHighlights,
    managementTeam: flat.managementTeam,
    scoring: scoring.scoring,
    redFlags: scoring.redFlags,
    infoGaps: scoring.infoGaps,
  };
}

/** Extract source attributions map from pipeline result */
export function extractSourceAttributions(result: IMPipelineResult) {
  return collectSourceRefs(result.analyzerExtraction);
}

// CJK Unified Ideographs, Hiragana, Katakana, CJK Extension A, Hangul
const CJK_REGEX = /[\u3000-\u9fff\uac00-\ud7af\uf900-\ufaff]/;
const CJK_THRESHOLD = 0.05;

/** Check if extracted content contains significant CJK text */
function containsCJK(extraction: ContentExtractionResult): boolean {
  const sample = extraction.pages
    .slice(0, 5)
    .map((p) => p.content)
    .join("");
  if (!sample) return false;
  const cjkChars = (sample.match(new RegExp(CJK_REGEX.source, "g")) ?? []).length;
  return cjkChars / sample.length > CJK_THRESHOLD;
}

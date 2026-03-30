import { extractContent, MODEL_ID as EXTRACTOR_MODEL } from "@/lib/agents/content-extractor";
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
  if (contentExtraction.metadata.documentLanguage === "en") {
    progress("Document is in English — skipping translation...");
  } else {
    progress(`Translating from ${contentExtraction.metadata.documentLanguage} to English...`);
  }
  const translation = contentExtraction.metadata.documentLanguage === "en"
    ? skipTranslation(contentExtraction)
    : await translateContent(contentExtraction);

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

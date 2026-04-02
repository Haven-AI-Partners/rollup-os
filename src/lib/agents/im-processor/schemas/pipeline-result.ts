import { type ContentExtractionWithImages } from "@/lib/agents/content-extractor/schema";
import { type TranslationResult } from "@/lib/agents/translator/schema";
import { type AnalyzerExtractionResult, type AnalyzerScoringResult } from "./analyzer";
import { type ExternalEnrichmentResult } from "@/lib/agents/external-enricher/schema";
import { type IMAnalysisResult } from "../schema";

// ── Combined pipeline result ──

export interface IMPipelineResult {
  /** Agent 1 output: raw page-level content extraction + diagram images */
  contentExtraction: ContentExtractionWithImages;
  /** Agent 2 output: translated pages (same as extraction if English) */
  translation: TranslationResult;
  /** Agent 3 output: structured extraction with source attribution */
  analyzerExtraction: AnalyzerExtractionResult;
  /** Agent 3 output: scoring with consensus voting */
  analyzerScoring: AnalyzerScoringResult;
  /** Agent 4 output: external enrichment data */
  externalEnrichment: ExternalEnrichmentResult;
  /** Legacy-compatible analysis result (for backward compat with existing DB/UI) */
  legacyAnalysis: IMAnalysisResult;
  /** Pipeline metadata */
  metadata: {
    pipelineVersion: "v2";
    processedAt: string;
    contentExtractionModel: string;
    translationModel: string;
    analyzerModel: string;
    enricherModel: string;
  };
}

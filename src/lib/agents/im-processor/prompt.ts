// Legacy re-exports — all prompt logic now lives in ./prompts/
export { AGENT_SLUG, EXTRACTION_SLUG, SCORING_SLUG, renderTemplate } from "./prompts/shared";
export {
  ANALYZER_EXTRACTION_TEMPLATE as EXTRACTION_TEMPLATE,
  ANALYZER_SCORING_TEMPLATE as SCORING_TEMPLATE,
  buildAnalyzerExtractionPrompt as buildExtractionPrompt,
  buildAnalyzerScoringPrompt as buildScoringPrompt,
} from "./prompts/analyzer";

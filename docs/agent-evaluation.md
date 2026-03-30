# IM Processor Agent Evaluation Framework

> **Status**: Design phase. Implementation planned for Phase 2 after the multi-agent refactor ships.

## Overview

The IM processor has been refactored into 4 specialized agents. Each agent has distinct evaluation criteria focused on its specific role. This document defines the evaluation framework for each agent.

## Agent 1: Content Extractor

**Goal**: Faithful transcription of PDF content into markdown. Zero hallucination.

### Metrics

| Metric | Method | Target |
|--------|--------|--------|
| **Page count accuracy** | Compare extracted page count vs PDF metadata | 100% match |
| **Character similarity** | Levenshtein distance vs Document AI baseline | > 95% |
| **Structural accuracy** | Correct detection of headers, tables, lists | > 90% |
| **Hallucination rate** | Content in LLM output not in Document AI baseline | < 1% |
| **Completeness** | Word count ratio vs Document AI baseline | > 90% |
| **Consistency** | Run N times, measure output variance | Identical (temp=0) |

### Cross-validation with Google Document AI

Run Google Document AI on the same PDFs and compare outputs:
1. Extract text via Document AI API (deterministic baseline)
2. Extract text via Gemini multimodal (Agent 1 output)
3. Compare character-level similarity (Levenshtein distance)
4. Flag any content in Agent 1 output not present in Document AI output as potential hallucination
5. Flag any content in Document AI output missing from Agent 1 output as potential omission

### Test corpus

Build a corpus of 20-30 representative IMs covering:
- Text-based PDFs (digital native)
- Scanned PDFs (image-based)
- Mixed PDFs (some pages text, some scanned)
- Various page counts (5-100 pages)
- Japanese, English, and mixed-language documents
- Complex layouts (multi-column, tables, charts)

## Agent 2: Translator

**Goal**: Faithful translation preserving all data points and structure.

### Metrics

| Metric | Method | Target |
|--------|--------|--------|
| **Number preservation** | Extract all numbers from source and target, compare | 100% match |
| **Name preservation** | Extract company/person names, verify unchanged | 100% match |
| **Structure preservation** | Compare markdown structure (headers, tables, lists) | Identical structure |
| **Back-translation similarity** | Translate back to source, measure semantic similarity | > 85% BLEU |
| **Consistency** | Run N times, measure output variance | Identical (temp=0) |

### Number preservation test

For each IM:
1. Extract all numeric patterns from original (regex: dates, currencies, percentages, counts)
2. Verify each appears verbatim in the translated output
3. Flag any missing or altered numbers

### Name preservation test

1. Extract all proper nouns (company names, person names) from original
2. Verify each appears unchanged in translation (kanji names should be preserved with romanization)
3. Flag any translated names that should have been kept original

## Agent 3: Analyzer

**Goal**: Accurate structured extraction and consistent scoring based only on IM data.

### Metrics

| Metric | Method | Target |
|--------|--------|--------|
| **Score variance** | Std dev per dimension across N runs | < 0.5 |
| **Overall std dev** | Std dev of weighted score across N runs | < 0.3 |
| **Flag agreement** | % of flags appearing in all N runs | > 80% |
| **Source attribution audit** | Spot-check that quotes appear on cited pages | > 95% accuracy |
| **Extraction completeness** | % of fields populated when data exists in IM | > 90% |
| **No external knowledge** | Verify no facts in output that aren't in input pages | 0 violations |

### Source attribution audit

For each extraction:
1. Sample 10 random source references
2. Look up the cited page number in the Agent 1 output
3. Verify the quoted text appears on that page (fuzzy match allowing for translation variance)
4. Flag any citations that don't match

### Scoring consistency (existing eval system)

The current `eval.ts` already implements:
- Run extraction once, scoring N times with different seeds
- Compute median scores, flag agreement rate, name consistency
- Store results in `evalRuns` and `evalIterations` tables

Extend to:
- Track source attribution accuracy per run
- Measure extraction field completeness
- Compare extracted values against manually verified ground truth (for test corpus)

## Agent 4: External Enricher

**Goal**: Relevant external data with accurate source attribution.

### Metrics

| Metric | Method | Target |
|--------|--------|--------|
| **Source reachability** | HTTP HEAD check on all cited URLs | > 90% return 200 |
| **Company relevance** | Manual review: are results about the right company? | > 95% |
| **Source freshness** | % of sources from last 2 years | > 70% |
| **Enrichment coverage** | % of fields populated when company has web presence | > 60% |
| **No fabrication** | Verify all facts are traceable to cited sources | 0 violations |

### Source reachability test

1. Collect all URLs from enrichment results
2. HTTP HEAD each URL (with appropriate rate limiting)
3. Flag URLs returning 4xx/5xx as broken sources
4. Track reachability rate over time (URLs may expire)

### Relevance scoring

For test corpus:
1. Run enrichment for each company
2. Manual review: does each result actually refer to the target company?
3. Flag false positives (results about a different company with similar name)

## Implementation Plan

### Phase 1 (current PR): Multi-agent refactor
- Refactor IM processor into 4 agents
- Add source attribution to all extracted data
- No eval implementation yet

### Phase 2: Core evaluation framework
- Implement eval runner for each agent
- Build test corpus (20-30 IMs with manual annotations)
- Set up Document AI cross-validation for Agent 1
- Extend existing `eval.ts` for new agent structure
- Store eval results in `evalRuns`/`evalIterations` tables

### Phase 3: Evaluation dashboard
- UI to visualize eval metrics per agent
- Trend charts showing quality over time
- Drill-down into individual eval failures
- Alerting when metrics drop below thresholds

## Database Schema for Eval Results

Extend existing `evalRuns` and `evalIterations` tables:

```sql
-- Add agent-specific eval columns to evalIterations
ALTER TABLE eval_iterations ADD COLUMN agent_slug TEXT;
ALTER TABLE eval_iterations ADD COLUMN metrics JSONB;
-- metrics schema varies by agent:
-- Agent 1: { pageCountMatch, charSimilarity, hallucinationRate }
-- Agent 2: { numberPreservation, namePreservation, backTranslationBleu }
-- Agent 3: { scoreVariance, flagAgreement, sourceAttributionAccuracy }
-- Agent 4: { sourceReachability, companyRelevance, sourceFreshness }
```

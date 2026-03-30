# Weekly Refactoring Analysis — 2026-03-30

**Generated**: 2026-03-30

## Summary

- **Files over 200 lines**: 45
- **Code duplicates**: 61
- **Circular dependencies**: 5
- **Complex functions**: 0
- **Total findings**: 111

## Files Exceeding 200 Lines

Found **45** files exceeding the 200-line limit.

| File | Lines | Over By |
|------|-------|---------|
| `src/components/ui/sidebar.tsx` | 728 | +528 |
| `src/lib/agents/im-processor/index.ts` | 544 | +344 |
| `src/lib/agents/scan-orchestrator.ts` | 522 | +322 |
| `src/components/deals/thesis-tree.tsx` | 480 | +280 |
| `src/lib/db/seed-demo-data.ts` | 475 | +275 |
| `src/app/(app)/[portcoSlug]/agents/page.tsx` | 449 | +249 |
| `src/app/(app)/[portcoSlug]/agents/im-processor/page.tsx` | 426 | +226 |
| `src/lib/gdrive/scanner.ts` | 414 | +214 |
| `src/app/(app)/[portcoSlug]/agents/discovery-interviewer/page.tsx` | 414 | +214 |
| `src/app/(app)/[portcoSlug]/agents/file-classifier/page.tsx` | 392 | +192 |
| `src/components/files/virtual-files-list.tsx` | 385 | +185 |
| `src/components/files/folder-files-list.tsx` | 384 | +184 |
| `src/lib/actions/thesis.ts` | 380 | +180 |
| `src/lib/scoring/rubric.ts` | 376 | +176 |
| `src/components/ui/chart.tsx` | 371 | +171 |
| `src/app/(app)/[portcoSlug]/agents/discovery-interviewer/sessions/[sessionId]/page.tsx` | 367 | +167 |
| `src/lib/thesis/template.ts` | 358 | +158 |
| `src/lib/agents/im-processor/store-results.ts` | 354 | +154 |
| `src/components/deals/thesis-graph.tsx` | 350 | +150 |
| `src/components/deals/deal-list-view.tsx` | 340 | +140 |
| `src/app/(app)/[portcoSlug]/agents/thesis-generator/page.tsx` | 302 | +102 |
| `src/trigger/im-processing.ts` | 300 | +100 |
| `src/lib/actions/deals.ts` | 286 | +86 |
| `src/components/agents/eval-panel.tsx` | 280 | +80 |
| `src/components/settings/team-table.tsx` | 277 | +77 |
| `src/lib/actions/im-processing.ts` | 276 | +76 |
| `src/components/agents/prompt-editor.tsx` | 272 | +72 |
| `src/lib/db/seed-brokers-update.ts` | 270 | +70 |
| `src/lib/actions/brokers.ts` | 269 | +69 |
| `src/components/ui/dropdown-menu.tsx` | 258 | +58 |
| `src/components/files/file-extraction-viewer.tsx` | 250 | +50 |
| `src/app/(app)/[portcoSlug]/brokers/[firmId]/page.tsx` | 243 | +43 |
| `src/lib/agents/im-processor/eval.ts` | 242 | +42 |
| `src/components/discovery/interview-chat.tsx` | 241 | +41 |
| `src/app/(app)/[portcoSlug]/pipeline/[dealId]/files/page.tsx` | 239 | +39 |
| `src/test/factories.ts` | 238 | +38 |
| `src/lib/db/seed-brokers.ts` | 234 | +34 |
| `src/lib/scoring/red-flags.ts` | 228 | +28 |
| `src/components/deals/red-flags-panel.tsx` | 224 | +24 |
| `src/components/deals/kanban-board.tsx` | 224 | +24 |
| `src/lib/agents/im-processor/schemas/analyzer.ts` | 214 | +14 |
| `src/app/(app)/[portcoSlug]/analytics/page.tsx` | 208 | +8 |
| `src/app/(app)/[portcoSlug]/portfolio/page.tsx` | 206 | +6 |
| `src/lib/agents/dd-processor/index.ts` | 204 | +4 |
| `src/lib/actions/agents.ts` | 203 | +3 |

**Recommendation**: Split these files into focused modules with barrel exports (`index.ts`).


## Code Duplication

Found **61** code duplication(s).

| Source A | Source B | Lines | Tokens |
|----------|----------|-------|--------|
| `src/app/(app)/[portcoSlug]/settings/integrations/page.tsx:30` | `src/app/(app)/[portcoSlug]/settings/team/page.tsx:38` | 14 | ? |
| `src/app/(app)/[portcoSlug]/settings/customization/page.tsx:21` | `src/app/(app)/[portcoSlug]/settings/team/page.tsx:38` | 15 | ? |
| `src/app/(app)/[portcoSlug]/agents/thesis-generator/page.tsx:22` | `src/app/(app)/[portcoSlug]/agents/translator/page.tsx:15` | 17 | ? |
| `src/app/(app)/[portcoSlug]/agents/thesis-generator/page.tsx:59` | `src/app/(app)/[portcoSlug]/agents/translator/page.tsx:38` | 14 | ? |
| `src/app/(app)/[portcoSlug]/agents/thesis-generator/page.tsx:100` | `src/app/(app)/[portcoSlug]/agents/translator/page.tsx:55` | 21 | ? |
| `src/app/(app)/[portcoSlug]/agents/thesis-generator/page.tsx:134` | `src/app/(app)/[portcoSlug]/agents/translator/page.tsx:91` | 11 | ? |
| `src/app/(app)/[portcoSlug]/agents/im-processor/page.tsx:34` | `src/app/(app)/[portcoSlug]/agents/translator/page.tsx:15` | 12 | ? |
| `src/app/(app)/[portcoSlug]/agents/im-processor/page.tsx:80` | `src/app/(app)/[portcoSlug]/agents/translator/page.tsx:36` | 13 | ? |
| `src/app/(app)/[portcoSlug]/agents/im-processor/page.tsx:93` | `src/app/(app)/[portcoSlug]/agents/translator/page.tsx:36` | 13 | ? |
| `src/app/(app)/[portcoSlug]/agents/im-processor/page.tsx:105` | `src/app/(app)/[portcoSlug]/agents/im-processor/page.tsx:92` | 17 | ? |
| `src/app/(app)/[portcoSlug]/agents/im-processor/page.tsx:179` | `src/app/(app)/[portcoSlug]/agents/translator/page.tsx:57` | 19 | ? |
| `src/app/(app)/[portcoSlug]/agents/im-processor/page.tsx:201` | `src/app/(app)/[portcoSlug]/agents/thesis-generator/page.tsx:123` | 22 | ? |
| `src/app/(app)/[portcoSlug]/agents/file-classifier/page.tsx:23` | `src/app/(app)/[portcoSlug]/agents/translator/page.tsx:15` | 14 | ? |
| `src/app/(app)/[portcoSlug]/agents/file-classifier/page.tsx:75` | `src/app/(app)/[portcoSlug]/agents/thesis-generator/page.tsx:56` | 17 | ? |
| `src/app/(app)/[portcoSlug]/agents/file-classifier/page.tsx:134` | `src/app/(app)/[portcoSlug]/agents/thesis-generator/page.tsx:95` | 26 | ? |
| `src/app/(app)/[portcoSlug]/agents/file-classifier/page.tsx:163` | `src/app/(app)/[portcoSlug]/agents/thesis-generator/page.tsx:123` | 18 | ? |
| `src/app/(app)/[portcoSlug]/agents/external-enricher/page.tsx:15` | `src/app/(app)/[portcoSlug]/agents/translator/page.tsx:15` | 17 | ? |
| `src/app/(app)/[portcoSlug]/agents/external-enricher/page.tsx:42` | `src/app/(app)/[portcoSlug]/agents/translator/page.tsx:36` | 17 | ? |
| `src/app/(app)/[portcoSlug]/agents/external-enricher/page.tsx:62` | `src/app/(app)/[portcoSlug]/agents/translator/page.tsx:55` | 21 | ? |
| `src/app/(app)/[portcoSlug]/agents/external-enricher/page.tsx:86` | `src/app/(app)/[portcoSlug]/agents/translator/page.tsx:79` | 23 | ? |

_...and 41 more duplicates._

**Recommendation**: Extract shared logic into reusable modules or components.


## Circular Dependencies

Found **5** circular dependency chain(s).

- `1) components/deals/thesis-graph.tsx > components/deals/thesis-tree.tsx`
- `2) components/files/file-row.tsx > components/files/virtual-files-list.tsx`
- `3) components/files/file-row.tsx > components/files/virtual-files-list.tsx > components/files/folder-files-list.tsx`
- `4) components/files/virtual-files-list.tsx > components/files/folder-files-list.tsx`
- `5) lib/db/schema/deals.ts > lib/db/schema/brokers.ts`

**Recommendation**: Break cycles by extracting shared types/interfaces into separate files.



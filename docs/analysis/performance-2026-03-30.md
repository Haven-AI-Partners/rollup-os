# Weekly Performance Review — 2026-03-30

**Generated**: 2026-03-30

## Summary

- **Large bundle chunks**: 0
- **N+1 query patterns**: 0
- **Missing next/image**: 0
- **Heavy client imports**: 3
- **React perf issues**: 70
- **Missing DB indexes**: 21
- **Total findings**: 94

## Bundle Size Analysis

_No build output found. Run `ANALYZE=true pnpm build` to generate bundle analysis._


## Heavy Client Component Imports

Found **3** heavy import(s) in client components.

| File | Line | Import |
|------|------|--------|
| `src/components/deals/deal-chat.tsx` | 5 | `@ai-sdk` |
| `src/components/deals/deal-chat.tsx` | 6 | `ai` |
| `src/components/ui/chart.tsx` | 4 | `recharts` |

**Recommendation**: Move heavy imports to server components or use dynamic imports with `next/dynamic`.


## React Performance Issues

Found **70** potential React performance issue(s).

| File | Line | Issue | Description |
|------|------|-------|-------------|
| `src/components/deals/financial-entry-form.tsx` | 58 | Inline callback prop | Consider useCallback for stable reference |
| `src/components/deals/financial-entry-form.tsx` | 69 | Inline callback prop | Consider useCallback for stable reference |
| `src/components/deals/thesis-graph.tsx` | 78 | Inline style object | Creates new object reference on every render |
| `src/components/deals/pipeline-view.tsx` | 51 | Inline callback prop | Consider useCallback for stable reference |
| `src/components/deals/pipeline-view.tsx` | 62 | Inline callback prop | Consider useCallback for stable reference |
| `src/components/deals/deal-list-view.tsx` | 120 | Inline callback prop | Consider useCallback for stable reference |
| `src/components/deals/deal-list-view.tsx` | 190 | Inline callback prop | Consider useCallback for stable reference |
| `src/components/deals/deal-list-view.tsx` | 273 | Inline callback prop | Consider useCallback for stable reference |
| `src/components/deals/thesis-tree.tsx` | 162 | Inline style object | Creates new object reference on every render |
| `src/components/deals/thesis-tree.tsx` | 244 | Inline style object | Creates new object reference on every render |
| `src/components/deals/thesis-tree.tsx` | 449 | Inline style object | Creates new object reference on every render |
| `src/components/deals/thesis-tree.tsx` | 452 | Inline style object | Creates new object reference on every render |
| `src/components/deals/thesis-tree.tsx` | 455 | Inline style object | Creates new object reference on every render |
| `src/components/deals/thesis-tree.tsx` | 163 | Inline callback prop | Consider useCallback for stable reference |
| `src/components/deals/thesis-tree.tsx` | 285 | Inline callback prop | Consider useCallback for stable reference |
| `src/components/deals/thesis-tree.tsx` | 429 | Inline callback prop | Consider useCallback for stable reference |
| `src/components/deals/thesis-tree.tsx` | 437 | Inline callback prop | Consider useCallback for stable reference |
| `src/components/deals/red-flags-panel.tsx` | 134 | Inline callback prop | Consider useCallback for stable reference |
| `src/components/deals/red-flags-panel.tsx` | 143 | Inline callback prop | Consider useCallback for stable reference |
| `src/components/deals/red-flags-panel.tsx` | 175 | Inline callback prop | Consider useCallback for stable reference |
| `src/components/deals/red-flags-panel.tsx` | 210 | Inline callback prop | Consider useCallback for stable reference |
| `src/components/deals/red-flags-panel.tsx` | 215 | Inline callback prop | Consider useCallback for stable reference |
| `src/components/deals/org-chart.tsx` | 62 | Inline style object | Creates new object reference on every render |
| `src/components/deals/kanban-column.tsx` | 47 | Inline style object | Creates new object reference on every render |
| `src/components/deals/kanban-column.tsx` | 54 | Inline style object | Creates new object reference on every render |
| `src/components/deals/task-list.tsx` | 111 | Inline callback prop | Consider useCallback for stable reference |
| `src/components/deals/create-deal-dialog.tsx` | 148 | Inline callback prop | Consider useCallback for stable reference |
| `src/components/deals/import-gdrive-dialog.tsx` | 143 | Inline callback prop | Consider useCallback for stable reference |
| `src/components/deals/import-gdrive-dialog.tsx` | 158 | Inline callback prop | Consider useCallback for stable reference |
| `src/components/deals/scoring-breakdown.tsx` | 26 | Inline style object | Creates new object reference on every render |

_...and 40 more._

**Recommendation**: Extract inline objects/callbacks outside the component or wrap with `useMemo`/`useCallback`.


## Database Index Opportunities

Found **21** foreign key column(s) potentially missing indexes.

| Schema File | Line | Column |
|-------------|------|--------|
| `src/lib/db/schema/deals.ts` | 43 | `assignedTo` |
| `src/lib/db/schema/deals.ts` | 45 | `brokerFirmId` |
| `src/lib/db/schema/deals.ts` | 47 | `brokerContactId` |
| `src/lib/db/schema/notifications.ts` | 10 | `userId` |
| `src/lib/db/schema/kpis.ts` | 35 | `dealId` |
| `src/lib/db/schema/kpis.ts` | 36 | `agentRunId` |
| `src/lib/db/schema/discovery.ts` | 24 | `createdBy` |
| `src/lib/db/schema/brokers.ts` | 37 | `dealId` |
| `src/lib/db/schema/brokers.ts` | 60 | `brokerContactId` |
| `src/lib/db/schema/agents.ts` | 47 | `createdBy` |
| `src/lib/db/schema/agents.ts` | 59 | `dealId` |
| `src/lib/db/schema/files.ts` | 25 | `dealId` |
| `src/lib/db/schema/files.ts` | 29 | `uploadedBy` |
| `src/lib/db/schema/evals.ts` | 31 | `createdBy` |
| `src/lib/db/schema/org-charts.ts` | 13 | `createdBy` |
| `src/lib/db/schema/org-charts.ts` | 23 | `parentId` |
| `src/lib/db/schema/deal-red-flags.ts` | 22 | `flaggedBy` |
| `src/lib/db/schema/deal-red-flags.ts` | 23 | `resolvedBy` |
| `src/lib/db/schema/deal-tasks.ts` | 36 | `assignedTo` |
| `src/lib/db/schema/deal-tasks.ts` | 40 | `parentTaskId` |
| `src/lib/db/schema/deal-tasks.ts` | 59 | `userId` |

**Recommendation**: Add database indexes on foreign key columns that are used in WHERE clauses or JOINs.



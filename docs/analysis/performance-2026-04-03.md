# Weekly Performance Review — 2026-04-03

**Generated**: 2026-04-03

## Summary

- **Large bundle chunks**: 0
- **N+1 query patterns**: 0
- **Missing next/image**: 0
- **Heavy client imports**: 3
- **React perf issues**: 60
- **Missing DB indexes**: 24
- **Total findings**: 87

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

Found **60** potential React performance issue(s).

| File | Line | Issue | Description |
|------|------|-------|-------------|
| `src/components/deals/deal-list-view.tsx` | 120 | Inline callback prop | Consider useCallback for stable reference |
| `src/components/deals/deal-list-view.tsx` | 190 | Inline callback prop | Consider useCallback for stable reference |
| `src/components/deals/deal-list-view.tsx` | 273 | Inline callback prop | Consider useCallback for stable reference |
| `src/components/deals/thesis-node-row.tsx` | 96 | Inline style object | Creates new object reference on every render |
| `src/components/deals/thesis-node-row.tsx` | 178 | Inline style object | Creates new object reference on every render |
| `src/components/deals/thesis-node-row.tsx` | 97 | Inline callback prop | Consider useCallback for stable reference |
| `src/components/deals/thesis-node-row.tsx` | 219 | Inline callback prop | Consider useCallback for stable reference |
| `src/components/deals/red-flags-panel.tsx` | 134 | Inline callback prop | Consider useCallback for stable reference |
| `src/components/deals/red-flags-panel.tsx` | 143 | Inline callback prop | Consider useCallback for stable reference |
| `src/components/deals/red-flags-panel.tsx` | 175 | Inline callback prop | Consider useCallback for stable reference |
| `src/components/deals/red-flags-panel.tsx` | 210 | Inline callback prop | Consider useCallback for stable reference |
| `src/components/deals/red-flags-panel.tsx` | 215 | Inline callback prop | Consider useCallback for stable reference |
| `src/components/deals/task-list.tsx` | 111 | Inline callback prop | Consider useCallback for stable reference |
| `src/components/deals/create-deal-dialog.tsx` | 152 | Inline callback prop | Consider useCallback for stable reference |
| `src/components/deals/import-gdrive-dialog.tsx` | 144 | Inline callback prop | Consider useCallback for stable reference |
| `src/components/deals/import-gdrive-dialog.tsx` | 159 | Inline callback prop | Consider useCallback for stable reference |
| `src/components/brokers/contact-list.tsx` | 96 | Inline callback prop | Consider useCallback for stable reference |
| `src/components/brokers/contact-list.tsx` | 132 | Inline callback prop | Consider useCallback for stable reference |
| `src/components/brokers/contact-list.tsx` | 142 | Inline callback prop | Consider useCallback for stable reference |
| `src/components/brokers/interaction-log.tsx` | 71 | Inline callback prop | Consider useCallback for stable reference |
| `src/components/brokers/interaction-log.tsx` | 78 | Inline callback prop | Consider useCallback for stable reference |
| `src/components/discovery/session-feedback.tsx` | 90 | Inline callback prop | Consider useCallback for stable reference |
| `src/components/discovery/session-feedback.tsx` | 91 | Inline callback prop | Consider useCallback for stable reference |
| `src/components/discovery/session-feedback.tsx` | 92 | Inline callback prop | Consider useCallback for stable reference |
| `src/components/discovery/session-feedback.tsx` | 112 | Inline callback prop | Consider useCallback for stable reference |
| `src/components/discovery/session-feedback.tsx` | 143 | Inline callback prop | Consider useCallback for stable reference |
| `src/components/discovery/interview-chat.tsx` | 137 | Inline callback prop | Consider useCallback for stable reference |
| `src/components/discovery/interview-chat.tsx` | 162 | Inline callback prop | Consider useCallback for stable reference |
| `src/components/files/scan-progress-bar.tsx` | 76 | Inline style object | Creates new object reference on every render |
| `src/components/files/folder-files-list.tsx` | 283 | Inline style object | Creates new object reference on every render |

_...and 30 more._

**Recommendation**: Extract inline objects/callbacks outside the component or wrap with `useMemo`/`useCallback`.


## Database Index Opportunities

Found **24** foreign key column(s) potentially missing indexes.

| Schema File | Line | Column |
|-------------|------|--------|
| `src/lib/db/schema/deals.ts` | 43 | `assignedTo` |
| `src/lib/db/schema/deals.ts` | 45 | `brokerFirmId` |
| `src/lib/db/schema/deals.ts` | 47 | `brokerContactId` |
| `src/lib/db/schema/notifications.ts` | 10 | `userId` |
| `src/lib/db/schema/kpis.ts` | 35 | `dealId` |
| `src/lib/db/schema/kpis.ts` | 36 | `agentRunId` |
| `src/lib/db/schema/discovery.ts` | 25 | `createdBy` |
| `src/lib/db/schema/discovery.ts` | 54 | `promptVersionId` |
| `src/lib/db/schema/brokers.ts` | 37 | `dealId` |
| `src/lib/db/schema/brokers.ts` | 64 | `brokerContactId` |
| `src/lib/db/schema/deal-thesis.ts` | 14 | `parentId` |
| `src/lib/db/schema/agents.ts` | 47 | `createdBy` |
| `src/lib/db/schema/agents.ts` | 62 | `dealId` |
| `src/lib/db/schema/files.ts` | 26 | `dealId` |
| `src/lib/db/schema/files.ts` | 30 | `uploadedBy` |
| `src/lib/db/schema/evals.ts` | 16 | `promptVersionId` |
| `src/lib/db/schema/evals.ts` | 32 | `createdBy` |
| `src/lib/db/schema/org-charts.ts` | 13 | `createdBy` |
| `src/lib/db/schema/org-charts.ts` | 26 | `parentId` |
| `src/lib/db/schema/deal-red-flags.ts` | 22 | `flaggedBy` |
| `src/lib/db/schema/deal-red-flags.ts` | 23 | `resolvedBy` |
| `src/lib/db/schema/deal-tasks.ts` | 36 | `assignedTo` |
| `src/lib/db/schema/deal-tasks.ts` | 40 | `parentTaskId` |
| `src/lib/db/schema/deal-tasks.ts` | 61 | `userId` |

**Recommendation**: Add database indexes on foreign key columns that are used in WHERE clauses or JOINs.



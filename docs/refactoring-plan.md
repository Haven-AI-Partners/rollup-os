# Codebase Refactoring Plan

## Context

Rollup OS is an M&A deal flow SaaS (Next.js 15 + Drizzle + Clerk). Phase 1 is complete, Phase 2 (Deal Pipeline & Kanban) is active. A thorough audit identified security gaps, code duplication, monolithic files, and test gaps that increase risk and slow development. This refactoring addresses the most impactful issues in prioritized phases that won't disrupt active development.

## Status

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Security & Auth Hardening | **Done** |
| 2 | Split Monolithic IM Processor | **Done** |
| 3 | Input Validation with Zod | **Done** |
| 4 | Extract Duplicated UI Patterns | Pending |
| 5 | Schema & Database Cleanup | Pending |
| 6 | Test Coverage | Pending |
| 7 | Configuration & Error Handling | Pending |

**To continue:** Resume from Phase 4 below.

---

## Phase 1: Security & Auth Hardening ✅ COMPLETE

### 1A. Create authenticated action wrapper

**Problem:** 23 instances of duplicated auth boilerplate across all action files.

**File:** `src/lib/auth/index.ts`

Add a reusable wrapper:
```typescript
export async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

export async function requirePortcoRole(portcoId: string, minRole: UserRole) {
  const user = await requireAuth();
  const role = await getUserPortcoRole(user.id, portcoId);
  if (!role) throw new Error("Not a member of this PortCo");
  if (!hasMinRole(role as UserRole, minRole)) throw new Error("Insufficient permissions");
  return { user, role };
}
```

### 1B. Add auth checks to read operations

**Problem:** 10+ read actions accept `portcoId`/`dealId` with zero auth, enabling cross-tenant data access.

**Files to modify:**
- `src/lib/actions/deals.ts` — `getDealsForPortco()`, `getStagesForPortco()`, `getComments()`, `getActivityLog()`
- `src/lib/actions/brokers.ts` — `getBrokerFirm()`, `getContactsForFirm()`, `getInteractionsForFirm()`
- `src/lib/actions/tasks.ts` — `getTasksForDeal()`
- `src/lib/actions/red-flags.ts` — `getRedFlagsForDeal()`

**Change:** Add `await requireAuth()` to each read function. For portco-scoped reads, verify membership.

### 1C. Add RBAC to write operations

**Problem:** Write actions (create/update/delete) only check `if (!user)` — no role check. Viewers can create deals, delete brokers.

**Files to modify:**
- `src/lib/actions/deals.ts` — `createDeal()`, `updateDeal()`, `moveDeal()`, `addComment()`
- `src/lib/actions/brokers.ts` — `createBrokerFirm()`, `updateBrokerFirm()`, `deleteBrokerFirm()`, etc.
- `src/lib/actions/tasks.ts` — `createTask()`, `updateTask()`
- `src/lib/actions/red-flags.ts` — `addRedFlag()`, `resolveRedFlag()`, `removeRedFlag()`
- `src/lib/actions/financials.ts` — `addFinancialEntry()`
- `src/lib/actions/settings.ts` — `updateGdriveFolderId()`, `disconnectGdrive()`

**Change:** Replace `getCurrentUser()` + `if (!user)` with `requirePortcoRole(portcoId, "analyst")` for writes and `requirePortcoRole(portcoId, "admin")` for deletes/settings. Reuse existing `hasMinRole()` from `src/lib/auth/index.ts`.

### 1D. Fix incorrect activity log action names

**Files:**
- `src/lib/actions/financials.ts:44` — `"file_uploaded"` should be `"financial_entry_added"`
- `src/lib/actions/red-flags.ts:48` — `"status_changed"` should be `"red_flag_added"`

---

## Phase 2: Split Monolithic IM Processor ✅ COMPLETE

### Problem
`src/lib/agents/im-processor/index.ts` is 1,035 lines mixing extraction, scoring, consensus, storage, folder scanning, and reprocessing.

### Plan — Split into 5 focused modules:

| New File | Functions to Move | ~Lines |
|----------|-------------------|--------|
| `src/lib/agents/im-processor/extraction.ts` | `extractFromIM()`, `scoreExtraction()`, `MODEL_ID` | ~80 |
| `src/lib/agents/im-processor/consensus.ts` | `scoreWithConsensus()`, `SCORING_VOTES`, `analyzeIM()`, `computeScoresFromAnalysis()` | ~120 |
| `src/lib/agents/im-processor/red-flag-detection.ts` | `filterRedFlags()` | ~30 |
| `src/lib/agents/im-processor/storage.ts` | `storeResults()`, `createDealFromAnalysis()`, `getDefaultStageId()`, `parseNumericValue()` | ~250 |
| `src/lib/agents/im-processor/pipeline.ts` | `scanAndProcessFolder()`, `reprocessAllFiles()`, `processSingleGdriveFile()`, `processIM()`, `pMap()`, `CONCURRENCY_LIMIT` | ~400 |

**Keep `index.ts` as a barrel export** re-exporting public functions from each module.

---

## Phase 3: Input Validation with Zod ✅ COMPLETE

### Problem
Server actions accept raw objects with no runtime validation. Unsafe `as` casts in `tasks.ts`.

### Plan

**New file:** `src/lib/actions/schemas.ts`

Define Zod schemas for all action inputs:
```typescript
export const createDealSchema = z.object({
  companyName: z.string().min(1).max(200),
  stageId: z.string().uuid(),
  source: z.enum(["broker", "direct", "referral", "other"]),
  // ...
});

export const createTaskSchema = z.object({
  title: z.string().min(1),
  category: z.enum(["due_diligence", "legal", "financial", "operational", "other"]),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  // ...
});
```

**Files to modify:**
- `src/lib/actions/deals.ts` — validate `createDeal()`, `updateDeal()` inputs
- `src/lib/actions/tasks.ts` — replace `as` casts (lines 41-42, 86-87) with schema parse
- `src/lib/actions/red-flags.ts` — validate severity enum
- `src/lib/actions/brokers.ts` — validate create/update inputs
- `src/lib/actions/financials.ts` — validate period, periodType, numeric fields

---

## Phase 4: Extract Duplicated UI Patterns (MEDIUM PRIORITY)

### 4A. Extract shared constants

**Problem:** Icon/label/color mappings duplicated 3+ times across components.

**New file:** `src/lib/constants.ts`

Extract from:
- `src/components/brokers/interaction-log.tsx` — interaction type icons/labels
- `src/components/deals/red-flags-panel.tsx` — severity icons/colors
- `src/components/agents/eval-panel.tsx` — badge color functions

### 4B. Decompose large components

| Component | Action |
|-----------|--------|
| `src/components/agents/eval-panel.tsx` (299 lines) | Extract nested `EvalRunRow` to `src/components/agents/eval-run-row.tsx` |
| `src/components/agents/prompt-editor.tsx` (275 lines) | Extract tab content into `prompt-edit-tab.tsx`, `prompt-preview-tab.tsx`, `prompt-history-tab.tsx` |
| `src/components/brokers/interaction-log.tsx` (263 lines) | Extract `InteractionForm` to `src/components/brokers/interaction-form.tsx` |
| `src/app/(app)/[portcoSlug]/agents/page.tsx` (425 lines) | Extract DB queries to `src/lib/actions/agents.ts` data-fetching functions |

### 4C. Extract inline date formatting

Multiple components use inline `toLocaleDateString()`. Create helpers in `src/lib/format.ts` (already exists with some formatters — extend it).

---

## Phase 5: Schema & Database Cleanup (MEDIUM PRIORITY)

### 5A. Add missing FK constraints

**Files:**
- `src/lib/db/schema/deals.ts` — Add `.references()` to `brokerFirmId` and `brokerContactId`
- `src/lib/db/schema/deal-tasks.ts` — Add self-referential FK on `parentTaskId`
- `src/lib/db/schema/org-charts.ts` — Add self-referential FK on `parentId`

### 5B. Replace raw SQL subqueries with Drizzle

**Files:**
- `src/lib/actions/deals.ts:31-32` — Replace raw SQL subqueries for `aiScore` and `redFlagCount` with separate queries or Drizzle subqueries
- `src/lib/actions/brokers.ts:23-24` — Replace raw SQL subqueries for `contactCount` and `interactionCount`

---

## Phase 6: Test Coverage (MEDIUM PRIORITY)

### 6A. Expand server action tests beyond auth-only

All 7 existing action test files only verify `"Unauthorized"` throws. Add:
- Success path tests (verify DB calls with correct args)
- Input validation error tests (once Phase 3 Zod schemas are added)
- RBAC tests (once Phase 1C role checks are added)

**Files:** All `*.test.ts` in `src/lib/actions/`

### 6B. Add missing test files

- `src/lib/actions/gdrive.test.ts`
- `src/lib/actions/im-processing.test.ts`
- `src/lib/agents/im-processor/prompt.test.ts`
- `src/lib/agents/im-processor/eval.test.ts`

### 6C. Add test factories for missing entities

**File:** `src/test/factories.ts`

Add builders for: `BrokerContact`, `File`, `FinancialEntry`, `Comment`, `PortcoMembership`

---

## Phase 7: Configuration & Error Handling (LOW PRIORITY)

### 7A. Standardize error handling in Trigger.dev calls

**File:** `src/lib/actions/im-processing.ts`

Wrap `tasks.trigger()` calls in try-catch with meaningful error messages.

### 7B. Add coverage thresholds

**File:** `vitest.config.ts`

Add thresholds to prevent regression:
```typescript
coverage: {
  thresholds: { lines: 60, functions: 60, branches: 50 }
}
```

### 7C. Extract polling interval constant

**File:** `src/hooks/use-run-status.ts:65`

Replace hard-coded `3000` with named constant.

---

## Verification Plan

After each phase:
1. Run `pnpm test` — all existing tests must pass
2. Run `pnpm lint` — no new lint errors
3. Run `pnpm build` — production build succeeds
4. For Phase 1 (auth): manually verify that read/write actions now reject unauthorized access in test cases
5. For Phase 2 (split): verify all imports resolve and `processIM()` still works end-to-end
6. For Phase 3 (validation): verify invalid inputs are rejected with clear error messages in tests

---

## Files Summary

**Critical files to modify:**
- `src/lib/auth/index.ts` — Add `requireAuth()`, `requirePortcoRole()`
- `src/lib/actions/deals.ts` — Auth + RBAC + validation
- `src/lib/actions/brokers.ts` — Auth + RBAC + validation
- `src/lib/actions/tasks.ts` — Auth + RBAC + validation + remove `as` casts
- `src/lib/actions/red-flags.ts` — Auth + RBAC + validation
- `src/lib/actions/financials.ts` — Auth + RBAC + fix activity log
- `src/lib/actions/settings.ts` — Auth + RBAC
- `src/lib/agents/im-processor/index.ts` — Split into 5 modules

**New files to create:**
- `src/lib/actions/schemas.ts` — Zod validation schemas
- `src/lib/constants.ts` — Shared UI constants (icons, labels, colors)
- `src/lib/agents/im-processor/extraction.ts`
- `src/lib/agents/im-processor/consensus.ts`
- `src/lib/agents/im-processor/red-flag-detection.ts`
- `src/lib/agents/im-processor/storage.ts`
- `src/lib/agents/im-processor/pipeline.ts`
- `src/components/agents/eval-run-row.tsx`
- `src/components/brokers/interaction-form.tsx`

**Existing utilities to reuse:**
- `src/lib/auth/index.ts` — `getCurrentUser()`, `getUserPortcoRole()`, `hasMinRole()`
- `src/lib/format.ts` — Existing formatters (extend, don't duplicate)
- `src/test/mocks/auth.ts` — `setupAuthMocks()` for new auth tests
- `src/test/factories.ts` — Existing builders (extend with new entities)

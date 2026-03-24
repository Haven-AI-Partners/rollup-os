# Automated Test Plan & Implementation Summary

## Overview

Rollup OS had zero testing infrastructure. This document covers the test plan, implementation details, and guidelines for maintaining and extending the test suite.

**Framework**: Vitest 4
**Tests**: 110 across 16 files
**CI**: GitHub Actions on push/PR

---

## Test Plan

### Phase 1: Testing Infrastructure Setup

#### Dependencies

```bash
pnpm add -D vitest @testing-library/react @testing-library/jest-dom jsdom
```

**Why Vitest**: Native ESM, fast, compatible with Next.js/TypeScript, shares Vite ecosystem.

#### Configuration

- **`vitest.config.ts`** — Test runner config with `@/` path alias, v8 coverage, node environment
- **`src/test/setup.ts`** — Global setup: env vars (`GOOGLE_DRIVE_ENCRYPTION_KEY`), global `next/cache` mock
- **`src/test/mocks/db.ts`** — Chainable mock Drizzle `db` (Proxy-based, supports `.select().from().where().limit()` chains)
- **`src/test/mocks/auth.ts`** — Mock Clerk auth: `getCurrentUser`, `getPortcoBySlug`, `getUserPortcoRole`, `hasMinRole`
- **`src/test/mocks/trigger.ts`** — Mock Trigger.dev: `tasks.trigger()`, `runs.retrieve()`
- **`src/test/factories.ts`** — Data factories: `buildUser`, `buildPortco`, `buildDeal`, `buildBrokerFirm`, `buildPipelineStage`, `buildRedFlag`, `buildTask`

#### Package Scripts

```json
"test": "vitest run",
"test:watch": "vitest",
"test:coverage": "vitest run --coverage"
```

---

### Phase 2: Pure Function & Utility Tests

These have no external dependencies — highest confidence, fastest to write.

| Test File | What's Tested |
|---|---|
| `src/lib/format.test.ts` | `formatCurrency` — JPY/USD/EUR formatting, null/NaN handling, string parsing, invalid currency fallback |
| `src/lib/auth/index.test.ts` | `hasMinRole` — All 16 role pair combinations (owner/admin/analyst/viewer × 4) |
| `src/lib/scoring/rubric.test.ts` | 8 dimensions, weights sum to 1.0, criteria scores 1-5, recommendation bands, `computeDimensionScore`, `calculateWeightedScore` |
| `src/lib/scoring/red-flags.test.ts` | Unique IDs, valid severity/category, `DECISION_FRAMEWORK` thresholds, `groupBySeverity`, `groupByCategory` |
| `src/lib/gdrive/crypto.test.ts` | AES-256-GCM encrypt/decrypt roundtrip, random IV uniqueness, tamper detection, missing key errors |
| `src/lib/agents/im-processor/schema.test.ts` | Zod schema validation (extraction, scoring, analysis), `mergeResults` combining extraction + scoring |

---

### Phase 3: Server Action Tests

Each action is tested by mocking `db` and `@/lib/auth`. Tests verify auth enforcement (unauthenticated users throw "Unauthorized") and RBAC checks (admin-only actions reject lower roles).

| Test File | Actions Tested |
|---|---|
| `src/lib/actions/deals.test.ts` | `createDeal`, `updateDeal`, `addComment` — auth checks, DB insert calls |
| `src/lib/actions/brokers.test.ts` | `createBrokerFirm`, `updateBrokerFirm`, `deleteBrokerFirm`, `createBrokerContact`, `deleteBrokerContact`, `createInteraction` — auth checks |
| `src/lib/actions/red-flags.test.ts` | `addRedFlag`, `resolveRedFlag`, `unresolveRedFlag`, `removeRedFlag` — auth checks |
| `src/lib/actions/tasks.test.ts` | `createTask`, `updateTask` — auth checks |
| `src/lib/actions/financials.test.ts` | `addFinancialEntry` — auth checks |
| `src/lib/actions/prompt-versions.test.ts` | `savePromptVersion`, `activatePromptVersion`, `resetToDefaultPrompt` — admin RBAC enforcement |
| `src/lib/actions/settings.test.ts` | `updateGdriveFolderId`, `disconnectGdrive` — auth checks |

---

### Phase 4: API Route Tests

Test Next.js route handlers by constructing `Request`/`NextRequest` objects and calling exported handler functions directly.

| Test File | What's Tested |
|---|---|
| `src/app/api/webhooks/clerk/route.test.ts` | Missing secret (500), missing svix headers (400), invalid signature (400), `user.created` upsert, `user.deleted` delete, unknown event graceful handling |
| `src/app/api/processing/status/route.test.ts` | Missing runId (400), successful status retrieval, run not found (404) |
| `src/app/api/gdrive/files/route.test.ts` | Missing portcoId (400), file listing, null connection (empty array), GDrive error (500) |

---

### Phase 5: Auth & RBAC Integration Tests (Future)

Extend `src/lib/auth/index.test.ts` with:
- `getCurrentUser()` — maps Clerk user to DB user, returns null when unauthenticated
- `getUserPortcos()` — returns portcos with memberships
- `getUserPortcoRole()` — returns role or null for non-member
- `getPortcoBySlug()` — returns portco or null
- Cross-tenant data isolation verification

---

### Phase 6: CI/CD

**`.github/workflows/test.yml`** runs on every push and PR to `main`/`develop`:
1. `pnpm install --frozen-lockfile`
2. `pnpm test`
3. `pnpm lint`

---

## Mocking Strategy

| Dependency | Mock Approach |
|---|---|
| **Drizzle DB** | `vi.mock('@/lib/db')` — Proxy-based chainable query builder |
| **Clerk Auth** | `vi.mock('@/lib/auth')` — mock `getCurrentUser()`, `getPortcoBySlug()`, etc. |
| **Trigger.dev** | `vi.mock('@trigger.dev/sdk')` — mock `tasks.trigger()`, `runs.retrieve()` |
| **next/cache** | `vi.mock('next/cache')` — mock `revalidatePath`, `revalidateTag` (global in setup.ts) |
| **next/headers** | `vi.mock('next/headers')` — mock `headers()` for webhook tests |
| **Svix** | `vi.mock('svix')` — mock `Webhook` class with controllable `verify()` |
| **GDrive** | `vi.mock('@/lib/gdrive/client')` — mock `listFiles`, `getDriveClient` |
| **Crypto env** | Set `GOOGLE_DRIVE_ENCRYPTION_KEY` in `src/test/setup.ts` |

**Key pattern**: Use `vi.hoisted()` for any variables referenced inside `vi.mock()` factory functions, since `vi.mock` calls are hoisted to the top of the file.

```ts
const { mockUser } = vi.hoisted(() => ({
  mockUser: { id: "user-001", email: "test@example.com" },
}));

vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn().mockResolvedValue(mockUser),
}));
```

---

## Implementation Summary

### Files Created (23 total)

#### Infrastructure (6)
| File | Purpose |
|---|---|
| `vitest.config.ts` | Vitest configuration with path aliases and coverage |
| `src/test/setup.ts` | Global test setup (env vars, next/cache mock) |
| `src/test/mocks/db.ts` | Chainable Drizzle DB mock utilities |
| `src/test/mocks/auth.ts` | Clerk auth mock helpers and default fixtures |
| `src/test/mocks/trigger.ts` | Trigger.dev SDK mock helpers |
| `src/test/factories.ts` | Test data factories (User, PortCo, Deal, BrokerFirm, Stage, RedFlag, Task) |

#### Test Files (16)
| File | Tests | Category |
|---|---|---|
| `src/lib/format.test.ts` | 10 | Pure function |
| `src/lib/auth/index.test.ts` | 6 | Pure function |
| `src/lib/scoring/rubric.test.ts` | 18 | Pure function |
| `src/lib/scoring/red-flags.test.ts` | 16 | Pure function |
| `src/lib/gdrive/crypto.test.ts` | 10 | Pure function |
| `src/lib/agents/im-processor/schema.test.ts` | 10 | Pure function |
| `src/lib/actions/deals.test.ts` | 3 | Server action |
| `src/lib/actions/brokers.test.ts` | 6 | Server action |
| `src/lib/actions/red-flags.test.ts` | 4 | Server action |
| `src/lib/actions/tasks.test.ts` | 2 | Server action |
| `src/lib/actions/financials.test.ts` | 1 | Server action |
| `src/lib/actions/prompt-versions.test.ts` | 3 | Server action |
| `src/lib/actions/settings.test.ts` | 2 | Server action |
| `src/app/api/webhooks/clerk/route.test.ts` | 6 | API route |
| `src/app/api/processing/status/route.test.ts` | 3 | API route |
| `src/app/api/gdrive/files/route.test.ts` | 4 | API route |

**Total: 110 tests, 16 files, all passing**

#### CI (1)
| File | Purpose |
|---|---|
| `.github/workflows/test.yml` | Run tests + lint on push/PR to main/develop |

### Modified Files
| File | Change |
|---|---|
| `package.json` | Added `test`, `test:watch`, `test:coverage` scripts + devDependencies |
| `CLAUDE.md` | Added Testing Requirements section |

---

## Guidelines for Extending Tests

1. **Co-locate tests**: Place `foo.test.ts` next to `foo.ts`
2. **Run tests after every change**: `pnpm test`
3. **New features require tests**: Every new server action, API route, or utility function must have corresponding tests
4. **Feature changes require test updates**: When modifying existing behavior, update tests to match
5. **Use factories**: Import from `src/test/factories.ts` for consistent test data
6. **Use `vi.hoisted()`**: For any variables referenced inside `vi.mock()` factories
7. **Mock at boundaries**: Mock external services (DB, auth, Trigger.dev), not internal logic

### Adding a New Server Action Test

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockUser } = vi.hoisted(() => ({
  mockUser: { id: "user-001", email: "test@example.com", fullName: "Test User" },
}));

vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn().mockResolvedValue(mockUser),
}));

vi.mock("@/lib/db", () => {
  const chainFn = vi.fn();
  const chain: any = new Proxy({}, {
    get() { chainFn.mockReturnValue(chain); return chainFn; },
  });
  return { db: chain };
});

// Mock schema tables and drizzle-orm operators as needed

import { getCurrentUser } from "@/lib/auth";

describe("myAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getCurrentUser as any).mockResolvedValue(mockUser);
  });

  it("throws when user is not authenticated", async () => {
    (getCurrentUser as any).mockResolvedValue(null);
    const { myAction } = await import("./my-action");
    await expect(myAction("arg")).rejects.toThrow("Unauthorized");
  });
});
```

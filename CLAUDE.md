# Rollup OS

M&A deal flow analysis and automation SaaS for managing rollup acquisitions across multiple PortCos.

## Tech Stack

- **Framework**: Next.js 15 (App Router) + TypeScript
- **Styling**: Tailwind CSS v4 + shadcn/ui
- **Auth**: Clerk (Google SSO)
- **Database**: Supabase (PostgreSQL) + Drizzle ORM + pgvector
- **Background Jobs**: Trigger.dev v3 (not yet configured)
- **AI**: Vercel AI SDK + Zod (not yet configured)
- **LLMOps**: Langfuse (not yet configured)
- **Package Manager**: pnpm
- **Deployment**: Vercel

## Project Structure

```
src/
├── app/
│   ├── (auth)/                    — Clerk sign-in/sign-up pages
│   ├── (app)/[portcoSlug]/        — All PortCo-scoped routes (dashboard, deals, brokers, etc.)
│   ├── api/webhooks/clerk/        — Clerk user sync webhook
│   ├── layout.tsx                 — Root layout (ClerkProvider, TooltipProvider)
│   └── page.tsx                   — Root redirect to first PortCo dashboard
├── components/
│   ├── layout/                    — App sidebar, header, PortCo switcher
│   ├── dashboard/                 — Dashboard-specific components
│   └── ui/                        — shadcn/ui components (do not edit directly)
├── hooks/                         — Custom React hooks
├── lib/
│   ├── auth/                      — Clerk helpers, RBAC utilities
│   ├── db/
│   │   ├── schema/                — Drizzle schema files (one per domain)
│   │   ├── migrations/            — Generated SQL migrations
│   │   ├── index.ts               — Drizzle client
│   │   └── seed.ts                — Seed script
│   ├── actions/                   — Server actions grouped by domain
│   ├── gdrive/                    — GDrive client factory (future)
│   └── agents/                    — Agent configs, prompts, Zod schemas (future)
└── middleware.ts                   — Clerk auth middleware
```

## Key Commands

```bash
pnpm dev              # Start dev server
pnpm build            # Production build
pnpm typecheck        # TypeScript type checking (tsc --noEmit)
pnpm lint             # ESLint
pnpm test             # Run all tests (Vitest)
pnpm test:watch       # Run tests in watch mode
pnpm test:coverage    # Run tests with coverage report
pnpm db:push          # Push schema to DB (dev only)
pnpm db:generate      # Generate migration SQL files
pnpm db:migrate       # Run pending migrations
pnpm db:studio        # Open Drizzle Studio
pnpm db:seed          # Seed sample PortCo + pipeline stages
```

## Architecture Conventions

- **Multi-tenancy**: Application-level via `portco_id` FK on nearly every table. RBAC enforced in the `[portcoSlug]/layout.tsx`.
- **Roles**: `owner > admin > analyst > viewer`. Use `hasMinRole()` from `src/lib/auth/`.
- **Schema files**: One file per domain in `src/lib/db/schema/`. Export everything from `schema/index.ts`.
- **Brokers are global**: Shared across PortCos. Scoped via `broker_interactions.portco_id`.
- **Agents are pluggable**: Registered in `agent_definitions` table. Adding a new agent = 1 DB row + 1 Trigger.dev task file.
- **KPIs are centralized**: `kpi_definitions` + `kpi_values` track metrics across all deal phases.
- **GDrive**: Per-PortCo service accounts (different GSuites). Credentials encrypted at rest.

## Code Quality Rules

### Server Actions — Auth & RBAC
- **Every server action must authenticate**: Use `requireAuth()` for read operations and `requirePortcoRole(portcoId, minRole)` for write operations from `src/lib/auth/`. Never use raw `getCurrentUser()` + manual null check.
- **Role requirements**: Reads require at minimum authenticated user. Writes (create/update) require `"analyst"` role. Deletes and settings require `"admin"` role. Use `requirePortcoRole()` which enforces both membership and role.
- **Multi-tenant isolation**: Every read query must be scoped by `portcoId`. Never trust client-provided IDs without verifying the user has membership in the corresponding PortCo.

### Input Validation
- **Validate all server action inputs with Zod**: Define schemas in `src/lib/actions/schemas.ts` and call `.parse()` at the top of each action. Never use `as` type casts for user input — use schema validation instead.
- **Enum fields**: Always validate against Zod `.enum()` rather than trusting string values for fields like `status`, `source`, `priority`, `category`, `severity`.

### File Size & Modularity
- **Max ~200 lines per file**: If a file exceeds 200 lines, split it into focused modules. Use barrel exports (`index.ts`) to maintain a clean public API.
- **One component per file**: Do not nest component definitions inside other component files. Extract sub-components to their own files.
- **Extract shared constants**: Icon mappings, label records, color functions, and other lookup tables belong in `src/lib/constants.ts`, not duplicated across components.

### Database Schema
- **Always add FK constraints**: Every UUID column referencing another table must have `.references(() => table.id)` in the Drizzle schema. This includes self-referential FKs (e.g., `parentId`).
- **Prefer Drizzle query builder over raw SQL**: Use Drizzle's type-safe API. If raw SQL is unavoidable, document why.
- **Activity log action names**: Use consistent, descriptive action names (e.g., `"deal_created"`, `"financial_entry_added"`). Never reuse action names for different operations.

### Error Handling
- **Wrap external service calls in try-catch**: Trigger.dev `tasks.trigger()`, GDrive API calls, and AI SDK calls must have error handling with meaningful error messages.
- **Use consistent error messages**: Auth errors throw `"Unauthorized"`, membership errors throw `"Not a member of this PortCo"`, role errors throw `"Insufficient permissions"`, missing resources throw `"<Resource> not found"`.

### Formatting & Utilities
- **Use shared formatters**: Date formatting, currency formatting, and number formatting should use helpers from `src/lib/format.ts`. Do not use inline `toLocaleDateString()` or similar in components.
- **No magic numbers**: Extract polling intervals, concurrency limits, retry counts, etc. into named constants.

## Testing Requirements

- **Run typecheck after every change**: Always run `pnpm typecheck` after making any code changes to ensure TypeScript compiles without errors. This catches type errors that tests and lint may miss.
- **Run tests after every change**: Always run `pnpm test` after making any code changes to ensure nothing is broken.
- **Add tests for every new feature**: Every new feature or server action must include corresponding test files.
- **Add tests for every feature change**: When modifying existing features, update or add tests to cover the changed behavior.
- **Test framework**: Vitest (config in `vitest.config.ts`, setup in `src/test/setup.ts`).
- **Test file location**: Co-locate test files next to the source file (e.g., `deals.ts` → `deals.test.ts`).
- **Mocking**: Use `vi.hoisted()` for variables referenced inside `vi.mock()` factories. Mock helpers are in `src/test/mocks/` and factories in `src/test/factories.ts`.
- **CI**: Tests run automatically on push/PR via GitHub Actions (`.github/workflows/test.yml`).

## Documentation Maintenance

- **Keep `README.md` up to date**: When making changes that affect the README — such as adding/removing features, changing the tech stack, adding new scripts to `package.json`, modifying the project structure, or updating setup steps — update `README.md` to reflect those changes in the same commit.
- **Flag stale docs**: If a change significantly alters the architecture (new DB tables, new integrations, new major features, or structural changes), mention to the user that `docs/architecture.md` or other relevant docs in `docs/` may need updating. Do not update them automatically — just flag it.
- **Phase summaries are historical**: Do not modify `docs/phase1-summary.md`, `docs/phase2-summary.md`, or similar phase docs. They are point-in-time records.

## Documentation

- `README.md` — Project overview, setup guide, tech stack, and quick reference
- `docs/architecture.md` — Full architecture, schema ERD, technical strategy, 5-phase plan
- `docs/production-readiness.md` — Operational checklist for launch
- `docs/phase1-summary.md` — Phase 1 deliverables and setup instructions
- `docs/testing.md` — Automated test plan, implementation summary, and guidelines for extending tests
- `docs/refactoring-plan.md` — Codebase refactoring plan with prioritized phases

## Current Status

Phase 1 complete. Phase 2 (Deal Pipeline & Kanban) is next.

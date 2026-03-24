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

## Testing Requirements

- **Run tests after every change**: Always run `pnpm test` after making any code changes to ensure nothing is broken.
- **Add tests for every new feature**: Every new feature or server action must include corresponding test files.
- **Add tests for every feature change**: When modifying existing features, update or add tests to cover the changed behavior.
- **Test framework**: Vitest (config in `vitest.config.ts`, setup in `src/test/setup.ts`).
- **Test file location**: Co-locate test files next to the source file (e.g., `deals.ts` → `deals.test.ts`).
- **Mocking**: Use `vi.hoisted()` for variables referenced inside `vi.mock()` factories. Mock helpers are in `src/test/mocks/` and factories in `src/test/factories.ts`.
- **CI**: Tests run automatically on push/PR via GitHub Actions (`.github/workflows/test.yml`).

## Documentation

- `docs/architecture.md` — Full architecture, schema ERD, technical strategy, 5-phase plan
- `docs/production-readiness.md` — Operational checklist for launch
- `docs/phase1-summary.md` — Phase 1 deliverables and setup instructions
- `docs/testing.md` — Automated test plan, implementation summary, and guidelines for extending tests

## Current Status

Phase 1 complete. Phase 2 (Deal Pipeline & Kanban) is next.

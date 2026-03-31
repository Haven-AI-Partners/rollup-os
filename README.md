# Rollup OS

[![Tests](https://github.com/Haven-AI-Partners/rollup-os/actions/workflows/test.yml/badge.svg?branch=main)](https://github.com/Haven-AI-Partners/rollup-os/actions/workflows/test.yml)
[![Coverage](https://codecov.io/gh/Haven-AI-Partners/rollup-os/branch/main/graph/badge.svg)](https://codecov.io/gh/Haven-AI-Partners/rollup-os)

M&A deal flow analysis and automation platform for managing rollup acquisitions across multiple portfolio companies (PortCos). Built for teams running buy-and-build strategies who need to source, score, and manage deal pipelines at scale.

## Key Features

- **Multi-PortCo Management** — Switch between portfolio companies with scoped dashboards, pipelines, and settings
- **Deal Pipeline & Kanban** — Track deals through customizable pipeline stages with drag-and-drop
- **Broker CRM** — Global broker directory with per-PortCo interaction tracking and relationship scoring
- **IM Scoring** — Per-PortCo scoring rubrics with 8-dimension weighted criteria for evaluating deals
- **Google Drive Integration** — Per-PortCo service accounts for document management
- **RBAC** — Role-based access control (owner, admin, analyst, viewer) per PortCo membership
- **Activity Logging** — Full audit trail across deal lifecycle events

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router) + TypeScript |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Auth | Clerk (Google SSO) |
| Database | Supabase (PostgreSQL) + Drizzle ORM + pgvector |
| Background Jobs | Trigger.dev v3 |
| AI | Vercel AI SDK + Zod |
| Package Manager | pnpm |
| Deployment | Vercel |

## Getting Started

### Prerequisites

- Node.js 20+
- [pnpm](https://pnpm.io/) 9+
- A [Supabase](https://supabase.com/) project (PostgreSQL)
- A [Clerk](https://clerk.com/) application

### Setup

1. **Clone and install dependencies:**

   ```bash
   git clone https://github.com/haven-ai-partners/rollup-os.git
   cd rollup-os
   pnpm install
   ```

2. **Configure environment variables:**

   ```bash
   cp .env.example .env.local
   ```

   Fill in your Supabase `DATABASE_URL`, Clerk keys, and encryption key. See `.env.example` for all required variables.

3. **Push the database schema and seed data:**

   ```bash
   pnpm db:push
   pnpm db:seed
   ```

4. **Start the dev server:**

   ```bash
   pnpm dev
   ```

   Open [http://localhost:3000](http://localhost:3000) to get started.

## Scripts

```bash
pnpm dev              # Start dev server
pnpm build            # Production build
pnpm typecheck        # TypeScript type checking
pnpm lint             # ESLint
pnpm test             # Run tests (Vitest)
pnpm test:watch       # Run tests in watch mode
pnpm test:coverage    # Run tests with coverage

# Database
pnpm db:push          # Push schema to DB (dev only)
pnpm db:generate      # Generate migration SQL
pnpm db:migrate       # Run pending migrations
pnpm db:studio        # Open Drizzle Studio
pnpm db:seed          # Seed sample data
```

## Project Structure

```
src/
├── app/
│   ├── (auth)/                    — Sign-in / sign-up pages
│   ├── (app)/[portcoSlug]/        — PortCo-scoped routes (dashboard, deals, brokers, etc.)
│   └── api/webhooks/clerk/        — Clerk user sync webhook
├── components/
│   ├── layout/                    — App sidebar, header, PortCo switcher
│   ├── dashboard/                 — Dashboard components
│   └── ui/                        — shadcn/ui primitives
├── hooks/                         — Custom React hooks
├── lib/
│   ├── auth/                      — Clerk helpers, RBAC utilities
│   ├── db/schema/                 — Drizzle schema (one file per domain)
│   ├── db/migrations/             — Generated SQL migrations
│   └── actions/                   — Server actions grouped by domain
└── middleware.ts                   — Clerk auth middleware
```

## Architecture

- **Multi-tenancy** is application-level, scoped by `portco_id` on nearly every table
- **Brokers are global** — shared across PortCos, scoped via interaction records
- **Agents are pluggable** — registered in `agent_definitions` table (1 DB row + 1 Trigger.dev task)

See [`docs/architecture.md`](docs/architecture.md) for the full schema ERD and technical design.

## Documentation

- [`docs/architecture.md`](docs/architecture.md) — Schema ERD, technical strategy, and 5-phase plan
- [`docs/testing.md`](docs/testing.md) — Test plan and guidelines
- [`docs/production-readiness.md`](docs/production-readiness.md) — Operational checklist for launch

## License

Private — all rights reserved.

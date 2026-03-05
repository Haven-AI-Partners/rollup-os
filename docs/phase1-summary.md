# Phase 1 — Foundation Summary

## What Was Built

### Project Setup
- Next.js 15 (App Router) + TypeScript + Tailwind CSS v4 + shadcn/ui (16 components)
- pnpm as package manager
- Drizzle ORM + postgres driver + drizzle-kit for migrations
- Clerk for authentication (Google SSO)
- svix for Clerk webhook verification

### Database Schema (11 schema files)

All tables from the architecture doc are defined in `src/lib/db/schema/`:

| File | Tables |
|---|---|
| `users.ts` | `users` |
| `portcos.ts` | `portcos`, `portco_memberships` |
| `deals.ts` | `pipeline_stages`, `deals`, `deal_transfers`, `deal_comments`, `deal_financials` |
| `deal-tasks.ts` | `deal_tasks`, `deal_activity_log` |
| `brokers.ts` | `broker_firms`, `broker_contacts`, `broker_interactions`, `broker_metrics` |
| `files.ts` | `files` |
| `profiles.ts` | `company_profiles` |
| `embeddings.ts` | `document_embeddings` |
| `agents.ts` | `agent_definitions`, `portco_agent_configs`, `agent_runs` |
| `kpis.ts` | `kpi_definitions`, `kpi_values` |
| `notifications.ts` | `notifications` |

### Authentication & RBAC
- Clerk middleware protects all routes except `/sign-in`, `/sign-up`, and `/`
- Clerk webhook (`/api/webhooks/clerk`) syncs user creation/updates/deletion to the `users` table
- Auth helpers in `src/lib/auth/`: `getCurrentUser`, `getUserPortcos`, `getUserPortcoRole`, `hasMinRole`
- PortCo layout checks membership before rendering — unauthorized users get a 404

### App Shell & Routing

```
/sign-in                          — Clerk sign-in
/sign-up                          — Clerk sign-up
/                                 — Redirects to first PortCo dashboard
/{portcoSlug}/dashboard           — Executive summary (landing page)
/{portcoSlug}/deals               — Placeholder (Phase 2)
/{portcoSlug}/brokers             — Placeholder (Phase 3)
/{portcoSlug}/agents              — Placeholder (Phase 4)
/{portcoSlug}/analytics           — Placeholder (Phase 5)
/{portcoSlug}/settings            — Integration status cards
```

- Sidebar with PortCo switcher dropdown, navigation links, admin section (Settings visible to owner/admin only)
- Header with Clerk UserButton for profile/sign-out

### Executive Summary Dashboard (`/{portcoSlug}/dashboard`)
- Company identity: name, description, industry, focus area badges
- Investment thesis card
- Aggregate financials: portfolio revenue, EBITDA, capital deployed, active pipeline count
- Pipeline snapshot: deal counts per stage with color indicators
- Acquisition leaderboard: top 10 closed deals ranked by EBITDA contribution
- Target criteria: revenue/EBITDA/deal size ranges, geography
- Team members with roles

### Seed Data
- `pnpm db:seed` creates a sample PortCo ("Haven Capital") with 8 default pipeline stages

## Setup Instructions

### 1. Environment Variables

Copy `.env.example` to `.env.local` and fill in:

```bash
cp .env.example .env.local
```

Required variables:
- `DATABASE_URL` — Supabase PostgreSQL connection string (use the pooled/transaction connection)
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` — from Clerk dashboard
- `CLERK_SECRET_KEY` — from Clerk dashboard
- `CLERK_WEBHOOK_SECRET` — from Clerk dashboard (Webhooks section)

### 2. Database Setup

```bash
# Push schema to Supabase (dev mode — no migration files)
pnpm db:push

# Seed sample data
pnpm db:seed
```

### 3. Clerk Setup

1. Create a Clerk application at clerk.com
2. Enable Google SSO in the Clerk dashboard
3. Add a webhook endpoint pointing to `https://your-domain/api/webhooks/clerk`
4. Subscribe to events: `user.created`, `user.updated`, `user.deleted`
5. Copy the webhook signing secret to `CLERK_WEBHOOK_SECRET`

### 4. Run Locally

```bash
pnpm dev
```

### 5. Vercel Deployment

Environment variables to set in Vercel:
- `DATABASE_URL`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `CLERK_WEBHOOK_SECRET`
- `ENCRYPTION_KEY` (for future GDrive credential encryption)

## Available Scripts

| Script | Description |
|---|---|
| `pnpm dev` | Start dev server |
| `pnpm build` | Production build |
| `pnpm lint` | Run ESLint |
| `pnpm db:push` | Push schema directly to DB (dev) |
| `pnpm db:generate` | Generate SQL migration files |
| `pnpm db:migrate` | Run pending migrations |
| `pnpm db:studio` | Open Drizzle Studio (DB browser) |
| `pnpm db:seed` | Seed sample PortCo and pipeline stages |

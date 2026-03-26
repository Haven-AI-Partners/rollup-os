# Rollup OS — Status Report & Roadmap

_Generated: 2026-03-26_

---

## 1. Executive Summary

Rollup OS is an M&A deal flow analysis and automation SaaS platform built for teams running buy-and-build acquisition strategies across multiple portfolio companies (PortCos). The platform enables users to source, score, and manage deal pipelines at scale with AI-powered document processing, broker relationship management, and multi-tenant dashboards.

**Current state:** The platform has completed its core foundation (Phases 1-2) and significant portions of Phases 3-4. The deal pipeline, broker CRM, Google Drive integration, and IM Processing agent are fully operational. Key gaps remain in notifications, deal sourcing automation, broker engagement automation, analytics dashboards, and production hardening.

---

## 2. Existing Functionality

### 2.1 Authentication & Multi-Tenancy

| Feature | Status |
|---------|--------|
| Clerk authentication with Google SSO | Done |
| Role-based access control (owner, admin, analyst, viewer) | Done |
| Multi-PortCo support with scoped dashboards | Done |
| Auto-join by email domain | Done |
| User sync via Clerk webhook | Done |
| Permission-gated UI (admin-only controls) | Done |
| `requireAuth()` / `requirePortcoRole()` wrappers | Done |

### 2.2 Deal Pipeline & Kanban

| Feature | Status |
|---------|--------|
| Kanban board with drag-and-drop stage transitions | Done |
| Deal CRUD (create, edit, archive, pass) | Done |
| 5-phase pipeline (sourcing, evaluation, diligence, closing, PMI) | Done |
| Custom pipeline stages per PortCo | Done |
| Deal list view (alternative to Kanban) | Done |
| Deal filtering and search | Done |
| Deal transfer across PortCos with audit trail | Done |

**Deal Detail Workspace** — 9 tabbed views per deal:

| Tab | Description |
|-----|-------------|
| Overview | Summary, key metrics, scoring breakdown |
| Profile | AI-extracted company profile from IM processing |
| Organization | Org chart visualization |
| Thesis | Investment thesis tree and graph (via XYFlow) |
| Financials | Multi-period financial tracking (monthly/quarterly/annual/snapshot), multi-currency (JPY default) |
| Files | Document storage with GDrive integration, 11 file types |
| Comments | Discussion threads |
| Tasks | Task management with categories (due diligence, legal, financial, operational) and priorities |
| Activity | Full audit trail from `deal_activity_log` |

### 2.3 IM Scoring System

| Feature | Status |
|---------|--------|
| Per-PortCo 8-dimension scoring rubric with configurable weights | Done |
| Sub-criteria scoring (3-4 sub-criteria per dimension) | Done |
| Red flag detection with evidence chains and confidence thresholds | Done |
| Info gap checklist (21 items) | Done |
| AI-powered scoring via multimodal Gemini PDF analysis | Done |
| Consensus scoring (multiple model passes) | Done |

### 2.4 Broker CRM

| Feature | Status |
|---------|--------|
| Global broker firm directory (shared across PortCos) | Done |
| Broker contact management | Done |
| Per-PortCo interaction logging (email, call, meeting) | Done |
| Broker metrics tracking (response time, deal quality) | Done |
| Firm detail pages with contacts and interaction history | Done |

### 2.5 AI Agents

| Agent | Status | Description |
|-------|--------|-------------|
| IM Processor | Done | Multimodal PDF analysis via Gemini, financial extraction, scoring, red flag detection, profile generation |
| File Classifier | Done | Auto-classify uploaded documents by type |
| Thesis Generator | Done | Generate investment thesis from deal data |
| Discovery Interviewer | Done | Conduct employee interviews via chat with password-protected sessions, workflow capture (44-field schema) |
| DD Processor | Placeholder | Due diligence processing (schema defined, not implemented) |
| Deal Sourcing Agent | Not built | Scraping 9 JP/intl M&A sites, LLM matching, auto-deal creation |
| Broker Engagement Agent | Not built | Email drafting, outbound email, interaction logging |

**Agent Infrastructure:**
- Trigger.dev v3 integration for async job execution
- Langfuse tracing support for LLM observability
- Prompt versioning with `{{PLACEHOLDER}}` template system
- Eval system (multi-pass scoring consistency checks)
- Per-PortCo agent configuration and prompt customization
- LLM providers: Google Gemini, OpenAI, Moonshot AI

### 2.6 Google Drive Integration

| Feature | Status |
|---------|--------|
| Per-PortCo service account configuration | Done |
| Encrypted credential storage (AES-256-GCM) | Done |
| File browser within deal detail | Done |
| File upload and download | Done |
| Folder scanning for new IMs | Done |
| Auto-classification of uploaded files | Done |
| Batch reprocessing of all files | Done |
| OAuth connection flow in settings | Done |

### 2.7 Executive Dashboard

| Feature | Status |
|---------|--------|
| Company identity (name, description, industry, thesis, focus areas) | Done |
| Aggregate financials (portfolio revenue, EBITDA, capital deployed) | Done |
| Pipeline snapshot (deal counts per stage) | Done |
| Acquisition leaderboard (top 10 closed deals by EBITDA) | Done |
| Target criteria summary | Done |
| Team members with roles | Done |
| Pipeline charts (via Recharts) | Done |

### 2.8 Portfolio Section

| Feature | Status |
|---------|--------|
| Portfolio companies list (closed_won acquisitions) | Done |
| Portfolio analytics page | Done |

### 2.9 Settings & Configuration

| Feature | Status |
|---------|--------|
| Team management (invite, roles, remove) | Done |
| GDrive connector setup | Done |
| PortCo customization (branding, criteria) | Done |

### 2.10 Testing & Quality

| Metric | Value |
|--------|-------|
| Test framework | Vitest |
| Total tests | 110 |
| Test files | 16 |
| Categories | Pure functions, server actions, API routes |
| CI/CD | GitHub Actions (push/PR to main/develop) |
| Mocking | Drizzle DB, Clerk Auth, Trigger.dev, GDrive, next/cache |
| Factories | User, PortCo, Deal, BrokerFirm, PipelineStage, RedFlag, Task |

### 2.11 Codebase Refactoring (All Complete)

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Security & auth hardening (requireAuth/requirePortcoRole, RBAC on writes) | Done |
| 2 | Split monolithic IM Processor (1,035 lines -> 5 focused modules) | Done |
| 3 | Input validation with Zod schemas | Done |
| 4 | Extract duplicated UI patterns and shared constants | Done |
| 5 | Schema & database cleanup (FK constraints, Drizzle query builder) | Done |
| 6 | Test coverage expansion | Done |
| 7 | Configuration & error handling (Trigger.dev try-catch, coverage thresholds) | Done |

---

## 3. Architecture Overview

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router) + TypeScript |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Auth | Clerk (Google SSO) |
| Database | Supabase (PostgreSQL) + Drizzle ORM + pgvector |
| Background Jobs | Trigger.dev v3 |
| AI | Vercel AI SDK + Google Gemini + OpenAI + Moonshot AI |
| LLMOps | Langfuse |
| Charts | Recharts |
| Diagrams | XYFlow (thesis trees, org charts) |
| Package Manager | pnpm |
| Deployment | Vercel |

### Multi-Tenancy Model

Application-level isolation via `portco_id` FK on nearly every table. RBAC enforced at the layout level (`[portcoSlug]/layout.tsx`). Brokers are the exception — they are global entities shared across PortCos, scoped via `broker_interactions.portco_id`.

### Database Schema

30+ tables organized across 11 schema files:

| Domain | Tables |
|--------|--------|
| Users | `users` |
| PortCos | `portcos`, `portco_memberships` |
| Deals | `pipeline_stages`, `deals`, `deal_transfers`, `deal_comments`, `deal_financials` |
| Tasks | `deal_tasks`, `deal_activity_log` |
| Brokers | `broker_firms`, `broker_contacts`, `broker_interactions`, `broker_metrics` |
| Files | `files` |
| Profiles | `company_profiles` |
| Scoring | `deal_thesis`, `deal_red_flags` |
| Agents | `agent_definitions`, `portco_agent_configs`, `prompt_versions`, `agent_runs` |
| Discovery | `discovery_campaigns`, `discovery_sessions`, `discovery_messages`, `discovery_workflows`, `discovery_dependencies` |
| KPIs | `kpi_definitions`, `kpi_values` |
| Other | `notifications`, `document_embeddings`, `org_charts`, `company_employees` |

### API Routes

| Endpoint | Purpose |
|----------|---------|
| `POST /api/webhooks/clerk` | User sync from Clerk |
| `POST /api/chat/deal` | Real-time deal chat with context |
| `POST /api/interview/auth` | Interview session authentication |
| `POST /api/interview/chat` | Interview chat endpoint |
| `POST /api/interview/feedback` | Session feedback collection |
| `POST /api/auth/gdrive/connect` | GDrive OAuth initiation |
| `GET /api/auth/gdrive/callback` | GDrive OAuth callback |
| `GET /api/gdrive/files` | List GDrive files |
| `GET /api/processing/status` | Poll file processing status |

---

## 4. Roadmap

### Phase Progress Overview

| Phase | Name | Status | Completion |
|-------|------|--------|------------|
| 1 | Foundation (Setup, Auth, Schema, Layout) | **Complete** | 100% |
| 2 | Deal Pipeline & Company Profiles | **Complete** | 100% |
| 3 | Integrations (GDrive, Slack, Broker Mgmt) | **Partial** | ~60% |
| 4 | AI Agents | **Partial** | ~40% |
| 5 | Analytics, Polish & Production Hardening | **Not Started** | 0% |

---

### 4.1 Phase 3 — Remaining Integration Work

#### Slack Notifications
- Configure per-PortCo webhook in settings
- Notify on: new deal, stage change, IM processed, task completion
- Queue and retry on Slack downtime

#### Email Automation (Gmail API)
- Gmail API via service account with domain-wide delegation
- **Inbound**: Parse broker emails, auto-log interactions, detect IM attachments
- **Outbound**: Send follow-ups, newsletters, IM requests via Resend/SendGrid fallback
- Rate limiting for Gmail API quotas

#### In-App Notification System
- Notification center UI
- Real-time notifications for deal activity, assignments, mentions
- Slack dispatch integration

---

### 4.2 Phase 4 — AI Agent Completion

#### Deal Sourcing Agent (High Priority)
Automate deal discovery across 9 Japanese and international M&A platforms:
- **Targets**: Tranbi, Batonz, Himawari, MAfolova, FundBook, SMERGERS, DealStream, Strike, MA-CP
- Per-site scraper tasks with configurable selectors (`scrape_config`)
- Bilingual JP/EN content handling (7 of 9 sites are Japanese)
- LLM matching: compare listings against PortCo `acquisition_criteria`
- Auto-create deal cards for matches above threshold
- IM request submission (contact form / email)
- Login-gated site support (credential storage, session management)

#### Broker Engagement Agent
- LLM-drafted emails (newsletters, follow-ups, IM requests)
- Outbound email via Resend/SendGrid
- Automated interaction logging from sent emails
- Template management per PortCo

#### DD Processor Agent
- Due diligence document processing (currently placeholder)
- Extract findings from DD reports
- Flag inconsistencies with IM data

---

### 4.3 Phase 5 — Analytics & Production

#### Analytics Dashboards
- **Broker performance**: response times, deal quality scores, volume by firm
- **Individual broker scorecards**: conversion rates, engagement metrics
- **Pipeline velocity**: average time per stage, stage conversion rates
- **Deal sourcing funnel**: scraped -> matched -> IM received -> scored -> LOI
- **Broker engagement analytics**: outreach effectiveness, response rates, relationship health trends

#### Search & Discovery
- pgvector semantic search across deals, company profiles, and documents
- Cross-deal similarity matching

#### Bulk Operations
- Batch stage moves
- Bulk assignment of deals to analysts

#### Audit Log UI
- Searchable, filterable activity log across all deals and PortCos
- Export capability for compliance

#### Production Hardening
Per the [production readiness checklist](./production-readiness.md):
- Database: migration strategy, connection pooling, backups, index tuning
- Auth: production Clerk instance, session management, rate limiting
- Security: OWASP review, tenant isolation audit, dependency audit, CSP headers
- Monitoring: Sentry error tracking, uptime monitoring, structured logging
- Performance: Core Web Vitals, Kanban at 100+ deals, query optimization, pagination

---

### 4.4 New Roadmap Items

#### Google Calendar Integration
- Automatic meeting scheduling with brokers and deal contacts
- Calendar sync for deal-related meetings (DD sessions, management meetings, closing calls)
- Meeting reminders tied to deal tasks
- Availability detection for team members across PortCos

#### Granola Integration
- **Meeting follow-up tracking**: Capture action items from recorded meetings, auto-create deal tasks
- **Portfolio company sales call tracking**: Monitor sales performance across acquired companies post-PMI
- Sync meeting transcripts and notes to deal activity log
- Extract key decisions and commitments from meeting recordings
- Dashboard for follow-up completion rates across deals and portfolio companies

#### Broker Engagement Strategy & Analytics
- Engagement scoring model: frequency, recency, deal quality, responsiveness
- Automated engagement cadence recommendations per broker
- Broker tier classification (A/B/C) based on historical performance
- Relationship health alerts (declining engagement, missed follow-ups)
- ROI tracking: deals closed per broker, average deal quality by source

#### Email Automation for Broker Communication
- Templated outreach sequences (intro, follow-up, IM request, thank you)
- Per-PortCo email templates with merge fields
- Scheduled sends and drip campaigns
- Open/click tracking integration
- Auto-classify inbound broker emails and route to correct deal

---

## 5. Production Readiness Status

All items from the [production readiness checklist](./production-readiness.md) are currently **unchecked**. Summary by category:

| Category | Items | Status |
|----------|-------|--------|
| Database & Migrations | Migration strategy, pooling, backups, indexes, pgvector tuning | Not started |
| Authentication & Authorization | Production Clerk, SSO, RBAC testing, rate limiting | Not started |
| Secrets & Credential Management | Env var audit, encryption keys, per-environment config | Not started |
| Infrastructure (Vercel/Supabase/Trigger.dev/Langfuse) | Production instances, deploy config, retry policies | Not started |
| External Integrations (GDrive/Gmail/Slack/Scrapers) | Production testing, error handling, rate limits | Not started |
| Security | OWASP review, tenant isolation audit, CSP headers | Not started |
| Monitoring & Observability | Error tracking, uptime, DB monitoring, log aggregation | Not started |
| Performance | Core Web Vitals, load testing, query optimization | Not started |
| Data Integrity & Recovery | Backup restoration, idempotency, soft delete policy | Not started |
| Pre-Launch | Staging env, E2E smoke tests, UAT, rollback plan | Not started |

---

## 6. Recommended Priorities

### Immediate (Next Sprint)
1. **Slack notifications** — Low effort, high visibility. Webhook infrastructure exists, just needs message formatting and event triggers.
2. **Deal Sourcing Agent** — Highest business value. Core differentiator for the platform.
3. **Google Calendar integration** — Streamlines broker meeting workflow.

### Short-Term (1-2 Sprints)
4. **Email automation** — Broker outreach sequences and inbound parsing.
5. **Broker Engagement Agent** — Builds on email automation, adds LLM-drafted communications.
6. **Broker engagement analytics** — Engagement scoring, tier classification, health alerts.

### Medium-Term (3-4 Sprints)
7. **Analytics dashboards** — Pipeline velocity, sourcing funnel, broker scorecards.
8. **Granola integration** — Meeting follow-ups, portfolio sales call tracking.
9. **pgvector semantic search** — Cross-deal discovery and similarity matching.

### Pre-Launch
10. **Production hardening** — Complete the full production readiness checklist.
11. **Load testing & performance** — Validate at scale before onboarding users.
12. **Security audit** — OWASP review, tenant isolation verification.

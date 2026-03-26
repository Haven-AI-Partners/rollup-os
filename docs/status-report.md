# Rollup OS — Status Report & Roadmap

_Generated: 2026-03-26_

---

## 1. Executive Summary

Rollup OS is an M&A deal flow analysis and automation SaaS platform built for teams running buy-and-build acquisition strategies across multiple portfolio companies (PortCos). The platform enables users to source, score, and manage deal pipelines at scale with AI-powered document processing, broker relationship management, and multi-tenant dashboards.

**Current state:** The platform has completed its core foundation (Phases 1-2) with backend logic and UI for deal pipeline, broker CRM, and Google Drive integration. However, many features lack admin UI for customization (scoring rubrics, red flags, PortCo profile editing are display-only). Test coverage is partial (~110 tests focused on auth checks and pure functions), meaning bugs likely exist in untested paths. AI agents are partially built — the IM Processor works end-to-end but Deal Sourcing and Broker Engagement agents are not yet implemented. Key gaps remain in admin configuration UI, notifications, deal sourcing automation, analytics dashboards, portfolio company tooling, and production hardening.

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
| Custom pipeline stages per PortCo | Backend only — no UI to add/remove/reorder stages |
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

**Deal Chatbot** — AI-powered contextual chat available on every deal page. Uses Gemini 2.5 Flash with Google Search tool. Provides answers grounded in deal data, IM analysis, financial data, management team info, and thesis tree. Accessible via a fixed bottom-right button that opens a chat sheet.

### 2.3 IM Scoring System

| Feature | Status |
|---------|--------|
| Per-PortCo 8-dimension scoring rubric with configurable weights | Backend done — UI is read-only ("Custom rubric editing coming soon") |
| Sub-criteria scoring (3-4 sub-criteria per dimension) | Done |
| Red flag detection with evidence chains and confidence thresholds | Backend done — UI is read-only ("Custom flag definitions coming soon") |
| Info gap checklist (21 items) | Done |
| AI-powered scoring via multimodal Gemini PDF analysis | Done |
| Consensus scoring (multiple model passes) | Done |

> **Gap:** Users cannot customize scoring rubric weights, red flag definitions, or acquisition criteria through the UI. These are display-only in the settings/customization page. Changes require direct DB edits or seed scripts.

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
| Portfolio analytics (acquisition leaderboard by EBITDA) | Done |
| Portfolio company KPI tracking | Not built — schema exists (`kpi_definitions`, `kpi_values`) but no UI or data flow |
| Portfolio company tool integrations | Not built — no connections to external tools for tracking acquired company performance |

> **Gap:** The portfolio section shows closed deals and a basic leaderboard, but has no tooling for actively tracking acquired company performance, KPIs, or operational metrics post-acquisition.

### 2.9 Settings & Configuration

| Feature | Status |
|---------|--------|
| Team management (invite, roles, remove) | Done |
| GDrive connector setup | Done |
| PortCo profile editing (name, industry, thesis, criteria) | Not built — display-only ("Profile editing coming soon") |
| Scoring rubric customization | Not built — display-only ("Custom rubric editing coming soon") |
| Red flag definition customization | Not built — display-only ("Custom flag definitions coming soon") |
| Pipeline stage management (add/remove/reorder) | Not built — no admin UI |
| Slack integration | Not built — "Coming soon" placeholder |
| Gmail integration | Not built — "Coming soon" placeholder |

> **Gap:** The settings/customization page is largely read-only. Users can manage team members and connect GDrive, but cannot configure the core business rules (scoring rubrics, red flags, pipeline stages, PortCo profile) through the UI.

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

> **Caveat:** Test coverage is partial and focused primarily on auth checks ("throws Unauthorized") and pure utility functions. Most server actions lack success-path tests (verifying correct DB calls and return values). There are no integration tests, no E2E tests, and no UI component tests. Given the limited coverage, **bugs likely exist in untested code paths** — particularly in complex flows like deal transfers, IM processing pipelines, GDrive file operations, and multi-step agent workflows. Missing test files include: `gdrive.test.ts`, `im-processing.test.ts`, `agents/im-processor/prompt.test.ts`.

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
| 2 | Deal Pipeline & Company Profiles | **Mostly Complete** | ~85% (backend done, admin UI for pipeline stages/customization missing) |
| 3 | Integrations (GDrive, Slack, Broker Mgmt) | **Partial** | ~40% (GDrive works, Slack/Gmail/notifications not built) |
| 4 | AI Agents | **Partial** | ~35% (IM Processor works, 2 of 3 major agents not built) |
| 5 | Analytics, Polish & Production Hardening | **Not Started** | 0% |

> **Note on "Done" vs. "Functional":** Several features marked as "Done" in Phase 2 have backend support (DB schema, server actions) but lack the admin UI needed for users to configure them. This includes scoring rubric customization, red flag definitions, pipeline stage management, and PortCo profile editing. These are listed as display-only in the settings page.

---

### 4.0 Phase 2 — Remaining Admin UI Work

These features have backend support but no user-facing configuration UI:

#### PortCo Settings & Customization UI
- **PortCo profile editing**: Name, industry, description, investment thesis, focus areas, target geography
- **Acquisition criteria editor**: Revenue/EBITDA/deal size ranges, custom criteria JSONB
- **Scoring rubric editor**: Adjust 8-dimension weights, sub-criteria thresholds, recommendation bands
- **Red flag definition editor**: Add/remove/edit custom red flag definitions with severity and category
- **Pipeline stage management**: Add, remove, reorder stages; assign phases (sourcing/evaluation/diligence/closing/PMI)

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

#### Portfolio Company Tool Integration & KPI Tracking
The platform has schema support for KPIs (`kpi_definitions`, `kpi_values`) but no UI or data flow. Post-acquisition portfolio tracking needs:

- **KPI dashboard**: Define, track, and visualize key metrics per acquired company (revenue, EBITDA, customer count, employee retention, etc.)
- **KPI definition management**: Per-PortCo KPI templates with targets, thresholds, and alert rules
- **Automated data ingestion**: Connect to portfolio company tools to pull metrics automatically:
  - **Accounting/ERP** (e.g., freee, MoneyForward, QuickBooks) — revenue, expenses, margins
  - **CRM** (e.g., Salesforce, HubSpot) — pipeline, win rates, customer acquisition
  - **HR/Payroll** — headcount, turnover, hiring velocity
  - **Customer support** — ticket volume, resolution time, NPS/CSAT
- **Performance benchmarking**: Compare acquired companies against each other and against pre-acquisition projections
- **PMI milestone tracking**: Post-merger integration checklist with deadlines and owners
- **Portfolio health dashboard**: Aggregate view across all acquired companies with traffic-light status indicators
- **Alerting**: Notifications when KPIs breach thresholds or trend negatively

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
1. **Admin customization UI** — Scoring rubric editor, red flag definitions, pipeline stage management, PortCo profile editing. These are blocking real usage — users can't configure core business rules without DB access.
2. **Bug fixing & test expansion** — Current 110 tests are mostly auth-check stubs. Add success-path tests, fix issues found during manual testing. Priority areas: deal transfers, IM processing, GDrive operations.
3. **Deal Sourcing Agent** — Highest business value. Core differentiator for the platform.

### Short-Term (1-2 Sprints)
4. **Slack notifications** — Low effort, high visibility. Webhook infrastructure exists, needs message formatting and event triggers.
5. **Email automation** — Broker outreach sequences and inbound parsing via Gmail API.
6. **Google Calendar integration** — Automatic meeting scheduling with brokers and deal contacts.
7. **Broker Engagement Agent** — Builds on email automation, adds LLM-drafted communications.

### Medium-Term (3-4 Sprints)
8. **Portfolio company tool integration & KPI tracking** — Connect to accounting/CRM/HR tools, KPI dashboards, PMI milestone tracking. Critical for post-acquisition value creation.
9. **Broker engagement analytics** — Engagement scoring, tier classification, health alerts, ROI tracking.
10. **Analytics dashboards** — Pipeline velocity, sourcing funnel, broker scorecards.
11. **Granola integration** — Meeting follow-ups, portfolio sales call tracking.
12. **pgvector semantic search** — Cross-deal discovery and similarity matching.

### Pre-Launch
13. **Production hardening** — Complete the full production readiness checklist.
14. **Load testing & performance** — Validate at scale before onboarding users.
15. **Security audit** — OWASP review, tenant isolation verification.
16. **E2E test suite** — Browser-based tests for critical user flows.

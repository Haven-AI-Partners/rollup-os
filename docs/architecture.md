# Rollup OS — Architecture Proposal

## Clarifying Questions (Resolved)

1. **User - PortCo relationship**: **Confirmed** — many-to-many. A single user can belong to multiple PortCos with a role per membership.

2. **Deal ownership**: **Audit trail** — deals transfer between PortCos with full history tracked in `deal_transfers` table.

3. **Broker model**: **Global** — broker firms and contacts are shared across all PortCos. Metrics aggregate platform-wide, filterable per-PortCo via interactions.

4. **IM Scoring Rubric**: **Per-PortCo** — each PortCo defines its own 8-dimension criteria and weights via `scoring_rubric` JSONB on the `portcos` table. This gives maximum flexibility for different rollup strategies.

5. **Email integration**: **Gmail API via service account** for shared company mailbox. Resend available as a fallback for outbound if needed.

6. **Deal Sourcing scraping targets**: **9 known sites** (mix of Japanese and international M&A platforms). Will need Japanese language support for scraping and IM processing. Sites:
   - https://www.tranbi.com/
   - https://batonz.jp/
   - https://himawari-ma5.net/
   - https://www.mafolova.biz/
   - https://fundbook.co.jp/cloud/login/
   - https://www.smergers.com/dashboard/
   - https://dealstream.com/login
   - https://www.strike.co.jp/
   - https://www.ma-cp.com/deal/
   - Additional sites may be added over time

> **Note**: The heavy Japanese market focus (7 of 9 sites) means the Deal Sourcing and IM Processing agents must handle Japanese-language content natively — scraping, text extraction, LLM analysis, and report generation should all support bilingual (JP/EN) operation.

---

## 1. Database Schema (ERD)

### Core Entities

```sql
users
├── id                  UUID (PK) — synced from Clerk
├── clerk_id            TEXT UNIQUE NOT NULL
├── email               TEXT UNIQUE NOT NULL
├── full_name           TEXT
├── avatar_url          TEXT
├── created_at          TIMESTAMPTZ
└── updated_at          TIMESTAMPTZ

portcos
├── id                  UUID (PK)
├── name                TEXT NOT NULL
├── slug                TEXT UNIQUE NOT NULL
├── logo_url            TEXT
├── description         TEXT         — company overview / elevator pitch
├── industry            TEXT         — primary industry vertical
├── focus_areas         JSONB        — array of specific sub-sectors / niches
├── target_geography    JSONB        — array of regions / countries
├── investment_thesis   TEXT         — free-form strategy narrative
├── target_revenue_min  NUMERIC      — min target revenue
├── target_revenue_max  NUMERIC      — max target revenue
├── target_ebitda_min   NUMERIC      — min target EBITDA
├── target_ebitda_max   NUMERIC      — max target EBITDA
├── target_deal_size_min NUMERIC     — min deal size (purchase price)
├── target_deal_size_max NUMERIC     — max deal size (purchase price)
├── acquisition_criteria JSONB       — additional criteria (employee count, customer concentration, etc.)
├── scoring_rubric      JSONB        — 8-dimension weights & thresholds
├── gdrive_folder_id    TEXT         — root GDrive folder for this PortCo
├── gdrive_service_account_enc TEXT  — encrypted service account JSON key
├── slack_webhook_url   TEXT
├── slack_channel_id    TEXT
├── settings            JSONB        — catch-all config
├── created_at          TIMESTAMPTZ
└── updated_at          TIMESTAMPTZ

portco_memberships (many-to-many: users <-> portcos)
├── id                  UUID (PK)
├── user_id             UUID (FK -> users)
├── portco_id           UUID (FK -> portcos)
├── role                TEXT NOT NULL — 'owner' | 'admin' | 'analyst' | 'viewer'
├── created_at          TIMESTAMPTZ
└── UNIQUE(user_id, portco_id)
```

### Deal Pipeline

```sql
pipeline_stages
├── id                  UUID (PK)
├── portco_id           UUID (FK -> portcos)
├── name                TEXT NOT NULL — e.g., 'Sourced', 'IM Review', 'LOI', 'DD', 'Closed'
├── phase               TEXT NOT NULL — 'sourcing' | 'evaluation' | 'diligence' | 'closing' | 'pmi'
├── position            INT NOT NULL — ordering
├── color               TEXT
└── UNIQUE(portco_id, position)

deals
├── id                  UUID (PK)
├── portco_id           UUID (FK -> portcos) — current owner
├── stage_id            UUID (FK -> pipeline_stages)
├── company_name        TEXT NOT NULL
├── description         TEXT
├── source              TEXT         — 'agent_scraped' | 'manual' | 'broker_referral'
├── source_url          TEXT         — original listing URL
├── asking_price        NUMERIC
├── revenue             NUMERIC
├── ebitda              NUMERIC
├── location            TEXT
├── industry            TEXT
├── employee_count      INT
├── status              TEXT         — 'active' | 'passed' | 'closed_won' | 'closed_lost'
├── assigned_to         UUID (FK -> users) — analyst
├── broker_firm_id      UUID (FK -> broker_firms)
├── broker_contact_id   UUID (FK -> broker_contacts)
├── kanban_position      INT         — ordering within stage
├── closed_at           TIMESTAMPTZ  — when deal was won/closed
├── metadata            JSONB
├── created_at          TIMESTAMPTZ
└── updated_at          TIMESTAMPTZ

deal_transfers (audit trail)
├── id                  UUID (PK)
├── deal_id             UUID (FK -> deals)
├── from_portco_id      UUID (FK -> portcos)
├── to_portco_id        UUID (FK -> portcos)
├── transferred_by      UUID (FK -> users)
├── reason              TEXT
└── transferred_at      TIMESTAMPTZ

deal_comments
├── id                  UUID (PK)
├── deal_id             UUID (FK -> deals)
├── user_id             UUID (FK -> users)
├── content             TEXT NOT NULL
├── created_at          TIMESTAMPTZ
└── updated_at          TIMESTAMPTZ
```

### Deal Tasks & Activity Tracking

Tracks actionable work items per deal across all phases. Gives a "current status" view for any acquisition at a glance.

```sql
deal_tasks
├── id                  UUID (PK)
├── deal_id             UUID (FK -> deals)
├── portco_id           UUID (FK -> portcos)
├── title               TEXT NOT NULL
├── description         TEXT
├── category            TEXT         — 'sourcing' | 'evaluation' | 'dd_financial' | 'dd_legal'
│                                      | 'dd_operational' | 'dd_tax' | 'dd_hr' | 'dd_it'
│                                      | 'closing' | 'pmi_integration' | 'pmi_reporting' | 'other'
├── status              TEXT         — 'todo' | 'in_progress' | 'blocked' | 'completed'
├── priority            TEXT         — 'low' | 'medium' | 'high' | 'critical'
├── assigned_to         UUID (FK -> users) NULLABLE
├── due_date            DATE NULLABLE
├── completed_at        TIMESTAMPTZ
├── parent_task_id      UUID (FK -> deal_tasks) NULLABLE — for sub-tasks / checklists
├── position            INT          — ordering within parent or deal
├── metadata            JSONB
├── created_at          TIMESTAMPTZ
└── updated_at          TIMESTAMPTZ

deal_activity_log (immutable timeline of everything that happens on a deal)
├── id                  UUID (PK)
├── deal_id             UUID (FK -> deals)
├── portco_id           UUID (FK -> portcos)
├── user_id             UUID (FK -> users) NULLABLE — null for system/agent actions
├── action              TEXT NOT NULL — 'stage_changed' | 'task_completed' | 'file_uploaded'
│                                       | 'comment_added' | 'profile_generated' | 'transferred'
│                                       | 'assigned' | 'status_changed' | 'task_created' | ...
├── description         TEXT         — human-readable summary
├── reference_type      TEXT         — 'task' | 'file' | 'comment' | 'stage' | 'agent_run'
├── reference_id        UUID NULLABLE
├── changes             JSONB        — { field: { old, new } } for auditing
├── created_at          TIMESTAMPTZ
```

### Broker Management

```sql
broker_firms (global — shared across PortCos)
├── id                  UUID (PK)
├── name                TEXT NOT NULL
├── website             TEXT
├── listing_url         TEXT         — URL to scrape
├── scrape_config       JSONB        — selectors, frequency, etc.
├── region              TEXT
├── specialty           TEXT
├── metadata            JSONB
├── created_at          TIMESTAMPTZ
└── updated_at          TIMESTAMPTZ

broker_contacts
├── id                  UUID (PK)
├── broker_firm_id      UUID (FK -> broker_firms)
├── full_name           TEXT NOT NULL
├── email               TEXT
├── phone               TEXT
├── title               TEXT
├── metadata            JSONB
├── created_at          TIMESTAMPTZ
└── updated_at          TIMESTAMPTZ

broker_interactions
├── id                  UUID (PK)
├── broker_contact_id   UUID (FK -> broker_contacts)
├── deal_id             UUID (FK -> deals) NULLABLE
├── portco_id           UUID (FK -> portcos)
├── type                TEXT         — 'email_sent' | 'email_received' | 'im_requested'
│                                      | 'call' | 'meeting' | 'form_submitted'
├── direction           TEXT         — 'inbound' | 'outbound'
├── subject             TEXT
├── body                TEXT
├── metadata            JSONB        — email message IDs, thread refs, etc.
├── occurred_at         TIMESTAMPTZ
├── created_at          TIMESTAMPTZ
└── updated_at          TIMESTAMPTZ

broker_metrics (materialized / computed — could also be a view)
├── id                  UUID (PK)
├── broker_firm_id      UUID (FK -> broker_firms)
├── broker_contact_id   UUID (FK -> broker_contacts) NULLABLE
├── period              TEXT         — '2026-Q1', '2026-02', etc.
├── avg_response_time_h NUMERIC     — avg hours to respond
├── deals_sent          INT
├── deals_progressed    INT         — moved past IM review
├── deal_quality_score  NUMERIC     — avg IM score of deals from this broker
├── im_request_to_recv  NUMERIC     — avg days from request to IM receipt
├── computed_at         TIMESTAMPTZ
└── UNIQUE(broker_firm_id, broker_contact_id, period)
```

### Deal Financials (Ongoing Performance Tracking)

Tracks financial snapshots for each deal/acquisition over time — both pre-acquisition (from IMs) and post-acquisition (actuals). Powers the PortCo executive summary with aggregate financials.

```sql
deal_financials
├── id                  UUID (PK)
├── deal_id             UUID (FK -> deals)
├── portco_id           UUID (FK -> portcos)
├── period              TEXT NOT NULL        — '2026-Q1', '2026-03', 'pre-acquisition', 'at-close', etc.
├── period_type         TEXT NOT NULL        — 'monthly' | 'quarterly' | 'annual' | 'snapshot'
├── revenue             NUMERIC
├── ebitda              NUMERIC
├── net_income          NUMERIC
├── gross_margin_pct    NUMERIC
├── ebitda_margin_pct   NUMERIC
├── cash_flow           NUMERIC
├── customer_count      INT
├── employee_count      INT
├── arr                 NUMERIC              — annual recurring revenue (if applicable)
├── purchase_price      NUMERIC              — what was actually paid (filled at closing)
├── purchase_multiple   NUMERIC              — purchase_price / ebitda or revenue
├── source              TEXT                 — 'im_extracted' | 'manual' | 'agent_computed' | 'integration'
├── notes               TEXT
├── metadata            JSONB                — additional line items, breakdowns
├── created_at          TIMESTAMPTZ
└── updated_at          TIMESTAMPTZ
└── UNIQUE(deal_id, period, period_type)
```

### Company Profiles & IM Analysis

```sql
company_profiles
├── id                  UUID (PK)
├── deal_id             UUID (FK -> deals) UNIQUE
├── summary             TEXT         — AI-generated executive summary
├── business_model      TEXT
├── market_position     TEXT
├── financial_highlights JSONB
├── key_risks           JSONB        — red flags array
├── strengths           JSONB
├── industry_trends     TEXT
├── ai_overall_score    NUMERIC      — composite score
├── scoring_breakdown   JSONB        — { dimension: { score, rationale } } x 8
├── raw_extraction      JSONB        — full structured data from IM
├── generated_at        TIMESTAMPTZ
├── model_version       TEXT         — which LLM version produced this
├── created_at          TIMESTAMPTZ
└── updated_at          TIMESTAMPTZ

files
├── id                  UUID (PK)
├── deal_id             UUID (FK -> deals)
├── portco_id           UUID (FK -> portcos)
├── uploaded_by         UUID (FK -> users) NULLABLE — null if agent-sourced
├── file_name           TEXT NOT NULL
├── file_type           TEXT         — 'im_pdf' | 'report' | 'attachment' | 'nda'
│                                      | 'dd_financial' | 'dd_legal' | 'dd_operational'
│                                      | 'dd_tax' | 'dd_hr' | 'dd_it'
│                                      | 'loi' | 'purchase_agreement'
│                                      | 'pmi_plan' | 'pmi_report' | 'other'
├── mime_type           TEXT
├── gdrive_file_id      TEXT         — Google Drive file ID
├── gdrive_folder_id    TEXT
├── gdrive_url          TEXT
├── size_bytes          BIGINT
├── processing_status   TEXT         — 'pending' | 'processing' | 'completed' | 'failed'
├── processed_at        TIMESTAMPTZ
├── metadata            JSONB
├── created_at          TIMESTAMPTZ
└── updated_at          TIMESTAMPTZ
```

### Vector Embeddings (pgvector)

```sql
document_embeddings
├── id                  UUID (PK)
├── file_id             UUID (FK -> files)
├── deal_id             UUID (FK -> deals)
├── portco_id           UUID (FK -> portcos) — denormalized for RLS filtering
├── chunk_index         INT          — page/section order
├── chunk_text          TEXT         — raw text of this chunk
├── embedding           VECTOR(1536) — OpenAI ada-002 or similar
├── metadata            JSONB        — page number, section heading, etc.
├── created_at          TIMESTAMPTZ
└── INDEX: ivfflat ON embedding WITH (lists = 100)
```

### Agent Registry & Runs

Agents are registered in a config table so new agents (DD document gathering, PMI planning, etc.) can be added without code changes to the schema or UI.

```sql
agent_definitions (registry of all available agents)
├── id                  UUID (PK)
├── slug                TEXT UNIQUE NOT NULL — 'deal_sourcing' | 'broker_engagement' | 'im_processing'
│                                             | 'dd_document_gathering' | 'pmi_plan_generation' | ...
├── name                TEXT NOT NULL        — human-readable: "IM Processing Agent"
├── description         TEXT
├── phase               TEXT NOT NULL        — 'sourcing' | 'evaluation' | 'diligence' | 'closing' | 'pmi'
├── trigger_task_id     TEXT NOT NULL        — maps to the Trigger.dev task identifier
├── input_schema        JSONB                — JSON Schema describing expected input payload
├── config_schema       JSONB                — JSON Schema for per-PortCo agent config
├── is_active           BOOLEAN DEFAULT true
├── created_at          TIMESTAMPTZ
└── updated_at          TIMESTAMPTZ

portco_agent_configs (per-PortCo overrides for each agent)
├── id                  UUID (PK)
├── portco_id           UUID (FK -> portcos)
├── agent_definition_id UUID (FK -> agent_definitions)
├── is_enabled          BOOLEAN DEFAULT true
├── config              JSONB                — agent-specific settings (schedule, thresholds, prompts, etc.)
├── created_at          TIMESTAMPTZ
├── updated_at          TIMESTAMPTZ
└── UNIQUE(portco_id, agent_definition_id)

agent_runs
├── id                  UUID (PK)
├── agent_definition_id UUID (FK -> agent_definitions)
├── portco_id           UUID (FK -> portcos)
├── deal_id             UUID (FK -> deals) NULLABLE
├── trigger_job_id      TEXT         — Trigger.dev run ID
├── langfuse_trace_id   TEXT         — for observability linking
├── status              TEXT         — 'queued' | 'running' | 'completed' | 'failed'
├── input               JSONB
├── output              JSONB
├── error               TEXT
├── started_at          TIMESTAMPTZ
├── completed_at        TIMESTAMPTZ
├── created_at          TIMESTAMPTZ
└── updated_at          TIMESTAMPTZ
```

### KPIs (Centralized Metrics Across All Phases)

A generic KPI system that tracks measurable outcomes at the deal, PortCo, and agent level — spanning sourcing through PMI.

```sql
kpi_definitions (registry of all tracked metrics)
├── id                  UUID (PK)
├── slug                TEXT UNIQUE NOT NULL — 'time_to_im' | 'dd_completion_pct' | 'pmi_revenue_synergy' | ...
├── name                TEXT NOT NULL        — "Time to IM Receipt"
├── description         TEXT
├── phase               TEXT NOT NULL        — 'sourcing' | 'evaluation' | 'diligence' | 'closing' | 'pmi'
├── category            TEXT                 — 'speed' | 'quality' | 'financial' | 'operational' | 'integration'
├── unit                TEXT                 — 'days' | 'percent' | 'currency' | 'count' | 'score'
├── direction           TEXT                 — 'higher_is_better' | 'lower_is_better'
├── target_value        NUMERIC NULLABLE     — optional default target
├── is_active           BOOLEAN DEFAULT true
├── created_at          TIMESTAMPTZ
└── updated_at          TIMESTAMPTZ

kpi_values (recorded measurements)
├── id                  UUID (PK)
├── kpi_definition_id   UUID (FK -> kpi_definitions)
├── portco_id           UUID (FK -> portcos)
├── deal_id             UUID (FK -> deals) NULLABLE — null for PortCo-level KPIs
├── agent_run_id        UUID (FK -> agent_runs) NULLABLE — if computed by an agent
├── value               NUMERIC NOT NULL
├── target_value        NUMERIC NULLABLE     — override target for this specific measurement
├── period              TEXT NULLABLE         — '2026-Q1', '2026-03', etc. for time-series KPIs
├── metadata            JSONB                — context, breakdown, notes
├── measured_at         TIMESTAMPTZ NOT NULL
├── created_at          TIMESTAMPTZ
└── INDEX(portco_id, kpi_definition_id, deal_id, period)
```

### Notifications

```sql
notifications
├── id                  UUID (PK)
├── portco_id           UUID (FK -> portcos)
├── user_id             UUID (FK -> users) NULLABLE — null = broadcast to portco
├── type                TEXT         — 'deal_created' | 'stage_changed' | 'im_processed' | ...
├── title               TEXT
├── body                TEXT
├── reference_type      TEXT         — 'deal' | 'file' | 'agent_run'
├── reference_id        UUID
├── read                BOOLEAN DEFAULT false
├── slack_sent          BOOLEAN DEFAULT false
├── created_at          TIMESTAMPTZ
└── updated_at          TIMESTAMPTZ
```

### Key Schema Decisions

- **RLS-ready**: `portco_id` is on nearly every table, enabling Supabase Row-Level Security policies or application-level filtering.
- **Brokers are global**: Same firm/contact can appear in deals across PortCos. Metrics aggregate globally but can be filtered per-PortCo via the `broker_interactions` join.
- **Scoring rubric on PortCo**: Each PortCo can customize its 8-dimension rubric weights. The IM Processing Agent reads this config.
- **pgvector**: Embeddings scoped to `portco_id` so vector searches respect tenant boundaries.
- **Deal financials as time-series**: `deal_financials` stores periodic snapshots (monthly/quarterly/annual) per deal. Aggregate queries across all `closed_won` deals power the PortCo executive summary. Pre-acquisition data (from IMs) and post-acquisition actuals live in the same table, distinguished by `source` and `period`.
- **Agent registry**: `agent_definitions` + `portco_agent_configs` make agents pluggable. New agents (DD, PMI) are added as DB rows + a Trigger.dev task file — no schema or UI changes.
- **Centralized KPIs**: `kpi_definitions` + `kpi_values` track metrics across all phases (sourcing speed, DD completion, PMI synergies) in one place. Both agents and scheduled jobs can write KPI values.
- **Agent runs table**: Links every background AI job to its Trigger.dev run ID and Langfuse trace for full observability.

---

## 2. Technical Strategy

### AI Agents via Trigger.dev + Vercel AI SDK

```
┌──────────────────────────────────────────────────────────────────┐
│  Next.js App (Vercel)                                            │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐        │
│  │ Server Action │   │ API Route    │   │ Cron trigger  │        │
│  │ or tRPC call  │   │ /api/agents  │   │ (Trigger.dev) │        │
│  └──────┬───────┘   └──────┬───────┘   └──────┬───────┘        │
│         │                   │                   │                │
│         └───────────┬───────┘───────────────────┘                │
│                     v                                            │
│          trigger.dev/sdk  ->  tasks.trigger()                    │
└─────────────────────┬────────────────────────────────────────────┘
                      │ enqueue
                      v
┌──────────────────────────────────────────────────────────────────┐
│  Trigger.dev v3 (Long-running tasks — NO serverless timeout)     │
│                                                                  │
│  ┌─────────────────────┐  ┌───────────────────┐                 │
│  │ Deal Sourcing Task   │  │ IM Processing Task│                 │
│  │                      │  │                   │                 │
│  │ 1. Fetch broker site │  │ 1. Download PDF   │                 │
│  │ 2. Parse listings    │  │    from GDrive     │                 │
│  │ 3. LLM: match vs    │  │ 2. Extract text    │                 │
│  │    PortCo criteria   │  │ 3. Chunk + embed   │                 │
│  │ 4. Create deal       │  │ 4. LLM: 8-dim     │                 │
│  │ 5. Submit IM request │  │    scoring         │                 │
│  │ 6. Log interaction   │  │ 5. Generate profile│                 │
│  └─────────────────────┘  │ 6. Write report to │                 │
│                            │    GDrive          │                 │
│  ┌─────────────────────┐  └───────────────────┘                 │
│  │ Broker Engagement   │                                         │
│  │                      │  All tasks use:                        │
│  │ 1. Check interactions│  - Vercel AI SDK (generateObject,     │
│  │ 2. LLM: draft email │    generateText with Zod schemas)      │
│  │ 3. Send via Resend  │  - Langfuse tracing (wrapped around    │
│  │ 4. Log interaction   │    every LLM call)                     │
│  └─────────────────────┘  - Drizzle for DB writes               │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

**Pattern for each agent:**

- **Trigger.dev task** defines the long-running job (can run minutes/hours).
- Inside the task, we use `generateObject()` / `generateText()` from Vercel AI SDK with **Zod schemas** for structured outputs (e.g., scoring breakdown, parsed listing data).
- Every LLM call is wrapped with **Langfuse `trace()` / `span()`** for cost tracking and debugging.
- **Agent loops** (multi-step reasoning) use a simple loop inside the Trigger task — no framework needed. Each iteration calls the LLM, gets structured output, decides next action.
- Tasks can call sub-tasks via `triggerAndWait()` for composability (e.g., sourcing task triggers IM processing when a PDF is found).

**Pluggable agent architecture:**

Adding a new agent (e.g., "DD Document Gathering") requires:
1. Create a new Trigger.dev task in `src/trigger/agents/dd-document-gathering.ts`
2. Insert a row into `agent_definitions` (slug, phase, trigger_task_id, input/config schemas)
3. The existing agent management UI automatically picks it up — run history, config, manual triggers all work

The agent UI reads from `agent_definitions` to render available agents per phase. `portco_agent_configs` allows each PortCo to enable/disable agents and customize their settings (schedules, thresholds, custom prompts). No frontend changes needed to add a new agent.

**KPI integration:**

Agents can write KPI measurements as part of their output. For example:
- IM Processing Agent records `im_quality_score` per deal
- A future DD Agent records `dd_completion_pct` and `dd_days_elapsed`
- A future PMI Agent records `pmi_revenue_synergy` and `pmi_integration_progress`

KPIs are also computed from deal activity (e.g., time between stage transitions). A scheduled Trigger.dev task can recompute aggregate KPIs periodically.

### Google Drive Service Account Strategy

Each PortCo may have its own GSuite account, so GDrive credentials are **per-PortCo**, not global.

```
portcos table
├── gdrive_folder_id        — root folder on that PortCo's Drive
├── gdrive_service_account  — encrypted JSON key (stored in DB or vault)
    │
    v
google-auth-library -> JWT auth per PortCo
    │
    v
googleapis (Drive API v3)
    │
    ├── List files in PortCo's configured folder
    ├── Download IM PDFs for processing
    ├── Upload generated reports to output sub-folder
    └── Copy files during cross-PortCo deal transfer
```

- **Per-PortCo service accounts**: Each PortCo configures its own GDrive service account credentials during onboarding. The service account JSON key is encrypted at rest (AES-256 via an app-level encryption key in env vars) and stored in the `portcos` table or a separate `portco_credentials` table.
- Each PortCo record stores its `gdrive_folder_id`. Sub-folders follow a convention: `/{portco_folder}/IMs/`, `/{portco_folder}/Reports/`.
- The `files` table tracks every GDrive file with its `gdrive_file_id`, processing status, and relationship to deals.
- **Deal transfer across PortCos** = **copy** (not move) files from PortCo A's Drive to PortCo B's Drive (since they may be different GSuite accounts), then update `portco_id` and `gdrive_file_id` on all related records. The original files can optionally be archived or deleted from PortCo A's Drive.
- A helper like `getGDriveClient(portcoId)` abstracts credential lookup and JWT auth so the rest of the codebase doesn't care about multi-account details.

### Gmail Integration (Broker Engagement Agent)

```
Service Account (domain-wide delegation) OR App Password
    │
    v
googleapis (Gmail API v1)
    │
    ├── Read inbound emails (poll or push via Pub/Sub)
    ├── Send outbound emails (drafts, replies, newsletters)
    └── Thread tracking (link to broker_interactions via message IDs)

Fallback: Resend (for transactional outbound if Gmail quotas are hit)
```

- **Shared company mailbox** accessed via Gmail API with service account + domain-wide delegation.
- Inbound emails are parsed by the Broker Engagement Agent (Trigger.dev task) to auto-log interactions and match to broker contacts/deals.
- Outbound emails (LLM-drafted) are sent through the same mailbox for consistent sender identity.
- Email message IDs and thread IDs stored in `broker_interactions.metadata` for conversation threading.

### Scraping Strategy (Deal Sourcing Agent)

- **9 target sites** with a mix of structured listings and login-gated dashboards.
- For each site, we store scrape configuration in `broker_firms.scrape_config` (selectors, auth method, pagination pattern).
- Login-gated sites (FundBook, SMERGERS, DealStream) will require stored credentials or session management in the scraper task.
- Given the variety of site structures, we'll build **per-site scraper modules** with a shared interface, rather than a generic AI scraper. The LLM is used for **matching and classification**, not for parsing HTML.
- Japanese-language listings are scraped as-is; the LLM handles bilingual matching against PortCo criteria.

---

## 3. Five-Phase Implementation Plan

### Phase 1 — Foundation (Setup, Auth, Schema, Layout)

- Initialize Next.js 15 + TypeScript + Tailwind + shadcn/ui
- Configure Clerk (Google SSO), middleware, auth helpers
- Set up Supabase project, Drizzle ORM config, and connection pooling
- Define and migrate **all** schema tables (including pgvector extension)
- Seed default pipeline stages
- Build app shell: sidebar nav, PortCo switcher, layout routes (`/[portcoSlug]/dashboard`, `/[portcoSlug]/deals`, etc.)
- RBAC middleware — gate routes by `portco_memberships` role
- **PortCo Executive Summary Dashboard** (`/[portcoSlug]/dashboard`) — the landing page after selecting a PortCo:
  - **Company Identity**: logo, name, description, industry, investment thesis, focus areas
  - **Aggregate Financials** (from `deal_financials` for all `closed_won` deals):
    - Total portfolio revenue, EBITDA, net income (current period)
    - Revenue & EBITDA trend charts (quarter-over-quarter, year-over-year)
    - Total capital deployed (sum of purchase prices)
    - Weighted average purchase multiple
  - **Acquisition Leaderboard**: ranked table of closed acquisitions by contribution
    - Top performers: highest revenue, EBITDA, growth rate
    - Underperformers: negative EBITDA, declining revenue, missed targets
    - Each row links to the deal workspace for drill-down
  - **Pipeline Snapshot**: deals by stage, total pipeline value, conversion rates
  - **Target Criteria Summary**: revenue range, EBITDA range, deal size, geography
  - **Active KPIs**: top-level KPI cards from `kpi_values` (e.g., avg time-to-close, DD completion rate)
  - **Recent Activity**: latest entries from `deal_activity_log` across all deals
  - **Team**: members list from `portco_memberships`
- PortCo settings pages (edit profile, criteria, integrations — for owners/admins)
- **Deliverable**: User can sign in, see their PortCos, land on an executive summary dashboard (with placeholder charts), navigate the shell, roles enforced

### Phase 2 — Deal Pipeline & Company Profiles

- Kanban board UI (drag-and-drop stage transitions, stages grouped by phase)
- Deal CRUD — create, edit, archive, pass
- Deal detail workspace with tabbed layout:
  - **Overview**: summary, key metrics, current tasks at a glance
  - **Profile**: AI-generated company profile (empty state until Phase 4)
  - **Files**: document list organized by type/phase
  - **Tasks**: task board with categories (sourcing, evaluation, etc.) — extensible to DD/PMI later
  - **Comments**: discussion thread
  - **Activity**: full timeline from `deal_activity_log`
- Deal financials tab — manual entry of financial snapshots per period (revenue, EBITDA, etc.)
- Deal tasks system (`deal_tasks`) — create, assign, complete, with sub-tasks
- Activity log — auto-logged on stage changes, task completions, file uploads, comments, etc.
- Deal comments system (real-time via Supabase Realtime or polling)
- Deal transfer flow (copy files between PortCo Drives, audit log)
- Custom pipeline stages per PortCo (add/remove/reorder, assign phase)
- **PortCo executive summary populates** with real data:
  - Aggregate financials from `deal_financials` across all closed acquisitions
  - Acquisition leaderboard (top/bottom performers by revenue, EBITDA contribution)
  - Pipeline snapshot with deal counts and total pipeline value
- **Deliverable**: Fully functional Kanban deal management with tasks, financials, activity timeline, commenting, and a live executive summary dashboard

### Phase 3 — Integrations (GDrive, Slack, Broker Management)

- Google Drive service account integration
  - Configure per-PortCo folder mapping in settings
  - File browser within deal detail (list, upload, download)
  - File sync: detect new IMs in watched folders
- Slack webhook integration
  - Configure per-PortCo in settings
  - Notify on: new deal, stage change, IM processed
- Broker management UI
  - Broker firms & contacts CRUD
  - Interaction log (manual entry + future agent automation)
  - Basic broker metrics dashboard (computed from interactions)
- Notification system (in-app + Slack dispatch)
- **Deliverable**: GDrive file management works, Slack notifies, brokers tracked

### Phase 4 — AI Agents

- Set up Trigger.dev v3 project, configure tasks
- Set up Langfuse project, integrate tracing wrapper
- **IM Processing Agent** (highest value, build first)
  - PDF download from GDrive -> **multimodal analysis** (PDF sent directly to Gemini)
  - **IMPORTANT**: Uses Gemini's multimodal PDF input — the PDF binary is sent directly
    to the model, which handles both text-based and scanned/image-based PDFs without OCR.
    This creates a hard dependency on a multimodal model that supports PDF file inputs
    (currently: Google Gemini, Anthropic Claude, Google Vertex). Switching to a text-only
    provider (OpenAI, Mistral) will break PDF processing. See `src/lib/agents/im-processor/index.ts`.
  - 8-dimension scoring via `generateObject()` + Zod schema
  - Company profile generation -> write to DB
  - Red flag detection against predefined flag definitions
- **Deal Sourcing Agent**
  - Per-broker scraper tasks (configurable selectors in `scrape_config`)
  - LLM matching: listing vs. PortCo `acquisition_criteria`
  - Auto-create deal cards for matches
  - IM request submission (contact form / email)
- **Broker Engagement Agent**
  - Email drafting via LLM (newsletter, follow-ups)
  - Outbound email via Resend/SendGrid
  - Interaction logging automation
- Agent management UI: run history, status, logs, manual triggers
- **Deliverable**: All three agents operational, observable via Langfuse

### Phase 5 — Analytics, Polish & Production Hardening

- Analytics dashboards
  - Broker firm performance (response times, deal quality, volume)
  - Individual broker scorecards
  - Pipeline velocity (avg time per stage, conversion rates)
  - Deal sourcing funnel (scraped -> matched -> IM received -> scored)
- Search across deals/profiles using pgvector similarity
- Bulk operations (batch stage moves, bulk assign)
- Audit log UI (who did what, when)
- Performance optimization (query tuning, caching, pagination)
- Error handling, rate limiting, edge cases
- Production deployment config (env management, monitoring)
- Complete [production readiness checklist](./production-readiness.md)
- **Deliverable**: Production-ready application with full analytics

---

## 4. Code Organization for Extensibility

The deal lifecycle spans **Sourcing → Evaluation → DD → Closing → PMI**. The codebase must make it easy to add DD and PMI features later without restructuring.

### App Routes (Next.js App Router)

```
app/
├── (auth)/                          — sign-in, sign-up
├── (app)/
│   ├── layout.tsx                   — sidebar, PortCo switcher
│   ├── [portcoSlug]/
│   │   ├── dashboard/               — PortCo executive summary (landing page)
│   │   ├── deals/
│   │   │   ├── page.tsx             — Kanban pipeline view
│   │   │   └── [dealId]/
│   │   │       ├── layout.tsx       — deal header + tab navigation
│   │   │       ├── overview/        — summary, key metrics, current tasks
│   │   │       ├── profile/         — AI-generated company profile
│   │   │       ├── files/           — all documents, organized by type/phase
│   │   │       ├── tasks/           — task board / checklist for this deal
│   │   │       ├── comments/        — discussion thread
│   │   │       ├── financials/       — deal financial snapshots & trends
│   │   │       ├── activity/        — full timeline (deal_activity_log)
│   │   │       ├── kpis/            — deal-level KPIs across all phases
│   │   │       ├── diligence/       — [FUTURE] DD workstreams & findings
│   │   │       └── integration/     — [FUTURE] PMI plan & KPI tracking
│   │   ├── brokers/                 — broker firms & contacts
│   │   ├── agents/                  — agent registry, run history & config
│   │   ├── analytics/               — dashboards
│   │   │   ├── pipeline/            — pipeline velocity, conversion rates
│   │   │   ├── brokers/             — broker performance scorecards
│   │   │   └── kpis/                — PortCo-level KPI dashboard (all phases)
│   │   └── settings/                — PortCo config, integrations, team, agent configs
```

### Domain Logic (`src/lib/`)

```
src/lib/
├── db/
│   ├── schema/
│   │   ├── users.ts
│   │   ├── portcos.ts
│   │   ├── deals.ts                 — deals, deal_transfers, deal_comments, deal_financials
│   │   ├── deal-tasks.ts            — deal_tasks, deal_activity_log
│   │   ├── brokers.ts               — broker_firms, broker_contacts, broker_interactions
│   │   ├── files.ts
│   │   ├── profiles.ts              — company_profiles
│   │   ├── embeddings.ts            — document_embeddings
│   │   ├── agents.ts                — agent_definitions, portco_agent_configs, agent_runs
│   │   ├── kpis.ts                  — kpi_definitions, kpi_values
│   │   └── notifications.ts
│   ├── migrations/
│   └── index.ts                     — Drizzle client + connection
├── actions/                         — server actions grouped by domain
│   ├── deals.ts
│   ├── tasks.ts
│   ├── brokers.ts
│   ├── files.ts
│   └── ...
├── gdrive/                          — GDrive client factory + helpers
├── agents/                          — agent configs, shared prompts, Zod schemas
└── auth/                            — Clerk helpers, RBAC utils
```

### Key Principles

- **Deal as workspace**: The `[dealId]/` route is a full workspace with tabs. New acquisition phases (DD, PMI) are just new tabs/sub-routes — no restructuring needed.
- **Tasks are generic**: `deal_tasks` with a `category` field covers sourcing, DD workstreams, closing checklists, and PMI action items. The same task UI works everywhere — just filtered by category.
- **Activity log is the single timeline**: Every action across all phases logs to `deal_activity_log`. This gives the "where is this deal at?" view — one query shows the full history.
- **Files organized by type**: The `file_type` enum already includes DD and PMI document types. The files tab can group by phase/type.
- **Schema per domain**: Each domain area has its own schema file. Adding DD-specific tables (e.g., `dd_findings`, `dd_checklists`) later means adding a new file, not modifying existing ones.

---

## 5. Database Migration Strategy

**Development (early Phase 1):**
- Use `drizzle-kit push` for rapid schema iteration while models are in flux

**Development (stabilized schema):**
- Switch to `drizzle-kit generate` to produce `.sql` migration files in `src/lib/db/migrations/`
- Review generated SQL, commit to git, merge via PR

**Production:**
- Migrations run as a **CI/CD step before deployment** — never on app start
- GitHub Actions runs `drizzle-kit migrate` against staging/prod Supabase, then triggers Vercel deploy
- Concurrency lock ensures only one migration job runs at a time
- Rollback SQL documented per migration (Drizzle does not auto-generate rollbacks)

```
PR merged → GitHub Actions →
  1. drizzle-kit migrate (against staging/prod Supabase)
  2. Vercel deployment triggers
  3. App starts with schema already up to date
```

> Full operational checklist: [docs/production-readiness.md](./production-readiness.md)

---

## 6. Key Architectural Decisions Summary

> **Note on extensibility**: The `phase` field on `pipeline_stages`, the generic `deal_tasks` system, and the `deal_activity_log` are designed so that DD and PMI features can be added as new task categories, file types, and deal sub-routes without touching existing models or restructuring the app.

| Decision | Choice | Rationale |
|---|---|---|
| Multi-tenancy | Application-level via `portco_id` FK + RBAC middleware | Simpler than RLS, full control, works with Drizzle |
| Agent runtime | Trigger.dev v3 tasks | Bypasses Vercel timeouts, built-in retry/scheduling |
| LLM orchestration | Simple loops in Trigger tasks, no framework | Vercel AI SDK + Zod gives us structured outputs without LangChain complexity |
| GDrive auth | Per-PortCo service accounts (encrypted) | Each PortCo may have its own GSuite; `getGDriveClient(portcoId)` abstracts it |
| Broker scope | Global entities | Same broker interacts with multiple PortCos |
| Scoring rubric | Per-PortCo JSONB config | Each rollup has different acquisition criteria |
| Agent architecture | Pluggable registry (`agent_definitions` + Trigger.dev tasks) | New agents = 1 DB row + 1 task file; UI auto-discovers them |
| KPIs | Generic `kpi_definitions` + `kpi_values` tables | One system for sourcing, DD, PMI metrics; agents write KPIs as output |
| Observability | Langfuse traces linked via `agent_runs` table | Full cost/latency/quality tracking per agent run |

---

## 7. Tech Stack Reference

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) + TypeScript |
| Styling | Tailwind CSS + shadcn/ui |
| Authentication | Clerk (Google SSO) |
| Database | Supabase (PostgreSQL) |
| ORM | Drizzle ORM |
| Vector DB | Supabase pgvector |
| Background Jobs | Trigger.dev v3 |
| AI Integration | Vercel AI SDK + Zod |
| LLMOps | Langfuse |
| Deployment | Vercel |

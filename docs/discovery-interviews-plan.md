# Discovery Interviews — Implementation Plan

## Overview

AI-powered interview system to map acquired companies' workflows and identify automation opportunities. Two main parts:

1. **Interview Agent ("Taro")** — Public-facing AI chat that interviews employees in Japanese (Keigo) about their workflows, pain points, and dependencies
2. **Discovery Analytics Dashboard** — Internal tool to explore responses, prioritize automation opportunities, and visualize workflow dependencies

## Data Model

### New Tables

#### `company_employees`
Company-level employee records (shared across features — discovery, org charts, etc.)

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| deal_id | UUID FK → deals | The acquired company (closed_won deal) |
| portco_id | UUID FK → portcos | For multi-tenancy queries |
| name | TEXT NOT NULL | |
| email | TEXT | |
| department | TEXT | |
| job_title | TEXT | |
| org_chart_node_id | UUID FK → org_chart_nodes | Optional link to existing org chart |
| metadata | JSONB | Extensible (phone, location, etc.) |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

Indexes: `(deal_id)`, `(portco_id)`

#### `discovery_campaigns`
Interview campaigns scoped to an acquired company.

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| deal_id | UUID FK → deals | The acquired company |
| portco_id | UUID FK → portcos | |
| name | TEXT NOT NULL | e.g., "Q1 Workflow Discovery" |
| description | TEXT | |
| campaign_type | TEXT NOT NULL | `workflow_discovery`, `sentiment_survey`, etc. |
| status | TEXT NOT NULL DEFAULT 'draft' | `draft`, `active`, `paused`, `completed` |
| prompt_config | JSONB | Agent name, language, custom instructions |
| created_by | UUID FK → users | |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

Indexes: `(deal_id)`, `(portco_id)`

#### `discovery_sessions`
One session per employee per campaign. Resumable.

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | Used in public URL: `/interview/{id}` |
| campaign_id | UUID FK → discovery_campaigns | |
| employee_id | UUID FK → company_employees | |
| password_hash | TEXT NOT NULL | bcrypt hash of session password |
| status | TEXT NOT NULL DEFAULT 'pending' | `pending`, `in_progress`, `paused`, `completed` |
| sentiment_score | NUMERIC | 0-100, updated during interview |
| sentiment_notes | TEXT | Agent's sentiment observations |
| workflow_count | INTEGER DEFAULT 0 | Running count |
| started_at | TIMESTAMPTZ | |
| completed_at | TIMESTAMPTZ | |
| last_active_at | TIMESTAMPTZ | |
| metadata | JSONB | agent_version, model_id, browser info |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

Indexes: `(campaign_id)`, `(employee_id)`

#### `discovery_messages`
Chat transcript, saved incrementally.

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| session_id | UUID FK → discovery_sessions (CASCADE) | |
| role | TEXT NOT NULL | `assistant`, `user`, `system` |
| content | TEXT NOT NULL | |
| metadata | JSONB | Token counts, latency, tool calls |
| created_at | TIMESTAMPTZ | |

Index: `(session_id)`

#### `discovery_workflows`
Extracted workflow data. One row per confirmed workflow.

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| session_id | UUID FK → discovery_sessions (CASCADE) | |
| campaign_id | UUID FK → discovery_campaigns | For efficient aggregation |
| employee_id | UUID FK → company_employees | |
| title | TEXT NOT NULL | |
| short_description | TEXT | |
| frequency | TEXT | `daily`, `weekly`, `monthly`, `quarterly`, `annually`, `ad_hoc` |
| volume | TEXT | `high`, `medium`, `low` |
| time_spent_per_cycle | TEXT | Free text from conversation |
| time_spent_minutes | INTEGER | Parsed numeric value for scoring |
| trigger | TEXT | What initiates the workflow |
| people_involved | TEXT | |
| tools_involved | TEXT | |
| inputs_required | TEXT | |
| output_produced | TEXT | |
| output_destination | TEXT | |
| rule_based_nature | INTEGER | 0-100 scale |
| standardization_level | TEXT | `high`, `medium`, `low` |
| steps_repetitive | TEXT | |
| steps_requiring_judgment | TEXT | |
| data_quality_requirements | TEXT | |
| risk_level | TEXT | `low`, `medium`, `high` |
| compliance_sensitivity | TEXT | `public`, `internal`, `confidential` |
| bottlenecks | TEXT | |
| error_prone_steps | TEXT | |
| ideal_automation_outcome | TEXT | |
| steps_must_stay_human | TEXT | |
| notes | TEXT | |
| automation_score | NUMERIC | 0-100, calculated deterministically in code |
| business_impact | TEXT DEFAULT 'medium' | `low`, `medium`, `high` — management-set |
| is_confirmed | BOOLEAN DEFAULT false | Employee confirmed the summary |
| overlap_group_id | UUID | Links duplicate/overlapping workflows |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

Indexes: `(campaign_id)`, `(session_id)`, `(employee_id)`

#### `discovery_dependencies`
Workflow dependencies (internal and external).

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| workflow_id | UUID FK → discovery_workflows (CASCADE) | |
| depends_on_workflow_id | UUID FK → discovery_workflows (SET NULL) | NULL for external deps |
| dependency_type | TEXT NOT NULL | `internal`, `external` |
| description | TEXT | Free text, especially for external deps |
| external_system | TEXT | Name of external system/actor |
| created_at | TIMESTAMPTZ | |

Index: `(workflow_id)`

## Automation Score (0-100)

Calculated deterministically in code, NOT by the LLM.

| Factor | Weight | Scoring |
|---|---|---|
| Rule-Based Nature | 25 | `(rule_based_nature / 100) * 25` |
| Time Spent | 20 | <10m→0, 10-30m→5, 30-60m→10, 1-2h→15, 2h+→20 |
| Standardization | 15 | High→15, Medium→8, Low→0 |
| Risk (inverted) | 15 | Low→15, Medium→7, High→0 |
| Frequency | 10 | Daily→10, Weekly→7, Monthly→3, Quarterly→1, Annually→1, Ad-hoc→0 |
| Business Impact | 10 | High→10, Medium→5 (default), Low→0 |
| Volume | 5 | High→5, Medium→3, Low→0 |

**Business Impact** defaults to `medium` (5 pts). Management can override per workflow from the dashboard.

## Interview Agent ("Taro")

### Conversational Flow

```
Phase 1: Rapport & Sentiment (2-3 messages)
  → Ask how they're feeling about workload
  → Build rapport, assess engagement

Phase 2: Workflow Discovery (loop)
  For each workflow:
    → Extract all fields through natural conversation
    → Present structured summary in Keigo
    → Employee confirms / corrects
    → Save to DB immediately
    → Ask about dependencies (internal + external)
    → Every 3-4 workflows: fatigue check-in
      → Offer to pause and resume later

Phase 3: Cross-linking (after employee says done)
  → Review all workflows together
  → Ask about connections not yet captured

Phase 4: Wrap-up
  → Thank the employee
  → Summary of what was captured
  → Mark session as completed
```

### Key Behaviors

- **Language**: Japanese Keigo (polite Desu/Masu form). Configurable later.
- **Progressive saving**: Each confirmed workflow saved to DB immediately. Transcript saved per message.
- **Fatigue management**: Check-in every 3-4 workflows. Allow pause/resume.
- **Frequency vs Volume clarification**: Agent explicitly distinguishes "how often" vs "how many items each time"
- **Safety framing**: Ask "what steps MUST stay human?" to reduce automation anxiety
- **Dependencies**: After each workflow, ask about upstream/downstream. Final cross-linking pass at end.
- **Scoring**: LLM extracts structured data via tool calls. Score computed in code, not by the model.

### Technical Implementation

- Vercel AI SDK `streamText` in a Route Handler (`/api/interview/chat`)
- Client uses `useChat` from `ai/react`
- Tool calls for workflow extraction:
  - `save_workflow` — validates fields via Zod, calculates score, writes to DB
  - `save_dependency` — writes dependency to DB
  - `update_sentiment` — updates session sentiment score
- Messages persisted to `discovery_messages` on each exchange

### Session Authentication

- Admin creates session → system generates random 6-char password
- Password bcrypt-hashed, stored in `discovery_sessions.password_hash`
- `POST /api/interview/auth` validates password → sets HttpOnly JWT cookie
- Chat API validates cookie on each request
- No Clerk involvement

## Routing

### Public (Interview)

```
/interview/[sessionId]          — Password gate + chat UI
  (route group: (interview), no sidebar, no Clerk auth enforcement)
```

### Internal (Portfolio Company)

```
/{portcoSlug}/portfolio/companies/[dealId]/
├── overview                    — Company overview (existing, may need enhancement)
├── employees                   — Employee list + CSV upload
├── discovery/
│   ├── (default)               — Campaign list + create
│   ├── [campaignId]/           — Campaign detail: employee selection, invite management
│   │   └── [sessionId]/        — Individual transcript + workflow viewer
│   └── analysis                — Prioritization dashboard with charts
├── organization                — Org chart (existing, move from pipeline)
└── ...                         — Other tabs as needed
```

**Note**: Acquired companies (closed_won deals) should have their own detail layout under `/portfolio/companies/[dealId]/` separate from the pipeline deal layout. Some tabs overlap (org chart, financials) but the context is different — pipeline is for active evaluation, portfolio is for post-acquisition management.

### Middleware Update

Add `/interview(.*)` to the `isPublicRoute` matcher in `src/proxy.ts`.

## Dashboard Views

### Employee Interaction Log

- Employee list with: name, department, interview status, sentiment score, workflow count
- Filter by: status (completed, in-progress, not started), search by name
- Click → full transcript + discovered workflows with individual automation scores

### Company-Wide Prioritization

| Visualization | Description |
|---|---|
| **Summary Metrics** | Total workflows, avg automation score, high-risk count, high-impact count, est. hours saved/week |
| **Top 10 Opportunities** | Bar chart sorted by automation score |
| **Priority Matrix** | Scatter plot: automation score (x) vs business impact (y) |
| **Risk Heatmap** | Automation score × risk level |
| **Workflow Dependency Graph** | Force-directed graph, internal (solid) vs external (dashed) edges |
| **Rule-Based Distribution** | Pie chart |
| **Workflow Overlap** | Flag when multiple employees describe the same workflow |
| **Export** | CSV + PDF (browser print) |

### Constraints

- **No "Team" field** anywhere in the system (avoid blame/politics)
- Department is captured on `company_employees` but not surfaced as a column in analytics

## File Structure

```
src/
├── lib/
│   ├── db/schema/
│   │   ├── company-employees.ts               — company_employees table
│   │   └── discovery.ts                        — 5 discovery tables
│   ├── actions/
│   │   ├── company-employees.ts                — CRUD + CSV upload parsing
│   │   ├── discovery-campaigns.ts              — Campaign CRUD, employee selection
│   │   ├── discovery-sessions.ts               — Session creation, password gen, invites
│   │   └── discovery-analytics.ts              — Aggregation queries for dashboard
│   ├── agents/
│   │   └── discovery-interviewer/
│   │       ├── index.ts                        — Agent core: tool definitions, streamText setup
│   │       ├── prompt.ts                       — System prompt template (Japanese Keigo)
│   │       ├── schema.ts                       — Zod schemas for workflow extraction
│   │       └── scoring.ts                      — Deterministic automation score calculator
│   └── discovery/
│       └── automation-score.ts                 — Pure function: workflow fields → 0-100
├── app/
│   ├── (interview)/
│   │   ├── layout.tsx                          — Minimal layout (no sidebar, no Clerk enforcement)
│   │   └── interview/[sessionId]/
│   │       ├── page.tsx                        — Password gate + chat UI
│   │       └── loading.tsx
│   ├── api/interview/
│   │   ├── auth/route.ts                       — Password validation → JWT cookie
│   │   └── chat/route.ts                       — Streaming chat endpoint
│   └── (app)/[portcoSlug]/portfolio/companies/[dealId]/
│       ├── layout.tsx                          — Company detail layout with tabs
│       ├── overview/page.tsx                   — Company overview
│       ├── employees/page.tsx                  — Employee list + CSV upload
│       └── discovery/
│           ├── page.tsx                        — Campaign list + create
│           ├── [campaignId]/
│           │   ├── page.tsx                    — Campaign detail: employees, invite status
│           │   └── [sessionId]/page.tsx        — Transcript + workflow viewer
│           └── analysis/page.tsx               — Charts + prioritization dashboard
└── components/
    └── discovery/
        ├── campaign-form.tsx                   — Create/edit campaign dialog
        ├── employee-upload.tsx                 — CSV upload + preview
        ├── employee-table.tsx                  — Employee list with status badges
        ├── interview-chat.tsx                  — Chat UI (useChat hook)
        ├── password-gate.tsx                   — Password entry form
        ├── workflow-card.tsx                    — Single workflow display
        ├── workflow-detail-dialog.tsx           — Full workflow details modal
        ├── priority-matrix.tsx                  — Scatter plot (recharts)
        ├── automation-heatmap.tsx               — Heatmap (recharts)
        ├── opportunity-bar-chart.tsx            — Top 10 bar chart (recharts)
        ├── dependency-graph.tsx                 — Force-directed workflow graph
        ├── summary-metrics.tsx                  — KPI cards row
        ├── company-tabs.tsx                     — Tab nav for company detail
        └── discovery-tabs.tsx                   — Sub-tab nav for discovery section
```

## Implementation Phases

### Phase A: Foundation
1. SQL migration script for all 7 tables (6 discovery + company_employees)
2. Drizzle schema files + export from `schema/index.ts`
3. Automation score pure function
4. Middleware update (add `/interview` to public routes)

### Phase B: Interview Agent Backend
5. System prompt (Japanese Keigo, phased conversation instructions)
6. Zod schemas for workflow extraction
7. Agent core with tool definitions (save_workflow, save_dependency, update_sentiment)
8. Auth API route (password → JWT cookie)
9. Chat API route (streaming with tool calls + message persistence)

### Phase C: Interview UI (depends on B)
10. Interview layout (minimal shell)
11. Password gate component
12. Chat component (useChat + message display + pause/resume)
13. Interview page

### Phase D: Admin Backend (parallel with C)
14. Company employees actions (CRUD + CSV parsing)
15. Campaign actions (CRUD + employee selection)
16. Session actions (create, password gen, invite email placeholder)
17. Analytics aggregation queries

### Phase E: Portfolio Company Pages (depends on D)
18. Company detail layout + tabs component
19. Company overview page
20. Employee list page + CSV upload component
21. Campaign management pages
22. Transcript + workflow viewer page

### Phase F: Analytics Dashboard (depends on D)
23. Summary metrics component
24. Opportunity bar chart
25. Priority matrix (scatter plot)
26. Risk heatmap
27. Dependency graph
28. Workflow overlap detection
29. Analysis page (assembles all charts)
30. Export (CSV via server action, PDF via print CSS)

## Charting

Recharts (already installed, v2.15.4) with existing shadcn `chart.tsx` wrapper. For the dependency graph, use SVG with a simple force-directed layout (no additional library unless complexity warrants reactflow).

## Key Design Decisions

1. **Scoring in code, not LLM** — deterministic, auditable, consistent
2. **Employees are company-level**, not campaign-level — reusable across features
3. **Progressive saving** — no data loss on browser close mid-interview
4. **Tool calls for extraction** — LLM calls `save_workflow` tool, code validates via Zod + calculates score
5. **No team field** — department stored but not surfaced in analytics to avoid blame
6. **Business impact defaults to medium** — management overrides from dashboard
7. **Portfolio company routes separate from pipeline** — different context and tabs

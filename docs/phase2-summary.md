# Phase 2+ Summary — Deal Pipeline, Integrations & IM Processing Agent

This phase combined deliverables from the original Phase 2 (Deal Pipeline), Phase 3 (Integrations), and Phase 4 (AI Agents), prioritizing end-to-end value delivery over strict phase boundaries.

## Deal Pipeline & Kanban (Phase 2)

### Kanban Board
- Drag-and-drop Kanban board with stages grouped by phase (sourcing → evaluation → diligence → closing → PMI)
- Stage color indicators and deal count badges
- Real-time position updates via server actions

### Deal Detail Workspace
Tabbed layout at `/{portcoSlug}/deals/{dealId}/`:

| Tab | Status |
|---|---|
| **Overview** | Summary, key metrics, stage, assigned user |
| **Profile** | AI-generated company profile with 8-dimension scoring breakdown |
| **Files** | File list with GDrive import and AI processing buttons |
| **Tasks** | Task management (create, assign, complete) |
| **Comments** | Discussion thread |
| **Financials** | Manual financial snapshot entry (revenue, EBITDA, margins, etc.) |
| **Activity** | Timeline from `deal_activity_log` |

### Deal Management
- Deal CRUD — create via dialog, edit, archive, pass
- Deal financials entry with period types (monthly, quarterly, annual, snapshot)
- Deal tasks with assignment and completion tracking
- Comments system
- Activity log auto-populating on state changes

### Executive Dashboard Enhancements
- **Strategy & Team section**: Investment thesis, target criteria, and team members in a 3-column layout
- **Deal Flow section** with:
  - Monthly stacked bar chart (deals by stage over time, active deals only)
  - Current month bar chart (deals per stage with stage colors)
  - Broker leaderboard (ranked by deal volume and quality/win rate)
  - Acquisition leaderboard (top closed deals by EBITDA)
- Aggregate financials: portfolio revenue, EBITDA, capital deployed
- Pipeline charts replace the static Pipeline Snapshot cards

### IM Scoring Rubric (`src/lib/scoring/rubric.ts`)
8 weighted dimensions for Japanese IT services M&A:

| Dimension | Weight |
|---|---|
| Financial Stability | 20% |
| Client Concentration | 20% |
| Technology & Technical Capability | 15% |
| Debt & Financial Leverage | 12% |
| Business Model & Service Mix | 12% |
| AI & Digital Transformation Readiness | 10% |
| Organizational Complexity | 6% |
| Post-Merger Integration Risk | 5% |

Each dimension scored 1-5 with detailed criteria per level. Weighted score maps to recommendation bands (Strong Candidate → High Risk).

### Red Flags Framework (`src/lib/scoring/red-flags.ts`)
80+ predefined red flag definitions across 4 severity levels and 9 categories:
- **Severities**: Critical, Serious, Moderate, Info Gap
- **Categories**: Financial, Clients, Legal/Regulatory, People, Operations, Technology, Business Model, Compliance/Governance, Japan-Specific
- Decision framework thresholds (e.g., 1 critical flag = likely pass)
- Interactive Red Flags Panel with add/resolve/remove actions

---

## Broker Management (Phase 3)

### Broker Firms & Contacts
- Broker firms CRUD with edit dialog and delete confirmation
- Broker contacts management with per-firm detail pages
- JSONB metadata for rich firm profiles (type, avg deal size, deal flow, fee model, relevance, notes)

### Broker Data
9 broker firms seeded with researched metadata from Japanese M&A market:
- Batonz, BizReach Succeed, FUNDBOOK, M&A Capital Partners, M&A Nakauchi, Nihon M&A Center, TRANBI, Ondeck, M&A総合研究所
- Contacts with Japanese names and titles (e.g., 大村様, 川嶋様 at M&A総合研究所)
- Round-robin deal-to-broker assignment for demo data

### Broker UI
- Firm cards showing type, avg deal size, deal flow, and relevance from metadata
- Detail pages with overview cards, full metadata display, contacts list, and interaction history
- Broker leaderboard on dashboard ranking by deal volume and quality

---

## Google Drive Integration (Phase 3)

### OAuth Flow
- OAuth 2.0 with refresh tokens (no service account JSON keys — blocked by org policy)
- `drive.readonly` scope for file browsing
- Dedicated bot account (`havenbot@havenaipartners.com`)
- AES-256-GCM encryption for refresh tokens at rest (`src/lib/gdrive/crypto.ts`)

### Routes
| Route | Purpose |
|---|---|
| `/api/auth/gdrive/connect` | Redirects to Google OAuth consent |
| `/api/auth/gdrive/callback` | Handles OAuth callback, stores encrypted token |
| `/api/gdrive/files` | Lists files from configured GDrive folder |

### GDrive Client (`src/lib/gdrive/client.ts`)
- `getAuthUrl()` — generate OAuth URL
- `handleCallback()` — exchange code, encrypt & store refresh token
- `getDriveClient()` — authenticated Drive v3 client per portco
- `getConnectedAccount()` — fetch connected account email/name
- `getFolderName()` — resolve folder ID to human name
- `listFiles()` — list files in configured folder
- `downloadFile()` — download file content as Buffer

### Settings Page
- GDrive connection status with badge (Connected/Not connected)
- Connected account display (name + email)
- Root folder configuration with human-readable folder name
- Connect/Disconnect buttons
- Token encrypted at rest note

### Files Browser (`/{portcoSlug}/files`)
- Lists GDrive files with icons, type badges, size, modified date
- External links to open in Google Drive
- "Connect Google Drive" prompt with link to Settings when not connected

---

## IM Processing AI Agent (Phase 4)

### Architecture
End-to-end pipeline: **GDrive PDF → Text Extraction → Claude Analysis → Database Storage**

### Components

| File | Purpose |
|---|---|
| `src/lib/agents/im-processor/schema.ts` | Zod v4 schema for structured AI output |
| `src/lib/agents/im-processor/prompt.ts` | System prompt with full rubric + red flags |
| `src/lib/agents/im-processor/index.ts` | Processing pipeline (download → extract → analyze → store) |
| `src/lib/actions/im-processing.ts` | Server actions for triggering processing |
| `src/components/deals/process-im-button.tsx` | Per-file "Process IM" button with status |
| `src/components/deals/import-gdrive-dialog.tsx` | Dialog to browse & import GDrive files |

### Pipeline Steps
1. Download PDF from Google Drive via `downloadFile()`
2. Extract text via `pdf-parse` v2 (`PDFParse`)
3. Send to Claude Sonnet 4.6 via Vercel AI SDK `generateObject()` with structured output
4. Parse response into: company profile, 8-dimension scores with rationales, red flags with evidence, info gaps
5. Calculate weighted overall score
6. Upsert `company_profiles` table (conflict on `dealId`)
7. Replace `deal_red_flags` for the deal (validates flag IDs against known definitions)
8. Update file `processing_status` (pending → processing → completed/failed)

### Structured Output Schema
- **Company Profile**: summary, business model, market position, industry trends, strengths, key risks
- **Financial Highlights**: revenue, growth, margins, recurring revenue %, employee count, client concentration, debt
- **Scoring**: 8 dimensions × (score 1-5 + rationale)
- **Red Flags**: flag ID + evidence notes (validated against 80+ predefined definitions)
- **Info Gaps**: missing information flags with explanations

### UI Integration
- Deal files page: "Import from GDrive" button opens file browser dialog
- Per-file "Process IM" button with states: idle → processing → done/error
- "Import + Process" one-click action for PDFs
- Profile page shows scoring breakdown with per-dimension rationales
- Red Flags Panel shows AI-generated evidence notes

---

## Other Improvements

### Domain-Based Auto-Join
- New users with matching email domain auto-join the portco membership

### Dashboard Performance
- Parallel data fetching for dashboard queries
- Optimized broker leaderboard query with FILTER clauses

### Navigation
- "Files" nav item added to sidebar (between Brokers and Agents)

---

## New Dependencies

| Package | Purpose |
|---|---|
| `ai` (v6) | Vercel AI SDK — `generateObject()` for structured LLM output |
| `@ai-sdk/anthropic` | Anthropic provider for AI SDK |
| `pdf-parse` (v2) | PDF text extraction |
| `googleapis` | Google Drive API v3 client |

## Environment Variables Added

| Variable | Purpose |
|---|---|
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `GOOGLE_REDIRECT_URI` | OAuth callback URL |
| `ENCRYPTION_KEY` | 64-char hex string for AES-256-GCM token encryption |
| `ANTHROPIC_API_KEY` | Anthropic API key for Claude |

# Rollup OS — Production Readiness Checklist

This document tracks all operational, infrastructure, and security requirements that must be in place before production launch. Items are organized by category and mapped to the implementation phase where they should be addressed.

---

## 1. Database & Migrations

### Migration Strategy

- [ ] **Phase 1 (dev)**: Use `drizzle-kit push` for rapid schema iteration
- [ ] **Phase 1 (stabilize)**: Switch to `drizzle-kit generate` + `drizzle-kit migrate` once schema settles
- [ ] **Migration files committed to git**: All `.sql` files in `src/lib/db/migrations/` are reviewed in PRs
- [ ] **CI/CD migration step**: GitHub Actions runs `drizzle-kit migrate` against staging/prod Supabase **before** Vercel deployment — never on app start
- [ ] **Migration rollback plan**: Document rollback SQL for each migration (Drizzle does not auto-generate rollbacks)
- [ ] **No concurrent migration risk**: CI/CD pipeline ensures only one migration job runs at a time (e.g., GitHub Actions concurrency group)

### Database Operations

- [ ] Connection pooling configured (Supabase PgBouncer or Drizzle pool settings)
- [ ] Database backups enabled and tested (Supabase daily backups + point-in-time recovery)
- [ ] Query performance baseline established (slow query logging enabled)
- [ ] Indexes reviewed for all common query patterns (especially `portco_id` filters, `deal_id` joins, `kpi_values` lookups)
- [ ] pgvector index tuned (`ivfflat` list count appropriate for data volume)
- [ ] Row-level or application-level tenant isolation verified (no cross-PortCo data leaks)

---

## 2. Authentication & Authorization

- [ ] Clerk production instance configured (separate from dev)
- [ ] Google SSO verified with production OAuth credentials
- [ ] RBAC middleware tested for all role levels (`owner`, `admin`, `analyst`, `viewer`)
- [ ] Clerk webhook for user sync (`users` table) handles edge cases (deletion, email change)
- [ ] Session management: token expiry, refresh, and revocation tested
- [ ] Rate limiting on auth endpoints

---

## 3. Secrets & Credential Management

- [ ] All secrets in environment variables (never in code or DB unencrypted)
- [ ] GDrive service account JSON keys encrypted at rest (AES-256 via app-level key)
- [ ] App-level encryption key (`GOOGLE_DRIVE_ENCRYPTION_KEY`) stored in Vercel environment variables (not `.env` files)
- [ ] Broker site credentials (for login-gated scrapers) stored encrypted
- [ ] Gmail service account credentials stored securely
- [ ] Separate env vars per environment (dev, staging, production)
- [ ] `.env.example` committed with all required keys documented (no values)

---

## 4. Infrastructure & Deployment

### Vercel

- [ ] Production domain configured with SSL
- [ ] Environment variables set for production
- [ ] Build output verified (no dev dependencies in production bundle)
- [ ] Edge middleware performance tested (Clerk + RBAC checks)
- [ ] Serverless function memory/timeout limits reviewed

### Supabase

- [ ] Production project created (separate from dev)
- [ ] Connection string uses pooled connection for serverless
- [ ] Direct connection available for migrations
- [ ] pgvector extension enabled
- [ ] Database region selected (close to primary users — likely Asia-Pacific given JP focus)

### Trigger.dev

- [ ] Production project configured
- [ ] Tasks deployed and verified
- [ ] Retry policies set per task (idempotency verified)
- [ ] Concurrency limits configured (prevent runaway scraping)
- [ ] Cron schedules set for recurring agents (deal sourcing, broker engagement)
- [ ] Alert on task failure (webhook or Slack notification)

### Langfuse

- [ ] Production project configured
- [ ] Trace sampling rate set (100% initially, reduce if volume is high)
- [ ] Cost tracking verified per agent type
- [ ] Retention policy defined

---

## 5. External Integrations

### Google Drive

- [ ] Per-PortCo service accounts tested with real GDrive folders
- [ ] Folder structure convention documented and enforced (`/IMs/`, `/Reports/`)
- [ ] File size limits defined and enforced
- [ ] Error handling for quota limits, permission errors, network failures
- [ ] Cross-PortCo deal transfer (file copy) tested between different GSuite accounts

### Gmail

- [ ] Service account domain-wide delegation configured and approved
- [ ] Scopes minimized to only what's needed (send, read)
- [ ] Rate limiting respected (Gmail API quotas)
- [ ] Inbound email parsing handles malformed/unexpected emails gracefully

### Slack

- [ ] Webhook URLs validated per PortCo
- [ ] Message formatting tested (deal cards, stage changes, IM processed alerts)
- [ ] Failure handling: queue and retry if Slack is down
- [ ] Rate limiting respected

### Scraping Targets

- [ ] Accounts created for login-gated sites (FundBook, SMERGERS, DealStream)
- [ ] Per-site scraper tested against live sites
- [ ] Rate limiting and polite crawling (respect `robots.txt`, add delays)
- [ ] Failure alerts when a site changes structure (selectors break)
- [ ] Japanese content handling verified end-to-end

---

## 6. Security

- [ ] OWASP Top 10 review completed
- [ ] No SQL injection vectors (Drizzle parameterized queries verified)
- [ ] No XSS vectors (React server components + proper escaping)
- [ ] CSRF protection (Next.js server actions use built-in protection)
- [ ] Input validation on all API routes and server actions (Zod schemas)
- [ ] File upload validation (type, size, malware scanning consideration)
- [ ] Tenant isolation audit: verified no endpoint leaks cross-PortCo data
- [ ] Encrypted data at rest: GDrive service account keys, broker site credentials
- [ ] Audit log cannot be tampered with (`deal_activity_log` is append-only)
- [ ] Dependency audit (`npm audit`, no known vulnerabilities)
- [ ] Content Security Policy headers configured

---

## 7. Monitoring & Observability

- [ ] Error tracking service configured (Sentry or Vercel's built-in)
- [ ] Uptime monitoring for the app and critical endpoints
- [ ] Database monitoring (connection pool usage, query latency, disk usage)
- [ ] Trigger.dev task monitoring (failure rates, queue depth, execution time)
- [ ] Langfuse dashboards for LLM cost, latency, and error rates per agent
- [ ] Slack alerts for: task failures, migration errors, auth anomalies, scraper breakage
- [ ] Log aggregation with structured logging (JSON format)

---

## 8. Performance

- [ ] Core Web Vitals baseline measured
- [ ] Kanban board performance tested with 100+ deals
- [ ] Dashboard aggregate queries optimized (consider materialized views for `deal_financials` aggregates)
- [ ] Pagination on all list views (deals, brokers, interactions, files, activity log)
- [ ] Image/asset optimization (Next.js Image component, CDN caching)
- [ ] API response times < 200ms for common operations
- [ ] Vector search latency acceptable (< 500ms for similarity queries)

---

## 9. Data Integrity & Recovery

- [ ] Database backup schedule confirmed (daily + point-in-time)
- [ ] Backup restoration tested at least once
- [ ] Deal transfer is transactional (DB + GDrive copy are atomic or compensating)
- [ ] Agent runs are idempotent (re-running a failed task doesn't create duplicates)
- [ ] Soft delete vs hard delete policy defined for deals, files, users
- [ ] Data export capability (for compliance or portability)

---

## 10. Pre-Launch

- [ ] Staging environment mirrors production config
- [ ] End-to-end smoke tests pass on staging
- [ ] Load testing completed (simulated concurrent users)
- [ ] User acceptance testing by stakeholders
- [ ] Documentation: user guide, admin guide, API reference (if applicable)
- [ ] Rollback plan documented (how to revert a bad deployment)
- [ ] On-call rotation or incident response plan defined

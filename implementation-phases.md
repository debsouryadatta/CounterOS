# CounterOS Implementation Phases

Prepared: April 19, 2026

This file is the build roadmap for CounterOS. Keep `plans/core-solution-simple-plan.md` as the product source of truth, and use this file to track implementation phases.

## North Star Loop

```text
Signal -> evidence -> interpretation -> counter-move -> founder decision
```

Every phase should protect this loop. If a feature does not help the founder see what changed, trust the evidence, understand the meaning, and choose a counter-move, it can wait.

## Phase 0: Planning And API Grounding

Status: completed

Goal: make the build executable and preserve context for future threads.

Deliverables:

- Final product name locked as CounterOS.
- MVP scope documented in `plans/core-solution-simple-plan.md`.
- Implementation phases documented in this file.
- Crustdata documentation map documented in `plans/crustdata-docs-index.md`.
- Environment variable list documented.

Acceptance criteria:

- A future developer can understand what to build first without reading the full discussion.
- A future developer can find the right Crustdata docs page for company, person, job, pricing, and rate-limit work.

## Phase 1: App Scaffold And Mock Dashboard

Status: completed

Goal: build the first usable CounterOS dashboard with mock data and no external API dependency.

Deliverables:

- Next.js App Router project with TypeScript.
- App shell for CounterOS.
- Mock dashboard data model in local files.
- Main views:
  - Overview
  - Competitors
  - Signals
  - Counter-Moves
  - Agent Chat
- Mock onboarding flow for:
  - Existing company profile
  - Pre-company product idea
  - Manual competitor entry
- Mock approval queue for suggested competitors.
- Mock signal feed with evidence, impact score, and recommended counter-move.
- Mock battlecard or target account artifact.

Acceptance criteria:

- User can run the app locally and see the end-to-end CounterOS workflow.
- No Crustdata or OpenAI key is required.
- The first screen is the actual product experience, not a marketing landing page.

## Phase 2: Auth, Database, And Seed Data

Status: completed

Goal: add simple persistence and email/password auth.

Deliverables:

- SQLite database.
- Drizzle ORM schema and migrations.
- Auth.js/NextAuth credentials auth.
- Email/password signup and login.
- Password hashes only; no plaintext password storage.
- One default workspace per user.
- Seed script for demo user and demo workspace.
- Tables for:
  - users
  - accounts/sessions if needed by Auth.js
  - workspaces
  - product_profiles
  - competitors
  - suggested_competitors
  - approval_decisions
  - evidence_sources
  - signals
  - artifacts
  - chats
  - messages
  - api_cache_entries

Acceptance criteria:

- User can sign up/login with email and password.
- User data survives page refreshes.
- Mock workflow reads from SQLite seed data instead of static-only data.

## Phase 3: Core Product CRUD APIs

Status: mostly completed

Goal: turn the mock product into a working local product with server-side state changes.

Deliverables:

- Route handlers or server actions for:
  - product/company profile create/update: completed
  - manual competitor create/update: completed
  - suggested competitor create/update: completed
  - approve/reject/edit/verify suggestions: completed
  - signal list/detail: completed
  - artifact list/detail: completed
  - chat message persistence: completed for the mock agent response loop
- Zod validation for request bodies.
- Basic server-side permission checks by workspace.
- Decision log records for approve/reject/ignore/snooze actions: completed.

Acceptance criteria:

- Approving a suggested competitor changes database state.
- Rejected suggestions are saved so they are not re-suggested immediately.
- Signal and artifact views are backed by persisted records.

## Phase 4: Crustdata Client And Company Intelligence

Status: in progress

Goal: connect approved competitors to Crustdata safely and cost-consciously.

Deliverables:

- Server-side Crustdata HTTP client.
- Shared headers:
  - `authorization: Bearer ${CRUSTDATA_API_KEY}`
  - `x-api-version: 2025-11-01`
- Central timeout, retry, and rate-limit handling.
- API cache table usage for successful responses.
- Company Identify integration for free entity resolution: completed.
- Company Search integration for competitor suggestions and target-account discovery: completed.
- Company Enrich integration for approved competitors only: completed.
- UI states for:
  - unresolved
  - resolved
  - enriched
  - no match
  - failed

Implementation guidance:

- Use `/company/identify` first when the user gives a domain, name, profile URL, or Crustdata company ID.
- Use `/company/search` for market scans and target account lists.
- Use `/company/enrich` only after approval or when the user explicitly asks for full detail.
- Always specify `fields` for Search and Enrich to control payload size and cost.
- Normalize Crustdata response envelopes defensively because some docs describe `results` wrappers while endpoint pages describe top-level arrays.

Acceptance criteria:

- User can add a competitor domain and resolve it through Crustdata.
- Approved competitors can be enriched with basic info, headcount, funding, hiring, competitors, news, and people sections.
- API keys never reach the browser.

## Phase 5: AI Agent, Structured Outputs, And Tool Calls

Status: mostly completed

Goal: make Agent Chat a real control surface for the core CounterOS workflow.

Deliverables:

- Vercel AI SDK integration.
- Server-side chat endpoint.
- Structured outputs for:
  - competitor suggestion: schema completed
  - signal explanation: schema completed
  - counter-move plan: schema completed
  - battlecard: schema completed
  - target account request: schema completed
- Agent tools for:
  - reading product profile
  - listing competitors
  - creating suggested competitors
  - approving/rejecting suggestions
  - fetching Crustdata company data
  - creating artifacts
- Agent activity stream persisted as steps.

Acceptance criteria:

- User can ask: "I am building an AI receptionist for dental clinics. Find competitors."
- Agent creates suggested competitor cards instead of silently adding competitors.
- Agent can explain a signal with evidence and generate a counter-move artifact.

## Phase 6: Signals From Jobs And People Movement

Status: in progress

Goal: add real strategic signals beyond static company enrichment.

Deliverables:

- Jobs Search integration for competitor hiring signals: completed.
- Person Search integration for leaders and role movements: wrapper completed; signal persistence pending.
- Person Enrich integration for selected people only: wrapper completed; signal persistence pending.
- Signal generation rules for:
  - hiring spikes: foundation completed
  - new GTM or leadership roles: foundation completed
  - product/engineering hiring focus: foundation completed
  - new geography hiring: foundation completed
  - people movement tied to competitor strategy: foundation completed
- Signal scoring implementation: completed for job and page-change signals; people-movement signal generation pending.

Implementation guidance:

- Use `/job/search` for hiring trend and role monitoring. The job result already includes company firmographics, so avoid unnecessary company enrich calls for every job row.
- Use `/person/search` for leadership, founder, GTM, product, and sales leader discovery.
- Use `/person/enrich` only for selected people who matter to a signal or artifact.

Acceptance criteria:

- CounterOS can show a signal like "Competitor is hiring enterprise AEs in the US."
- The signal includes evidence, source, timestamp, confidence, and recommended action.

## Phase 7: Web Context And Page Signals

Status: in progress

Goal: detect public web changes and add source evidence.

Deliverables:

- Web search/page fetch strategy.
- Homepage/pricing page/manual URL tracking: API completed; dashboard surface pending.
- Evidence source storage for page fetches.
- Basic diffing or snapshot comparison for selected pages: completed.
- AI interpretation of page changes: pending.

Implementation guidance:

- Crustdata Web docs currently appear access-gated from the public docs flow. Pricing lists `/web/search/live` and `/web/enrich/live` as self-serve endpoints, so use dashboard/API reference access before implementation.
- Keep page snapshot storage small at first. Store extracted text and metadata in SQLite; move large snapshots to disk/object storage later.

Acceptance criteria:

- User can track one competitor URL.
- CounterOS can show a page-change signal with evidence and explanation.

## Phase 8: Background Jobs, Scheduling, And Production Hardening

Status: in progress

Goal: make discovery, enrichment, and monitoring durable.

Deliverables:

- Redis and BullMQ: dependency and queue wiring completed.
- Jobs for:
  - competitor discovery: payload contract completed; worker pending
  - company enrichment: payload contract completed; worker pending
  - jobs search monitoring: payload contract completed; worker pending
  - person movement monitoring: payload contract completed; worker pending
  - page snapshot collection: payload contract completed; worker pending
  - signal scoring: payload contract completed; worker pending
  - weekly founder briefing: payload contract completed; worker pending
- Bounded queues and backoff: completed for initial worker wiring.
- Observability for:
  - API calls
  - token usage
  - Crustdata credits estimation
  - job status
  - failures
  - approval decisions
- Deployment plan for worker runtime separate from Vercel serverless if deployed on Vercel.

Acceptance criteria:

- Long-running work does not block page requests.
- Rate limits are respected.
- Failed jobs retry safely without duplicating approved competitors, signals, or artifacts.

## Environment Variables

Required for local app with auth and persistence:

```env
DATABASE_URL=file:./local-dev/dev.db
AUTH_SECRET=replace-with-a-32-plus-character-random-secret
```

Required when real AI and Crustdata are enabled:

```env
OPENAI_API_KEY=...
CRUSTDATA_API_KEY=...
```

Recommended for deployed environments:

```env
AUTH_URL=https://your-counteros-domain.com
NEXT_PUBLIC_APP_URL=https://your-counteros-domain.com
```

Optional for demo seeding:

```env
SEED_USER_EMAIL=founder@example.com
SEED_USER_PASSWORD=change-this-before-sharing
```

Optional later:

```env
REDIS_URL=redis://localhost:6379
```

## Immediate Next Build Step

Finish the remaining Phase 3 decision actions, then wire the Phase 4 and Phase 5 foundations into the product loop:

```text
Crustdata Identify/Enrich routes -> status UI -> AI chat tools -> generated suggestions/artifacts
```

Keep the next wave focused on the same north-star loop: a founder approves competitors, sees trusted evidence, understands the signal, and chooses a counter-move.

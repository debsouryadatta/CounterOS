# CounterOS Core Solution Plan

## Product Name

The product name is **CounterOS**.

Use this name consistently in the UI, docs, code comments, and product copy. The product should feel like a focused agent for competitive counter-moves, not a broad market research dashboard.

## Product Idea

CounterOS is an AI competitor intelligence agent for founders and small teams.

In simple words:

```text
CounterOS watches competitors, explains what changed, and tells the founder what to do next.
```

The main value is not only collecting competitor data. The main value is turning that data into a clear action.

```text
Competitor change -> evidence -> meaning -> recommended action
```

## Who This Is For

- Startup founders.
- Small GTM teams.
- Product teams.
- Sales teams that need fresh competitor battlecards.

These users usually do not have time to manually check competitor websites, pricing pages, hiring pages, news, reviews, and social posts every week.

## Core Problem

Founders often know they should track competitors, but the process is messy.

- Competitor information is spread across many places.
- Website change alerts are noisy.
- Pricing and positioning changes are easy to miss.
- Battlecards become outdated quickly.
- Hiring and people changes can reveal strategy, but founders may not notice them.
- AI/search visibility is becoming important, but most teams do not track it.

## Core Solution

The product should work like a smart competitive assistant.

It should:

1. Track known competitors.
2. Discover new or adjacent competitors.
3. Let founders either add competitors manually or ask the agent to find competitors from existing company details or an unreleased product idea.
4. Require founder approval before suggested competitors are added to tracking.
5. Collect evidence from public sources and the Crustdata API.
6. Detect important changes.
7. Score each change by importance.
8. Explain why the change matters.
9. Recommend what the founder should do next.
10. Create useful outputs like battlecards, positioning notes, target account lists, or action memos.

The simple promise:

```text
Do not make founders read more data.
Help them make better competitive decisions.
```

The product should always preserve this loop:

```text
Signal -> evidence -> interpretation -> counter-move -> founder decision
```

## Main Features

| Feature | What It Means | How We Can Build It |
|---|---|---|
| Competitor Setup | User enters optional company details, a product idea description, and any competitors they already know. | Simple onboarding form and chat flow. Store a flexible company or product idea profile plus the competitor list. |
| Product Idea Input | User may not have a company yet, but can describe what they plan to build. | Ask for product description, problem, ICP, category, geography, planned solution, and any competitor names or links they already have in mind. |
| Competitor Auto-Finder | User can ask the agent to find likely competitors instead of entering all of them manually. | Use optional company name, URL, ICP, category, geography, and product idea description with AI, Crustdata company search, and web context to generate suggestions. |
| Competitor Approval Queue | Suggested competitors wait for approval before tracking starts. | Show review cards in the UI and Agent Chat with name, URL, threat type, confidence, evidence, and approve/reject/edit/verify actions. |
| Competitor Map | Shows direct, indirect, and emerging competitors. | Use user input plus Crustdata company search to discover similar companies. |
| Signal Feed | Shows important competitor changes in one place. | Track pricing pages, homepages, changelogs, hiring pages, blogs, reviews, and AI/search results. |
| Crustdata Company Intel | Adds trusted business context about each competitor. | Use Crustdata company search and company enrichment. |
| People Movement Tracker | Finds leadership changes, new hires, and role changes. | Use Crustdata person search and person enrichment. |
| Impact Score | Ranks which signals matter most. | Score signals by freshness, confidence, competitor importance, customer impact, and actionability. |
| Counter-Move Planner | Recommends what the founder should do next. | Use AI to convert evidence into product, pricing, sales, content, or GTM actions. |
| Battlecard Generator | Creates sales notes against a competitor. | Generate strengths, weaknesses, objections, talk tracks, and comparison points. |
| Founder Briefing | Gives a short weekly summary. | Show "what matters", "what to ignore", and "what to do this week". |
| Decision Log | Tracks what the founder approved, ignored, or assigned. | Save each recommendation and its final decision. |

## How Crustdata API Fits

Crustdata is the external data layer. It gives the product real company and people context.

Use it for:

| Crustdata API Area | Use In Product |
|---|---|
| Company Search | Find competitors, similar companies, and target accounts from the user's optional company profile or product idea profile. |
| Company Enrichment | Get company profile, headcount, funding, growth, location, industry, and other business context. |
| Person Search | Find founders, executives, product leaders, sales leaders, and new strategic hires. |
| Person Enrichment | Get more context about important people and their background. |
| Web Context | Pull public context from competitor pages, blogs, launches, and news. |

Important implementation rule:

```text
Keep the Crustdata API key only on the server. Never expose it in the browser.
```

Also cache successful API responses locally. This helps the demo work even if the network is slow or the API has limits.

## Recommended Technical Stack

Use a simple TypeScript-first stack that can ship quickly and still scale later.

| Layer | Recommended Choice | Notes |
|---|---|---|
| App framework | Next.js App Router | Use App Router for pages, layouts, server components, server actions where useful, and route handlers for backend APIs. |
| Backend APIs | Next.js route handlers | Keep product APIs, chat APIs, Crustdata proxy calls, and approval actions inside `app/api/.../route.ts`. |
| Database | SQLite for MVP | Good for local development, fast demos, and simple deployment. |
| ORM | Drizzle ORM | Keep schema and queries typed. Use migrations from the start. |
| Future database | Postgres later | Drizzle makes this easier, but it is not always only a database URL swap. Keep schema types portable and isolate the DB adapter so the move is clean. |
| Auth | Auth.js/NextAuth credentials | Use a simple email and password flow for the MVP. Store only the minimum profile fields: email, optional name, password hash, and timestamps. Do not collect full address or expanded profile data. |
| AI and agents | Vercel AI SDK | Use it for streaming chat, structured outputs, tool calls, and agent workflows. |
| Background jobs | BullMQ workers when needed | Use for slow or scheduled work like competitor discovery, enrichment, page snapshots, signal scoring, and weekly briefings. |
| Queue backend | Redis in Docker Compose | Required for BullMQ locally. Keep it optional until jobs need durability. |
| External intelligence | Crustdata API | Server-side only. Use for company search, enrichment, people search, and target account discovery. |
| Validation | Zod | Validate API inputs, AI structured outputs, job payloads, and webhook-style events. |
| Local development | Docker Compose | Start Redis and any future supporting services locally. SQLite can stay as a local file. |

Important architecture rule:

```text
Next.js handles the product UI and request/response APIs.
BullMQ workers handle long-running background work.
Redis powers the queue.
SQLite stores durable product state for the MVP.
```

If the product is deployed on Vercel, keep BullMQ workers outside the serverless request path. They should run as a separate long-running process on a worker-friendly runtime such as a Docker host, Railway, Fly.io, Render, or another persistent server.

## Simple User Flow

1. Founder chooses an input path: existing company, unreleased product idea, manual competitors, or any mix of these.
2. Founder enters optional company URL/name if they have one.
3. Founder describes the product idea, ICP, category, geography, problem, and planned solution.
4. Founder adds known competitors manually, or asks the agent to find competitors.
5. The product uses AI, Crustdata, and web context to suggest likely competitors.
6. Founder approves, rejects, edits, or asks the agent to verify each suggestion.
7. Approved competitors are added to tracking.
8. The product uses Crustdata to enrich those competitors.
9. The product discovers adjacent competitors over time.
10. The product tracks signals like pricing, hiring, positioning, launches, and people movement.
11. Each signal gets an impact score.
12. The AI explains the signal in simple language.
13. The AI recommends a counter-move.
14. Founder can approve, edit, ignore, or ask for more evidence.
15. The product creates an artifact like a battlecard, comparison page outline, or target account list.

Everything in this flow should also be available inside Agent Chat. A user should be able to say: "I do not have a company yet, but I am building an AI receptionist for dental clinics. Find competitors and show me which ones to track."

## Example

```text
Signal:
A competitor changed its homepage from "for small clinics" to "for multi-location healthcare groups."

Crustdata evidence:
The competitor is hiring enterprise sales roles and recently added a senior GTM leader.

Meaning:
They may be moving upmarket.

Recommended action:
1. Defend the small-clinic positioning.
2. Create a comparison page for smaller clinics.
3. Generate a sales battlecard.
4. Use Crustdata to find target accounts before the competitor reaches them.
```

## MVP Build Plan

Start small. The first version does not need every advanced feature.

Detailed implementation phases now live in `implementation-phases.md`. Use this section for the product slice and the phases file for build execution.

Build this demo slice:

```text
Company or product idea profile
-> AI/API competitor suggestions
-> founder approval
-> approved competitor profiles
-> Crustdata enrichment
-> signal timeline
-> impact score
-> simple explanation
-> recommended counter-move
-> generated battlecard or target account list
```

For the first implementation, the MVP should focus on one memorable workflow:

```text
A founder describes a company or product idea.
CounterOS suggests competitors.
The founder approves the right ones.
CounterOS shows one important competitor signal with evidence.
CounterOS explains the meaning and creates the recommended counter-move.
```

Keep these in the first build:

- Company or product idea onboarding.
- Manual competitor entry.
- AI/API competitor suggestions.
- Competitor approval queue.
- Approved competitor profiles.
- Crustdata company enrichment.
- A simple signal timeline.
- Impact scoring.
- Agent explanation and counter-move generation.
- One generated artifact, preferably a battlecard or target account list.

Defer these until the core loop feels strong:

- Full CRM-style internal data integrations.
- Slack, Notion, Linear, or Jira actions.
- Automated daily or weekly polling.
- AI visibility tracking.
- Large website snapshot storage.
- Learning-loop analytics.
- Multi-workspace administration.

Recommended build order:

1. Build the UI with mock data first.
2. Add onboarding for optional company details, product idea description, and manual competitor entry.
3. Create the competitor suggestion and approval queue with mock data.
4. Add SQLite, Drizzle schema, and migrations.
5. Create the Next.js route handlers for company profiles, product ideas, competitors, suggestions, approvals, signals, and chat.
6. Create a server-side Crustdata client.
7. Add company search and company enrichment.
8. Add Vercel AI SDK chat, structured outputs, and tool calls.
9. Add AI/web-context competitor suggestion logic.
10. Add person search and person enrichment.
11. Create a simple signal feed.
12. Add impact scoring.
13. Add AI explanation and counter-move generation.
14. Add local caching for demo safety.
15. Add BullMQ and Redis only when discovery, enrichment, or polling needs background processing.
16. Polish the demo with loading states, evidence cards, and clear actions.

## First Implementation Defaults

- **Auth**: use Auth.js/NextAuth with the Credentials provider for email and password login. Keep signup/profile fields minimal: email, password, optional display name. Do not collect full address, phone number, company billing details, or expanded profile data in the MVP.
- **Password storage**: store only a password hash, never plaintext passwords. Validate credentials server-side and add basic rate limiting before deployment.
- **Workspace model**: start with one default workspace per demo user.
- **Agent chat**: make chat a real control surface for onboarding, competitor discovery, approvals, and artifact generation.
- **Background jobs**: keep initial discovery/enrichment synchronous or manually triggered. Add BullMQ only when jobs become slow or scheduled.
- **Data freshness**: store timestamps and evidence source records from day one, even if signal collection starts with mock or manually seeded examples.
- **API safety**: keep Crustdata and AI provider keys server-side only.

## Environment Variables

Use a `.env.local` file for local development. Keep all secrets server-side and do not expose provider keys through `NEXT_PUBLIC_` variables.

Required for the local app with auth and persistence:

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

Only add search, crawling, email, Slack, Notion, Linear, or Jira environment variables when those integrations move into scope.

## Remaining Technical Decisions

- **Auth hardening**: decide when to add email verification, password reset, stricter rate limits, and optional OAuth/passkeys.
- **Workspaces**: decide when users need multiple projects instead of one default workspace.
- **Data model**: define tables for users, workspaces, product profiles, competitors, suggested competitors, approval decisions, evidence sources, signals, artifacts, chats, messages, jobs, and API cache entries.
- **Page snapshots**: decide whether to store website snapshots in SQLite for MVP or on disk/object storage once they get large.
- **Search and memory**: start with SQLite full-text search for notes/evidence; consider Postgres plus pgvector later if semantic search becomes important.
- **Rate limits and retries**: add provider limits for Crustdata, AI calls, web fetching, and queue jobs.
- **Observability**: log agent steps, API calls, job results, token usage, costs, failures, and approval decisions.
- **Permissions**: keep approval gates for adding competitors, generating public-facing artifacts, sending messages, and creating external tickets.
- **Deployment**: decide whether the first version is local/demo-only or deployed with a hosted database, hosted Redis, and a separate worker process.

## What To Avoid

- Do not build a full CRM.
- Do not build a full SEO tool.
- Do not make it only a dashboard.
- Do not show too many alerts without explaining them.
- Do not recommend action without evidence.
- Do not overreact to weak signals.

The product should always answer:

```text
What changed?
Why does it matter?
What should we do now?
```

## Name Decision

The final product name is:

```text
CounterOS
```

Working tagline:

```text
Most tools tell you what changed. CounterOS tells you what changed, why it matters, and what counter-move to make next.
```

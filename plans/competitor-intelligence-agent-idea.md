# CounterOS Competitor Intelligence Agent For Founders

Prepared: April 19, 2026

## Refinement Note

Use this document as the expanded product vision for **CounterOS**. Use `core-solution-simple-plan.md` as the source of truth for the first implementation.

The first build should not try to ship every capability below. It should prove the core loop first:

```text
Signal -> evidence -> interpretation -> counter-move -> founder decision
```

## One-Line Idea

```text
CounterOS is an AI agent that tracks your competitors in real time and tells you what to do next.
```

## Short Pitch

Founders do not lose because they lack competitor data. They lose because they notice competitor moves too late, misread what those moves mean, or fail to respond.

CounterOS monitors competitor activity across websites, pricing, product launches, hiring, funding, people movement, customer sentiment, and AI/search visibility. It then explains what changed, why it matters, and what the founder should do next.

## Core Problem

- Founders track competitors manually using Google Alerts, spreadsheets, Slack, Reddit, X, websites, and memory.
- Most competitor updates are noisy and hard to prioritize.
- Website change tools show what changed, but not what it means.
- Battlecards become stale quickly.
- Competitors can change positioning, pricing, ICP, or product direction before founders notice.
- AI search is becoming a new battlefield: competitors may show up better in ChatGPT, Perplexity, Gemini, or Google AI answers.

## Core Solution

Build CounterOS as a founder-first competitor intelligence agent that:

- Watches competitors continuously.
- Discovers new and adjacent competitors automatically.
- Lets users add competitors manually or ask the agent to find likely competitors from either existing company details or an unreleased product idea.
- Requires founder approval before auto-discovered competitors are added to the tracked competitor list.
- Categorizes competitors as direct, indirect, substitute, emerging, or enterprise threat.
- Detects meaningful changes.
- Adds trusted company and people context using Crustdata.
- Connects competitor signals with your own internal data, like lost deals, sales notes, support tickets, and customer requests.
- Scores each signal by strategic importance.
- Separates real threats from noise.
- Recommends a concrete counter-move.
- Creates multiple response options, not just one recommendation.
- Shows confidence level, evidence, and why the agent might be wrong.
- Lets the founder approve, edit, ignore, or assign the recommendation.
- Creates founder-ready outputs like battlecards, positioning memos, pricing notes, and target account lists.
- Tracks whether the recommended action worked.
- Provides one agent interface with two ways to work: structured UI views and direct chat.
- Shows the agent's live steps as it fetches docs, queries Crustdata, reads connected databases, verifies evidence, and prepares actions.
- Lets founders perform the same actions from inside the chat window that they can perform from the planned UI.

## Extra Practical Capabilities

These make the product more useful and more impressive without turning it into a random all-in-one platform.

### 1. Competitor Discovery

The founder should not need to know every competitor manually, and they may not have launched a company yet. The setup should support several paths:

- **Manual competitor entry**: the founder enters competitor names, URLs, or domains they already know.
- **Existing company profile**: the founder enters their company name, URL, ICP, category, geography, and product description if they already have them.
- **Pre-company product idea**: the founder enters what they plan to build, who it is for, the problem it solves, target geography, pricing idea, and any competitor names or links they already have in mind.

The company name, website, and links should be optional. A strong product description should be enough for the agent to begin discovery. The user should be able to provide any of this in the onboarding UI or directly in Agent Chat.

The agent uses AI plus APIs like Crustdata company search, web context, customer mentions, review sites, and AI/search answers to suggest likely competitors.

The agent can:

- Find companies with similar positioning.
- Find companies targeting the same ICP.
- Find fast-growing adjacent players.
- Detect competitors mentioned by customers, Reddit, reviews, blogs, and AI answers.
- Group competitors by threat type.

Auto-discovered competitors should not be added silently. The agent should create a review card for each suggested competitor with:

- Company name, URL, and short description.
- Why it might be a competitor.
- Threat type.
- Confidence score.
- Evidence sources.
- Suggested tracking priority.

The founder can approve, reject, edit, or ask the agent to verify the suggestion. Approved competitors are added to the competitor map and baseline profile queue. Rejected competitors are saved as ignored suggestions so the agent does not keep recommending the same company.

Threat types:

- **Direct competitor**: sells almost the same thing.
- **Indirect competitor**: solves the same problem differently.
- **Substitute**: manual process, agency, spreadsheet, internal tool, or old workflow.
- **Emerging threat**: small company growing fast.
- **Enterprise threat**: larger company adding your feature.

### 2. Baseline Competitor Profiles

For each competitor, maintain a living profile:

- What they sell.
- Who they sell to.
- Their pricing.
- Their positioning.
- Their strongest features.
- Their weakest points.
- Key people.
- Funding and growth.
- Hiring direction.
- Main channels.
- Customer complaints.
- AI/search visibility.

This gives the agent memory. It can detect real strategic changes instead of treating every website edit as important.

### 3. Internal + External Signal Matching

The strongest insights come from combining outside signals with your own data.

Examples:

- Competitor launches a feature and your sales calls mention that same feature.
- Competitor lowers price and your CRM has more price-based lost deals.
- Competitor hires enterprise salespeople and your own pipeline has enterprise prospects going cold.
- Competitor gets complaints on Reddit and your product already solves that pain.

This turns competitor intelligence into a practical business advantage.

### 4. Counter-Move Options

Instead of giving one answer, the agent can offer 3 response styles:

- **Defensive move**: protect your current market.
- **Offensive move**: attack competitor weakness.
- **Ignore move**: do nothing because the signal is noise.

Example:

```text
Signal: Competitor launches enterprise plan.

Defensive:
Clarify that your product is best for small teams and easier to adopt.

Offensive:
Target mid-market accounts that may find the competitor too complex.

Ignore:
If your current pipeline is mostly SMB, this may not need action this week.
```

### 5. Founder Decision Queue

Every important signal should become a decision card:

- What changed?
- Why does it matter?
- What is the evidence?
- What are the options?
- What is the recommended move?
- What is the risk if we ignore it?
- Who should own the response?
- What should happen by when?

Actions:

- Approve.
- Edit.
- Assign.
- Snooze.
- Ignore.
- Ask agent to verify.

### 6. Auto-Generated Action Artifacts

The agent should not stop at advice. It should create usable artifacts:

- Sales battlecard.
- Comparison page outline.
- Pricing memo.
- Product requirement note.
- Landing page copy.
- Blog post outline.
- Customer email draft.
- Founder update paragraph.
- Investor update paragraph.
- Linear/Jira ticket.
- Notion strategy memo.
- Slack summary.
- Target account list using Crustdata.

### 7. Opportunity Finder

Competitor changes can reveal new opportunities.

Examples:

- Competitor moves upmarket -> find smaller customers they may neglect.
- Competitor raises prices -> find price-sensitive accounts.
- Competitor gets bad reviews -> find unhappy users or similar companies.
- Competitor launches complex feature -> position around simplicity.
- Competitor hires in a new geography -> decide whether to defend or avoid that market.

Crustdata can help convert this into target companies and people.

### 8. AI Visibility Tracking

Track how your startup and competitors appear in AI answers.

Example prompts:

```text
Best AI receptionist tools for clinics
Best alternatives to [competitor]
Which tools help automate healthcare appointment booking?
Best software for multi-location dental groups
```

Track:

- Who appears.
- Who is recommended first.
- What claims are made.
- Which sources are cited.
- Whether your company or product category is missing.
- What content could improve visibility.

### 9. Skeptic Mode

The agent should actively prevent overreaction.

It should flag:

- Old news.
- Weak evidence.
- Cosmetic website edits.
- Signals from unreliable sources.
- Changes that do not affect your ICP.
- Competitor moves that are irrelevant to your current strategy.

This is important because founders can waste time reacting to every competitor movement.

### 10. Learning Loop

After a recommendation, track:

- Did the founder approve it?
- Was the action completed?
- Did sales use the battlecard?
- Did reply rate improve?
- Did win rate change?
- Did website traffic or conversion improve?
- Did the competitor keep moving in that direction?

Over time, the agent learns which competitor signals actually matter.

### 11. Agent Command Interface

The product should have one main agent interface with two ways to work:

| Mode | Purpose |
|---|---|
| Structured UI Mode | Lets users browse the planned product views: overview, competitors, signals, counter-moves, battlecards, and decision logs. |
| Agent Chat Mode | Lets users talk directly to the AI agent and ask it to fetch, analyze, generate, or execute actions. |

This matters because many users now expect to operate software through a chat window, especially when the product is already agentic. The chat should not feel like a separate support bot. It should be another way to control the whole product.

In Agent Chat Mode, users can ask things like:

```text
What did our top competitor change this week?
I do not have a company yet, but I am building an AI receptionist for dental clinics. Find competitors.
Here is my product idea and ICP. Which competitors should I track first?
Why are we losing deals against Competitor X?
Create a new battlecard for Competitor Y.
Find accounts we should target after Competitor Z raised prices.
Check our docs, CRM notes, and competitor pages before recommending a move.
```

The UI should show the agent's work as it happens, similar to an agentic coding interface:

```text
Reading your existing competitor profiles...
Fetching latest competitor website changes...
Querying Crustdata for company and people updates...
Checking internal lost-deal notes...
Comparing new evidence against previous baseline...
Scoring signal impact...
Preparing recommended counter-moves...
Generating battlecard draft...
Waiting for founder approval...
```

Each step should be visible as an activity row with status, source, and evidence:

- **Running**: the agent is currently fetching or analyzing.
- **Done**: the step completed and produced evidence.
- **Needs approval**: the agent wants confirmation before taking action.
- **Failed**: the source could not be fetched or needs reconnection.

The chat window should support real actions, not just answers:

- Approve, reject, edit, or verify suggested competitors.
- Approve a recommended move.
- Ask the agent to verify evidence.
- Create or update a battlecard.
- Generate a comparison page outline.
- Draft a customer email.
- Assign a decision card to a teammate.
- Create a Linear/Jira ticket.
- Save a target account list from Crustdata.
- Snooze, ignore, or watch a signal.

This gives the product two strong entry points:

- Users who like dashboards can inspect everything through structured views.
- Users who prefer agent workflows can simply chat and let the agent pull docs, database context, Crustdata intelligence, and web evidence in real time.

## Why This Can Win

- It is practical and easy to understand.
- It solves a real founder pain.
- It uses Crustdata naturally for competitor company and people intelligence.
- It is bigger than a simple dashboard because it recommends action.
- It has a strong demo moment: competitor changes something, the agent explains it, then creates the response.
- It has an intuitive agent interface: users can either browse the planned UI or directly chat with the agent and watch each step happen.
- It has a current 2026 angle: AI agents, real-time signals, and AI visibility/GEO.

## Where Crustdata Fits

Crustdata should be the trusted external intelligence layer.

- **Company Search**: discover direct, indirect, and emerging competitors.
- **Company Search from company or product idea context**: use the user's optional company name, website, ICP, category, geography, and product idea description to suggest likely competitors for approval.
- **Company Enrichment**: get headcount, funding, investors, hiring, growth, location, industry, and company profile.
- **Person Search**: find founders, executives, product leaders, GTM leaders, and recent strategic hires.
- **Person Enrichment**: understand key people and their background.
- **Web Search / Web Context**: pull fresh public context from competitor pages, launches, blogs, and news.
- **Signal tracking**: detect people movement, hiring changes, company updates, and market signals.

## Main Features

| Feature | What It Does |
|---|---|
| Competitor Setup | Lets users enter optional company details, describe an unreleased product idea, add known competitors manually, or ask the agent to find competitors automatically. |
| Product Idea Input | Lets pre-launch founders describe what they are building even if they do not have a company name, website, or launched product yet. |
| Competitor Auto-Finder | Suggests likely competitors from the user's company profile or product idea, Crustdata, web context, and AI/search evidence, then waits for approval before adding them. |
| Competitor Approval Queue | Shows suggested competitors as review cards with evidence, confidence, threat type, and approve/reject/edit/verify actions. |
| Competitor Map | Tracks direct, indirect, and emerging competitors. |
| Signal Feed | Shows meaningful competitor changes in one place. |
| Company Intel | Uses Crustdata to enrich competitors with business context. |
| People Movement Tracker | Watches leadership changes, key hires, promotions, and role changes. |
| Pricing Tracker | Detects pricing, packaging, trial, and enterprise-plan changes. |
| Positioning Diff | Compares homepage, landing page, and messaging changes over time. |
| Product Launch Detector | Tracks changelogs, docs, release notes, Product Hunt, GitHub, and help center updates. |
| Customer Sentiment Radar | Monitors Reddit, HN, reviews, social posts, and public complaints. |
| AI Visibility Monitor | Checks how the user's company, product category, and competitors appear in AI/search answers. |
| Counter-Move Planner | Recommends what the founder should do next. |
| Battlecard Generator | Creates live competitor battlecards for sales and positioning. |
| Founder Briefing | Gives a short daily/weekly summary: what matters, what to ignore, what to do. |
| Decision Log | Tracks which recommendations were acted on and what happened after. |
| Agent Chat | Lets users enter company or product idea details, find competitors, approve suggestions, fetch docs, query the database, use Crustdata, analyze evidence, and perform actions from one chat window. |
| Agent Activity Stream | Shows each step the agent is taking, including sources fetched, database checks, Crustdata calls, evidence found, and actions waiting for approval. |

## The Most Important Feature

The key feature is not monitoring.

The key feature is:

```text
Competitor move -> interpretation -> recommended founder action
```

Example:

```text
Competitor changed pricing and added enterprise language.
Crustdata shows they are hiring enterprise AEs and recently added a VP Sales.
Interpretation: they are moving upmarket.
Recommended action:
1. Update positioning for smaller teams.
2. Create a comparison page.
3. Generate a sales battlecard.
4. Use Crustdata to find accounts in the segment before they do.
```

## Signal Types To Track

- Pricing page changes.
- Homepage positioning changes.
- New landing pages.
- New case studies.
- New integrations.
- Product launches.
- Changelog updates.
- Docs/help center changes.
- Hiring spikes.
- New leadership hires.
- Founder or executive job changes.
- Funding announcements.
- Web traffic movement.
- Product Hunt launches.
- GitHub activity.
- Reddit/HN complaints.
- Review site sentiment.
- SEO/search movement.
- AI answer visibility.
- New partnerships.
- New geographies or industries targeted.

## Signal Scoring

Each signal should be scored using a simple formula:

```text
impact_score =
  0.25 * strategic relevance
+ 0.20 * freshness
+ 0.20 * source confidence
+ 0.15 * competitor importance
+ 0.10 * customer impact
+ 0.10 * actionability
```

Labels:

- **Act now**: important enough to respond this week.
- **Watch**: meaningful but not urgent.
- **Ignore**: probably noise.
- **Verify**: needs more evidence.

## Suggested UI Structure

Use one main agent interface with two options:

| Option | Purpose |
|---|---|
| Planned UI | Lets users see everything through structured screens and workflows. |
| Agent Chat | Lets users ask for the same work conversationally, while the UI shows each step the agent is taking. |

The planned UI can still contain four main views:

| View | Purpose |
|---|---|
| Overview | Founder briefing, top signals, and recommended actions. |
| Competitors | Competitor profiles enriched with Crustdata, plus suggested competitors waiting for approval. |
| Signals | Timeline of changes with evidence and impact score. |
| Counter-Moves | Action plans, battlecards, content drafts, and decision log. |

The Agent Chat view should sit beside these views and be able to control them. When the agent finds evidence, creates an artifact, or recommends an action, the result should appear as a rich UI card inside chat and also be saved into the relevant product view.

Optional advanced views:

- Pricing War Room.
- Product War Room.
- GTM War Room.
- AI Visibility War Room.

## Demo Flow

```text
1. Founder chooses an input path: existing company, unreleased product idea, manual competitors, or any mix of these.
2. Founder enters optional company URL/name if they have one.
3. Founder describes the product idea, ICP, category, geography, problem, and planned solution.
4. Founder adds known competitors manually, or skips this step.
5. Agent discovers likely direct, indirect, substitute, emerging, and enterprise competitors.
6. Founder approves, rejects, edits, or verifies the suggested competitors in UI or Agent Chat.
7. Approved competitors are added to the competitor map.
8. Crustdata enriches competitor companies and key people.
9. Agent detects important signals.
10. Agent ranks the signals by impact.
11. Founder opens one signal.
12. Agent explains what changed and why it matters.
13. Founder asks follow-up questions in Agent Chat.
14. Chat shows the agent fetching docs, querying Crustdata, checking internal data, and verifying evidence.
15. Agent generates a counter-move plan.
16. Founder approves an action directly from chat.
17. Founder gets a battlecard, positioning memo, and target account list.
```

## Best Demo Scenario

```text
Your startup sells AI voice agents for clinics.

Competitor signal:
One competitor changed its homepage from "AI receptionist for small clinics" to "AI front office automation for multi-location healthcare groups."

Crustdata evidence:
- Competitor headcount is growing.
- They are hiring enterprise sales roles.
- A new GTM leader joined.
- Their web traffic is increasing.

Agent interpretation:
They are moving upmarket.

Recommended counter-move:
1. Defend the small-clinic wedge.
2. Create a comparison page.
3. Build a battlecard for sales calls.
4. Find 25 mid-market clinic groups using Crustdata before the competitor reaches them.
```

## Why It Is Different From Existing Tools

| Existing Tool Type | Limitation | This Product's Difference |
|---|---|---|
| Website change monitor | Shows changes without strategy. | Explains business impact and next action. |
| Enterprise CI platform | Often built for large sales/product marketing teams. | Built for founders and small teams. |
| Battlecard tool | Battlecards become stale. | Battlecards update from live signals. |
| SEO tool | Focuses mostly on search traffic. | Tracks product, pricing, people, hiring, sentiment, and AI visibility too. |
| Social listening tool | Gives noisy feeds. | Filters noise and recommends decisions. |

## Winning Positioning

Do not pitch it as:

```text
Competitor monitoring dashboard.
```

Pitch it as:

```text
An AI competitive operating system for founders.
```

Or:

```text
An AI chief of staff for competitor moves.
```

## Final Pitch

```text
Founders do not need another dashboard of competitor updates. They need to know which competitor moves matter and what to do next.

CounterOS monitors competitors across product, pricing, hiring, people, funding, positioning, customer sentiment, and AI visibility. Crustdata powers the company and people intelligence layer. The agent then scores every signal, explains the strategic impact, and recommends the next counter-move.

It is not just competitor tracking. It is a competitive operating system for founders.
```

## Product Name

The final product name is:

```text
CounterOS
```

Working tagline:

```text
Most tools tell you what changed. CounterOS tells you what changed, why it matters, and what counter-move to make next.
```

## Best Build Slice

For a strong demo, focus on this exact slice:

```text
Company or product idea profile
-> approved competitor suggestion
-> signal timeline
-> Crustdata company/person evidence
-> strategic interpretation
-> counter-move plan
-> agent chat with visible step-by-step work
-> battlecard or comparison-page draft
-> target accounts to attack using Crustdata
```

## Recommended Technical Stack

Use the Next.js stack as the main product surface.

| Layer | Choice | Why |
|---|---|---|
| Frontend | Next.js App Router | Keeps the product UI, layouts, server components, and chat experience in one codebase. |
| Backend APIs | Next.js App Router route handlers | Good fit for product APIs, Crustdata proxy endpoints, approval actions, and AI chat endpoints. |
| Auth | Auth.js/NextAuth credentials | Use email and password for the MVP. Store only minimal profile data and password hashes. Do not collect full address details. |
| Database | SQLite for MVP | Simple, local-friendly, and enough for early product state, cache records, approvals, and signal history. |
| ORM | Drizzle ORM | Typed schema, typed queries, migrations, and a cleaner path to Postgres later. |
| AI layer | Vercel AI SDK | Use for streaming chat, tool calling, structured outputs, and agent workflows. |
| Background jobs | BullMQ workers when needed | Use for long-running competitor discovery, enrichment, snapshots, signal polling, scoring, and scheduled briefings. |
| Queue backend | Redis through Docker Compose | Required for BullMQ locally and easy to run during development. |
| External data | Crustdata API | Main company and people intelligence layer. Keep API calls server-side. |
| Validation | Zod | Validate API inputs, AI outputs, and job payloads. |

Important database note:

```text
SQLite is the MVP database.
Postgres can come later, but treat it as a planned migration, not only a URL change.
Keep Drizzle schema choices portable and isolate the database adapter.
```

Important worker note:

```text
Next.js route handlers should handle request/response work.
BullMQ workers should handle durable background work.
```

Locally, run Redis with Docker Compose. In production, if the app is hosted on Vercel, run BullMQ workers separately on a persistent worker runtime such as Docker, Railway, Fly.io, Render, or another long-running server.

## Remaining Technical Needs

- **Auth and workspaces**: use Auth.js/NextAuth credentials auth for the MVP with email, password, optional display name, hashed passwords, and one default workspace per user. Add email verification, password reset, OAuth, passkeys, and multiple workspaces later.
- **Core schema**: create tables for users, workspaces, product profiles, competitors, suggested competitors, approval decisions, evidence, signals, artifacts, chats, messages, jobs, and API cache entries.
- **Agent tools**: define tools for competitor search, Crustdata enrichment, web context fetching, signal scoring, approval queue updates, artifact generation, and target account discovery.
- **Caching**: cache Crustdata responses, AI outputs where safe, page snapshots, and evidence records to control cost and make demos reliable.
- **Rate limits and retries**: prevent API overuse and make failed discovery/enrichment jobs retryable.
- **Observability**: track agent steps, sources fetched, token usage, job status, errors, and approval decisions.
- **Storage strategy**: keep small records in SQLite; move large website snapshots or generated documents to file/object storage later.
- **Search**: use SQLite full-text search first; consider Postgres plus pgvector later if semantic memory becomes a major feature.
- **Approval gates**: require user approval before adding competitors, creating public artifacts, sending messages, or writing to external tools.

## What To Avoid

- Do not build only an alerts dashboard.
- Do not track too many signals without prioritization.
- Do not make it a generic BI tool.
- Do not hide Crustdata usage.
- Do not generate strategy without evidence.
- Do not overwhelm the founder with noise.

## Final Recommendation

Build this idea as:

```text
CounterOS: a competitor intelligence agent for founders that tracks competitor moves, explains why they matter, and recommends what to do next.
```

The strongest winning angle:

```text
Most tools tell you what changed. CounterOS tells you what changed, why it matters, and what counter-move to make next.
```

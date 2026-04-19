# CounterOS Remaining Implementation Checklist

Updated: April 19, 2026

This is the working punch list for the API-first, empty-workspace version of CounterOS. Demo seed data has been removed; new workspaces are expected to start empty and fill from product input, APIs, jobs, and agent actions.

## Latest Verification Snapshot

- [x] `npm run typecheck` passes.
- [x] `npm run build` passes.
- [x] Local dev server responds on `http://localhost:3000`.
- [x] Empty database/login routing works: unauthenticated `/` redirects to `/login`.
- [x] Manual smoke pass completed on April 19, 2026: 25/25 checked flows passed after fixes.
- [x] Live agent smoke pass completed on April 19, 2026: temp user signed up, logged in, created a product profile, asked the agent for competitors, and then asked for a battlecard.
- [x] Live agent action smoke completed on April 19, 2026: approve suggestion, reject suggestion, provider discovery attempt, and tracked-page snapshot all returned controlled chat responses with run steps.
- [x] Live AI SDK streaming smoke completed on April 19, 2026: approve, reject, track+snapshot, provider discovery tool event, artifact save, persistence, and cleanup passed.
- [x] Temporary smoke-test account data was cleaned up after the run.
- [ ] `npm audit --omit=optional` still reports 4 moderate `drizzle-kit` transitive `esbuild` advisories; `npm audit fix --force` would downgrade `drizzle-kit` and is not safe to run blindly.

## Phase 3: Core Product CRUD APIs

- [x] Signup creates a user and empty workspace transactionally.
- [x] Login works through NextAuth credentials with SQLite-backed users.
- [x] Stale sessions are rejected when the SQLite user row no longer exists.
- [x] Product profile GET returns 404 before setup instead of crashing.
- [x] First product profile can be created through `PATCH /api/product-profile` with all fields.
- [x] Existing product profile can be patched partially.
- [x] Manual competitor list/create/read/update/delete APIs.
- [x] Competitor duplicate-domain conflict handling.
- [x] Suggested competitor list/create/read/update/delete APIs.
- [x] Suggested competitor decision API for approve/reject/verify/ignore/snooze.
- [x] Approving a suggestion creates an approved competitor.
- [ ] Add automated route-level tests for auth, workspace scoping, validation, not-found, and conflict cases.

## Phase 4: Crustdata Client And Company Intelligence

- [x] Server-only Crustdata HTTP client.
- [x] Crustdata timeout/retry handling.
- [x] Successful-response API cache helpers.
- [x] Company Identify/Search/Enrich wrappers.
- [x] Crustdata status fields and migrations for suggestions and approved competitors.
- [x] Manual competitor suggestion resolves through Company Identify when `CRUSTDATA_API_KEY` is configured.
- [x] Approved competitors attempt Company Enrich after approval.
- [x] Manual competitor enrichment retry endpoint.
- [x] Dashboard status UI for unresolved/resolved/enriched/no match/failed.
- [x] Crustdata route failures now return controlled JSON responses instead of uncaught 500s.
- [ ] Validate `/api/suggested-competitors/discover` against the current Crustdata Company Search filter allowlist. Current smoke returns a controlled `502` provider error, not a successful discovery result.
- [ ] Add provider-contract tests/mocks for Identify, Search, Enrich, Jobs Search, and provider error bodies.

## Phase 5: AI Agent, Structured Outputs, And Tool Calls

- [x] Structured output schemas for competitor suggestions, signal explanations, counter-move plans, battlecards, target-account requests, and agent activity.
- [x] Approval-safe agent prompt contracts.
- [x] Vercel AI SDK OpenAI provider is the active server-side model client.
- [x] Streaming chat route persists user and agent turns after AI SDK stream completion.
- [x] Saved chat history hydrates the AI SDK chat UI and is sent back as UI messages for multi-turn context.
- [x] Missing `OPENAI_API_KEY` fallback records activity and returns a UI message stream instead of crashing.
- [x] AI SDK tool outputs are used for side effects and streamed status, replacing direct Responses JSON output.
- [x] Assistant-history turns are handled through AI SDK UI messages, avoiding the older `output_text` history issue.
- [x] Agent-created suggestions and artifacts are persisted by explicit AI SDK tool calls.
- [x] Agent-created duplicate competitor suggestions are filtered server-side by existing domain/name.
- [x] Live agent smoke created 2 pending competitor suggestions and then a `Battlecard` artifact from the follow-up prompt.
- [x] AI SDK tools run explicit approve/reject suggestion actions from chat.
- [x] Agent approval action creates approved competitors and attempts Crustdata enrichment.
- [x] Agent provider discovery action calls Crustdata Company Search and records controlled provider failures in the run trace.
- [x] Agent tracked-page action can create tracked pages and snapshot them from chat.
- [x] Chat stream includes a Codex-style run trace for thinking, fetching, performing, saving, and final response steps.
- [x] Vercel AI SDK packages installed and wired for OpenAI provider chat streaming.
- [x] Chat route now streams AI SDK UI message parts through `createAgentUIStreamResponse`.
- [x] Agent now uses AI SDK `ToolLoopAgent` tools for approve/reject, provider discovery, competitor suggestion saves, artifact saves, page tracking, and page snapshots.
- [x] Direct OpenAI Responses API wrapper and old deterministic pre-action loop were removed from active code.
- [x] Agent chat UI renders streamed text, step-start markers, live tool input/output states, and final responses in the chat window.
- [x] Live AI SDK chat smoke completed on April 19, 2026: signup/login/profile, approve suggestion, reject suggestion, track+snapshot page, provider discovery failure handling, artifact save, DB persistence, and cleanup all passed.
- [ ] Add automated tests for fallback mode, malformed model JSON, suggestion persistence, and artifact persistence.
- [ ] Convert the live agent smoke into repeatable tests with mocked OpenAI responses and deterministic fixture expectations.
- [ ] Add agent actions for direct signal generation, competitor enrichment retries by name, and bulk page snapshots.
- [ ] Add explicit confirmation UI before destructive or high-cost agent-initiated actions beyond approve/reject that the user already requested.

## Phase 6: Signals From Jobs And People Movement

- [x] Deterministic signal scoring foundation.
- [x] Hiring and people-movement rule helpers.
- [x] Crustdata Jobs Search wrapper.
- [x] Crustdata Person Search wrapper.
- [x] Crustdata Person Enrich wrapper.
- [x] Jobs Search normalizer handles `job_listings` envelopes.
- [x] Hiring signal generation route returns a controlled response in smoke testing.
- [x] Persist generated signals with evidence and counter-move fields.
- [ ] Provider-backed people movement signal generation.
- [ ] Validate hiring signal quality against real competitor fixtures with known job listings.
- [ ] Add deduplication/idempotency for repeated generated signals from the same evidence.

## Phase 7: Web Context And Page Signals

- [x] Tracked page schema and migration.
- [x] Manual tracked URL API.
- [x] Duplicate tracked URL conflict handling.
- [x] Page fetch/snapshot helper.
- [x] Basic extracted-text diff helper.
- [x] Page snapshot API creates snapshots and can create page-change signals on meaningful diffs.
- [ ] Dashboard surface for tracked pages and page snapshot history.
- [ ] Add controls for pausing/removing tracked pages.
- [ ] Harden page fetching for robots policy, redirects, non-HTML pages, large pages, and timeout UX.

## Phase 8: Background Jobs, Scheduling, And Production Hardening

- [x] Job payload contracts.
- [x] Job idempotency helpers.
- [x] Queue-agnostic job status helpers.
- [x] Observability event types and lightweight logger.
- [x] Redis/BullMQ dependency and queue wiring.
- [x] Worker process entrypoint.
- [x] Bounded queues, retries, backoff, and duplicate prevention at the queue layer.
- [ ] Worker currently validates/emits events only; implement handlers for discovery, enrichment, jobs monitoring, person movement, page snapshots, signal scoring, and weekly briefings.
- [ ] Persist job run state if the UI should show job progress/history.
- [ ] Worker deployment plan separate from Vercel/serverless.
- [ ] Add scheduler/cron strategy for recurring monitoring.

## Product And UX Gaps

- [x] Dashboard handles null product profile and empty arrays without crashing.
- [x] Empty states exist for overview, competitors, signals, moves, artifacts, chat, and activity.
- [x] Dedicated `/signup` page exists.
- [x] Agent tab shows generated suggestions/artifacts as reviewable outputs.
- [x] Agent chat bubbles show per-run steps and final response in the conversation.
- [x] Agent output panel includes suggestions, artifacts, and tracked pages created by chat actions.
- [ ] First-run onboarding UI for product profile creation.
- [ ] UI controls for discovery jobs, signal generation, tracked pages, and retrying failed provider work.
- [ ] Dashboard should show tracked pages and recent snapshots.
- [ ] Better user-visible provider error copy for Crustdata/OpenAI failures.
- [ ] Account/session UX polish: explicit sign-out path, loading states after signup, and cookie/session reset guidance.

## Manual Smoke Pass: April 19, 2026

- [x] Signup API creates user and workspace.
- [x] Credentials login issues a session cookie.
- [x] Authenticated empty dashboard renders the API-sourced empty state.
- [x] Product profile missing, invalid create, and complete create flows.
- [x] Manual competitor create, duplicate conflict, patch, and delete.
- [x] Suggested competitor create and verify decision.
- [x] Suggested competitor approval creates approved competitor.
- [x] Competitor enrich endpoint responds without crashing.
- [x] Discovery route returns a controlled provider status, not an uncaught 500.
- [x] Signal generation route returns a controlled provider/success status.
- [x] Signal list route.
- [x] Chat route persists a turn.
- [x] Live chat route creates pending competitor suggestions from an authenticated agent request.
- [x] Live second-turn agent request uses recent context and creates a battlecard artifact.
- [x] Live chat approve action marks a suggestion approved and returns an approved competitor.
- [x] Live chat reject action marks a suggestion rejected.
- [x] Live chat provider discovery action returns a controlled response when Crustdata discovery fails.
- [x] Live chat track-and-snapshot action creates a tracked page and initial snapshot.
- [x] Artifacts list route.
- [x] Tracked page create, duplicate conflict, list, and snapshot.
- [ ] Convert this smoke pass into repeatable API integration tests.

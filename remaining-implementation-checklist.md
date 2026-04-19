# Counterless Remaining Implementation Checklist

Updated: April 19, 2026

This is the single checklist for what remains before the product moves into a dedicated testing pass. Keep `implementation-phases.md` as the phase roadmap and use this file as the working punch list.

## Phase 3: Core Product CRUD APIs

- [x] Product profile read/update API.
- [x] Manual competitor create/update/delete APIs.
- [x] Suggested competitor create/update/delete APIs.
- [x] Suggested competitor approve/reject decision API.
- [x] Suggested competitor verify action.
- [x] Suggested competitor ignore action.
- [x] Suggested competitor snooze action.
- [ ] Route-level tests for auth, workspace scoping, not-found, and conflict cases.

## Phase 4: Crustdata Client And Company Intelligence

- [x] Server-only Crustdata HTTP client.
- [x] Crustdata timeout/retry handling.
- [x] Successful-response API cache helpers.
- [x] Company Identify/Search/Enrich wrappers.
- [x] Crustdata status fields and migration for suggestions and approved competitors.
- [x] Manual competitor add resolves through Company Identify when `CRUSTDATA_API_KEY` is configured.
- [x] Approved competitors enrich through Company Enrich after approval.
- [x] Manual retry endpoint for competitor enrichment.
- [x] Company Search endpoint for competitor discovery and target-account requests.
- [x] Dashboard status UI for unresolved/resolved/enriched/no match/failed.

## Phase 5: AI Agent, Structured Outputs, And Tool Calls

- [x] Structured output schemas for competitor suggestions, signal explanations, counter-move plans, battlecards, target-account requests, and agent activity.
- [x] Approval-safe agent prompt contracts.
- [x] Server-side OpenAI client.
- [x] Real chat response generation using `OPENAI_API_KEY`.
- [x] Agent creates suggested competitor cards from chat requests without approving them.
- [x] Agent generates battlecard/target-account artifacts from signal context.
- [x] Persist agent activity steps from chat.
- [x] Dashboard merges agent-created suggestions and artifacts after chat.

## Phase 6: Signals From Jobs And People Movement

- [x] Deterministic signal scoring foundation.
- [x] Hiring and people-movement rule helpers.
- [x] Crustdata Jobs Search wrapper.
- [x] Crustdata Person Search wrapper.
- [x] Crustdata Person Enrich wrapper.
- [x] Provider-backed hiring signal generation.
- [ ] Provider-backed people movement signal generation.
- [x] Persist generated signals with evidence and confidence.

## Phase 7: Web Context And Page Signals

- [x] Tracked page schema and migration.
- [x] Manual tracked URL API.
- [x] Page fetch/snapshot helper.
- [x] Basic extracted-text diff helper.
- [x] Page-change signal generation.
- [ ] Dashboard surface for tracked pages and page-change signals.

## Phase 8: Background Jobs, Scheduling, And Production Hardening

- [x] Job payload contracts.
- [x] Job idempotency helpers.
- [x] Queue-agnostic job status helpers.
- [x] Observability event types and lightweight logger.
- [x] Redis/BullMQ dependency and queue wiring.
- [x] Worker process entrypoint.
- [ ] Jobs for discovery, enrichment, jobs monitoring, person movement, page snapshots, signal scoring, and weekly briefings.
- [x] Bounded queues, retries, backoff, and duplicate prevention.
- [ ] Worker deployment plan separate from Vercel serverless.

## Testing Gate

- [x] Run database migration from a clean database.
- [x] Seed demo workspace.
- [x] Run `npm run typecheck`.
- [x] Run `npm run build`.
- [ ] Add API integration tests.
- [ ] Smoke-test signup/login, manual competitor add, approval/enrichment, chat suggestion creation, artifact generation, and page tracking.
- [ ] Resolve dev dependency audit advisory without downgrading `drizzle-kit`.

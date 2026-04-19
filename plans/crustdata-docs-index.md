# Crustdata Docs Index For Counterless

Prepared: April 19, 2026

This file maps the Crustdata docs to the Counterless implementation. It exists so a future chat/thread can quickly find the right page for a specific integration task.

## Global Integration Rules

Base URL:

```text
https://api.crustdata.com
```

Required headers for the new API docs:

```text
authorization: Bearer YOUR_API_KEY
content-type: application/json
x-api-version: 2025-11-01
```

Counterless rules:

- Keep `CRUSTDATA_API_KEY` server-side only.
- Centralize all Crustdata calls in one server-side client.
- Cache successful responses in `api_cache_entries`.
- Prefer free/low-cost endpoints first.
- Use Autocomplete to find exact filter values.
- Use Identify to resolve ambiguous companies for free.
- Use Search for discovery and lists.
- Use Enrich only for approved competitors, selected people, or records the user explicitly wants.
- Always specify `fields` in production requests.
- Add backoff and throttling before background polling.

Important footguns:

- Most endpoints require `x-api-version: 2025-11-01`.
- Greater-than-or-equal is `=>`, not `>=`.
- Less-than-or-equal is `=<`, not `<=`.
- Search endpoints are billed per result returned, so control `limit`.
- Company Search country fields use ISO3 country values like `USA`; Person Search examples use full country strings like `United States`.
- Some endpoint pages describe current behavior differently from quickstarts/examples. Build response normalizers that tolerate either a top-level array or an object containing `results` where the docs are inconsistent.
- Current docs say exact limits/pricing may vary by plan, entitlement, and endpoint version. Verify the active dashboard before production usage.

## Which Doc To Use For What

| Need | Use This Doc | URL | Counterless Use |
|---|---|---|---|
| Understand the public API areas | Introduction | https://docs.crustdata.com/general/introduction | High-level map of Company, Person, and Web APIs. Use when onboarding a future developer. |
| Company API overview | Company quickstart | https://docs.crustdata.com/company-docs/quickstart | Learn the four company endpoints and common flow: Autocomplete -> Search -> Enrich, or Identify -> Search. |
| Company discovery and target lists | Company Search | https://docs.crustdata.com/company-docs/search | Competitor suggestions, adjacent market scans, target account lists, segmentation by industry, geography, funding, headcount, and competitors. |
| Full company profile | Company Enrich | https://docs.crustdata.com/company-docs/enrichment | Approved competitor profiles with headcount, funding, hiring, people, competitors, news, SEO, traffic, reviews, and more. |
| Resolve company from partial input | Company Identify | https://docs.crustdata.com/company-docs/identify | Normalize user-entered competitor domains/names/profile URLs before adding them to the approval queue. Free endpoint. |
| Build company filter UI | Company Autocomplete | https://docs.crustdata.com/company-docs/autocomplete | Discover exact values for company industries, countries, company types, funding stages, and names. Free endpoint. |
| Company workflow examples | Company Examples | https://docs.crustdata.com/company-docs/examples | Copy patterns for Autocomplete -> Search -> Enrich and Inbound domain -> Identify -> Search similar companies. |
| Person API overview | Person quickstart | https://docs.crustdata.com/person-docs/quickstart | Understand Person Search, Person Enrich, Autocomplete, and live endpoint access boundaries. |
| People discovery | Person Search | https://docs.crustdata.com/person-docs/search | Find founders, executives, GTM leaders, product leaders, and strategic hires at competitors. |
| Full person profile | Person Enrichment | https://docs.crustdata.com/person-docs/enrichment | Enrich selected people from profile URLs or business emails after the signal matters. |
| Build people filter UI | Person Autocomplete | https://docs.crustdata.com/person-docs/autocomplete | Discover exact current titles, employer names, seniority levels, functions, locations, schools, skills, and more. Free endpoint. |
| Person workflow examples | Person Examples | https://docs.crustdata.com/person-docs/examples | Copy patterns for Autocomplete -> Search -> Enrich and Business email -> Enrich. |
| Jobs API overview | Jobs quickstart | https://docs.crustdata.com/job-docs/quickstart | Understand the job record shape and why hiring signals include company firmographics in each result. |
| Hiring signal discovery | Search Jobs | https://docs.crustdata.com/job-docs/search | Track competitor hiring, role mix, new geographies, GTM hiring, engineering/product hiring, and hiring trend counts. |
| Rate-limit design | Rate limits | https://docs.crustdata.com/general/rate-limits | Build throttling, queues, retry, and rollout strategy. Baseline defaults are 15 requests/minute for listed endpoints. |
| Credit planning | Pricing | https://docs.crustdata.com/general/pricing | Estimate Crustdata usage and choose cheap search/identify/autocomplete before enrich. |

## Endpoint Summary

| Area | Endpoint | Purpose | Credit Notes | Counterless Phase |
|---|---|---|---|---|
| Company | `POST /company/search` | Search companies using structured filters, fields, sorts, limits, and cursor pagination. | 0.03 credits per result returned. | Phase 4 |
| Company | `POST /company/search/autocomplete` | Discover valid values for Company Search filters. | Free. | Phase 4 |
| Company | `POST /company/enrich` | Return full company profile from domains, names, profile URLs, or Crustdata company IDs. | 2 credits per record. | Phase 4 |
| Company | `POST /company/identify` | Resolve domain/name/profile URL/company ID to matched company records. | Free. | Phase 4 |
| Person | `POST /person/search` | Search people by name, title, company, location, skills, experience, and more. | 0.03 credits per result returned. | Phase 6 |
| Person | `POST /person/search/autocomplete` | Discover valid Person Search filter values. | Free. | Phase 6 |
| Person | `POST /person/enrich` | Enrich a person by profile URL or business email. | 1-7 credits per profile depending on requested data. | Phase 6 |
| Job | `POST /job/search` | Search indexed job listings with filters, fields, sorting, pagination, and aggregations. | 0.03 credits per result returned. | Phase 6 |
| Web | `POST /web/search/live` | Web search. | Pricing page says 1 credit per query and self-serve availability. | Phase 7 |
| Web | `POST /web/enrich/live` | Fetch web page content. | Pricing page says 1 credit per page and self-serve availability. | Phase 7 |

## Company APIs

### Company Quickstart

URL: https://docs.crustdata.com/company-docs/quickstart

Use for:

- High-level Company API orientation.
- Endpoint comparison:
  - Search: find companies by filters.
  - Autocomplete: discover valid filter values.
  - Enrich: full company profile from known identifier.
  - Identify: resolve partial info to company records.
- Shared auth/header rules.
- Common footguns like ISO3 countries and `=>` / `=<` operators.

Counterless mapping:

- Read before building the Phase 4 Crustdata client.
- Use the workflow guidance to order discovery:
  - Autocomplete for exact values.
  - Search for discovery and suggestions.
  - Identify for user-entered competitors.
  - Enrich only selected/approved competitors.

### Company Search

URL: https://docs.crustdata.com/company-docs/search

Endpoint:

```text
POST /company/search
```

Use for:

- Competitor auto-finder.
- Similar-company and adjacent-company discovery.
- Target account list generation.
- Market scans by country, industry, funding, headcount, year founded, followers, competitors, and more.

Request shape:

```json
{
  "filters": {
    "op": "and",
    "conditions": [
      { "field": "taxonomy.professional_network_industry", "type": "=", "value": "Software Development" },
      { "field": "locations.hq_country", "type": "in", "value": ["USA"] }
    ]
  },
  "fields": [
    "crustdata_company_id",
    "basic_info.name",
    "basic_info.primary_domain",
    "headcount.total",
    "funding.total_investment_usd"
  ],
  "sorts": [{ "column": "headcount.total", "order": "desc" }],
  "limit": 20
}
```

Response shape:

```text
{ companies, next_cursor, total_count }
```

Important fields for Counterless:

- `crustdata_company_id`
- `basic_info.name`
- `basic_info.primary_domain`
- `basic_info.website`
- `basic_info.year_founded`
- `basic_info.employee_count_range`
- `basic_info.industries`
- `taxonomy.professional_network_industry`
- `taxonomy.categories`
- `headcount.total`
- `roles.distribution`
- `roles.growth_6m`
- `roles.growth_yoy`
- `locations.hq_country`
- `locations.largest_headcount_country`
- `funding.total_investment_usd`
- `funding.last_round_amount_usd`
- `funding.last_fundraise_date`
- `funding.last_round_type`
- `followers.count`
- `followers.yoy_percent`
- `competitors.company_ids`
- `competitors.websites`

Implementation notes:

- Always set `fields`.
- Use cursor pagination through `next_cursor`.
- Keep filters, fields, sorts, and limit stable while paginating.
- Use stable sorts when paginating.
- Handle empty results as successful `200` responses.

### Company Enrich

URL: https://docs.crustdata.com/company-docs/enrichment

Endpoint:

```text
POST /company/enrich
```

Use for:

- Detailed approved competitor profile.
- Strategic evidence on headcount, funding, hiring, people, competitors, news, traffic, SEO, reviews, and more.
- Full context for signal interpretation and battlecards.

Supported identifiers:

- `domains`
- `names`
- `professional_network_profile_urls`
- `crustdata_company_ids`

Request example:

```json
{
  "domains": ["retool.com"],
  "fields": ["basic_info", "headcount", "funding", "hiring", "people", "competitors", "news"]
}
```

Response shape:

```text
[
  {
    matched_on,
    match_type,
    matches: [
      { confidence_score, company_data }
    ]
  }
]
```

Key `company_data` sections:

- `basic_info`
- `headcount`
- `funding`
- `locations`
- `taxonomy`
- `revenue`
- `hiring`
- `followers`
- `seo`
- `competitors`
- `social_profiles`
- `web_traffic`
- `employee_reviews`
- `people`
- `news`
- `software_reviews`
- `status`

Implementation notes:

- Submit exactly one identifier type per request.
- Use `exact_match: true` for strict domain matching when appropriate.
- For name-based enrichment, inspect `confidence_score` and `primary_domain`.
- Multi-company enrich is allowed as multiple values in the same identifier array.
- Some docs/examples mention a `results` wrapper, while the endpoint page says current behavior is a top-level array. Normalize both.

### Company Identify

URL: https://docs.crustdata.com/company-docs/identify

Endpoint:

```text
POST /company/identify
```

Use for:

- Free company resolution before paid enrich.
- Deduplication of user-entered competitor names/domains.
- Turning a company domain/profile URL/name into a Crustdata company ID.

Supported identifiers:

- `domains`
- `names`
- `professional_network_profile_urls`
- `crustdata_company_ids`

Response shape:

```text
[
  {
    matched_on,
    match_type,
    matches: [
      { confidence_score, company_data }
    ]
  }
]
```

Implementation notes:

- Current docs say Identify returns match metadata plus `company_data.basic_info`, not a full company profile.
- Use Identify first for ambiguous inputs, then pass the chosen `crustdata_company_id` into Enrich if full profile is needed.
- No-match can be `200` with empty `matches`, and the OpenAPI spec also defines `404`. Handle both.

### Company Autocomplete

URL: https://docs.crustdata.com/company-docs/autocomplete

Endpoint:

```text
POST /company/search/autocomplete
```

Use for:

- Filter dropdowns and typeahead in the Counterless discovery UI.
- Exact industry, country, company type, funding stage, and company-name values before Search.

Request example:

```json
{
  "field": "basic_info.industries",
  "query": "software",
  "limit": 5
}
```

Common autocomplete fields:

- `basic_info.industries`
- `basic_info.name`
- `taxonomy.professional_network_industry`
- `locations.country`
- `basic_info.company_type`
- `funding.last_round_type`
- `headcount.latest_count`
- `followers.latest_count`

Implementation notes:

- Response is `{ "suggestions": [{ "value": "..." }] }`.
- Use returned `value` exactly in Search filters.
- Empty `query` returns common values by frequency.
- Optional `filters` can narrow suggestions.

### Company Examples

URL: https://docs.crustdata.com/company-docs/examples

Use for:

- End-to-end workflow references.
- Autocomplete -> Search -> Enrich.
- Inbound domain -> Identify -> Search similar companies.
- Error handling and retry decision table.
- Stable pagination examples.

Counterless mapping:

- Use these examples when implementing competitor auto-finder and similar-company discovery.
- Use the error handling table when building the Crustdata client.

## Person APIs

### Person Quickstart

URL: https://docs.crustdata.com/person-docs/quickstart

Use for:

- Person API overview.
- Difference between Search, Enrich, and Autocomplete.
- Access boundary for live endpoints.

Counterless mapping:

- Use before Phase 6 people movement implementation.
- The normal first workflow is Person Search -> Person Enrich only for people who matter.

### Person Search

URL: https://docs.crustdata.com/person-docs/search

Endpoint:

```text
POST /person/search
```

Use for:

- Finding founders, executives, GTM leaders, product leaders, and sales leaders.
- People movement signals.
- Detecting competitor hiring or leadership changes.
- Finding specific roles at approved competitor companies.

Request example:

```json
{
  "filters": {
    "op": "and",
    "conditions": [
      { "field": "experience.employment_details.current.company_name", "type": "in", "value": ["Retool"] },
      { "field": "experience.employment_details.current.title", "type": "(.)", "value": "VP|Director|Head of" }
    ]
  },
  "fields": [
    "basic_profile.name",
    "experience.employment_details.current.title",
    "experience.employment_details.current.company_name",
    "social_handles.professional_network_identifier.profile_url"
  ],
  "limit": 20
}
```

Response shape:

```text
{ profiles, total_count, next_cursor }
```

Useful filters:

- `basic_profile.name`
- `basic_profile.location.country`
- `basic_profile.location.full_location`
- `experience.employment_details.company_name`
- `experience.employment_details.title`
- `experience.employment_details.current.company_name`
- `experience.employment_details.current.title`
- `experience.employment_details.current.seniority_level`
- `experience.employment_details.current.function_category`
- `recently_changed_jobs`
- `metadata.updated_at`

Operators:

- `=`
- `!=`
- `>`
- `<`
- `in`
- `not_in`
- `(.)`
- `geo_distance`

Implementation notes:

- `experience.employment_details.company_name` searches current and past employers.
- Use current-specific fields when you only want current roles.
- Use `geo_distance` on `professional_network.location.raw`.
- Use `post_processing` to exclude known names/profile URLs in repeat searches.
- Preview mode is premium/plan-gated and may return a 400 if not enabled.

### Person Enrichment

URL: https://docs.crustdata.com/person-docs/enrichment

Endpoint:

```text
POST /person/enrich
```

Use for:

- Full person profile for selected strategic people.
- Reverse lookup from business email when needed.
- Deeper evidence for leadership-change or strategic-hire signals.

Supported identifiers:

- `professional_network_profile_urls`
- `business_emails`

Request example:

```json
{
  "professional_network_profile_urls": [
    "https://www.linkedin.com/in/example/"
  ]
}
```

Response shape:

```text
[
  {
    matched_on,
    match_type,
    matches: [
      { confidence_score, person_data }
    ]
  }
]
```

Key `person_data` sections:

- `basic_profile`
- `professional_network`
- `social_handles`
- `experience`
- `education`
- `skills`
- `contact`
- `dev_platform_profiles`

Implementation notes:

- Batch size is up to 25 identifiers per request.
- Use one identifier type per request.
- Business email reverse lookup can use `min_similarity_score`.
- Contact and developer-platform data can add credits; request only what the workflow needs.
- No-match returns an entry with empty `matches`.
- Advanced flags `force_fetch` and `enrich_realtime` exist but behavior can vary by cache state and account access. Avoid relying on them until tested.

### Person Autocomplete

URL: https://docs.crustdata.com/person-docs/autocomplete

Endpoint:

```text
POST /person/search/autocomplete
```

Use for:

- Person filter builders.
- Exact current title, seniority, function, company, location, school, skill, certification, or social-handle values.

Request example:

```json
{
  "field": "experience.employment_details.current.title",
  "query": "VP",
  "limit": 5
}
```

Common autocomplete fields:

- `experience.employment_details.current.title`
- `experience.employment_details.current.name`
- `experience.employment_details.current.company_name`
- `experience.employment_details.current.seniority_level`
- `experience.employment_details.current.function_category`
- `experience.employment_details.current.company_industries`
- `experience.employment_details.current.company_type`
- `experience.employment_details.current.company_website_domain`
- `experience.employment_details.past.title`
- `experience.employment_details.past.name`
- `basic_profile.name`
- `basic_profile.headline`
- `basic_profile.location.city`
- `basic_profile.location.state`
- `basic_profile.location.country`
- `professional_network.location.city`
- `professional_network.location.country`
- `education.schools.school`
- `skills.professional_network_skills`
- `certifications.name`
- `social_handles.twitter_identifier.slug`

Implementation notes:

- Response is `{ "suggestions": [{ "value": "..." }] }`; some API reference pages may include `document_count`, so tolerate it as optional.
- Use `value` verbatim in Person Search.
- Empty `query` returns common values; filter out blank string suggestions in the UI.
- Top-level autocomplete `field` has an allowlist; `filters.field` can use broader Person Search fields.

### Person Examples

URL: https://docs.crustdata.com/person-docs/examples

Use for:

- Autocomplete -> Search -> Enrich workflow.
- Business email -> Enrich workflow.
- Error handling and retry decision table.

Counterless mapping:

- Use this for the Phase 6 leadership/people movement implementation.
- Follow the pattern of searching first, extracting profile URLs, and enriching only top matches.

## Jobs APIs

### Jobs Quickstart

URL: https://docs.crustdata.com/job-docs/quickstart

Use for:

- Mental model of a job record.
- Understanding job fields and company firmographics included in each job result.
- Choosing jobs search patterns.

Important model:

- `crustdata_job_id` is the stable job ID.
- `company.basic_info.crustdata_company_id` is the stable company ID returned on each job.
- `company.basic_info.company_id` is the filter alias for that same company ID in `/job/search`.
- `metadata.date_added` is when Crustdata first indexed the listing, not necessarily when the employer posted it.

Counterless mapping:

- Use Jobs Search for hiring signals without enriching every company result.

### Search Jobs

URL: https://docs.crustdata.com/job-docs/search

Endpoint:

```text
POST /job/search
```

Use for:

- Hiring signal feed.
- Detecting competitor GTM hiring.
- Detecting product/engineering investment.
- Detecting new geography or market entry.
- Aggregated hiring counts for briefings.

Request example:

```json
{
  "filters": {
    "op": "and",
    "conditions": [
      { "field": "company.basic_info.company_id", "type": "=", "value": 631394 },
      { "field": "job_details.category", "type": "=", "value": "Engineering" },
      { "field": "metadata.date_added", "type": "=>", "value": "2025-01-01" }
    ]
  },
  "fields": [
    "job_details.title",
    "job_details.url",
    "company.basic_info.name",
    "location.raw",
    "metadata.date_added"
  ],
  "sorts": [{ "column": "metadata.date_added", "order": "desc" }],
  "limit": 20
}
```

Response shape:

```text
{ job_listings, next_cursor, total_count, aggregations? }
```

Important operators:

- `=`
- `!=`
- `<`
- `=<`
- `>`
- `=>`
- `in`
- `not_in`
- `is_null`
- `is_not_null`
- `(.)` all-words match
- `[.]` exact-phrase match

Useful fields:

- `crustdata_job_id`
- `job_details.title`
- `job_details.category`
- `job_details.workplace_type`
- `job_details.url`
- `company.basic_info.company_id`
- `company.basic_info.crustdata_company_id`
- `company.basic_info.name`
- `company.basic_info.primary_domain`
- `company.basic_info.industries`
- `company.headcount.total`
- `company.funding.*`
- `company.revenue.*`
- `location.raw`
- `location.country`
- `location.city`
- `content.description`
- `metadata.date_added`
- `metadata.date_updated`

Implementation notes:

- Always send `fields`; job records are large.
- Use `limit: 0` with `aggregations` for counts only.
- For "companies hiring for both role X and role Y", run two queries and intersect company IDs client-side.
- Use `[.]` for short acronyms like SDR to avoid broad overmatching.
- Sort by `metadata.date_added` for deterministic recency views.

## General Docs

### Rate Limits

URL: https://docs.crustdata.com/general/rate-limits

Use for:

- Shared Crustdata client throttling.
- Background job queue design.
- Retry and rollout planning.

Current public guidance:

- Default baseline is 15 requests per minute for listed endpoints.
- Spread traffic across the full minute.
- Use exponential backoff with jitter.
- Keep queues bounded.
- Add circuit breakers around non-critical enrichment.
- Cache stable results.

Counterless mapping:

- Phase 4 can start with conservative direct calls.
- Phase 8 should centralize rate limits in queue workers before scheduled polling.

### Pricing

URL: https://docs.crustdata.com/general/pricing

Use for:

- Credit estimation.
- Deciding whether to search, identify, autocomplete, or enrich.

Current public pricing summary:

- `/company/search`: 0.03 credits per result.
- `/company/search/autocomplete`: free.
- `/company/identify`: free.
- `/company/enrich`: 2 credits per record.
- `/person/search`: 0.03 credits per result.
- `/person/search/autocomplete`: free.
- `/person/enrich`: 1-7 credits per profile depending on requested data.
- `/job/search`: 0.03 credits per result.
- `/web/search/live`: 1 credit per query.
- `/web/enrich/live`: 1 credit per page.

Counterless cost strategy:

- Use Autocomplete freely for UI filter values.
- Use Identify freely for user-entered competitor resolution.
- Use Search with small limits for suggestions.
- Enrich only approved competitors.
- For people, enrich only selected strategic people and avoid contact add-ons unless needed.
- For jobs, request only fields needed for signal detection.
- Use cache aggressively for demo safety and credit control.

## Web APIs

The Introduction and Pricing docs mention Web APIs:

- `/web/search/live`
- `/web/enrich/live`

Pricing says both are available on self-serve plans. However, the public Web quickstart link redirected to login during review, so the detailed Web docs may require dashboard access.

Counterless mapping:

- Do not block Phase 1-6 on Web APIs.
- In Phase 7, use the dashboard/API reference to confirm request/response shape before coding.
- Web APIs are likely useful for homepage/pricing-page evidence, public page fetches, and AI/search visibility workflows.

## Recommended Counterless Crustdata Call Order

### Competitor Added Manually

```text
User enters domain/name/profile URL
-> /company/identify
-> save suggested competitor with confidence/evidence
-> founder approves
-> /company/enrich
-> save approved competitor profile
```

### Agent Finds Competitors From Product Idea

```text
Product idea + ICP + category + geography
-> optional /company/search/autocomplete for exact filter values
-> /company/search with small limit and selected fields
-> AI ranks suggestions and writes why each may be a competitor
-> founder approves/rejects
-> /company/enrich for approved competitors only
```

### Hiring Signal

```text
Approved competitor with crustdata_company_id
-> /job/search by company id, role/category, date window
-> save job evidence
-> score hiring signal
-> AI explains why it matters
```

### People Movement Signal

```text
Approved competitor
-> /person/search by current company + strategic title patterns
-> optionally /person/enrich selected profiles
-> save evidence
-> score strategic-hire or leadership-change signal
```

### Target Account List

```text
Founder chooses opportunity or counter-move
-> /company/search with ICP filters
-> optionally enrich top accounts
-> generate target account artifact
```

## Error Handling Cheatsheet

| Status/Case | Meaning | Counterless Behavior |
|---|---|---|
| `200` with empty list | No match or no results | Show no-match state; do not retry automatically. |
| `400` | Invalid field/operator/body | Log request, show developer/admin error, fix code/query. Do not retry. |
| `401` | Bad/missing API key | Show integration setup error. Do not retry. |
| `403` | Permission, plan, or credits issue | Show account/credits/permission error. Do not retry automatically. |
| `404` | No data found per OpenAPI spec for some enrich/identify flows | Treat like no-match and handle gracefully. |
| `429` | Rate limit | Retry after delay with backoff/jitter; slow queue. |
| `500` | Server error | Retry with exponential backoff, then mark failed. |

## Open Questions Before Real API Wiring

- Confirm active Crustdata plan limits in the dashboard.
- Confirm whether Web docs/API reference are accessible from the dashboard.
- Confirm whether the account has access to any live Company/Person endpoints.
- Confirm preferred Crustdata credit budget per demo run.
- Decide the first real demo industry and geography so we can build small, cheap queries.

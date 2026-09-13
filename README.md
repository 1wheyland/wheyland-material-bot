# Wheyland Electric Material Bot

Internal Next.js / Node 24 / TypeScript app for Vercel and PostgreSQL. It reads Jobber's daily visits and material sources, generates a structured OpenAI analysis, and creates a single **MATERIALS FOR THE DAY** calendar event at 6:00 AM Pacific on weekdays.

**Start with [SETUP.md](SETUP.md).** No credentials are included. Live writes default to disabled. The dashboard supports sign-in, Jobber OAuth, dry-run previews, manual event creation, and recent run status.

## Workflow

1. Vercel calls the protected scheduler at 12:45/50/55 and 13:45/50/55 UTC on weekdays. A Los Angeles time check accepts only 5:45–5:59 AM, handling daylight saving time. Later calls retry safe failures or skip an already claimed date.
2. Query A reads the day's visits with a `startAt.after/before` window and cursor pagination. The local day window uses calendar days, including 23/25-hour DST days. A one-second lower overlap plus exact local filtering protects midnight visits from exclusive `after` semantics.
3. Query B fetches each distinct job once, then completes every nested connection separately. Null quotes, requests, clients and job links are supported. Unexpected schema shapes or partial GraphQL errors stop the run.
4. One structured OpenAI response per job uses source IDs, exact excerpts, source priority, and explicit uncertainty. All of that job's visits are analyzed together. Standard rules start empty; no invented Wheyland practices are installed.
5. The report groups by employee and aggregates purchasing categories without multiplying shared crew materials. The full list and a durable write intent are saved before one `eventCreate` call.

## Safety and operational behavior

- OAuth authorization code flow with one-time state, browser binding, PKCE S256 and account allowlisting. AES-256-GCM encrypts access/refresh tokens in PostgreSQL.
- Atomic refresh ownership prevents concurrent redemption of a rotating token. A lost refresh response or abandoned refresh requires reconnection; old tokens are never blindly reused.
- Unique `(account_id, local_date)` record and fenced leases protect overlapping runs. `creating`, `uncertain` and `created` are never automatically retried.
- Jobber's verified schema has no event update/delete or idempotency key. **A strict exactly-once guarantee across Jobber and PostgreSQL is impossible after a lost response.** This app chooses duplicate prevention: stop, inspect Jobber, and reconcile. Normal successful runs create one event; an ambiguous run can leave zero or one pending review.
- Read retries respect HTTP 429 / Retry-After and GraphQL cost/throttle data. Writes and token exchanges are never retried automatically. Processing has a 240-second budget under a 300-second Vercel function limit; oversized sources/reports fail visibly rather than truncate.
- REQUIRED, LIKELY-STANDARD and VERIFY are distinct. Unknown stock/supplier remains VERIFY; only explicit sourcing directions enter NEED TO BUY / CED. Optional quote items alone cannot establish REQUIRED. Exact evidence, unsupported count/specification checks and structured JSON reduce hallucination; semantic interpretation still needs business acceptance testing.
- All visit statuses are retained and shown; no undocumented status filter silently drops scheduled work. Job quantities are not multiplied by visit count. Review multi-phase jobs in acceptance testing.
- Default event duration is 15 minutes. An empty day produces one event stating no scheduled visits were found.
- Admin APIs use either a server-validated eight-hour HttpOnly session or an admin Bearer secret. Cookie writes require same-origin requests. Cron uses a separate Bearer secret. Login is globally limited to ten attempts/minute.
- Logs include only event codes, run IDs, dates and counts. Provider error bodies, tokens, scope text and request URLs are never intentionally logged by the application. Configure platform access-log redaction separately, especially for OAuth callback query strings.

## Project map

| Path | Purpose |
| --- | --- |
| `app/` | Dashboard and protected HTTP endpoints |
| `src/jobber/queries.ts` | Version-pinned Query A, Query B, event create/read |
| `src/jobber/data.ts` | Runtime validation and complete cursor pagination |
| `src/oauth.ts` | OAuth and refresh rotation coordination |
| `src/materials/` | Source hierarchy, structured schema, evidence checks, aggregation |
| `src/runs/` | Daily state machine, database ownership, collection and write-back |
| `migrations/001_initial.sql` | Durable PostgreSQL state |
| `config/standard-rules.json` | Business-approved standards, initially empty |
| `tests/` | Unit, mocked-provider and PostgreSQL-engine tests |

## Commands

```sh
pnpm install --frozen-lockfile
pnpm dev
pnpm typecheck
pnpm test
pnpm build
```

Tests use an embedded PostgreSQL engine (PGlite) for real SQL constraints, claims and token rotation, plus mocked Jobber responses. They do not call paid APIs, authorize an account or create events. The project has not been deployed or tested against live credentials in this workspace.

## Source basis

The supplied “Check Jobber API” conversation contains successful Query A/B responses on `2026-05-12`. Pagination metadata and continuation queries added here still require an authenticated live dry run. No live API call was made while building this project.

- [Jobber OAuth authorization](https://developer.getjobber.com/docs/building_your_app/app_authorization/)
- [Jobber refresh rotation](https://developer.getjobber.com/docs/building_your_app/refresh_token_rotation/)
- [Jobber rate limits](https://developer.getjobber.com/docs/using_jobbers_api/api_rate_limits/)
- [OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs)
- [Vercel cron management](https://vercel.com/docs/cron-jobs/manage-cron-jobs)
- [Vercel cron plan limits and timing](https://vercel.com/docs/cron-jobs/usage-and-pricing)

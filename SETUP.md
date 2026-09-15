# Setup and launch checklist

This is a single-company internal app. Complete these checks before enabling calendar writes. No live credentials are stored in this project.

## 1. Runtime and database

- [ ] Install Node.js 24 and pnpm 11.19.0. Run `pnpm install --frozen-lockfile` in this project.
- [ ] Create a PostgreSQL database (for example, a Vercel-connected PostgreSQL provider). Use an SSL connection with certificate verification; use the provider's recommended serverless pool URL and a compatible transaction pool if needed. The app uses atomic statements, not session advisory locks. Migration uses a transaction-scoped advisory lock.
- [ ] Use separate production and development/preview databases. Never connect preview deployments to production Jobber tokens or run records.
- [ ] Copy `.env.example` to `.env.local`, fill `DATABASE_URL`, then run `pnpm db:migrate`. Existing tables are preserved. Configure provider backups and verify restore procedures; losing the daily ledger can permit duplicate events.
- [ ] Run `pnpm typecheck`, `pnpm test`, and `pnpm build`.

## 2. Secrets

Generate three independent values locally. Use your password manager or these commands; keep the output private:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

- [ ] First value → `ADMIN_SECRET`; second → `CRON_SECRET`; third → `TOKEN_ENCRYPTION_KEY`.
- [ ] Keep `TOKEN_ENCRYPTION_KEY` backed up separately from the database. Changing it without re-encrypting stored records breaks token decryption. To replace a lost key, configure the new key and reconnect Jobber; do not delete daily run history.
- [ ] Create an OpenAI project API key and set `OPENAI_API_KEY`. Set `OPENAI_MODEL` to a Responses API model available to your account that supports structured outputs; the example uses `gpt-6-astra`. Configure spending limits in that OpenAI project.
- [ ] All environment variables are server-side. Do not add `NEXT_PUBLIC_` prefixes. Do not commit `.env.local` or paste credentials into chat, tickets, URLs, or screenshots.

## 3. Jobber app

- [ ] Open the Jobber Developer Center and use/create the internal app. Record `JOBBER_CLIENT_ID` and `JOBBER_CLIENT_SECRET` in the environment.
- [ ] Keep **refresh token rotation enabled**.
- [ ] In the developer console, grant the available read permissions for visits/schedule, users, clients/properties, jobs/line items/notes, quotes and requests, plus the write permission covering calendar `eventCreate`. Use the console's actual scope labels; do not invent scope strings. This app relies on the scopes configured there rather than supplying a scope parameter.
- [ ] In the account you intend to connect, run `query { account { id name } }` in GraphiQL. Copy the exact encoded `id` into `JOBBER_ACCOUNT_ID`. The callback rejects any other account.
- [ ] Set `JOBBER_GRAPHQL_VERSION=2026-05-12`, matching the prior live responses. Revalidate queries before changing versions.
- [ ] Set `APP_URL=https://YOUR-PRODUCTION-DOMAIN` and `JOBBER_CALLBACK_URL=https://YOUR-PRODUCTION-DOMAIN/api/oauth/callback`. Register that **exact** callback URL in Jobber. For local testing use a separately registered localhost URL if Jobber permits it, or an HTTPS development deployment and separate database.
- [ ] Connect from this app's **Connect / reconnect Jobber** button after signing in. This internal callback intentionally rejects unsolicited Marketplace flows without the app's state/browser cookie. Do not use the temporary developer-console test callback from the prior conversation.

## 4. Vercel

- [ ] Put this project in your private repository and import it into Vercel. Select this folder as the root directory, Next.js as framework and Node.js 24 as runtime. Use `pnpm install --frozen-lockfile` and `pnpm build`.
- [ ] Add every `.env.example` setting to the production environment, using the HTTPS callback above. Start with `ENABLE_EVENT_WRITES=false`. Redeploy after environment changes.
- [ ] Use a plan supporting per-minute cron precision/frequency and a 300-second function duration. Vercel's Hobby cron timing/frequency is unsuitable for this configuration; confirm your plan's current limits. Cron is best effort, not a guaranteed exact wake-up time.
- [ ] Deploy `vercel.json`. It schedules 12:45/50/55 and 13:45/50/55 UTC Monday–Friday; the app only accepts 5:45–5:59 AM Los Angeles time. The other UTC hour exits without collecting or writing. No seasonal cron edits are needed.
- [ ] Vercel automatically sends the configured `CRON_SECRET` as a Bearer authorization header. Ensure deployment protection allows Vercel's own cron invocation and does not block the OAuth redirect; verify in cron logs.
- [ ] Restrict Vercel project and database access to the internal team. Configure log retention/redaction so OAuth callback query parameters are not retained in access logs or external analytics. This app adds no analytics.
- [ ] Add an external uptime/job monitor that alerts the owner when there is no `created` run by 6:05 AM Pacific on a weekday, when a run is `failed`/`uncertain`, or when OAuth needs reconnecting. `/api/status` is admin-protected; keep its monitor credentials private. No external notification destination is configured by this scaffold.

## 5. Acceptance test before enabling writes

- [ ] Sign in, connect Jobber and confirm the dashboard says `ready`.
- [ ] Use **Preview materials** on a known weekday. September 9, 2026 is the historical date in the earlier conversation, if those records still exist. Preview reads Jobber and calls OpenAI, but does not reserve the date or create an event.
- [ ] Confirm all visits and employees are present, including unassigned visits. Test more than 25 visits, more than 10 assignees, and more than 25 notes/line items where available to validate continuation fields against the live schema.
- [ ] Compare job/quote/request sources with Jobber. Check a null quote/request, an optional quote item, a shared crew, two visits for one job, and a multi-phase job. Verify that service-call quantities are not treated as material counts. Test contradictory notes and missing gauge/length/brand/stock details.
- [ ] Review `config/standard-rules.json` with Wheyland and add only explicitly approved rules. It begins as `[]` because no company standards were supplied. Custom fields have a reserved priority but are not queried until their schema and semantics are provided.
- [ ] Confirm Jobber supports the `EventCreateInput` fields and `eventCreate { event { id } userErrors { message } }` payload in the pinned live schema. Query definitions are in `src/jobber/queries.ts`; the prior conversation verified input/create support but this deployment's mutation has not been executed.
- [ ] Confirm the tested description length fits Jobber. `MAX_EVENT_DESCRIPTION_CHARS=20000` is a conservative local guard, **not a verified Jobber limit**. Lower it if your account rejects that length; the app never silently truncates. Large schedules may require a durable multi-step worker before launch if they exceed 240 seconds.
- [ ] Set `ENABLE_EVENT_WRITES=true` and redeploy. Use **Create daily event** for the chosen weekday, then verify its exact title, description and 6:00–6:15 AM Pacific time in Jobber.
- [ ] Run the same date again and make two concurrent requests. There must still be one calendar event, with an `already_claimed` response on reruns.
- [ ] Verify at least one real scheduled weekday invocation and check logs for success before relying on it operationally.

## Manual API examples

Use a secure API client with `Authorization: Bearer <ADMIN_SECRET>` and JSON content type. The examples intentionally omit real secret values.

| Endpoint | Method | Body / behavior |
| --- | --- | --- |
| `/api/manual-test` | POST | `{"date":"2026-09-14","dryRun":true}` — safe preview, default is true |
| `/api/manual-test` | POST | `{"date":"2026-09-14","dryRun":false}` — one event, requires writes enabled |
| `/api/status` | GET | Connection state and latest 20 daily runs; no tokens or scope text |
| `/api/reconcile` | POST | `{"date":"2026-09-14","eventId":"ENCODED_ID"}` — verifies an existing event before saving it |
| `/api/cron` | GET | Requires CRON_SECRET, honors weekday/local-time gate; no date override |

Preview and create each fetch fresh Jobber sources; a preview is not a frozen snapshot. Repeated previews consume API usage. Reopening an existing daily event is not supported through the API.

## Recovery guide

**`OPENAI_QUOTA_EXCEEDED`**: check the OpenAI API project's available credits and spending limits. This is distinct from `OPENAI_RATE_LIMITED`, which is a temporary request limit. No automatic purchase or limit increase occurs. `OPENAI_KEY_INVALID` means the configured API key was rejected; `OPENAI_PERMISSION_DENIED` or `OPENAI_MODEL_UNAVAILABLE` means the key/project lacks the requested access. `OPENAI_REQUEST_REJECTED` requires checking the request/schema against the selected model. Error codes deliberately exclude raw provider messages and credentials.

**`failed`** means failure occurred before the write intent. Correct the configuration, source size, or provider problem and rerun. Scheduled 5:50/5:55 calls provide limited retry coverage.

**`processing`** has a five-minute lease. After expiry, a later run can take over; an old worker is fenced out of event creation. If the function budget is repeatedly exceeded, split collection/classification into a durable workflow before increasing production volume.

**`creating` or `uncertain`** means Jobber may have received the mutation. Never delete/reset the daily row just to rerun. Inspect that day's Jobber calendar for the exact title, time and `Material Bot reference` in the description. Obtain the event's encoded ID through Jobber/GraphiQL and POST it to `/api/reconcile`. The endpoint reads it from the connected account and verifies date, title and run marker before accepting it. If no event exists, have an operator verify the absence after any outstanding request has finished; manually create the event with the stored description/marker and then reconcile its ID. The app offers no automatic reset-to-retry endpoint.

**`OAUTH_RECONNECT_REQUIRED`** means a refresh was rejected, its outcome was lost, or a refresh owner disappeared. Reconnect using the dashboard. No old-token retry loop is attempted. An expired access token alone is refreshed automatically.

**`JOBBER_SCHEMA_MISMATCH` / `JOBBER_GRAPHQL_ERROR`**: inspect the matching query in Jobber's GraphiQL with the configured version. Keep provider error messages in private debugging sessions; the app intentionally does not log raw provider error bodies.

**`AI_INVALID_EVIDENCE`, `AI_INCOMPLETE_OR_REFUSED`**: no event is published. Review the source quality, model availability/output limits, and retry. The structured response is validated, but semantic material decisions still need spot checks.

**Database outage after a successful event write**: retain the database and restore connectivity. The committed `creating` row prevents re-creation; use reconciliation. Never restore a backup predating event creation and immediately resume writes without reconciling the calendar.

Retain the date/event ledger indefinitely unless all corresponding Jobber dates are permanently excluded from reruns. Descriptions contain internal/customer information: restrict database access and define a company retention policy; old descriptions can be nulled after successful creation while retaining event/date identifiers. Rotate admin/cron credentials as appropriate. Session cookies stop validating after an admin secret change.

## Van lists (September 2026)

The preview shows Tim’s Van and Niall’s Van, with evidence and full checks collapsed under Show sources. Jobber assignee first names Tim (or Timothy) and Niall route jobs to those vans. Curren-only jobs appear in a separate preview section named Curren and are excluded from both calendar events. Other unmatched assignments appear under Needs van assignment. Shared Tim/Niall jobs appear on both vans with the full material quantities preserved. A note identifies those quantities as the shared job total.

When ENABLE_EVENT_WRITES=true, each weekday run creates two 6 AM Pacific events titled “Tim’s Van — Materials” and “Niall’s Van — Materials”. An empty van gets “No jobs assigned”. Each van has its own durable run state; one successful event is never repeated because the other failed. Uncertain writes still require reconciliation. The authenticated status/run paths automatically apply an additive van_daily_runs table migration; existing daily_runs history is preserved. Existing legacy processing/creating/uncertain/created dates block new van events until reviewed.

For van reconciliation, include `"van":"tim"` or `"van":"niall"` alongside date and eventId in the existing reconciliation request. Omitting van continues to reconcile legacy daily events. Preview creates no events. Writing remains controlled by the existing environment flag; deploying this update does not enable it.


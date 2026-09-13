# Validation record

Validated locally on September 12, 2026 (America/Los_Angeles) with Node.js 24.19.0.

- TypeScript strict type checking: passed.
- Automated tests: 20 passed, 0 failed. Includes PostgreSQL-engine tests for concurrent daily claims, expired-worker fencing, ambiguous event outcomes, prewrite retry, rotating token concurrency and lost refresh responses.
- Jobber transport tests: mocked responses for expired access token recovery, partial GraphQL errors, query-cost rejection, mutation non-retry and nested pagination.
- Material tests: exact source evidence, optional items, unsupported quantities/specifications, employee sharing, units/specification separation and unknown totals. A regression test ensures a 20A rating cannot justify a quantity of 20.
- Pacific time tests: summer/winter UTC scheduling, weekdays, local dates, DST 23/25-hour day boundaries and 6 AM event time.
- Admin tests: missing/incorrect bearer auth, session expiry and cross-origin cookie-write rejection.
- Production Next.js build: passed, dashboard plus eight server endpoints generated.
- Headless Edge browser smoke: sign-in screen, preview interaction with synthetic data, disabled write button in preview mode, no client page errors, and no mobile horizontal overflow. Desktop/mobile screenshots were visually inspected.

Live Jobber OAuth, live pagination/schema extensions, OpenAI material quality, database-provider TLS connectivity, Vercel cron delivery and real event creation have **not** been exercised with production credentials. Complete SETUP.md's acceptance checks before launch. No Jobber calendar event was created during this build.

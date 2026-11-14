# Clashless backend

University registration, class routines, exam routines and seat plans. Implementation status and continuation notes are in [progress.md](progress.md); the specification is [requirement.md](requirement.md).

## Development setup

Use Node.js 24, PostgreSQL and Redis. Install dependencies with `npm ci`. Copy `.env.example` to `.env` and fill in service credentials, first-admin details, `UNIVERSITY_EMAIL_DOMAIN` and `DEMO_PASSWORD`. Never commit environment files containing secrets.

Run `npm run db:deploy`, `npm run db:seed` and `npm run db:seed:demo`. Start the API with `npm run dev`; Swagger is at `http://localhost:5000/docs`. The first Super Admin uses `ADMIN_*`; all demo accounts use `DEMO_PASSWORD`. Seeds can be rerun without duplicating rows.

For a registration-ready demo, run `npm run db:seed:demo -- --registration-open`. It generates and publishes the class routine, advances Spring 2027 to REGISTRATION and opens batch 23-3 for two hours. Repeating the option reuses its published routine, reopens that demo window and moves affected bill deadlines without removing enrollments or payments. It refuses to rewind a semester that has entered CLASSES or a later phase.

## Verification

Copy `.env.test.example` to `.env.test` and configure the supplied PostgreSQL and Redis services. For this assignment, tests share the services and enforce `DATABASE_SCHEMA=clashless_test` and `REDIS_KEY_PREFIX=clashless:test:`. Tests migrate and truncate only that schema and delete only keys with that prefix. Development data in `public` is preserved. Set `REDIS_TLS=true` in both environments if the Redis provider requires TLS.

Run `npx tsc --noEmit`, `npm run lint:check`, `npm run format:check` and `npm test`. Build with `npm run build`, then start with `npm start`. Tests mock outgoing mail, Google verification, uploads and bKash calls.

## Architecture

Express 5 + TypeScript (ESM), Prisma 7 on PostgreSQL (driver adapter), Redis for caching, rate limits, the seat-count pub/sub and BullMQ queues. One module per resource lives in `src/app/module/<name>/` with six files (route, controller, service, validation, interface, docs). Pure algorithm code (routine, exam routine and seat plan generators and validators) lives in `src/app/engine/` with no Express and no Prisma, so it is unit tested without any service. Background work is split in two: BullMQ workers in `src/app/jobs/` (routine and exam routine generation, bulk email) and cron schedules in `src/app/lib/cron.ts` (hourly discard of unpaid registrations, daily payment reminders at 10:00, abandoned payments every 15 minutes, exam seat reminders at 18:00 Asia/Dhaka). Cron only calls exported service functions, so tests call those functions directly.

Seats are announced to the seat stream (`GET /api/registrations/seats/stream`, server-sent events) through Redis pub/sub on `seats:{semesterId}`.

## Design decisions

- **Why a guarded seat update.** Selecting a section runs in one transaction: lock the student's registration row (`SELECT ... FOR UPDATE`), run every rule check, then take the seat with `UPDATE sections SET enrolledCount = enrolledCount + 1 WHERE id = ? AND status = 'OPEN' AND enrolledCount < capacity`. The database decides who gets the last seat, so 1,000 simultaneous requests can never oversell a 40-seat section, with no application lock and no read-then-write race. The registration row lock serialises one student's own parallel requests, which is what keeps the 15-credit limit exact.
- **Why column groups in the seat plan.** Odd columns hold course group A and even columns hold group B, and a course lives in only one group. Both neighbours of an odd column are even columns and the other way round, so two students of the same course can never sit side by side. That rule holds by construction instead of by search, and the validator checks it again before publishing.
- **Money and credits are `Decimal`.** Fees, payments and credits use Prisma `Decimal` and Decimal methods; the minimum payment is `ceil(40%)` in whole taka.
- **No outside call inside a transaction.** bKash, email, Cloudinary and Google calls run before or after database transactions; payments create their checkout after the PENDING row commits.
- **Idempotency.** Selecting accepts an `Idempotency-Key` header (replayed from Redis for 10 minutes); the bKash callback and the abandoned-payment job both end in the same guarded `PENDING -> COMPLETED` update, so confirming twice changes nothing.
- **Connection settings.** `DATABASE_POOL_MAX` (default 10) sets the API's database pool and must stay below the database's `max_connections`. The HTTP listener uses a 4,096-connection backlog so a registration rush can connect.

## Performance

| Check | Result |
|---|---|
| T-ROUT-14: class routine for the actual demo (264 sections, 38 rooms, 72 teachers) | 552 ms, 0 hard violations (limit 30 s) |
| T-SEAT-13: seat plan for 5,000 students in one slot | well under 100 ms, validator ok (limit 10 s) |
| T-REG-10: 100 students race for 40 seats | exactly 40 enrolled and 60 `SECTION_FULL`, every run |

## Load test (requirement 9.7)

Files: `tests/load/makeTokens.ts` and `tests/load/select-section.k6.js`. Steps:

```bash
npm run db:seed:demo -- --registration-open
```

```bash
npm run build
```

```bash
npm start
```

```bash
npx tsx tests/load/makeTokens.ts
```

```bash
npm run test:load
```

k6 is a separate program (`winget install k6` on Windows). Pass criteria: exactly 40 responses 201, 960 responses 409 `SECTION_FULL`, `enrolledCount` 40, p95 under 500 ms.

### Result on the development machine (14 Nov 2026) — NOT a pass

Real `npm run test:load` (k6 2.4.0, 1,000 VUs at once, production build, `DATABASE_POOL_MAX=35`, one API instance, 1,000 real demo students of batch 23-3 selecting CSC2211 section 1) against the supplied hosted PostgreSQL (about 56 ms per round trip) on Windows. Two runs:

| | Run 1 | Run 2 | Required |
|---|---|---|---|
| `selected_201` | **40** | **40** | exactly 40 |
| `section_full_409` | 552 | 614 | 960 |
| other (client could not connect) | 408 | 346 | 0 |
| p95 | 44.2 s | 45.6 s | under 500 ms |

- **The core guarantee held:** exactly 40 students were enrolled in both runs (never more), and the API logged zero errors.
- **The other targets failed on this setup, for environmental reasons:** every "other" response is a TCP failure before the request reached the API (`dial: connection refused` and Windows error 10060). The Windows loopback accept queue cannot take 1,000 simultaneous connections, so those requests never arrived. The latency is the remote database: each select takes about a dozen round trips of about 56 ms, and the guarded seat update holds the hot section row for about three of them, so contenders queue for tens of seconds.
- **To get a real pass,** run the same five steps on a machine where PostgreSQL is local (or on the same host as the API) and preferably on Linux, then record the numbers here. Nothing in the specified locking flow was changed to chase the number.

## Deploy to Vercel

The repository is ready to import into Vercel from GitHub (the setup follows the `express-vercel-deploy-skill`: tsup bundles, `api/index.js` exports `dist/app.js`, `public/` is the static output, `vercel.json` packages the bundle, the Swagger comment sources, the email templates and the Prisma runtime).

1. In Vercel choose **Add New Project**, import this GitHub repository and keep the Root Directory at the repository root.
2. Framework preset **Other**. The build command (`npm run build`) and output directory (`public`) come from `vercel.json`. Production branch: `main`. Use Node.js 24 if it is offered.
3. Add these environment variables (Production, and Preview if you want previews) and then deploy. Never commit their values.

| Variable | Notes |
|---|---|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | Hosted PostgreSQL URL (with `?schema=public` if you use the default schema) |
| `DATABASE_POOL_MAX` | Keep small on serverless, for example `3` to `5`; every function instance opens its own pool |
| `REDIS_HOST`, `REDIS_PORT`, `REDIS_USER`, `REDIS_PASSWORD`, `REDIS_TLS` | Hosted Redis |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_ACCESS_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN`, `BCRYPT_SALT_ROUNDS` | Authentication |
| `SERVER_URL` | The deployed API's base URL (bKash callback is `SERVER_URL/api/payments/bkash/callback`) |
| `FRONTEND_URL` | The frontend origin allowed by CORS and used for payment redirects |
| `UNIVERSITY_EMAIL_DOMAIN`, `APP_NAME`, `EMAIL_SENDER`, `SMTP_USER`, `SMTP_PASSWORD` | University domain and email sending |
| `GOOGLE_CLIENT_ID` | Google sign-in |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Profile photos |
| `BKASH_BASE_URL`, `BKASH_USERNAME`, `BKASH_PASSWORD`, `BKASH_APP_KEY`, `BKASH_APP_SECRET` | bKash (sandbox values for testing) |
| `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `DEMO_PASSWORD` | Only needed where you run the seeds |

4. Apply the migrations and seed the first admin to the hosted database from your own machine, with `DATABASE_URL` pointing at it (this changes that database, so check the target first). Seed the demo data only if you want it:

```bash
npm run db:deploy
```

```bash
npm run db:seed
```

5. After the deploy, check `/`, `/docs/` and a database-backed call such as `POST /api/auth/login`.

What is different on Vercel (there is no long-running process):

- **Queue jobs run inside the request.** With `VERCEL` set, `enqueueJob` runs the handler inline (as in tests), so routine and exam routine generation, emails and receipts complete before the response; the function limit in `vercel.json` is 60 seconds.
- **Cron jobs do not run.** Vercel does not execute `src/app/lib/cron.ts`, so the hourly discard of unpaid registrations, the daily payment reminders, the abandoned-payment settlement and the exam seat reminders need either a long-running host (`npm start`) or an external scheduler that calls the exported job functions. Until then, run `npm start` somewhere, or discard and remind by hand.
- **Redis connects on demand** in the exported app (`src/app.ts`), because `server.ts` is not used.
- **The seat stream** (`GET /api/registrations/seats/stream`) is a long-lived connection and is limited by the function duration; a long-running host is better for it.
- For BullMQ's sake the Redis provider should use the `noeviction` policy.

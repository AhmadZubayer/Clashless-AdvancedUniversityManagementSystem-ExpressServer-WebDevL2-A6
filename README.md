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

k6 is a separate program (`winget install k6` on Windows) and was **not installed on the development machine, so `npm run test:load` has not been run**. Pass criteria: exactly 40 responses 201, 960 responses 409 `SECTION_FULL`, `enrolledCount` 40, p95 under 500 ms.

What was measured instead (a Node HTTP client, the real production build, the supplied hosted PostgreSQL and Redis, 1,000 real demo students of batch 23-3 selecting CSC2211 section 1):

- Every run enrolled **exactly 40** students and never more. The seat guard held in all runs, including runs where requests failed.
- The 960-rejection and p95 numbers could **not** be reproduced on this machine. The database is remote (about 56 ms per round trip) and every select holds the hot section row lock for about three round trips, so 1,000 contenders serialise to tens of seconds; the Windows loopback additionally timed out many of the 1,000 simultaneous connections (`ETIMEDOUT`) on the client side. With 200 requests in flight one run recorded 40 created, 609 `SECTION_FULL` and 351 client connection timeouts; no server error was caused by the seat logic. The p95 target assumes a database close to the API (for example PostgreSQL on the same host); please run `npm run test:load` there and record the numbers here.

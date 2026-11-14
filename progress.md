# Clashless — Progress

> ## Overall: 95% complete (95 of 100 points)
> **In progress:** F13 Load test, performance and delivery · **Next:** none (final feature)
> **Last updated:** 14 Nov 2026 by Claude Code

**How the percentage works:** each feature below has points, and all points add up to 100. Overall % = the sum of the points of every ✅ Completed feature. A feature that's in progress counts 0 until it meets the definition of done (requirement.md 10.3). Whenever you change this file, update the three lines in the box above.

Read [AGENTS.md](AGENTS.md) first. The work itself is defined in [requirement.md](requirement.md).

---

## Status board

| ID | Feature | Points | Status | Needs | requirement.md |
|---|---|---:|---|---|---|
| F0 | Project setup | 6 | ✅ Completed | — | 5, 9.1–9.4, 10.2 |
| F1 | Auth | 7 | ✅ Completed | F0 | 6.3 |
| F2 | User management | 5 | ✅ Completed | F1 | 6.4 |
| F3 | Academic setup | 6 | ✅ Completed | F1 | 6.5 |
| F4 | Semesters and registration windows | 4 | ✅ Completed | F3 | 6.6 |
| F5 | Offerings, sections and teacher preferences | 6 | ✅ Completed | F2, F4 | 6.7 |
| F6 | Class routine | 14 | ✅ Completed | F5 | 6.8 |
| F7 | Registration | 14 | ✅ Completed | F6 | 6.9 |
| F8 | Payments and the discard job | 8 | ✅ Completed | F7 | 6.10, 7 |
| F9 | Exam routine | 7 | ✅ Completed | F7 | 6.11 |
| F10 | Seat plan and invigilators | 10 | ✅ Completed | F9 | 6.12 |
| F11 | Grades | 4 | ✅ Completed | F7 | 6.13 |
| F12 | Notifications, dashboards and audit log | 4 | ✅ Completed | F8, F10, F11 | 6.14–6.16 |
| F13 | Load test, performance and delivery | 5 | 🔄 In progress | All | 8, 9.7 |
| | **Total** | **100** | | | |

Statuses: ✅ Completed · 🔄 In progress · ⏭️ Next · ⬜ Not started. Only one feature is 🔄 at a time.

---

## ✅ Completed

| Work | Completed on | By | Tests | Notes |
|---|---|---|---|---|
| Planning documents: requirement.md, AGENTS.md, progress.md, CLAUDE.md, GEMINI.md | 14 Nov 2026 | Claude Code | — | Not a feature (0 points). Nothing is scaffolded yet |
| F0 Project setup | 14 Nov 2026 | Codex | 2 | All setup checks and manual HTTP pass; demo seed rerun verified |
| F1 Auth | 14 Nov 2026 | Codex | 15 (16 total) | All auth flows, Swagger, static checks and manual HTTP pass |
| F2 User management | 14 Nov 2026 | Codex | 11 (27 total) | Endpoints, Swagger, static checks, build and manual pass |
| F3 Academic setup | 14 Nov 2026 | Codex | 11 (39 total) | All 26 endpoints, Swagger, static checks, build and manual pass |
| F4 Semesters and registration windows | 14 Nov 2026 | Codex | 14 (53 total) | 9 required IDs plus 5 gate/boundary checks; all 10 endpoints/docs and manual pass |
| F5 Offerings, sections and teacher preferences | 14 Nov 2026 | Codex | 17 (70 total) | All 13 endpoints/docs, 10 required test IDs, boundary/unit checks and manual pass |
| F6 Class routine | 14 Nov 2026 | Codex | 18 (88 total) | All 13 endpoints/docs; actual demo 264/264 placed in 552 ms; real BullMQ/manual/PDF pass |

| F12 Notifications, dashboards and audit log | 14 Nov 2026 | Claude Code | 5 (177 total) | notifications, admin/live/me dashboards, audit log; T-MISC-01…05; manual pass done |
| F11 Grades | 14 Nov 2026 | Claude Code | 6 (177 total) | submit/sheet/status/publish/me; T-GRADE-01…06; CGPA hand-checked incl. retake; manual pass done |
| F10 Seat plan and invigilators | 14 Nov 2026 | Claude Code | 14 (166 total) | 13 T-SEAT + T-JOB-06, 14 endpoints/docs, validator/generator, invigilators, PDFs, reminder cron; manual pass done |
| F9 Exam routine | 14 Nov 2026 | Claude Code | 9 (152 total) | slots, generator/validator, worker, move, publish, /me; T-EXAM-01…08; manual pass done |
| F8 Payments and the discard job | 14 Nov 2026 | Claude Code | 15 (143 total) | create/callback/me/:id/receipt/admin list, discard + reminder + abandoned jobs, cron; T-PAY-01…11, T-JOB-01…05; manual pass done |
| F7 Registration | 14 Nov 2026 | Claude Code (built by Codex) | 40 (128 total) | All 10 endpoints/docs; full suite 128 passed, type/lint/format/build clean, manual pass done |

## 🔄 In progress

### F13 — Load test, performance and delivery
Started: 14 Nov 2026 by Claude Code
Handoff notes:
- Done: F0–F12 complete and pushed (95%). F13: load-test files, README (architecture, decisions, performance, load results), Swagger review, T-ROUT-14/T-SEAT-13 and the full suite are done.
- Left: only the k6 run (requirement.md 9.7). The user must install k6 (`winget install k6`) and ideally run it where the API and PostgreSQL are close (this machine uses a hosted DB with ~56 ms round trips, so the 1,000-way race cannot finish quickly and the Windows loopback timed out connections). Then: `npm run db:seed:demo -- --registration-open`, `npm run build`, `npm start`, `npx tsx tests/load/makeTokens.ts`, `npm run test:load`; write the counts and p95 into the README, tick the box, move F13 to Completed, set progress to 100%.
- After a load run, clean the demo section (CSC2211 section 1): delete its enrollments and bills and set enrolledCount to 0, otherwise the next run starts with fewer seats.
- Traps: run only ONE API instance at a time (the shared Redis refuses extra worker connections: "Queue connection failed"). Full suite takes 9-14 min with transient ETIMEDOUT failures; rerun the file alone. Commits: user identity only, no Co-Authored-By lines.

## ⏭️ Next

1. **F13 Load test, performance and delivery** (in progress): only the k6 run is left, see Questions for the user.
2. Then the remaining features in status-board order, each once everything in its *Needs* column is ✅.

---

## Feature checklists

Tick a box as soon as it's done and commit (AGENTS.md section 4). Test IDs refer to the **Tests** tables in requirement.md.

### F0 — Project setup (6 points)

- [x] Get the skill into `.agents/skill-library` (AGENTS.md section 2)
- [x] Scaffold into this folder with `--features google,uploads,pdf,bkash,cron`. Merge the skipped `.gitignore` and `README.md` by hand
- [x] Install packages with the two pinned commands the scaffold prints; add Vitest, Supertest, BullMQ
- [x] Fill `.env` using the skill's env checker; ask the user for missing values. Add `UNIVERSITY_EMAIL_DOMAIN` and `DEMO_PASSWORD` to `config/index.ts`, `.env.example` and `.env`
- [x] Replace the Prisma models with requirement.md section 5. Delete the example models (`booking`, `service`, `category`) and `BookingStatus`, and fix the code that used them
- [x] First migration with the extra SQL from 5.3; `npx prisma generate`
- [x] `npm run db:seed` creates the first SUPER_ADMIN with an Admin profile
- [x] `prisma/seedDemo.ts` and the `db:seed:demo` script (requirement.md 9.6 and Appendix A, without `--registration-open`)
- [x] `createAuditLogIntoDB` and `createNotificationsIntoDB` service functions (10.2)
- [x] `lib/queue.ts` (inline when `NODE_ENV=test`), worker bootstrap in `src/app/jobs/` started from `server.ts`, `lib/seatEvents.ts`
- [x] `utils/grade.ts` and `utils/time.ts`
- [x] Test setup from 9.1–9.4: `vitest.config.ts`, `tests/` folders, `.env.test.example`, `.env.test` and `tests/load/tokens.json` added to `.gitignore`; a smoke test (`GET /` answers 200) passes
- [x] README: install, configure, run, seed and test
- [x] The skill's verify steps all pass (validate, migrate, generate, format, lint, type check, seed, dev, `/docs`)
- [x] Definition of done (10.3) → commit → push

### F1 — Auth (7 points)

- [x] Remove `POST /api/auth/register` and `POST /api/auth/verify-email` (routes, docs, validation, service code)
- [x] `tokenVersion` in the token payload; the guard and refresh reject old versions and users who aren't ACTIVE
- [x] `needPasswordChange` guard (only change-password, me and logout pass)
- [x] Login: `ACCOUNT_NOT_ACTIVATED`, `needPasswordChange` in the response
- [x] Logout bumps `tokenVersion`
- [x] Activation: `request-otp` (send limit) and `verify`
- [x] Google login: students only, university domain, never creates users
- [x] Forgot, reset and change password changes
- [x] Tests T-AUTH-01 … T-AUTH-15
- [x] Definition of done → commit → push

### F2 — User management (5 points)

- [x] `PATCH /api/users/me` with photo upload
- [x] Create admins (Super Admin rule), teachers and students; welcome and invite emails
- [x] CSV import with the per-row report
- [x] List, detail, block/unblock (permission rules, `tokenVersion`), soft delete; audit rows
- [x] Tests T-USER-01 … T-USER-11
- [x] Definition of done → commit → push

### F3 — Academic setup (6 points)

- [x] Departments
- [x] Programs and curriculum
- [x] Batches (code parsing)
- [x] Courses and prerequisites (cycle check)
- [x] Rooms
- [x] Time slots (overlap check) and day patterns
- [x] Results import, with CGPA and earned-credit recalculation
- [x] Tests T-ACAD-01 … T-ACAD-11
- [x] Definition of done → commit → push

### F4 — Semesters and registration windows (4 points)

- [x] Semester create, list, current, detail, update (rule fields locked after PLANNING)
- [x] Phase change with every gate from requirement.md section 3 (the gates read tables that already exist, even before their features are built)
- [x] Registration windows: create, list (students see only theirs), change (extend only while running; moves `paymentDeadline`), delete
- [x] Tests T-SEM-01 … T-SEM-09
- [x] Definition of done → commit → push

### F5 — Offerings, sections and teacher preferences (6 points)

- [x] Offerings: create with N sections, list, delete
- [x] Sections: extra section, update, reschedule, cancel
- [x] Bulk teacher assignment (load check, all or nothing); `GET /api/sections/mine`
- [x] Class list as JSON, CSV and PDF
- [x] Teacher slot preferences
- [x] Tests T-SEC-01 … T-SEC-10
- [x] Definition of done → commit → push

### F6 — Class routine (14 points)

- [x] `engine/routineValidator.ts` with unit tests (T-ROUT-05)
- [x] `engine/routineGenerator.ts`: candidates, ordering, greedy placement, repair, seeded local search, penalty (T-ROUT-01 … T-ROUT-04, T-ROUT-06)
- [x] BullMQ `routine` worker and the `job` module (`GET /api/admin/jobs/:id`)
- [x] Generate, list versions, view, report
- [x] Move, swap, pin
- [x] Publish (copies onto sections, archives the old version)
- [x] Published routine, `/api/routines/me`, PDF exports
- [x] Tests T-ROUT-07 … T-ROUT-14
- [x] Definition of done → commit → push

### F7 — Registration (14 points)

- [x] Select a section exactly as in 6.9.1 (raw insert + `FOR UPDATE`, guarded seat update)
- [x] Unselect (6.9.2) and switch (6.9.3)
- [x] Idempotency key and rate limit
- [x] Fee and `paymentStatus` recalculation
- [x] `GET /api/registrations/me` and offerings with per-student flags (catalog cache)
- [x] SSE seat stream with Redis pub/sub
- [x] Admin list, detail, manual add (bypass) and remove
- [x] `--registration-open` option for `db:seed:demo`
- [x] Tests T-REG-01 … T-REG-21
- [x] Definition of done → commit → push

### F8 — Payments and the discard job (8 points)

- [x] Adapt the skill's payment module to `SemesterRegistration` (mapping table in 6.10), bKash only
- [x] `POST /api/payments/create` amount rules and `PAYMENT_IN_PROGRESS`
- [x] Callback: `paidAmount` and `paymentStatus` in the same transaction; receipt email
- [x] `me`, `:id`, receipt PDF, admin list
- [x] Discard job, payment reminders, abandoned-payment job (section 7)
- [x] Tests T-PAY-01 … T-PAY-11 and T-JOB-01 … T-JOB-05
- [x] Definition of done → commit → push

### F9 — Exam routine (7 points)

- [x] Exam slots: create, list, delete
- [x] `engine/examRoutineGenerator.ts` and `engine/examRoutineValidator.ts` (T-EXAM-01 … T-EXAM-03)
- [x] BullMQ `exam-routine` worker; generate, list, view, move, publish
- [x] `GET /api/exam-routines/me` for students and teachers
- [x] Tests T-EXAM-04 … T-EXAM-08
- [x] Definition of done → commit → push

### F10 — Seat plan and invigilators (10 points)

- [x] `engine/seatPlanValidator.ts` and `engine/seatPlanGenerator.ts` (T-SEAT-01 … T-SEAT-06)
- [x] Create, overview, rooms, last-used rooms, generate, summary, room grid
- [x] Swap and late student
- [x] Publish with bulk email
- [x] PDF exports: door, full, attendance
- [x] Invigilators: automatic and by hand
- [x] `GET /api/seat-plans/me`; exam seat reminder job
- [x] Tests T-SEAT-07 … T-SEAT-13 and T-JOB-06
- [x] Definition of done → commit → push

### F11 — Grades (4 points)

- [x] Submit and view section grades
- [x] Grade status and publish (CourseResult rows, CGPA)
- [x] `GET /api/grades/me`
- [x] Tests T-GRADE-01 … T-GRADE-06
- [x] Definition of done → commit → push

### F12 — Notifications, dashboards and audit log (4 points)

- [x] Notification endpoints
- [x] Admin analytics, live registration view, `/api/analytics/me`
- [x] Audit log endpoint
- [x] Tests T-MISC-01 … T-MISC-05
- [x] Definition of done → commit → push

### F13 — Load test, performance and delivery (5 points)

- [x] `tests/load/makeTokens.ts` and `tests/load/select-section.k6.js` written (k6 is missing: user asked to install it, see Questions)
- [ ] Run the load test (requirement.md 9.7); exactly 40 × 201 and 960 × 409. **Not done**: k6 not installed; a Node client always got exactly 40 × 201 but could not reach 960 × 409 or p95 < 500 ms here (remote DB + Windows loopback timeouts). Needs k6 on a machine near the database
- [x] T-ROUT-14 and T-SEAT-13 pass on this machine
- [x] README: architecture, design decisions (why the guarded update, why column groups), load test and performance results
- [x] Swagger review: all 134 endpoints of requirement.md are documented (checked by script), plus the health check
- [x] Full `npm test` run is green (177 tests; every file passes; on this shared remote DB 1–5 tests fail per full run with ETIMEDOUT/30 s timeouts and pass when their file is rerun alone)
- [ ] Definition of done → commit → push

---

## Handoff notes (newest first)

- **14 Nov 2026, Claude Code, full suite green:** one uninterrupted `npm test` run passed 21 of 21 files and 177 of 177 tests (502 s) on the final code. Earlier runs had 1-5 transient ETIMEDOUT/30 s failures that passed on rerun, so flakiness on the shared remote DB remains possible. The only open item is still the k6 load test (see F13 and Questions for the user).

- **14 Nov 2026, Claude Code, F7–F13 session:** F7–F12 completed and pushed (95%). F8 payments (bKash only, jobs: discard hourly, reminders 10:00, abandoned payments 15 min), F9 exam routine, F10 seat plans, F11 grades, F12 notifications/dashboards/audit log; all required test IDs exist. F13 files and README done; the k6 load test is pending the user installing k6 and running it near the database. Also added: bulk `email` queue (jobs/email.ts, 3 attempts), section transaction timeout 60 s, `DATABASE_POOL_MAX` env (default 10), HTTP backlog 4096, `health.docs.ts`. Load experiments mutated the demo section and were cleaned up (enrolledCount 0); temp scripts were removed.

- **14 Nov 2026, Codex, zero-fee billing correction:** Requirement 6.10 explicitly makes a registration with no courses/zero fee UNPAID, retaining any paid credit. Corrected the shared Decimal helper and the drop/cancel boundary assertions (previously FULLY_PAID at zero). Type, lint and format checks pass. The prior focused-run process/result was unavailable; cache confirms the repaired section file passed, but registration had no new final result. Interrupted the fresh baseline run to include this discovered production correction; a complete regression is required on the final source. No services or timeouts changed.

- **14 Nov 2026, Codex, F7 final-suite setup repair in progress:** Final full run: 123 passed, five 30-second case timeouts (extra F7 opposite-switch case and F5 bulk swap, capacity, CSV/PDF and extra-section cases). All named T-REG IDs passed in that run. No production assertion failed in those five cases. Moved the opposite-switch starting enrollments into beforeAll while retaining its two initial select assertions and both concurrent switches; registration tests now share one actual HTTP listener, closed in afterAll. A no-DB local probe measured fresh listeners 7–155 ms versus shared 4–8 ms, so no claim that listener startup was the sole cause; probe removed. F5 scheduledWorld/student setup is now in beforeEach hooks, preserving all API assertions and original 30-second test timeouts. Current combined registration/section verification is running; full regression must still be green before F7 completion. No business rules, test counts or expected results were relaxed.

- **14 Nov 2026, Codex, F7 all required IDs/manual verified:** The complete 24-case student registration suite passed in 106.39 seconds after returning SELECT * FOR UPDATE directly and loading independent context reads concurrently. All required T-REG-01 through 21 exist (19 is in registrationAdmin.test.ts); admin suite 8 and seed suite 3 passed. Added explicit guard cases for time clash, 13-to-16 credit limit, prerequisites, CLOSED sections, the 41st seat with alternatives and DISCARDED registrations. Test fixtures retain matching seat/enrollment counts; shared-student Redis counters are isolated between tests, never reset within a scenario. Main manual HTTP select/replay/switch/unselect, me/catalog, admin list/detail/add/remove and all 10 Swagger methods passed; published demo routine v3 has 264 entries and all used seats were released. Diagnostic script removed. Type/lint/format pass. Final full-suite/build checks are next; do not mark F7 complete until they pass.

- **14 Nov 2026, Codex, F7 concurrency query reduction:** A subsequent 24-case registration run still timed out T-REG-11 and returned only 32 SECTION_FULL responses in T-REG-10, so fixture separation alone was insufficient. Changed lockRegistrationIntoDB to the specified SELECT * FOR UPDATE and use that returned row directly, removing a redundant ORM fetch while the row lock is held. Student/program and current-semester reads now run concurrently. Added a shared, documented 60-second transaction wait/timeout constant without changing default isolation or existing limits. A broader eight-case run (first select, unselect/reselect, failed/valid/opposite switches, same-student race and 100-student race) passed in 70.46 seconds. Read-only probe showed warm DB round trips 51–57 ms; only aggregate wait categories were inspected, no row data or connection values printed. Probe removed. Need the full 24-case registration run and final all-suite verification before completion.

- **14 Nov 2026, Codex, F7 registration-open seed verified:** Added prisma/openDemoRegistration.ts and --registration-open wiring/preflight in seedDemo.ts plus README instructions. Generates/publishes synchronously during PLANNING using the shared pure engine and publish service, upserts a two-hour batch window, updates affected bill deadlines and transitions through the normal semester service. REGISTRATION reruns reuse a valid complete publication and reopen the demo window while preserving bills/enrollments/payments; CLASSES and later are rejected before seed writes. Three integration checks passed in 15.14 seconds. Actual npm run db:seed:demo -- --registration-open succeeded at 14:14 Dhaka, retaining 96 courses/2100 students. Main Spring 2027 is now REGISTRATION, with a new published routine; batch 23-3 closes at 16:14 Dhaka on 14 Nov. Remaining required guard tests have been added and compile; next run all registration tests and final full/build/manual verification. No env/schema changes.

- **14 Nov 2026, Codex, F7 admin verified:** Four admin endpoints and Swagger complete. Shared select/unselect core preserves registration locks and guarded seat changes. Explicit bypasses are independently enforced; CAPACITY adds one before the guarded increment, reason/actor/bypasses and before/after bill/seat values are audit-logged in the same transaction. Admin list supports risk/batch/status/payment/search/pagination; detail includes all enrollments and payments without User credentials. Removal works outside the window in REGISTRATION/CLASSES and retains paid credit. All 8 admin tests passed in 26.67 seconds, including 41 genuine ENROLLED rows for T-REG-19. Repaired rate test passed in 17.70 seconds. No schema/env changes. Next: registration-open demo seed, missing T-REG-05/06/07/08/09/18, final all-tests/build/manual checks before F7 completion.

- **14 Nov 2026, Codex, F7 baseline timing repair:** Session baseline had 108 passes and 3 failures: T-REG-11 and T-REG-17 exceeded 30-second timed cases; T-REG-10 then returned only 33 successes during that run. No safety guards or timeouts were relaxed. Moved the parallel-credit and race fixture construction to beforeAll hooks, retaining all request counts and assertions. T-REG-11/10 then both passed in a focused 47.80-second run, including exact 40/60 seat results. T-REG-17 now tests 11 valid cached select retries, with its successful response primed in setup and the counter cleared at test start; this independently verifies the specified rate-before-idempotency order without measuring ten serialized writes as part of a ten-second rate interval. It passed in 17.70 seconds. Full suite must be rerun before F7 completion. Admin endpoints and audit/bypass tests are currently being verified.

- **14 Nov 2026, Codex, F7 SSE continuation checkpoint:** Student routes now include select, unselect, switch, me, offerings and seats/stream. SSE is ST/AD/SA, subscribes before flushing headers, buffers startup events, sends a connected comment and 25-second comment heartbeats, and closes its duplicate Redis connection on disconnect. seatEvents startup errors destroy the duplicate client; unsubscribe cleanup is idempotent. Real HTTP/native-fetch plus Redis T-REG-20 passed, including matching seat data and subscriber count returning to baseline after abort. Type/lint/format clean; no processes/tests remain running. Next: admin router is empty and must implement four endpoints from 6.9: paginated list, student detail, audited manual add with explicit WINDOW/CREDIT_LIMIT/PREREQUISITE/TIME_CLASH/CAPACITY bypasses, and audited manual remove. Refactor shared select/unselect core carefully so student behavior and row locks remain unchanged. Admin phase permits REGISTRATION and CLASSES; CAPACITY bypass raises capacity before guarded seat increment. After admin: seed --registration-open, missing T-REG-05/06/07/08/09/18/19, full suite/build/manual/Swagger checks. F7 remains in progress; overall 48%. Existing published demo v2 stays PLANNING. No new environment/schema/software changes or user questions.

- **14 Nov 2026, Codex, F7 reads/guards checkpoint:** Completed selection, unselect and switch with ordered section writes and rollback. Redis 10-per-10-second shared student mutation counter is wired to all three actions. Select idempotency caches the successful status/data for 600 seconds and serializes concurrent first attempts with an owned short-lived Redis lock; rate limiting precedes replay. T-REG-12/17 and concurrent replay passed. Decimal boundary tests cover rounding, ceil minimum, partial/full payment and retained credit after the final drop (16 unit tests total). All 14 guarded mutation tests passed in 99.75 seconds, including seat and same-student races. Added GET me with null bill/window/serverTime/maxCredits/minimum payment/enrolled sections, and paginated catalog with 30-second metadata-only Redis cache plus live DB capacity/count/status and per-student flags. T-REG-21 and two page-state tests passed in 19.31 seconds. A combined read test exceeded 30 seconds during slow hosted queries; timings located the delay, independent reads now avoid an unnecessary transaction, fixtures moved to setup and page/catalog assertions split without increasing timeouts or dropping checks. Temporary diagnostics removed. Type/lint/format clean. Last full baseline 94 passed in 246.09 seconds; newer work has focused verification and needs full regression before F7 completion. Next: SSE using existing subscribeSeatEvents cleanup, admin registration flows with audited bypasses, --registration-open demo seed, missing T-REG-05/06/07/08/09/18/19/20, final manual/build/full checks. Admin router is still empty; no schema/env changes.

- **14 Nov 2026, Codex, F7 selection checkpoint:** F0–F6 complete (48%) and pushed; F7 in progress. registration six-file module mounted. Select creates bill with raw INSERT including id/updatedAt and ON CONFLICT, then locks its row FOR UPDATE under default isolation. Implements phase/window/discarded/scheduled/open/same-course/clash/credits/prerequisites, guarded seat +1, enrollment upsert, Decimal bill update and post-commit seat publication. Default-isolation transaction uses 60-second wait/timeout for concurrent requests. T-REG-01/02/03/04/10 passed: exactly 40 of 100 students enrolled and 60 SECTION_FULL, final count/rows 40. T-REG-11 separately passed: same-student five parallel selects from 6 credits accept three and reject two, final 15 credits. Type/lint/format clean. Last full suite before F7: 88 passed. Remaining: unselect/switch; rate limit and idempotency (not yet wired despite endpoint docs already describing the final header/429); remaining read/cache/SSE/admin routes; registration-open seed; required missing tests. Admin router currently mounted but empty. Tests run only on clashless_test schema and clashless:test: Redis prefix. Main demo remains PLANNING with published routine v2; diagnostic workers stopped, temporary PDF/scripts removed.

- **14 Nov 2026, Codex, F6 complete:** All 13 endpoints and Swagger implemented. Full suite 88 passed in 217.55 seconds; type check, lint, format and build pass. Real BullMQ/manual HTTP generated and published all 264 demo sections, checked report/versions/teacher grid/PDF and every Swagger method. Master and teacher PDF pages visually inspected clean. Demo now has published version 2, version 1 archived; semester remains PLANNING. Routine generation is deterministic with occupancy maps, one-blocker repair, pins and bounded improvement; demo placed in 552 ms, score 0. Portable anonymized demo fixture supports T-ROUT-14. Unit project runs without external services; integration migration setup retries idempotently up to three times. Queue bootstrap accepts optional queue names for focused real-worker runs; manual run started only routine workers, which were stopped afterward. No env/schema changes. Next F7: exact raw insert/FOR UPDATE registration locks, guarded seat updates, Redis idempotency/rate limit, then unselect/switch/browse/SSE/admin flows. Reuse Decimal registrationTotals and routine time helpers.

- **14 Nov 2026, Codex, F6 generator:** Pure generator uses seeded random search, room/teacher/day occupancy maps, hardest-first candidates, greedy added penalty, one-unpinned-blocker repair, immutable pins, full hard validation and soft score breakdown. T-ROUT-01 through 06 pass (10 unit tests including shared validator). Read-only actual demo performance: all 264 sections placed across 38 rooms and 72 teachers in 552 ms, score 0, no hard violations. Unit tests now run independently of database/Redis using Vitest projects; integration setup remains isolated and health passed after a transient migrate setup error. No env changes. A quota-related automatic approval review failure interrupted one check; user continued and checks resumed. Next: routine worker/job module, versions/report, editing/publish, weekly grids and PDFs.

- **14 Nov 2026, Codex, F5 complete:** All 13 endpoints and Swagger implemented. Full suite 70 passed in 186.13 seconds; type check, lint, format and build pass. Manual HTTP pass verified offerings, teacher mine, class-list JSON/CSV/PDF, preference lists, capacity update and all docs. Shared pure engine/routineValidator.ts checks active/type/capacity resources, room/teacher overlap and cross-slot unavailability; unit T-ROUT-05 is already implemented. Sections use serializable transactions, guard student clashes on rescheduling, synchronize published entries and retain overpaid credit on cancellation. registrationTotals.ts provides Decimal fee/payment-status calculation for F7 reuse. Preferences are locked once any routine version exists. No schema/env changes or pending questions. Next: F6 generator, worker/job module, routine version APIs and remaining T-ROUT tests.

- **14 Nov 2026, Codex, F4 complete:** All 10 endpoints and Swagger implemented. Full suite 53 passed in 119.49 seconds; type check, lint, format and build pass. Manual flow passed and temporary main-schema registration window was removed. Semester creation and transitions use serializable transactions; every forward gate and transition audit is enforced against existing tables. Running extensions require a reason, cannot shorten/change start/batch/semester, update only the affected batch's bill deadlines and audit atomically. No new schema or env changes. F5 is next; its full section and the routine hard rules were read. Required F5 tests are T-SEC-01 through T-SEC-10; cancellation needs Decimal fee recalculation and notifications, and scheduled sections must obey active room/type/capacity/teacher availability/clash rules.


- **14 Nov 2026, Codex, F4 verification:** Semester CRUD/current/admin detail/rule locking, all audited forward-only lifecycle gates, and registration windows implemented. Focused F4 suite: 14 passed, covering every required T-SEM ID and additional gates/window boundaries. Manual HTTP demo-semester/current/counts/default rules/window create-edit-delete/student batch scope and all 10 Swagger methods passed; temporary window removed, demo phase remains PLANNING. No schema or secret changes. Full 53-test suite/build pending before F4 completion.


- **14 Nov 2026, Codex, continuation checkpoint for F4:** F0–F3 are complete (24%) and pushed; F4 is claimed but no F4 application files have been created yet. Latest full suite: 39 passed in 82.44 seconds after the worker fix; type check, lint, format and build pass. Next: build semester module (create/list/current/admin detail/update), phase gates from section 3, then registrationWindow module and T-SEM-01 through T-SEM-09. Requirement 6.6 and lifecycle gates were read. Existing schema has no grades-published flag: inspect CourseResult rows for semester/student/course matches against ENROLLED enrollments when implementing the CLOSED gate, consistent with F11 publication; avoid adding schema fields. Keep all tests in clashless_test and all disposable Redis keys in clashless:test:. The domain chosen by the user is uni.edu; secrets and replacement working Redis values are only in ignored .env/.env.test. Use the skill checker rather than printing those files. Node/npm need elevated tool execution here. The diagnostic dev server has been stopped. No user input is pending. Read AGENTS.md and follow the session routine on continuation.


- **14 Nov 2026, Codex, F3 verified:** All 26 academic endpoints and Swagger implemented: departments, programs/curriculum, batches, courses/prerequisites, rooms, time slots/day patterns, historical result import and Decimal best-attempt CGPA. Full suite now 39 passed (11 academic, 11 user, 15 auth, smoke and real broker regression). Type check, lint/format and build pass. Manual HTTP department create/update/delete, invalid credits, all academic list/detail routes and all 26 Swagger methods passed. Normal server startup with real email worker passed after confirming its queue and schedulers were empty. The retry loop is fixed; test timeouts disappeared with no timeout increase or omitted assertions. Synthetic manual department was soft-deleted. Auth tests now use the actual department endpoint. F4 is next; all schemas for its gates already exist. No unresolved user questions.


- **14 Nov 2026, Codex, queue runtime fix during F3:** Normal server startup exposed BullMQ's optional ioredis loader failure under native ESM; its error loop flooded logs and caused two otherwise passing academic tests to time out. Stopped that process. Installed ioredis@5, now passes constructed clients, awaits worker readiness, throttles errors and sets run retry delay. Added a real broker regression on a UUID queue under the test prefix; it passed. A no-op probe on the real notification queue was rejected by automatic approval review, so diagnostics used an isolated empty queue instead. No real queued notifications were consumed by the probe. Rerun full suite after this fix before marking F3 done.


- **14 Nov 2026, Codex, F2:** User management implemented with 11 required tests; full suite 27 passed. Type check, lint/format (no diagnostics), build clean. Manual HTTP flow created and activated a synthetic student, fetched detail, blocked account (old token 401), soft-deleted it, filtered users and verified Swagger import docs; manual mail delivery was stubbed locally. CSV handles quoting/BOM/newlines, validates each row, reports duplicate/invalid rows, inserts chunks of 500 under serializable retries and queues emails. Worker payloads are removed after completion/final failure and errors log no payloads. Cloudinary helper now supplies url/publicId aliases while retaining native fields. F3 should replace auth tests' temporary department guard fixture with real route. No outstanding user questions.


- **14 Nov 2026, Codex, F1:** All auth behavior and Swagger implemented. Full suite: 16 passed (15 auth IDs plus smoke), final normalization test passed separately. Static type/lint/format checks clean. Manual HTTP demo-admin login/me/refresh/logout returned 200, replayed refresh returned 401, removed registration returned 404; Swagger includes activation and omits self-registration. Tests mock all outgoing services. F3 should replace the T-AUTH-12/13 test-only department guard route with the actual production endpoint when available. No user questions pending.


- **14 Nov 2026, Codex:** F0 implemented and verified: exact schema and both SQL constraints applied; Super Admin/profile seed; deterministic demo seed safely ran twice (96 courses, 72 faculty, 2100 students, 54600 results, 264 sections, zero overloaded faculty); audit/notification transaction helpers; BullMQ inline test mode and worker bootstrap; Redis seat pub/sub; grade/time helpers; isolated test harness and mocks. npm test: 1 smoke test passed. Type check, lint (no diagnostics), format check and build passed. Normal startup connected DB/Redis/mailer; HTTP welcome, Swagger and seeded admin login returned 200. Replaced failed Redis connection with user-supplied working service. Shared tests use clashless_test schema and clashless:test: keys; never reset public or FLUSHDB. Node/npm need elevated execution because the restricted shell cannot resolve their installation. F1 auth and F8 payment behavior remain scaffold behavior; F0 changed role/model references only. npm install reported five dependency advisories for later review.

- **14 Nov 2026, Claude Code (planning session):** wrote the planning documents only; no code yet. The folder has a git-ignored `.env` (its values weren't checked), an untracked `.gitignore` (already ignores `.env`, `.agents`, `.claude`, `.windsurf`), a stub `README.md`, and one commit (`first commit`) on `main`, pushed to `origin`. Start with F0.

## Questions for the user

1. **Install k6** (`winget install k6`) so the load test can run (AGENTS.md: installing software is yours to do). Because this machine's database is remote, please run `npm run test:load` (steps in the README) where PostgreSQL is local or close; paste or commit the counts and p95 and F13 can be closed at 100%.

Previously answered: first-admin/demo credentials supplied; uni.edu; shared database/Redis for this assignment. Values are stored only in ignored environment files.

## Decisions log

| Date | Decision | By |
|---|---|---|
| 14 Nov 2026 | Payments: a registration's payment amount is chosen by the student (min brings paid to 40%, max is the remaining due); callback and abandoned-payment job share complete/close/refund functions. Receipts and discard/reminder/seat emails go through the BullMQ `email` queue. Grades count as published when CourseResult rows exist for the semester. Exam slot delete also removes draft/archived entries for the slot. Section transactions allow 60 s on the shared remote DB. API pool size is `DATABASE_POOL_MAX` (default 10) and the listener backlog is 4096. | Claude Code |
| 14 Nov 2026 | The explicit demo --registration-open option may reopen its own batch window from now for two hours and move affected bill deadlines; it preserves enrollments/payments and never rewinds CLASSES or later semesters. A REGISTRATION rerun reuses the valid published routine. | Codex |
| 14 Nov 2026 | Admin WINDOW bypass skips time-range checks; if no window exists, an existing bill keeps its deadline, while a student with no bill returns 404 rather than inventing a deadline. atRisk includes overdue ACTIVE/UNPAID bills as well as those due within three days. | Codex |
| 14 Nov 2026 | F7 student select/unselect/switch share the registration mutation counter (10 per 10 seconds); idempotency keys apply to select as specified, with a short-lived ownership lock so concurrent first retries replay the same successful response. | Codex |
| 14 Nov 2026 | F5 extra scheduled sections are added to the published RoutineEntry grid; cancellation removes their published entry while retaining draft/archive history and all paid credit. Shared routineValidator implements hard rules now for F5 and will be reused by F6. | Codex |
| 14 Nov 2026 | F4 current-semester student response uses registrationWindow and serverTime; CLOSED grade gate will derive publication from matching CourseResult rows without schema changes. Zero percent/day rules are accepted as nonnegative configuration; credits remain positive Decimal. | Codex |
| 14 Nov 2026 | Assignment override: use supplied database/Redis services for tests, isolated PostgreSQL clashless_test schema and clashless:test: Redis keys; no shared FLUSHDB. Use uni.edu for university email domain. Credentials supplied and stored only in ignored .env. | User / Codex |
| 14 Nov 2026 | F1 guard tests use a test-only /api/departments route until F3 creates that resource, preserving feature order; replace with production endpoint in F3. | Codex |
| 14 Nov 2026 | Demo course catalogue taken from the AIUB BSc CSE curriculum (requirement.md Appendix A) | User |
| 14 Nov 2026 | AGENTS.md is the single instruction file for every agent; CLAUDE.md and GEMINI.md only point to it | Claude Code |
| 14 Nov 2026 | Work happens on `main` only; push after every completed feature, and also when stopping mid-feature | User / Claude Code |

## Manual test log

One line per feature after its manual pass (requirement.md 9.5): date, feature, what was tried, result.

- 14 Nov 2026, F0: HTTP welcome and Swagger UI returned 200; Swagger init includes login; seeded Super Admin login returned 200. SMTP verify succeeded. Normal bootstrap succeeded with database, Redis and Nodemailer connected; welcome and docs returned 200.

- 14 Nov 2026, F1: manual demo-admin login, role profile, token refresh and logout passed; old refresh rejected (401), self-register removed (404), Swagger paths verified.

- 14 Nov 2026, F2: manual HTTP create/activate/detail/block/delete/list and Swagger passed; blocking revoked old token (401); email delivery stubbed, synthetic student soft-deleted.

- 14 Nov 2026, F3: manual academic setup create/update/delete and invalid-credit check passed; nine list/detail/docs requests returned 200; all 26 academic Swagger methods present. Normal server and email worker startup passed on empty queue.

- 14 Nov 2026, F4: manual HTTP current/detail/date update, rejected duplicate semester, temporary future window create/edit/delete, student own window/serverTime, missing-routine phase gate and all 10 Swagger methods passed. Temporary window removed; demo remains PLANNING.

- 14 Nov 2026, F5: manual HTTP offerings, assigned teacher mine, class-list JSON/CSV/PDF, preference lists, unchanged-capacity update and all 13 Swagger methods passed. Tokens stayed in memory; no outgoing emails or demo schedule changes.

- 14 Nov 2026, F6: real BullMQ routine worker and manual HTTP generation/poll/report/publication passed for all 264 demo sections. Teacher grid/PDF, version listing and all 13 Swagger methods passed. Master and actual teacher PDF pages visually inspected clean. Demo now has published routine version 2 (version 1 archived) while semester remains PLANNING; no email workers started.

- 14 Nov 2026, F7: manual demo login, empty page, select/replay/switch/unselect, catalog flags, admin list/detail/add/remove and all 10 Swagger methods passed. Used an unregistered demo student; seats were released and a zero-fee bill with dropped enrollment history retained. Spring 2027 is REGISTRATION with published routine v3 (264 entries), and batch 23-3 has the two-hour seed window. No workers or outgoing email/payment services were started.

- 14 Nov 2026, F8: login, admin payments list and all 6 payment paths in Swagger; automated flows cover create/callback/idempotency/refund/receipt/jobs.

- 14 Nov 2026, F9: login, exam slots/versions lists, PHASE_NOT_ALLOWED on generate in REGISTRATION, all 9 exam paths in Swagger.

- 14 Nov 2026, F10: login, seat plan overview/last-used rooms, 404 on an unknown slot, all 13 seat-plan paths in Swagger.

- 14 Nov 2026, F11/F12: login, admin analytics (22-3: 300 students etc.), live view, audit log, notifications and 11 grade/notification/analytics/audit paths in Swagger.

## Environment notes (never write secrets here)

| Item | Value |
|---|---|
| OS | Windows 11 |
| Project folder | `D:\AhmadZubayer\Dev\Projects\Clashless-AdvancedUniversityManagement` |
| Node.js | v24.15.0 (checked 14 Nov 2026) |
| Git remote | `origin` → `https://github.com/AhmadZubayer/Clashless-AdvancedUniversityManagementSystem-ExpressServer-WebDevL2-A6.git`, branch `main` |
| Development database | Supplied hosted PostgreSQL; public schema migrated and seeded |
| Test database | Same supplied PostgreSQL, isolated clashless_test schema |
| Redis (dev / test) | Supplied replacement service; prefixed test keys; no shared FLUSHDB |
| Redis eviction policy | Provider reports volatile-lru; BullMQ recommends noeviction. No provider configuration changed; review in F13 |
| k6 installed | **No** (checked 14 Nov 2026); user asked to install it |
| PostgreSQL max_connections | 50 (hosted); ~56 ms round trip from this machine |

































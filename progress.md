# Clashless — Progress

> ## Overall: 28% complete (28 of 100 points)
> **In progress:** F5 Offerings, sections and teacher preferences · **Next:** F6 Class routine
> **Last updated:** 14 Nov 2026 by Codex

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
| F5 | Offerings, sections and teacher preferences | 6 | 🔄 In progress | F2, F4 | 6.7 |
| F6 | Class routine | 14 | ⬜ Not started | F5 | 6.8 |
| F7 | Registration | 14 | ⬜ Not started | F6 | 6.9 |
| F8 | Payments and the discard job | 8 | ⬜ Not started | F7 | 6.10, 7 |
| F9 | Exam routine | 7 | ⬜ Not started | F7 | 6.11 |
| F10 | Seat plan and invigilators | 10 | ⬜ Not started | F9 | 6.12 |
| F11 | Grades | 4 | ⬜ Not started | F7 | 6.13 |
| F12 | Notifications, dashboards and audit log | 4 | ⬜ Not started | F8, F10, F11 | 6.14–6.16 |
| F13 | Load test, performance and delivery | 5 | ⬜ Not started | All | 8, 9.7 |
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

## 🔄 In progress

### F5 — Offerings, sections and teacher preferences
Started: 14 Nov 2026 12:23 Asia/Dhaka by Codex
Handoff notes:
- Done: F0–F4 complete and pushed; all 53 tests and static/build checks pass.
- Half-done: offering create/list/delete and Swagger implemented. Creation and deletion enforce PLANNING; numbered sections are created atomically; enrollment history is preserved. Section management and its four Swagger endpoints now implemented; focused suite 11 passed (8 integration, 3 validator).
- Next step: teacher preferences, then complete F5 verification/manual pass. Class-list ownership, enrolled-only university ID sorting, escaped CSV and valid PDF passed focused tests.
- Traps: cancellation must retain overpaid credit and recalculate Decimal bills; schedule changes must protect teacher and student clashes, and published routine entries must stay consistent.


## ⏭️ Next

1. **F5 Offerings, sections and teacher preferences**: implement requirement.md 6.7; apply hard schedule rules from 6.8.1.
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
- [ ] Teacher slot preferences
- [ ] Tests T-SEC-01 … T-SEC-10
- [ ] Definition of done → commit → push

### F6 — Class routine (14 points)

- [ ] `engine/routineValidator.ts` with unit tests (T-ROUT-05)
- [ ] `engine/routineGenerator.ts`: candidates, ordering, greedy placement, repair, seeded local search, penalty (T-ROUT-01 … T-ROUT-04, T-ROUT-06)
- [ ] BullMQ `routine` worker and the `job` module (`GET /api/admin/jobs/:id`)
- [ ] Generate, list versions, view, report
- [ ] Move, swap, pin
- [ ] Publish (copies onto sections, archives the old version)
- [ ] Published routine, `/api/routines/me`, PDF exports
- [ ] Tests T-ROUT-07 … T-ROUT-14
- [ ] Definition of done → commit → push

### F7 — Registration (14 points)

- [ ] Select a section exactly as in 6.9.1 (raw insert + `FOR UPDATE`, guarded seat update)
- [ ] Unselect (6.9.2) and switch (6.9.3)
- [ ] Idempotency key and rate limit
- [ ] Fee and `paymentStatus` recalculation
- [ ] `GET /api/registrations/me` and offerings with per-student flags (catalog cache)
- [ ] SSE seat stream with Redis pub/sub
- [ ] Admin list, detail, manual add (bypass) and remove
- [ ] `--registration-open` option for `db:seed:demo`
- [ ] Tests T-REG-01 … T-REG-21
- [ ] Definition of done → commit → push

### F8 — Payments and the discard job (8 points)

- [ ] Adapt the skill's payment module to `SemesterRegistration` (mapping table in 6.10), bKash only
- [ ] `POST /api/payments/create` amount rules and `PAYMENT_IN_PROGRESS`
- [ ] Callback: `paidAmount` and `paymentStatus` in the same transaction; receipt email
- [ ] `me`, `:id`, receipt PDF, admin list
- [ ] Discard job, payment reminders, abandoned-payment job (section 7)
- [ ] Tests T-PAY-01 … T-PAY-11 and T-JOB-01 … T-JOB-05
- [ ] Definition of done → commit → push

### F9 — Exam routine (7 points)

- [ ] Exam slots: create, list, delete
- [ ] `engine/examRoutineGenerator.ts` and `engine/examRoutineValidator.ts` (T-EXAM-01 … T-EXAM-03)
- [ ] BullMQ `exam-routine` worker; generate, list, view, move, publish
- [ ] `GET /api/exam-routines/me` for students and teachers
- [ ] Tests T-EXAM-04 … T-EXAM-08
- [ ] Definition of done → commit → push

### F10 — Seat plan and invigilators (10 points)

- [ ] `engine/seatPlanValidator.ts` and `engine/seatPlanGenerator.ts` (T-SEAT-01 … T-SEAT-06)
- [ ] Create, overview, rooms, last-used rooms, generate, summary, room grid
- [ ] Swap and late student
- [ ] Publish with bulk email
- [ ] PDF exports: door, full, attendance
- [ ] Invigilators: automatic and by hand
- [ ] `GET /api/seat-plans/me`; exam seat reminder job
- [ ] Tests T-SEAT-07 … T-SEAT-13 and T-JOB-06
- [ ] Definition of done → commit → push

### F11 — Grades (4 points)

- [ ] Submit and view section grades
- [ ] Grade status and publish (CourseResult rows, CGPA)
- [ ] `GET /api/grades/me`
- [ ] Tests T-GRADE-01 … T-GRADE-06
- [ ] Definition of done → commit → push

### F12 — Notifications, dashboards and audit log (4 points)

- [ ] Notification endpoints
- [ ] Admin analytics, live registration view, `/api/analytics/me`
- [ ] Audit log endpoint
- [ ] Tests T-MISC-01 … T-MISC-05
- [ ] Definition of done → commit → push

### F13 — Load test, performance and delivery (5 points)

- [ ] `tests/load/makeTokens.ts` and `tests/load/select-section.k6.js` (ask the user to install k6 if it's missing)
- [ ] Run the load test (requirement.md 9.7); exactly 40 × 201 and 960 × 409
- [ ] T-ROUT-14 and T-SEAT-13 pass on this machine
- [ ] README: architecture, design decisions (why the guarded update, why column groups), load test and performance results
- [ ] Swagger review: every endpoint listed and described
- [ ] Full `npm test` run is green
- [ ] Definition of done → commit → push

---

## Handoff notes (newest first)

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

No outstanding questions. First-admin/demo credentials supplied; user chose uni.edu and shared database/Redis services for this assignment. Replacement Redis credentials supplied after the previous host failed DNS. Values are stored only in ignored environment files.

## Decisions log

| Date | Decision | By |
|---|---|---|
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
| k6 installed | _not checked yet_ |




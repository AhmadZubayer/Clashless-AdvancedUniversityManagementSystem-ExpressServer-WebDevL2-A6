# Clashless backend

University registration, class routines, exam routines and seat plans. Implementation status and continuation notes are in [progress.md](progress.md); the specification is [requirement.md](requirement.md).

## Development setup

Use Node.js 24, PostgreSQL and Redis. Install dependencies with `npm ci`. Copy `.env.example` to `.env` and fill in service credentials, first-admin details, `UNIVERSITY_EMAIL_DOMAIN` and `DEMO_PASSWORD`. Never commit environment files containing secrets.

Run `npm run db:deploy`, `npm run db:seed` and `npm run db:seed:demo`. Start the API with `npm run dev`; Swagger is at `http://localhost:5000/docs`. The first Super Admin uses `ADMIN_*`; all demo accounts use `DEMO_PASSWORD`. Seeds can be rerun without duplicating rows.

For a registration-ready demo, run `npm run db:seed:demo -- --registration-open`. It generates and publishes the class routine, advances Spring 2027 to REGISTRATION and opens batch 23-3 for two hours. Repeating the option reuses its published routine, reopens that demo window and moves affected bill deadlines without removing enrollments or payments. It refuses to rewind a semester that has entered CLASSES or a later phase.

## Verification

Copy `.env.test.example` to `.env.test` and configure the supplied PostgreSQL and Redis services. For this assignment, tests share the services and enforce `DATABASE_SCHEMA=clashless_test` and `REDIS_KEY_PREFIX=clashless:test:`. Tests migrate and truncate only that schema and delete only keys with that prefix. Development data in `public` is preserved. Set `REDIS_TLS=true` in both environments if the Redis provider requires TLS.

Run `npx tsc --noEmit`, `npm run lint:check`, `npm run format:check` and `npm test`. Build with `npm run build`, then start with `npm start`. Tests mock outgoing mail, Google verification, uploads and bKash calls.

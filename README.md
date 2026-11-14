# Clashless backend

University registration, class routines, exam routines and seat plans. Implementation status and continuation notes are in [progress.md](progress.md); the specification is [requirement.md](requirement.md).

## Development setup

Use Node.js 24, PostgreSQL and Redis. Install dependencies with `npm ci`. Copy `.env.example` to `.env` and fill in service credentials, first-admin details, `UNIVERSITY_EMAIL_DOMAIN` and `DEMO_PASSWORD`. Never commit environment files containing secrets.

Once F0's database schema and migration are ready, run `npm run db:migrate`, `npm run db:seed` and `npm run db:seed:demo`. Start the API with `npm run dev`; Swagger is at `http://localhost:5000/docs`.

## Verification

Use a separate PostgreSQL database and disposable Redis database in `.env.test`. Tests reset those databases. The test harness and demo seed are pending F0 work; see the checklist before running them.

Run `npx tsc --noEmit`, `npm run lint:check`, `npm run format:check` and, once the harness is implemented, `npm test`. Build with `npm run build`, then start with `npm start`.

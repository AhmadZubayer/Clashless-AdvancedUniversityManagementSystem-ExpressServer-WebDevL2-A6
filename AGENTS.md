# AGENTS.md — Clashless

Instructions for **any** AI coding agent working on this repository (Claude Code, Codex, Gemini CLI, Cursor, GitHub Copilot, Windsurf, or anything else). Several agents may work on this project one after another: when one runs out of limits, another picks up where it stopped. Everything you need to continue is in three files, so read them before doing anything.

## 1. The three files

| File | What it is for | Who changes it |
|---|---|---|
| [requirement.md](requirement.md) | **What** to build: rules, user journeys, database schema, every endpoint with its core logic, every test, build order, decisions already made | Only when the user changes a requirement. Write the change in progress.md → *Decisions log* |
| [progress.md](progress.md) | **Where the project is**: percentage done, completed / in progress / next, feature checklists, handoff notes, questions, environment notes | Every agent, during every session |
| AGENTS.md (this file) | **How to work**: getting the skill, the session routine, git and handoff rules | Only when the user asks |

`CLAUDE.md` and `GEMINI.md` only point here, for tools that look for those names. Don't put instructions in them.

**How** to build (project setup, folder structure, module files, naming, validation, logging, auth plumbing, payments, error handling) comes from the **express-super-skill**: <https://github.com/AhmadZubayer/skill-library/tree/main/express-super-skill>. Don't copy the skill's content into this repo; read it from your local copy (section 2).

## 2. Get the skill

The skill lives on GitHub, not in this repo. Keep a local copy in `.agents/skill-library/` (already git-ignored):

```bash
git clone --depth 1 https://github.com/AhmadZubayer/skill-library.git .agents/skill-library
```

If the folder already exists, update it instead:

```bash
git -C .agents/skill-library pull
```

Then read `.agents/skill-library/express-super-skill/SKILL.md`, and before each kind of work read the reference file it points to (Prisma, modules, auth, files/PDF/cron, payments). Run the skill's scripts from that path, for example:

```bash
node .agents/skill-library/express-super-skill/scripts/scaffold.mjs . --features google,uploads,pdf,bkash,cron
```

If your tool has the same skill installed natively (for example as a Claude Code skill), you may use that copy instead, as long as it is this skill.

## 3. Start of every session

Do these in order, every time, even if you worked on this project before:

1. **Read** this file, all of [progress.md](progress.md), and in [requirement.md](requirement.md): sections 0, 2, 6.1, 10 and 11, plus the full section of the feature you'll work on.
2. **Look at git:** `git status` and `git log --oneline -15`.
   - Uncommitted changes you didn't make are another agent's unfinished work. Read the handoff notes, keep the changes, and continue from them. **Never discard or reset them.** Commit them first as `wip(F<n>): picked up unfinished work`.
3. **Sync:** `git pull --rebase origin main`.
4. **Get or update the skill** (section 2).
5. **Check the real state, don't just trust progress.md.** Once F0 is done, run `npx tsc --noEmit` and `npm test`. If either fails, fixing that is your first task; write what you found in the handoff notes.
6. **Pick the work:**
   - If a feature is *In progress* in progress.md, continue it.
   - Otherwise take the first feature in *Next* whose *Needs* are all ✅ Completed.
   - Work on one feature at a time.
7. **Claim it:** move it to *In progress* in progress.md with your tool name and the date and time, update the summary line at the top, and commit `chore(progress): start F<n>`.

## 4. While working

- Build exactly what requirement.md says: paths, access, logic, error codes, tests. Don't add features that aren't listed. Follow the skill for where code goes and how it's written.
- Go through the feature's checklist in progress.md from top to bottom. **Tick each box as soon as it's done.**
- **Commit after every ticked box** (small commits). Each commit must pass `npx tsc --noEmit`. Never leave a completed feature's tests failing.
- **Keep the handoff notes current**: update them at least every time you tick a box, so that if you're cut off suddenly, the next agent knows what's done, what's half-done (file and function), what's next, and any traps.
- Never ask the user about anything in requirement.md section 11 (*Decisions already made*).
- **Ask the user** only for: secrets and `.env` values, installing software (PostgreSQL, Redis, k6, Docker), and choices that are hard to undo (see requirement.md 0.1). Write the question in progress.md → *Questions for the user* as well, so the next agent sees it.
- For anything else that's unclear, make the smallest choice consistent with requirement.md and write it in progress.md → *Decisions log*.
- **Secrets:** never print, log or commit `.env`, `.env.test`, tokens, passwords or OTPs. Check `.env` only with the skill's env checker, which never prints values.

## 5. Finishing a feature

A feature is done only when its **definition of done** in requirement.md 10.3 is met: every endpoint, Swagger docs, every listed test passing (and all earlier tests), clean type check, lint and format, one manual pass. Then:

1. **Update progress.md:**
   - Move the feature to *Completed* with the date, your tool name and the number of tests.
   - Recalculate the percentage (the rule is at the top of progress.md) and update the summary line.
   - Set its status board row to ✅, clear *In progress*, make the next feature *Next*.
   - Write a handoff note, and add one line to the *Manual test log*.
2. **Commit:** `feat(F<n>): <feature name> complete`.
3. **Push to GitHub:** `git push origin main`.
   - If the push is rejected: `git pull --rebase origin main`, run `npm test` again, then push again.
   - **Never force-push.**
   - Check that `git status` says the branch is up to date with `origin/main`.

## 6. Stopping before a feature is finished

If you're about to run out of limits, or the session is ending:

1. Update the handoff notes in progress.md: done, half-done, next step, traps.
2. Commit everything as `wip(F<n>): <short state>`. If the code doesn't compile right now, still commit, and say so at the top of the handoff notes; the next agent fixes it first.
3. Push to `origin main`, so an agent on another machine can continue too.

## 7. Git rules

- One branch: **`main`**. The remote is `origin` (its URL is in progress.md → *Environment notes*).
- Commit messages use Conventional Commits with the feature ID:
  - `feat(F7): select a section with a guarded seat update`
  - `test(F7): T-REG-10 concurrency test`
  - `fix(F6): repair step skipped pinned entries`
  - `docs: ...`, `chore(progress): ...`, `wip(F7): ...`
- Add your own tool's co-author line if your tool requires one. Don't add lines for other tools.
- **Never:** force-push, rewrite or squash pushed history, delete branches or tags, commit secrets, or commit `node_modules/`, `dist/`, `src/generated/`, `.agents/`, `.env*` (except `.env.example` and `.env.test.example`) or `tests/load/tokens.json`.
- Always commit `prisma/migrations/`. Never edit a migration that's already pushed; add a new one.

## 8. Where things go

[requirement.md](requirement.md) section 6.1 has the module map and mount paths. In short:

- One module per resource in `src/app/module/<name>/`, with the skill's six files.
- Pure algorithm code (generators, validators) goes in `src/app/engine/`.
- BullMQ workers go in `src/app/jobs/`, and the queue client in `src/app/lib/queue.ts`.
- Seat-count pub/sub goes in `src/app/lib/seatEvents.ts`.
- Tests go in `tests/` (layout in requirement.md 9.1). Name each test by its ID, e.g. `T-REG-10`.

## 9. Everyday commands

| Command | What it does |
|---|---|
| `npm run dev` | Start the API with reload |
| `npm test` | Run every unit and integration test |
| `npx tsc --noEmit` | Type check |
| `npm run lint:check` / `npm run format:fix` | Lint / format (Biome) |
| `npx prisma migrate dev --name <name>` | Create and apply a migration |
| `npx prisma generate` | Regenerate the Prisma client |
| `npm run db:seed` | Create the first Super Admin |
| `npm run db:seed:demo` | Load the demo data (requirement.md 9.6) |
| `npm run test:load` | k6 load test (F13) |

The machine is Windows. Shell examples here use Git Bash syntax; adapt them if your tool uses PowerShell.

# 🏋️ Gym Tracker

A private progress tracker built for **two people**. No more scribbling
"Bench Press: 3×12 @ 24kg" in a notebook — log your workouts, save reusable
routines, track your bodyweight and measurements, and watch your progress on
charts over time. Installable straight to your phone's home screen.

UI is in **European Portuguese (pt-PT)**. Weights and measurements are
**metric-only (kg / cm)**.

## Features

- **Workout logging** — pick an exercise, log sets × reps × weight, add notes
- **Fast repeat and editing** — repeat the previous session with its values,
  duplicate individual sets, see the last performance, and correct saved workouts
- **Reusable workout templates** — save a routine (e.g. "Treino de Pernas")
  and start a new session from it instead of picking exercises from scratch
- **Exercise progression** — per-exercise history with top weight, estimated
  1RM, and volume charts over time
- **Body measurements** — track bodyweight, body fat %, and tape measurements
  (waist, chest, arms, thighs, hips), with trend charts
- **Workout calendar** — a 52-week activity heatmap links each training day
  to its filtered workout history
- **Two-person, shared view** — see your own progress or switch to your
  training partner's via a simple toggle
- **Installable PWA** — add it to your phone's home screen like a native app
- **Resilient with poor signal** — an offline fallback and connection warning
  keep the app understandable, while workout and measurement drafts survive a
  dropped connection on the current device

## Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS v4**
- **Drizzle ORM** on **libSQL/SQLite** — a local `dev.db` file in development,
  **Turso** in production (same driver, no code changes between environments)
- **Recharts** for the progress graphs
- Lightweight cookie-session auth (signed JWT via `jose`, passwords hashed
  with `bcryptjs`) — no external auth provider

## Getting started

```bash
npm install

# 1. Set up your local environment
cp .env.example .env.local
# then edit .env.local: set a SESSION_SECRET and your two accounts' credentials

# 2. Create the SQLite schema and seed the two accounts + exercise catalog
npm run db:push
npm run db:seed

# 3. Run it
npm run dev                     # http://localhost:3000
```

Log in with the credentials you set in `.env.local` (`SEED_USER1_*` /
`SEED_USER2_*`). Change them there and re-run `npm run db:seed` to update.

## Scripts

| Command                              | What it does                                    |
| ------------------------------------- | ------------------------------------------------ |
| `npm run dev`                         | Dev server                                       |
| `npm run build`                       | Production build (also typechecks)               |
| `npm run start`                       | Serve the production build                       |
| `npm run lint`                        | ESLint                                           |
| `npm run typecheck`                   | TypeScript validation                            |
| `npm test`                            | Unit tests                                       |
| `npm run test:e2e`                    | Playwright browser workflow                      |
| `npm run check`                       | Lint + types + unit tests + production build     |
| `npm run db:push`                     | Apply `src/db/schema.ts` to the database (dev)   |
| `npm run db:generate` / `db:migrate`  | Generate + run SQL migrations (prod workflow)    |
| `npm run db:seed`                     | Upsert the two users + starter exercise catalog  |
| `npm run db:reset`                    | Wipe `dev.db`, re-push schema, re-seed           |
| `npm run db:studio`                   | Drizzle Studio — browse the database in a GUI    |
| `npm run backup:verify -- backup.sql` | Restore and integrity-check a dump temporarily   |

## Deploying (Vercel + Turso)

A plain SQLite file doesn't persist on serverless hosts, so production uses
**Turso** (libSQL — SQLite-compatible, generous free tier) instead of a file:

1. Create a [Turso](https://turso.tech) database and grab its URL + auth token.
2. On Vercel (or your host of choice), set the environment variables:
   - `DATABASE_URL` — your `libsql://<db>.turso.io` URL
   - `DATABASE_AUTH_TOKEN` — the Turso auth token
   - `SESSION_SECRET` — a fresh secret, **different from your local one**
     (generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)
3. Create the schema on Turso: run `npm run db:generate` then
   `npm run db:migrate` (or `db:push`) pointed at the Turso URL.
4. Seed it: `npm run db:seed` (with real names/emails/passwords — **not** the
   `changeme123` defaults).
5. Deploy. No code changes are needed between local dev and production.

## Next steps

Ideas for where to take this next, roughly in order of usefulness:

- [x] **Replace the default credentials and deploy with Vercel + Turso.**
- [x] **Fast workout logging** — repeat the previous workout, show the latest
      exercise performance, duplicate sets, and edit saved sessions.
- [x] **Automated quality and security gates** — CI, Playwright, CodeQL,
      dependency review, secret scanning, npm audit, and Dependabot.
- [x] **Training-day calendar / heatmap** — a GitHub-contributions-style grid
      on the dashboard shows consistency and opens the workouts from each day.
- [x] **Poor-network resilience** — a service worker provides a public offline
      fallback without caching authenticated pages, and workout/body forms keep
      local drafts until they can be submitted online.
- [ ] **Password reset / account settings page** — right now, changing an
      email or password means editing `.env.local` and re-running
      `npm run db:seed`.

## Notes

This is a personal project for private use by two people, not a general-audience
product — there's no sign-up flow, and accounts are provisioned by editing
`.env.local` and running `npm run db:seed`. See `CLAUDE.md` for architecture
notes if you're extending it with an AI coding assistant. See
[`docs/DEVSECOPS.md`](docs/DEVSECOPS.md), [`SECURITY.md`](SECURITY.md), and
[`CONTRIBUTING.md`](CONTRIBUTING.md) for delivery and security guidance. The
tested Turso recovery runbook is in
[`docs/BACKUP_RESTORE.md`](docs/BACKUP_RESTORE.md).

# 🏋️ Gym Tracker

A progress tracker born for **two people**, now with public registration. No more scribbling
"Bench Press: 3×12 @ 24kg" in a notebook — log your workouts, save reusable
routines, track your bodyweight and measurements, and watch your progress on
charts over time. Installable straight to your phone's home screen.

UI is in **European Portuguese (pt-PT)**. Weights and measurements are
**metric-only (kg / cm)**.

## Features

- **Weekly report** — workouts, volume, personal records beaten and calories vs goal, on screen and by email
- **Calorie tracker** — a private food diary with user-defined calorie goals,
  meal portions, full nutrition, product photos and day/week/month overviews.
  Manual entry, reviewed label/food AI and Open Food Facts barcode/store lookup.
  Historical nutrition snapshots and goals stay stable when products change.
  See [calorie tracker setup and limitations](docs/CALORIES.md).

- **Workout logging** — pick an exercise, log sets × reps × weight, add notes
- **Decimal weights** — enter `2.8` or `2,8` kg, including smaller increments;
  incomplete sets are flagged before saving instead of silently discarded
- **Identify equipment from a photo** — take a photo or choose an image,
  preview it, then let AI suggest existing catalogue exercises for confirmation.
  Optional server-side OpenAI or OpenRouter configuration (including Qwen vision);
  manual selection always works, with a persistent daily AI quota per account
- **Searchable catalogue** — Portuguese aliases, equipment, editable metadata,
  private favorites and recent exercises
- **Compact workout entry** — consecutive sets grouped by exercise, with a
  pauseable rest timer that survives navigation on the same device
- **Fast repeat and editing** — repeat the previous session with its values,
  duplicate individual sets, see the last performance, and correct saved workouts
- **Reusable workout templates** — save a routine (e.g. "Treino de Pernas")
  and start a new session from it instead of picking exercises from scratch
- **Exercise progression** — per-exercise history with top weight, estimated
  1RM, and volume charts over time
- **Body progress** — track bodyweight, body fat %, BMI and tape measurements
  (waist, chest, arms, thighs, hips), with a summary of how much each one
  changed over a chosen period (30 days, 3 months, 1 year or all time),
  per-measure trend charts, and a history table showing each entry's change
- **Workout calendar** — a 52-week activity heatmap links each training day
  to its filtered workout history, and a monthly calendar on the workouts page
  navigates and filters sessions by day
- **Workout planning** — schedule a workout on a future day by picking what it
  trains (peito, dorsal, pernas, bíceps… or anything you type), optionally
  starting from a template, then register it from the calendar when it's done
- **Weekly routine** — set your split once (Monday: peito, tríceps, ombros;
  Tuesday: dorsal, bíceps; …) and fill a whole month with one tap; it only
  adds days that are still free, so you can re-run it safely
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
# then edit .env.local: set a SESSION_SECRET; accounts are created at /registo (the seed script still provisions the two original accounts)

# 2. Apply the versioned migrations and seed both accounts + exercise catalog
npm run db:migrate
npm run db:seed

# 3. Run it
npm run dev                     # http://localhost:3000
```

Log in with the credentials you set in `.env.local` (`SEED_USER1_*` /
`SEED_USER2_*`). Change them there and re-run `npm run db:seed` to update.

## Scripts

### Optional AI setup

Choose a provider in `.env.local` or your host's secret environment settings:

- OpenAI: `AI_PROVIDER=openai`, `OPENAI_API_KEY`, optional
  `OPENAI_VISION_MODEL` (default `gpt-4.1-mini`).
- OpenRouter: `AI_PROVIDER=openrouter`, `OPENROUTER_API_KEY`, optional
  `OPENROUTER_VISION_MODEL` (default `qwen/qwen3-vl-30b-a3b-instruct`).
  The model and serving endpoint must support images and strict JSON Schema.
  Unit/package conversion is resolved in the calorie diary, without mandatory
  weight fields when creating a product; missing unit weights can be estimated explicitly.
  `z-ai/glm-5.3-flash` is explicitly supported via JSON mode with server-side
  schema validation (for both food and machine photos).
- `AI_DAILY_LIMIT=20`: attempts per account/Lisbon day, shared across instances.
  Provider failures consume attempts too; set a credit limit with the provider.

Run `npm run db:migrate` before starting this version: migration 0002 adds
catalogue metadata, favorites and daily quota counters without replacing sets.
Back up real databases first. Restart/redeploy after changing environment.
Never use `NEXT_PUBLIC_` for keys. Without a key, manual entry still works.

See [`docs/AI_RECOGNITION.md`](docs/AI_RECOGNITION.md) for supported photos,
privacy, limits and the live validation checklist. Prioritised improvements
are tracked in [`docs/IMPROVEMENTS.md`](docs/IMPROVEMENTS.md).

### Commands

| Command                              | What it does                                    |
| ------------------------------------- | ------------------------------------------------ |
| `npm run dev`                         | Dev server                                       |
| `npm run build`                       | Production build; applies prod schema on Vercel  |
| `npm run start`                       | Serve the production build                       |
| `npm run lint`                        | ESLint                                           |
| `npm run typecheck`                   | TypeScript validation                            |
| `npm test`                            | Unit tests                                       |
| `npm run test:e2e`                    | Playwright browser workflow                      |
| `npm run check`                       | Lint + types + unit tests + production build     |
| `npm run db:migrate`                  | Verify and apply pending SQL migrations           |
| `npm run db:generate`                 | Generate a versioned migration after schema edits |
| `npm run db:push`                     | Sync a disposable development database only       |
| `npm run db:seed`                     | Upsert the two users + starter exercise catalog  |
| `npm run db:reset`                    | Wipe `dev.db`, migrate it, and re-seed            |
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
3. In Vercel, enable **Automatically expose System Environment Variables** and
   keep the default package build command (`npm run build`).
4. Deploy. After a successful compile, the build verifies the migration ledger
   and applies pending versioned migrations before Vercel activates it; preview
   and ordinary local builds skip this step.
5. Seed it: `npm run db:seed` (with real names/emails/passwords — **not** the
   `changeme123` defaults).

The manual `Database schema` GitHub workflow is an emergency recovery path for
`main`, not part of the normal deployment sequence.

## Next steps

Ideas for where to take this next, roughly in order of usefulness:

- [x] **Replace the default credentials and deploy with Vercel + Turso.**
- [x] **Fast workout logging** — repeat the previous workout, show the latest
      exercise performance, duplicate sets, and edit saved sessions.
- [x] **Automated quality and security gates** — CI, Playwright, CodeQL,
      dependency review, secret scanning, npm audit, and Dependabot.
- [x] **Training-day calendar / heatmap** — a GitHub-contributions-style grid
      on the dashboard shows consistency and opens the workouts from each day.
- [x] **Monthly calendar with workout planning** — a month view on the
      workouts page filters sessions by day and schedules future workouts
      from templates, marking them done once the session is logged.
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

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Gym Tracker — a private, two-person web app for logging workouts (exercise →
sets × reps × weight), reusable workout templates, and body measurements, with
progress charts. Phone-first PWA, hosted on a free tier (Vercel + Turso).

**UI language is European Portuguese (pt-PT)** — all user-facing strings,
`<html lang="pt">`, and date formatting (`src/lib/format.ts` uses locale
`"pt-PT"`) are Portuguese. Keep new UI copy in pt-PT to match. **Units are
metric-only (kg for weight, cm for measurements)** — there is no unit field on
exercises; weight labels are hardcoded `"kg"` throughout (see the "no lb"
decision below).

## Critical: this is bleeding-edge Next.js

Pinned to **Next.js 16**, **React 19**, **Tailwind CSS v4** — newer than most
training data. `AGENTS.md` (imported below) says it plainly: **read the relevant
guide in `node_modules/next/dist/docs/` before using an unfamiliar API.** The
conventions that differ from older Next and already bit this codebase:

- `cookies()`, and page `params` / `searchParams`, are **async** — always `await`
  them. Pages type props as `Promise<…>`.
- Middleware is renamed to **`proxy.ts`** (there is no `middleware.ts`).
  `src/proxy.ts` exists for exactly one job: minting the per-request CSP nonce,
  which has to happen before rendering. **Never move auth into it** — per the
  Next docs, auth is enforced in server components and in every server action,
  not at the proxy layer. Because the nonce is stamped during SSR, every page
  that serves HTML must render dynamically; that is why `src/app/not-found.tsx`
  calls `connection()`.
- **Tailwind v4:** `@apply` can only reference real utilities, not other custom
  component classes. In `globals.css` each `.btn-*` variant repeats the base
  button utilities rather than `@apply btn`.
- **Zod v4:** avoid `z.string().email()`; validate emails plainly.

## Commands

```bash
npm run dev            # dev server (http://localhost:3000)
npm run build          # production build (also runs full tsc typecheck)
npm run start          # serve the production build
npm run lint           # ESLint
npm run typecheck      # TypeScript without emitting files
npm test               # node:test unit suite through tsx
npm run test:e2e       # Playwright browser flow
npm run check          # lint + typecheck + unit tests + production build
npx tsc --noEmit       # typecheck only

npm run db:push        # sync a disposable development DB only
npm run db:generate    # generate a versioned SQL migration
npm run db:migrate     # verify the ledger and apply pending migrations
npm run db:seed        # upsert the 2 users + starter exercise catalog
npm run db:reset       # wipe dev.db, migrate it, re-seed
npm run db:studio      # browse the DB
```

GitHub Actions run lint, typechecking, unit tests, a production build, a
Playwright workout flow, CodeQL, dependency review, Gitleaks, and npm audit.
Production Vercel builds apply verified, versioned migrations in `postbuild`;
the manual database workflow on `main` is the recovery path. See
`docs/DEVSECOPS.md`.

## Architecture

**Auth (`src/lib/auth.ts`).** A signed JWT (`jose`, HS256) in an httpOnly cookie;
passwords hashed with `bcryptjs`. `requireUser()` is the security boundary: it is
called by the protected layout **and must be called at the top of every server
action that reads or writes data**. `login`/`logout` are server actions
(`src/app/login/actions.ts`, `src/app/(app)/actions.ts`).

**Routing.** `src/app/(app)/` is the protected area — its `layout.tsx` calls
`requireUser()` and renders the app shell (header, `UserSwitcher`, `BottomNav`).
`/` and `/login` are public. `src/app/page.tsx` redirects based on session.

**Reads vs. writes.** Reads live in `src/lib/queries.ts` (`import "server-only"`;
result sets are tiny, so aggregation like est-1RM and per-session grouping is done
in plain JS, not SQL). Writes are **server actions colocated in each feature's
`actions.ts`** — they `requireUser()`, validate with Zod, mutate via Drizzle,
`revalidatePath(...)`, then `redirect(...)`. Client components call actions
directly with **typed objects** for structured data (e.g. `createWorkout({ date,
entries })`); only `login` uses `FormData` + `useActionState`.
Multi-step writes must use a database transaction. Update and delete actions
must re-read ownership from the signed-in user instead of trusting client data.

**Two-user model.** `getPageContext(searchParams)` (in `queries.ts`) resolves who
is being viewed from `?user=<id>` (default = signed-in user) and returns
`{ me, viewed, isSelf, query }`. **Reads are parameterized by `viewed.id`; writes
always target the signed-in user.** `UserSwitcher` sets the param; append the
returned `query` string to internal links to keep viewing the same person.

**Database (`src/db/`).** A single libSQL client (`index.ts`); schema in
`schema.ts`. Local dev uses `file:./dev.db`; production uses a Turso
`libsql://…` URL + `DATABASE_AUTH_TOKEN` (same driver, no code change).
Timestamps are stored as unix seconds and surfaced as JS `Date`s; foreign keys
cascade on delete (libSQL enforces FKs). `next.config.ts` lists
`@libsql/client` in `serverExternalPackages` so its native binding isn't bundled.

**Charts.** `src/components/progress-chart.tsx` is the only Recharts surface
(`'use client'`); server pages pass plain `{ date, … }[]` arrays into it. Its
`unit` prop is just the chart's display suffix (e.g. `"kg"`, `" cm"`) — not
related to the (removed) per-exercise unit field. For a trend line with no axes
or interaction, prefer `src/components/sparkline.tsx`: plain SVG, renders on the
server, ships no JS.

**Body progress.** `src/lib/body-progress.ts` is a pure, unit-tested module that
turns body-metric rows into per-measure progress over a range (`?range=`, one of
`30d|3m|1y|all`, default `3m`; `?measure=` selects the expanded chart — both
strictly validated). Two conventions matter. **The baseline for a range is the
last reading *before* the window** (falling back to the first inside it), so a
range shows real change over it even when you measure rarely. **Each measure
carries a `goal`** (`down` for waist and body fat, `up` for chest/arm/thigh,
`neutral` for weight and hips, since those depend on cutting vs. bulking);
`deltaTone()` maps a change plus its goal to good/bad/neutral colouring, so
green never means "the number went down" by itself.

**Personal records.** `src/lib/personal-records.ts` is pure and unit-tested:
`markRecords()` walks an exercise's sessions oldest → newest and flags the ones
that beat every earlier session, on heaviest set or on estimated 1RM. Two rules
matter — **the first session is never a record** (nothing to beat, and badging
it would mark every exercise the first time you try it), and **ties never
count**, only strict improvements. Records are derived on read, so editing or
deleting a workout re-evaluates them with no stored state to migrate.
`getPersonalRecords(userId)` returns `workoutId → Set<exerciseId>` for badges in
lists; `getExerciseProgression` marks each point instead.

**Template suggestions.** `src/lib/template-match.ts` connects a day planned by
muscle group to the saved templates that train it. Matching goes through
`formatMuscleGroup`, so the seeded English catalog (`Chest`, `Legs`) compares
against pt-PT plan groups, and a small `CONTAINS` map handles broader groups
holding narrower ones — the catalog files biceps and triceps under `Arms`, so a
"Tríceps" day would otherwise match nothing. Ranking subtracts half a point per
group the template trains that was not planned, so a focused template beats a
full-body one instead of losing to it for touching more muscles.

**Workout templates.** `workoutTemplates` + `workoutTemplateExercises` (schema)
are per-user, ordered lists of exercises with no reps/weight (e.g. "Treino de
Pernas" → Squat, Leg Press). `getWorkoutTemplates`/`getWorkoutTemplate` in
`queries.ts` read them; `src/app/(app)/workouts/templates/` has the manage
page + actions (`createTemplate`, `deleteTemplate`). `/workouts/new` accepts
`?template=<id>`, fetches it server-side, and passes `initialRows` into
`WorkoutForm` — the form is keyed on the template id
(`key={activeTemplate?.id ?? "blank"}`) so switching templates remounts it and
actually resets state (a plain prop change would not, since `useState`'s
initial value only applies on first mount).

**Calendar & planned workouts.** All calendar date math uses the UTC-midnight
convention (workout dates are stored as `new Date("YYYY-MM-DD")`, i.e. UTC
midnight, so ISO `YYYY-MM-DD` keys and exact-equality date filters line up).
`src/lib/workout-calendar.ts` (52-week dashboard heatmap + `readDateKey`
query-param validation) and `src/lib/month-calendar.ts` (month grid for
`/workouts` + `readMonthKey`) are pure, unit-tested modules. `plannedWorkouts`
(schema) schedules a workout on a date, optionally tied to one of the user's
templates; "done" is **derived** — a plan counts as concluded when the user has
any real workout on that date — so nothing needs updating when a workout is
logged or deleted. `/workouts` accepts `?month=YYYY-MM` and `?date=YYYY-MM-DD`
(both strictly validated); a selected future day offers `PlanWorkoutForm`, and
"Registar" links to `/workouts/new?date=…&template=…`, which prefills both.

**Muscle groups & the weekly routine.** A plan says *what* it trains
(`plannedWorkoutGroups`) independently of *which exercises* it starts from (the
optional template). Groups are plain labels, not an entity — `MUSCLE_GROUP_SUGGESTIONS`
in `src/lib/muscle-groups.ts` is only a shortcut, and any text the user types is
equally valid, so never validate against the suggestion list.
`normalizeGroupNames()` (trim, collapse spaces, drop case-insensitive
duplicates, cap at 8) is the single funnel every write goes through.
`routineGroups` stores the recurring weekly split — one row per group per ISO
weekday (1 = Monday … 7 = Sunday), and a weekday with no rows is a rest day.
`applyRoutineToMonth` materializes it into planned workouts via the pure
`planRoutineApplication()` in `src/lib/routine.ts`: **only days from today
onward that have no plan yet**, so re-running it never duplicates or destroys
anything. Editing `/workouts/routine` saves per weekday as you toggle chips
(last write wins); there is no save button.

## Conventions & gotchas

- Import alias: `@/*` → `src/*`.
- Scripts that run **outside** Next (via `tsx`) — `scripts/seed.ts`,
  `scripts/migrate-database.ts`, `drizzle.config.ts` — must
  `process.loadEnvFile(".env.local")` **before** any
  import that reads env, and therefore import the db module dynamically.
- Env vars: `DATABASE_URL`, `DATABASE_AUTH_TOKEN` (prod), `SESSION_SECRET`,
  `SEED_USER1_*` / `SEED_USER2_*`. Local values live in `.env.local` (gitignored).
- Adding a field/table: edit `src/db/schema.ts`, run `npm run db:generate`,
  inspect the generated SQL, and test `npm run db:migrate`; add reads to
  `queries.ts` and writes as a new/updated server action.
- Never use `db:push` to evolve a persistent database. It is reserved for
  disposable prototyping; versioned migrations are the source of truth.
- `<html>`/`<body>` in `src/app/layout.tsx` have `suppressHydrationWarning`
  because browser extensions (e.g. Dark Reader) inject attributes like
  `data-darkreader-proxy-injected` client-side, which otherwise trips a
  hydration-mismatch warning that isn't an actual app bug.

@AGENTS.md

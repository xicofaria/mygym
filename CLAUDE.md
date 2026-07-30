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

npm run db:push        # apply src/db/schema.ts to the DB (dev workflow)
npm run db:generate    # generate SQL migrations (prod workflow)
npm run db:migrate     # run migrations
npm run db:seed        # upsert the 2 users + starter exercise catalog
npm run db:reset       # wipe dev.db, re-push schema, re-seed
npm run db:studio      # browse the DB
```

GitHub Actions run lint, typechecking, unit tests, a production build, a
Playwright workout flow, CodeQL, dependency review, Gitleaks, and npm audit.
See `docs/DEVSECOPS.md`.

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

## Conventions & gotchas

- Import alias: `@/*` → `src/*`.
- Scripts that run **outside** Next (via `tsx`) — `scripts/seed.ts`,
  `drizzle.config.ts` — must `process.loadEnvFile(".env.local")` **before** any
  import that reads env, and therefore import the db module dynamically.
- Env vars: `DATABASE_URL`, `DATABASE_AUTH_TOKEN` (prod), `SESSION_SECRET`,
  `SEED_USER1_*` / `SEED_USER2_*`. Local values live in `.env.local` (gitignored).
- Adding a field/table: edit `src/db/schema.ts` → `npm run db:push`; add reads to
  `queries.ts` and writes as a new/updated server action.
- `db:push` prompts interactively on data-loss changes (e.g. dropping a
  column); non-interactively use `npx drizzle-kit push --force` (only after
  confirming the loss is expected/acceptable).
- `<html>`/`<body>` in `src/app/layout.tsx` have `suppressHydrationWarning`
  because browser extensions (e.g. Dark Reader) inject attributes like
  `data-darkreader-proxy-injected` client-side, which otherwise trips a
  hydration-mismatch warning that isn't an actual app bug.

@AGENTS.md

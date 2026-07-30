# DevSecOps pipeline

The repository uses blocking GitHub Actions checks to keep product quality and
security controls in the same delivery path.

## CI controls

`CI` runs on pull requests and pushes to `main`:

- ESLint;
- TypeScript typechecking;
- unit tests;
- a production Next.js build;
- a Playwright login/create/edit/repeat workout flow against an isolated
  SQLite database.

## Security controls

`Security` runs on pull requests, pushes to `main`, and every Monday:

- CodeQL with the `security-extended` query suite;
- dependency review, blocking newly introduced vulnerabilities of moderate
  severity or higher;
- Gitleaks over complete Git history;
- `npm audit` for high or critical production dependency vulnerabilities.

All third-party actions are pinned to immutable commit SHAs. Dependabot checks
both npm and GitHub Actions dependencies weekly.

## Database schema delivery

`Database schema` runs on pushes to `main` that change `src/db/schema.ts` or
`drizzle.config.ts` (and on manual dispatch): it applies the Drizzle schema to
the production Turso database with a non-interactive `drizzle-kit push`. It
needs the `DATABASE_URL` and `DATABASE_AUTH_TOKEN` repository secrets and
refuses to run without them (otherwise the drizzle config would silently fall
back to a local file). It never passes `--force`, so destructive changes
(dropping or renaming columns) fail the job on purpose and must be applied
manually after backing up (`turso db shell <db> .dump > backup.sql`).

## Recommended branch protection

After the workflows have run once on `main`, configure the branch ruleset to:

1. require a pull request before merging;
2. require the `Lint, types, tests and build`, `End-to-end workout flow`,
   `CodeQL`, `Dependency review`, `Secret scan`, and
   `Production dependency audit` checks;
3. require branches to be up to date;
4. block force pushes and branch deletion;
5. require code-owner review when a second maintainer is added.

Repository settings are intentionally not changed by the workflow itself.

## Runtime controls in the application

`next.config.ts` sets `X-Content-Type-Options`, `X-Frame-Options`,
`Referrer-Policy`, `Permissions-Policy` and HSTS on every route.

The Content-Security-Policy is separate because it is nonce-based, and a nonce
has to be minted per request: `src/proxy.ts` generates one, puts it on the
request so Next can stamp it onto the scripts it emits during SSR, and sets the
matching header on the response. `script-src` therefore needs no
`'unsafe-inline'` — it is `'nonce-…' 'strict-dynamic'`, so an injected script
without the nonce does not execute.

Two consequences worth knowing before changing this:

- **Every HTML route must render dynamically.** A prerendered page has no
  nonce, so its scripts would all be blocked. `src/app/not-found.tsx` calls
  `connection()` for this reason; any new statically rendered page needs the
  same treatment.
- **`style-src` keeps `'unsafe-inline'`.** A nonce only whitelists `<style>`
  elements, never `style="…"` attributes, and Recharts styles its SVG that way.
  `style-src-attr` would be the surgical fix but Safari support is patchy, and
  this is a phone-first PWA.

## Offline boundary

`public/sw.js` caches only the public `/offline` response and immutable
`/_next/static/` assets. It deliberately bypasses authenticated HTML, RSC/API
responses, Server Actions, non-GET requests and cross-origin resources. Do not
expand that cache to user-specific pages: both people can use the same installed
PWA and a shared HTML cache would leak one person's history to the other.

Workout and body-measurement forms persist drafts in device-local storage. A
draft is convenience recovery, not a confirmed write: it only becomes part of
the database after the authenticated Server Action succeeds.

## Production controls outside GitHub

The deployment platform should provide:

- rate limiting or a firewall rule for `/login`;
- separate preview and production secrets;
- Turso backup/restore procedures;
- deployment protection so only a green commit can reach production.

The backup and recovery procedure, including a local integrity-checking restore,
is documented in [`BACKUP_RESTORE.md`](BACKUP_RESTORE.md).

# Contributing

## Local setup

1. Copy `.env.example` to `.env.local` and replace every placeholder.
2. Run `npm ci`.
3. Run `npm run db:migrate` and `npm run db:seed`.
4. Start the app with `npm run dev`.

## Before opening a pull request

Run:

```bash
npm run check
```

For the browser flow, install Chromium once with
`npx playwright install chromium`, and run:

```bash
npm run test:e2e
```

Playwright always recreates the disposable local `e2e.db`; external database
URLs and credentials are deliberately ignored.

## Pull request expectations

- Keep server actions authenticated, authorized, and validated.
- Scope every update or delete by the signed-in user.
- Use a database transaction for multi-step writes.
- Add tests for fitness calculations and authorization boundaries.
- Update user-facing copy in European Portuguese.
- Do not commit `.env` files, database files, tokens, or real credentials.

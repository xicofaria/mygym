# Contributing

## Local setup

1. Copy `.env.example` to `.env.local` and replace every placeholder.
2. Run `npm ci`.
3. Run `npm run db:push` and `npm run db:seed`.
4. Start the app with `npm run dev`.

## Before opening a pull request

Run:

```bash
npm run check
```

For the browser flow, prepare a disposable local database with the seed
credentials from `playwright.config.ts`, install Chromium once with
`npx playwright install chromium`, and run:

```bash
DATABASE_URL=file:./e2e.db npm run db:push
DATABASE_URL=file:./e2e.db npm run db:seed
DATABASE_URL=file:./e2e.db npm run test:e2e
```

Never point browser tests at production or a database containing real workout
history.

## Pull request expectations

- Keep server actions authenticated, authorized, and validated.
- Scope every update or delete by the signed-in user.
- Use a database transaction for multi-step writes.
- Add tests for fitness calculations and authorization boundaries.
- Update user-facing copy in European Portuguese.
- Do not commit `.env` files, database files, tokens, or real credentials.

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Repository rules

- Keep user-facing copy in European Portuguese and units in kg/cm.
- Read the relevant files in `node_modules/next/dist/docs/` before using an
  unfamiliar Next.js API.
- Treat every Server Action as an untrusted entry point: authenticate,
  authorize ownership, validate input, and minimize return values.
- Use a database transaction for multi-step writes.
- Run `npm run check` before committing. Run `npm run test:e2e` when changing
  authentication or workout flows.
- Never commit `.env` files, SQLite databases, tokens, or real credentials.
- Keep workflows least-privileged and pin third-party actions to commit SHAs.

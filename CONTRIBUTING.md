# Contributing

## Trabalho com agentes

Começar por [AGENTS.md](AGENTS.md) e consultar as referências da área alterada.
`CLAUDE.md` importa essas mesmas regras, evitando cópias divergentes.
A organização e as fontes oficiais estão em [AGENT_GUIDANCE.md](docs/AGENT_GUIDANCE.md).

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

Para alterações de autenticação, treinos ou fluxos de calorias, executar também
o E2E. Instalar Chromium uma vez com
`npx playwright install chromium`, and run:

```bash
npm run test:e2e
```

Playwright always recreates the disposable local `e2e.db`; external database
URLs and credentials are deliberately ignored.

Para documentação sem alterações de código, verificar links locais, comandos
referidos e `git diff --check`. Antes de commits, executar `npm run check`.
As regras completas de isolamento e seleção de testes estão em
[TESTING.md](docs/TESTING.md).

## Pull request expectations

- Keep server actions authenticated, authorized, and validated.
- Scope every update or delete by the signed-in user.
- Use a database transaction for multi-step writes.
- Add tests for fitness calculations and authorization boundaries.
- Update user-facing copy in European Portuguese.
- Do not commit `.env` files, database files, tokens, or real credentials.

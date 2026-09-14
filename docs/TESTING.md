# Regras de validação

- E2E must wait for a valid selected product ID after saving before constructing
  API URLs. An existing select can still hold its empty placeholder while refresh
  completes; inputValue() alone does not wait for the desired value.

- Run `npm run check` for code changes and before committing. Run
  `npm run test:e2e` for authentication, workout or calorie flow changes.
  E2E uses disposable `e2e.db` and clears both provider keys; tests must never
  call a billable provider or inherit production database credentials.
- Unit tests cover decimal parsing, recognition payloads and output validation.
  Keep unit test files directly in `tests/unit/`; the npm glob also works with
  Node 20's shell expansion (which does not understand a recursive `**` glob).
  E2E covers persistence/edit/repeat, photo confirmation/fallback, authentication
  and the absence of a key. Mocked tests do not establish real photo accuracy.
- Migration 0002 adds catalogue metadata, private favorites and persistent AI
  quotas. Test upgrades from release 0001 with/without a ledger; preserve IDs,
  decimal sets and explicit plan links. Never edit published 0000/0001 hashes.
- Migration 0008 adds `exercises.user_id` and the per-scope name indexes. Test
  the upgrade from 0007 with legacy rows: common exercises stay read-only, IDs,
  decimal sets and template/plan links survive, equal names across accounts are
  allowed and deleting an account removes only its private exercises.
- Next/eslint-config-next 16.3.4, postcss 8.5.28, esbuild >=0.28.2 and sharp
  0.35.4 resolve the audited dependency findings; the sharp override tracks the
  libheif advisories reached through Next's optional image optimizer. Verify
  drizzle-kit generation after changing its transitive esbuild override; do not
  downgrade via audit fix --force.

Para alterações apenas de documentação, verificar os links locais, os comandos
referidos e `git diff --check`; não criar testes que apenas repetem o texto.
A obrigação de executar `npm run check` antes de um commit mantém-se.
Depois de passarem as verificações necessárias, repetir ou alargar testes apenas
perante novas alterações, falhas ou dúvidas concretas.

O build executa `postbuild`: numa validação local, limpar os marcadores
`VERCEL`/`VERCEL_ENV` para evitar ativar migrações de produção. Usar a configuração
Playwright existente para o E2E isolado. Ver [DEVSECOPS.md](DEVSECOPS.md).

Registar resultados efetivamente obtidos e limitações no PR ou na entrega;
o CI conserva os resultados automáticos. Não é necessário atualizar um diário
de validação por alteração. Experiências reais que expliquem limites do produto
podem ser documentadas no guia da funcionalidade. Os registos anteriores estão
no [arquivo de setembro de 2026](archive/VALIDATION_2026-09.md).

## Compatibilidade das atualizações Dependabot — setembro de 2026

O PR #46 integra as atualizações compatíveis dos grupos #47/#48 e CodeQL
4.38.0 (#49/#50, init/analyze no mesmo SHA). React/React DOM ficam em 19.3.0;
Playwright em 1.63.0. O intervalo Zod proposto (`^4.6.2`) resolve 4.6.5 no lockfile.

TypeScript 7.0.2 e ESLint 10.10.0 foram adiados: o lint falha explicitamente
com TypeScript 7 em `typescript-eslint`; `eslint-plugin-import@2.32.0`, usado
pelo Next, só declara peers até ESLint 9. Manter TypeScript 6.0.3 e ESLint 9.39.5
até existir uma combinação suportada; não usar `--force` ou `--legacy-peer-deps`
para ocultar estas incompatibilidades. ESLint 9 já tem aviso de fim de suporte
no registry, pelo que esta exceção deve ser revista na próxima atualização do tooling.

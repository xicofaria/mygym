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

## Production controls outside GitHub

The deployment platform should provide:

- rate limiting or a firewall rule for `/login`;
- separate preview and production secrets;
- Turso backup/restore procedures;
- deployment protection so only a green commit can reach production.

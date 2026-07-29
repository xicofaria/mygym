# Security policy

## Supported version

The `main` branch is the only supported version of this private-use
application.

## Reporting a vulnerability

Do not open a public issue containing credentials, personal data, database
URLs, exploit details, or other sensitive information. Report vulnerabilities
privately to the repository owner through GitHub's private vulnerability
reporting feature.

Include:

- the affected page, action, or commit;
- the conditions required to reproduce the issue;
- the expected impact;
- a minimal reproduction when it is safe to share.

## Deployment requirements

- Production must provide `DATABASE_URL`, `DATABASE_AUTH_TOKEN` for remote
  libSQL, and a unique `SESSION_SECRET` of at least 32 characters.
- Production credentials must never be committed or copied into issue or pull
  request descriptions.
- Deployments should enable platform-level rate limiting for `/login`; the
  application-level limiter is intentionally a best-effort secondary control.
- Database backups and restore tests remain the responsibility of the
  deployment owner.

## Automated controls

Every pull request runs linting, typechecking, unit tests, a production build,
an end-to-end workout flow, CodeQL, dependency review, secret scanning, and a
production dependency audit. Workflow dependencies are pinned to immutable
commit SHAs and maintained by Dependabot.

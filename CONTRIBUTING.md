# Contributing to GraftVision

## Purpose and Current Status

This repository contains the development foundation for GraftVision, a planned multi-tenant
hair-restoration consultation platform. It currently provides neutral application shells, shared
package boundaries, quality policies, environment validation, and reproducible foundation checks.
It is not production-ready and contains no product modules, external providers, authentication,
database access, patient records, scanning, reports, presentation workflow, 3D, or AI.

## Requirements

- Node.js `^22.13.0` or `>=24.0.0`
- pnpm `11.17.0`, activated through Corepack

Check the installed versions:

```bash
node --version
corepack pnpm --version
```

If Corepack is not enabled or the pnpm version is wrong:

```bash
corepack enable
corepack prepare pnpm@11.17.0 --activate
```

Do not substitute npm, Yarn, Bun, or an unpinned pnpm installation. `pnpm-lock.yaml` is the only
approved lockfile.

## Initial Setup

From the repository root:

```bash
node --version
corepack enable
corepack prepare pnpm@11.17.0 --activate
corepack pnpm install --frozen-lockfile
corepack pnpm verify:workspace
corepack pnpm check
```

The neutral shells need no provider credentials and run without `.env.local`. `.env.example`
documents the current non-secret runtime contract. Copy it to `.env.local` only when deliberately
testing a local override; local environment files stay ignored and must never be committed.

## Local Development

Start every shell:

```bash
corepack pnpm dev
```

Or select one workspace:

```bash
corepack pnpm --filter @graftvision/web dev
corepack pnpm --filter @graftvision/scan dev
corepack pnpm --filter @graftvision/present dev
```

| Application | Port | Current purpose                    |
| ----------- | ---: | ---------------------------------- |
| Web         | 3000 | Neutral clinic/platform shell      |
| Scan        | 3001 | Neutral capture shell              |
| Present     | 3002 | Neutral patient-safe display shell |

Use pnpm filters for focused work, for example:

```bash
corepack pnpm --filter @graftvision/config test
corepack pnpm --filter @graftvision/ui typecheck
corepack pnpm exec turbo run build --filter=@graftvision/web...
```

## Quality Commands

| Command                              | Purpose                                                           |
| ------------------------------------ | ----------------------------------------------------------------- |
| `corepack pnpm format:check`         | Check formatting without changing files                           |
| `corepack pnpm lint`                 | Run root and workspace lint policies                              |
| `corepack pnpm typecheck`            | Run strict TypeScript checks                                      |
| `corepack pnpm test`                 | Run deterministic workspace tests and boundary checks             |
| `corepack pnpm test:coverage`        | Run tests and create local coverage reports                       |
| `corepack pnpm build`                | Build all three apps and five packages                            |
| `corepack pnpm check`                | Run the complete non-destructive local quality sequence           |
| `corepack pnpm verify:workspace`     | Check tools, manifests, workspaces, hygiene, and safe clean rules |
| `corepack pnpm verify:clean-build`   | Safely clean generated outputs and run the full check             |
| `corepack pnpm verify:fresh-install` | Verify a frozen install and build in a temporary copy             |
| `corepack pnpm check:foundation`     | Run verifier fixtures and standard clean-build acceptance         |

`pnpm check` does not clean outputs. Use `verify:clean-build` only when a safe generated-output
reset is intended.

## Clean-Build Workflow

Standard verification uses the existing `node_modules`, verifies workspace safety, snapshots
protected files, runs the explicit workspace clean commands, runs `pnpm check`, confirms every app
and package output, and proves protected files stayed unchanged:

```bash
corepack pnpm verify:clean-build
```

Fresh-install verification is opt-in:

```bash
corepack pnpm verify:fresh-install
```

It creates an allowlisted copy in the operating-system temporary directory; excludes `.git`,
`node_modules`, `.env.local`, generated output, caches, and `docs/`; installs through Corepack with
the frozen lockfile; runs standard clean-build verification; and removes the temporary copy even
after failure. `docs/` is omitted because no foundation build, test, or policy task consumes it;
the working repository documentation remains untouched.

Neither mode deletes the working repository's dependencies, source, documentation, README,
CONTRIBUTING guide, `.env.example`, `.env.local`, lockfile, manifests, assets, untracked work, or
Git metadata. Cleanup is limited to explicit `.next`, `dist`, `coverage`, `.turbo`, and TypeScript
build-info paths.

Use `corepack pnpm verify:clean-build --help` for mode and safety details.

## Tests

Keep unit and component tests beside their owners as `*.test.ts` or `*.test.tsx`. DOM workspaces use
Testing Library and accessible queries; server and configuration workspaces use the Node
environment. Tests must be deterministic, isolated, and offline by default. Restore mocks, timers,
globals, and environment changes. Use unmistakably synthetic names, contacts, identifiers, media,
and clinical-like values.

Never use real clinic or patient data, production metadata, credentials, images, reports, or
regulated health information in tests, fixtures, screenshots, logs, commits, or review material.

## Linting, Formatting, and Pre-Commit Behaviour

ESLint enforces strict TypeScript, React, accessibility, import, workspace, and client/server
boundaries. Prettier owns source and root-document formatting; approved `docs/` files and the
lockfile are deliberately excluded from automatic formatting.

The local Husky pre-commit hook applies ESLint and Prettier to supported staged files, then runs the
fast boundary verifier. It neither builds the repository nor contacts GitHub. Run the complete
`corepack pnpm check` before review even when a hook was bypassed.

## Task and Scope Discipline

Each change must reference one approved task ID from `docs/TASKS.md`. Before editing, read that
task's referenced product, architecture, security, UX, and workflow sources. Unrelated cleanup,
features, dependencies, and documentation changes are prohibited.

Run the tests and build checks required by the task. A blocking task must be reviewed against its
acceptance criteria before the next blocking task begins. Do not start AI, 3D, database,
authentication, patient, scanning, clinical workflow, reporting, or presentation modules early.

## Package and Client/Server Boundaries

- Applications may consume shared packages only through declared `@graftvision/*` exports.
- Do not deep-import another package's `src`, use cross-app imports, or create workspace cycles.
- Keep application code inside its owning app; shared code must have an approved package owner.
- Client-safe code must not import database, authentication-server, or server-environment entries.
- Read runtime environment values through approved `@graftvision/config` entries.
- Server-only markers and explicit package exports must remain intact.
- UI visibility is never permission or clinical authority.

Run `corepack pnpm verify:boundaries` after changing imports or package dependencies.

## Secrets, Providers, and Data

Do not commit secrets, tokens, passwords, private keys, provider credentials, `.env.local`, or real
configuration values. Do not add provider variables or provider/product dependencies before their
approved task. Never prefix confidential data with `NEXT_PUBLIC_`, print supplied secrets in
errors, or copy production data into local development.

Development and testing are synthetic-data-only. Real patient data and production clinic data are
prohibited.

## Database Migrations

DB-002 establishes the workflow in [`supabase/README.md`](supabase/README.md); it does not connect a
database or authorise product schema. Future approved schema changes must:

- use one UTC-timestamped SQL migration per logical change group and reference the approved task ID;
- remain PostgreSQL-first, reviewable as plain SQL, and immutable after application to a shared
  environment;
- include schema tests and an explicit RLS review whenever tenant or permission boundaries may be
  affected;
- use synthetic data only and never copy production patient or clinic data locally;
- avoid production or staging dashboard schema changes and use controlled migration tooling;
- include compatibility, lock/transaction, verification, and forward corrective plans; and
- obtain explicit task and impact approval before any destructive operation.

Use `corepack pnpm migration:create descriptive_name` to create a safe comment-only file,
`corepack pnpm verify:migration-policy` to check repository policy, and
`corepack pnpm verify:migration-fixtures` to exercise the guardrails without a database. Do not edit
an applied migration; add a new corrective migration.

## Documentation Changes

Files under `docs/` are authoritative planning documents. Change them only under an approved
documentation task or when a task explicitly authorises the exact document. Product-code tasks
must not casually update planning documents. Foundation and tooling tasks may update README and
CONTRIBUTING when their scope permits it.

When a task changes behavior, setup expectations, safety boundaries, or public project status,
add a short entry to [`docs/CHANGELOG.md`](docs/CHANGELOG.md) under `Unreleased` using the task ID,
a date, a brief impact summary, and any approval or risk note that materially affects the change.

## Commits and Future Reviews

Use focused Conventional Commit messages such as
`chore(tooling): add foundation verification`, optionally referencing the task ID in the body.
After the first baseline commit, prefer a feature branch and review before merge. A future pull
request should state the task ID, scope, source documents read, files changed, checks run, security
and privacy effects, and deferred work. Do not make direct production changes.

GitHub, a remote repository, CI, deployment credentials, and a pull request are not required for
local work. This guide does not create or imply a production deployment process.

## Security Reporting

Do not publish patient data, secret data, real credentials, or sensitive evidence in an issue,
commit, screenshot, recording, or chat. Redact screenshots and reproduce problems with synthetic
content.

During the local and pilot stage, report a suspected security problem privately to the project
owner, Haris Liaqat. Include the smallest safe reproduction, affected boundary, and observed
impact, without copying sensitive values. A formal public security policy and reporting channel
may be added later.

## Troubleshooting

- Wrong pnpm version: run `corepack prepare pnpm@11.17.0 --activate`, then use
  `corepack pnpm`, not a globally installed binary.
- Unsupported Node version: switch to Node `^22.13.0` or `>=24.0.0` and reinstall from the frozen
  lockfile.
- Stale generated output: run `corepack pnpm verify:clean-build`.
- One workspace fails: rerun its command with `corepack pnpm --filter <package-name> <command>`.
- Turborepo cache is suspect: add `--force` to the focused `turbo run` command; do not delete source
  or local environment files.
- Fresh-install failure: keep the working tree intact, read the first failed step, confirm Corepack
  and network/package-registry availability, then rerun the opt-in command.
- Structural or hygiene failure: run `corepack pnpm verify:workspace` and correct the named file;
  do not weaken the verifier to accept an unauthorised dependency, secret, output, or boundary.

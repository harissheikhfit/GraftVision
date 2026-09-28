# GraftVision

GraftVision is a planned multi-tenant SaaS platform for digital hair-restoration consultations.

## Repository Status

`FOUNDATION-001`–`FOUNDATION-005`, `TOOLING-001`–`TOOLING-003`, `UI-FOUNDATION-005`,
`TENANT-001`–`TENANT-004`, `DB-003`, and `AUDIT-001` provide the runnable monorepo, local-only
PostgreSQL tenant and RLS-family foundation, private storage-key contract, and append-only audit
foundation plus deterministic synthetic two-clinic fixtures and a rollback-only tenant isolation
regression gate. Product features, registration, roles, patient records, clinical workflows,
scanning, presentation functionality, reports, 3D, and AI have not been implemented.

This is a development foundation, not a production-ready application. See
[`CONTRIBUTING.md`](CONTRIBUTING.md) for the complete contributor workflow, scope rules, safety
policy, and troubleshooting guidance.

## Monorepo Layout

- `apps/web` — minimal Next.js shell for the future clinic application
- `apps/scan` — minimal Next.js shell for the future capture application
- `apps/present` — minimal Next.js shell for the future patient-safe presentation application
- `packages/ui` — shared design tokens, interaction, data-entry, information, state, layout, and application-shell primitives
- `packages/database` — server-only PostgreSQL pool and transaction-scoped tenant boundary
- `packages/auth` — provider-isolated email/password session and trusted identity-linkage boundary
- `packages/config` — shared configuration and environment-validation foundation
- `packages/types` — shared foundational TypeScript utilities
- `supabase` — local-only Supabase PostgreSQL configuration, migrations, and pgTAP tests
- `docs` — product, architecture, security, UX, and delivery documentation

## Tooling Decision

This repository uses **pnpm 11.17.0** workspaces with **Turborepo 2.10.6**.

pnpm was selected over npm because its explicit workspace file and `workspace:*` protocol make local package relationships clear, its content-addressed dependency store avoids unnecessary duplication, and Turborepo supports its lockfile and workspace graph directly. The repository has migrated from the original npm-workspace placeholder: `pnpm-workspace.yaml` is now authoritative, `pnpm-lock.yaml` is the only lockfile, and npm installation commands should not be used.

## Requirements

- Node.js `^22.13.0` or `>=24.0.0`
- pnpm `11.17.0`
- Corepack for activating and invoking the pinned pnpm version
- Docker Desktop or another Docker-compatible runtime for the disposable local database

## Getting Started

```bash
corepack enable
corepack prepare pnpm@11.17.0 --activate
corepack pnpm install --frozen-lockfile
corepack pnpm verify:workspace
corepack pnpm check
corepack pnpm dev
```

Local applications and their neutral shell routes:

| Application | Responsibility                       | URLs                                                     |
| ----------- | ------------------------------------ | -------------------------------------------------------- |
| Web         | Future clinic and platform web areas | `http://localhost:3000`, `/clinic`, `/platform`          |
| Scan        | Future mobile capture sessions       | `http://localhost:3001`, `http://localhost:3001/session` |
| Present     | Future patient-safe display sessions | `http://localhost:3002`, `http://localhost:3002/session` |

The development command starts all three application shells. They require no external service credentials.

Run one application with `pnpm --filter @graftvision/web dev`, `pnpm --filter @graftvision/scan dev`, or `pnpm --filter @graftvision/present dev`.

### Shell boundaries

- Shared shell components live in `packages/ui/src/shells`.
- Web uses `PublicShell`, `ClinicShell`, and `PlatformShell`; Scan uses `ScanShell`; Present uses
  `PresentationShell`.
- Clinic, platform, scan, public, and patient-safe presentation surfaces remain structurally
  distinct according to trust level.
- Responsive desktop, tablet, mobile, shared-device lock, and 16:9 presentation patterns are
  defined without implementing working menus or sessions.
- Web public routes contain no private data or privileged imports.
- The web login and clinic route groups exercise the AUTH-001 session boundary.
- Scan and Present `/session` routes are temporary-session placeholders with no tokens, data, capture, or presentation behaviour.
- Route errors, global errors, loading, and not-found states use neutral, accessible copy and reveal no error details.
- No API route or request middleware is included; those remain deferred to their approved tasks.
- No registration, recovery, MFA, role permission filtering, or real product navigation exists.

These routes are non-product development shells. Future tasks must preserve the app boundaries and must not add cross-app imports or privileged imports to public or client-safe code.

## Package Ownership

- `ui` — client-compatible tokens, neutral shell, interaction primitives, and state-display components.
- `database` — server-only future persistence boundary.
- `auth` — client-safe validation plus isolated browser and server Supabase Auth entry points.
- `config` — environment and configuration boundary with separate client-safe and server-only entries.
- `types` — shared compile-time foundations without domain models.

Applications import packages only through their declared public exports. Package internals remain private to their owning package.

## Commands

| Command                                | Purpose                                                                 |
| -------------------------------------- | ----------------------------------------------------------------------- |
| `pnpm dev`                             | Start all application development servers                               |
| `pnpm build`                           | Build all buildable workspaces                                          |
| `pnpm lint`                            | Run ESLint across all workspaces                                        |
| `pnpm lint:fix`                        | Apply safe ESLint fixes across the repository                           |
| `pnpm migration:create <name>`         | Create a validated comment-only UTC migration file                      |
| `pnpm supabase:start`                  | Start the disposable local PostgreSQL stack                             |
| `pnpm supabase:status`                 | Show the local stack status                                             |
| `pnpm supabase:stop`                   | Stop the disposable local PostgreSQL stack                              |
| `pnpm db:reset`                        | Rebuild locally from migrations and the approved synthetic seed         |
| `pnpm db:seed`                         | Idempotently replay the seed against the approved local database        |
| `pnpm db:seed:verify`                  | Verify stable synthetic seed IDs, counts, statuses, RLS, and scope      |
| `pnpm db:test`                         | Run transactional pgTAP tenant-isolation tests                          |
| `pnpm db:test:all`                     | Run every database pgTAP suite                                          |
| `pnpm db:test:audit`                   | Run the transactional AUDIT-001 pgTAP suite                             |
| `pnpm db:test:pool-regression`         | Run guarded local pool reuse and concurrency tests                      |
| `pnpm db:test:seed`                    | Run deterministic two-clinic seed and isolation pgTAP tests             |
| `pnpm db:test:tenant-regression`       | Run the rollback-only TENANT-004 pgTAP suite                            |
| `pnpm db:test:tenant-families`         | Run reusable tenant constraint and RLS-family pgTAP tests               |
| `pnpm typecheck`                       | Run strict TypeScript checks across all workspaces                      |
| `pnpm test`                            | Run the Vitest foundation suite across all workspaces                   |
| `pnpm test:watch`                      | Run workspace Vitest suites in watch mode                               |
| `pnpm test:coverage`                   | Run tests and generate workspace coverage reports                       |
| `pnpm format`                          | Format supported repository files with Prettier                         |
| `pnpm format:check`                    | Verify repository formatting                                            |
| `pnpm verify:boundaries`               | Verify workspace dependency and client/server boundaries                |
| `pnpm verify:audit-policy`             | Verify append-only audit schema, metadata, access, and scope            |
| `pnpm verify:env-policy`               | Verify environment schemas, template, access, and cache policy          |
| `pnpm verify:tenant-regression-policy` | Verify regression coverage, boundaries, fixtures, and migration hashes  |
| `pnpm verify:shell-policy`             | Verify neutral route shells, fallbacks, metadata, and exports           |
| `pnpm verify:turbo-policy`             | Verify task graph, output, cache, and clean policies                    |
| `pnpm verify:workspace`                | Verify tools, workspace structure, hygiene, and clean safety            |
| `pnpm verify:clean-build`              | Safely clean generated output and run the full check                    |
| `pnpm verify:fresh-install`            | Verify frozen install/build in an isolated temporary copy               |
| `pnpm verify:migration-policy`         | Verify migration structure, naming, order, and safety policy            |
| `pnpm verify:migration-fixtures`       | Test migration helper and policy failures in temporary dirs             |
| `pnpm verify:seed-policy`              | Verify deterministic, synthetic, local-only seed boundaries             |
| `pnpm verify:storage-key-policy`       | Verify private key namespaces, validation, separation, and scope        |
| `pnpm verify:tenant-policy`            | Verify schema, RLS, context, local-only, and scope controls             |
| `pnpm verify:tenant-family-policy`     | Verify reusable tenant constraints, context, RLS families, and scope    |
| `pnpm verify:ui-primitive-policy`      | Verify accessible primitive APIs, tests, styles, and boundaries         |
| `pnpm verify:ui-information-policy`    | Verify data-entry, information, layout, copy, and formatting boundaries |
| `pnpm verify:ui-state-policy`          | Verify state displays, privacy-safe copy, semantics, and scope          |
| `pnpm verify:ui-token-policy`          | Verify UI tokens, contrast, brand boundaries, and shared CSS            |
| `pnpm check:foundation`                | Run verifier fixtures and standard foundation acceptance                |
| `pnpm clean`                           | Remove generated build, test, and Turborepo cache artefacts             |
| `pnpm check`                           | Run the complete local quality sequence                                 |

`pnpm check` remains non-destructive. `verify:clean-build` uses existing `node_modules` and removes
only explicit generated outputs. The opt-in `verify:fresh-install` creates an allowlisted operating
system temporary copy, excludes local environment files, dependencies, Git metadata, docs, caches,
and outputs, installs from the frozen lockfile, verifies the build, and removes the copy. Neither
command deletes source, documentation, local `.env.local`, assets, manifests, the lockfile, or
untracked work.

## Task Graph and Build Outputs

Turborepo manages workspace `dev`, `build`, `lint`, `typecheck`, `test`, `test:coverage`, `test:watch`, and `clean` tasks. Formatting, lint fixes, policy verifiers, and the aggregate `check` command remain root-only so repository-wide work is not duplicated in every workspace.

| Task            | Cache and dependency behaviour                                     | Output                              |
| --------------- | ------------------------------------------------------------------ | ----------------------------------- |
| `dev`           | Persistent and uncached; starts only the three application scripts | None                                |
| `build`         | Cached; builds actual workspace dependencies first via `^build`    | App `.next/**` or package `dist/**` |
| `lint`          | Cached and independently parallel                                  | Logs only                           |
| `typecheck`     | Cached; typechecks dependencies first via `^typecheck`             | Logs only                           |
| `test`          | Cached, deterministic, and independent of builds                   | Logs only                           |
| `test:coverage` | Cached independently per workspace                                 | `coverage/**`                       |
| `test:watch`    | Persistent, interactive, and uncached                              | None                                |
| `clean`         | Uncached and limited to explicit generated directories             | Removes generated output            |

The three Next.js applications consume `@graftvision/ui` from source and write production output to their own `.next/` directories; transient `.next/cache/` data is not cached as a build artefact. All five shared packages remain source-consumed through explicit exports while their build tasks emit declaration-only `dist/` output as a compile and public-contract check. No package bundler is used, and test declarations are excluded.

`pnpm check` runs formatting, root and workspace linting, root and topological workspace typechecking, workspace tests, the topological build, and each policy verifier exactly once. `pnpm clean` removes only `.next`, `dist`, coverage, TypeScript build information, and local Turborepo artefacts; it does not target source, documentation, lockfiles, `.env.example`, or user assets.

### Filtering and local cache

```bash
# Run one application on its configured port
pnpm exec turbo run dev --filter=@graftvision/web

# Build one application and its workspace dependencies
pnpm exec turbo run build --filter=@graftvision/web...

# Test one shared package
pnpm exec turbo run test --filter=@graftvision/config

# Lint and typecheck workspaces changed from Turborepo's Git comparison base
pnpm exec turbo run lint typecheck --affected

# Build a package and every workspace that depends on it
pnpm exec turbo run build --filter=...@graftvision/ui

# Bypass local cache while troubleshooting
pnpm exec turbo run build --filter=@graftvision/web... --force
```

Turborepo uses its local `.turbo/cache` by default. Task inputs exclude workspace README files, generated files, and the root `docs/` tree; root TypeScript, ESLint, Vitest, and test-setup files invalidate only the tasks that consume them. `CI` and `NODE_ENV` affect test hashes, while application builds scope `NODE_ENV` locally. `APP_ENV` is not a build input because no current build output consumes it. No external-service or secret-bearing environment variable is required.

Remote caching is deliberately unconfigured. A future task may opt in with an approved provider, team scope, short-lived authentication, access controls, cache-integrity policy, and confirmation that cached artefacts and logs contain no secrets or patient data. Local development must continue to work without remote-cache credentials.

## Proposed UI Token Foundation

The framework-independent token contract lives in `packages/ui/src/styles`, with public metadata in
`packages/ui/src/tokens.ts` and clinic-brand policy in `packages/ui/src/brand-boundaries.ts`. Each
application imports the single `@graftvision/ui/styles.css` entry from its local `globals.css`.

Tokens are initial proposals pending design, accessibility, clinical-image, print, device, and LED
review. Clinics may eventually supply bounded identity and approved brand accents, but cannot
override error, warning, approval, privacy, focus, anatomical, patient-safe, spacing, typography,
motion, or interaction meanings. Application code must use semantic custom properties instead of
hard-coded status or clinic colours.

Tailwind and other theming frameworks remain deferred. A later approved task may map the same token
contract into a utility system without changing its safety boundaries.

## Accessible Interaction Primitives

Accessible shared primitives live in `packages/ui/src/primitives` and field composition lives in
`packages/ui/src/forms`. The public set includes buttons, icon buttons, links, text inputs,
textareas, labels, descriptions, errors, checkboxes, radio groups, native selects, switches,
fields, and visually hidden content.

Native semantics and keyboard behavior are the default. Protected focus, error, destructive,
disabled, and invalid meanings cannot be replaced by clinic branding, while approved brand tokens
may style ordinary primary, secondary, link, and selected states. No product form, form library,
Tailwind configuration, component framework, or product screen has been added. APIs, boundaries,
states, and examples are documented in
[`packages/ui/README.md`](packages/ui/README.md).

## Shared State Displays

Generic state-display components live in `packages/ui/src/states`. They cover protected badges,
loading and progress, feedback panels, messages, banners, skeletons, session-safe locks, and shared
operational, approval, privacy, and connectivity taxonomies.

Every meaning is communicated with text and a non-colour cue. Privacy-safe components require
consumer-supplied contextual copy and expose no record, tenant, or identity details by default.
Protected error, warning, restricted, approval, patient-safe, AI-assisted, focus, and expired-state
styling cannot be replaced by clinic branding. No product-specific state, screen, or workflow has
been added.

## Data-Entry, Information, and Layout Primitives

Generic structured primitives live in `packages/ui/src/forms`, `packages/ui/src/information`, and
`packages/ui/src/layout`. They provide native field grouping, search/date/time/number foundations,
definition and metadata displays, safe copy/read-only/reference values, and constrained responsive
layout composition.

Number-like input preserves the user’s raw string; dates and times use native browser controls.
Values are never automatically formatted, coerced, localized, or copied. Only local search
clearing, clipboard interaction, and the existing indeterminate checkbox require client
boundaries; static primitives remain Server Component compatible. No product form, table, card,
dashboard, or screen has been added.

## Selected Development Providers

`DB-001` selects an integrated Supabase foundation for planned development: managed PostgreSQL,
Auth, private Storage, and narrowly scoped Realtime. The selection is documented in
[`decisions/ADR-001-DEVELOPMENT-PROVIDER-FOUNDATION.md`](decisions/ADR-001-DEVELOPMENT-PROVIDER-FOUNDATION.md)
and is connected only to the disposable local development stack by TENANT-001.

The pinned CLI runs local PostgreSQL only. Staging and production will use separate
GraftVision-owned projects only after their approval gates. No remote project link, provider
credential, application Supabase SDK, Auth integration, bucket, Storage, or Realtime implementation
exists. Credentials must never be committed.

## Database Migration Workflow

Repository-owned PostgreSQL SQL under `supabase/migrations/` is the schema source of truth.
TENANT-001 adds `platform_user`, `clinic`, and `clinic_membership`; AUDIT-001 adds only
`audit_event`. Both use deny-by-default RLS, trusted transaction-local context, explicit
constraints and indexes, and synthetic pgTAP tests. They add no authentication, role assignments,
patient, clinical, report, media, scanning, presentation, 3D, or AI model.

Create a comment-only migration shell with
`corepack pnpm migration:create descriptive_name`, then verify completed migration files with
`corepack pnpm verify:migration-policy` and `corepack pnpm verify:tenant-policy`. The local
workflow is `supabase:start` → `db:reset` → `db:test` → `supabase:stop`. Never make uncontrolled
staging or production schema
changes through a provider dashboard, and never edit a migration after it reaches a shared
environment. The naming, review, local/staging/production, drift, RLS, data, destructive-change,
and forward-fix policies are in [`supabase/README.md`](supabase/README.md).

## Private Storage-Key Contract

DB-003 defines provider-neutral private object-key construction and validation in
`@graftvision/database/storage`. The proposed fixed logical buckets are `clinical-private`,
`transfer-private`, and `platform-private`; they are names only and have not been created.

Clinic-owned final keys begin with `clinics/{clinic_id}`. Patient assets additionally include
opaque patient, resource, and asset UUIDs. Clinic assets, exports, temporary uploads, quarantine,
rejected uploads, platform assets, internal reports, patient-safe reports, and presentation-safe
derivatives use structurally separate namespaces. Keys never use patient names, contact details,
medical text, or user filenames.

The builders and parser are pure server-only utilities with no provider SDK or network behavior.
Key validation supports tenant security but does not replace database ownership checks, RLS,
private storage policies, or server-side authorisation. No bucket, Storage policy, upload,
download, signed URL, media table, patient table, or clinical feature is implemented.

## Append-Only Audit Foundation

AUDIT-001 adds the minimum `audit_event` table and a server-only writer under
`@graftvision/database/audit`. Clinic event writes reuse an existing trusted tenant transaction;
the database derives the actor and clinic from transaction-local context and requires active
membership. The input accepts only controlled action, resource, outcome, source, opaque
correlation identifiers, reason codes, and allowlisted metadata. It never accepts actor or clinic
authority.

Audit metadata is a flat allowlist capped at 2,048 UTF-8 bytes. Unknown fields, nested structures,
free text, clinical content, contact data, credentials, tokens, URLs, request/response bodies, and
raw errors are rejected. Required audit writes are transactional and fail closed.

The table has forced RLS, no normal policies or table privileges, owner-only controlled write
functions, restrictive historical foreign keys, and a trigger that rejects updates and deletes.
AUDIT-001 deliberately selects no product read access: role-based projections, audit APIs,
screens, searches, exports, retention execution, alerts, and the complete domain event catalogue
remain deferred.

## Reusable Tenant Policy Families

TENANT-002 adds owner-only transaction-local context setup, an active-tenant row predicate, active
membership assertion, and reusable immutable-`clinic_id` trigger. Context may be reused only for
the same actor and clinic; switching either value within a transaction fails. Commit and rollback
remove context through PostgreSQL transaction-local settings.

Future clinic-owned tables must physically store `clinic_id`, index it, scope local uniqueness by
it, expose `(clinic_id, id)` on referenced parents, and use composite child foreign keys such as
`(clinic_id, parent_id)`. Every table must enable and force RLS. Tenant access composes as tenant
context AND active membership AND later permission, record-state, and approval predicates.

TENANT-002 proves these rules using temporary pgTAP fixture tables; no persistent product-domain
table was created. Ordinary inserts remain closed because roles and permissions do not yet exist.
Clinic/platform administration, authentication, support access, and service-role runtime access
remain deferred.

## Synthetic Two-Clinic Seed

TENANT-003 adds a deterministic seed under `supabase/seed/`. Local reset applies the three
unchanged migrations followed by two synthetic clinics, five internal platform-user placeholders,
and five memberships. Clinic Alpha and Clinic Beta have separate active owner/staff-labelled
fixtures, while Clinic Alpha also has one suspended membership for negative access tests.

The labels “Owner” and “Staff” are descriptive fixture aliases only. There is no role or permission
model. Internal identities use `.example.test`, stable UUID namespaces make seed ownership
recognizable, and reruns reject unexpected conflicts instead of updating or deleting records.

`pnpm db:reset` is explicitly local. Standalone `db:seed` and `db:seed:verify` commands require the
local project marker, loopback host, approved port and database, local or test environment, matching
migration history, and local administrative role. They do not print the database URL.

The fixtures are not Auth users, have no passwords, cannot log in, and create no audit events.
They contain no patient, clinical, media, report, onboarding, or production data. Staging seeding
requires a future explicit command; production seeding is prohibited.

## Tenant Isolation Regression Gate

TENANT-004 adds 62 rollback-only pgTAP assertions to the existing 139, for 201 database assertions
after a clean local reset. The focused suite covers tenant visibility, membership and lifecycle
states, immutable transaction context, savepoints, composite tenant relationships, forced RLS,
audit rollback and scope, deterministic seeds, and test-local insecure negative controls.

`pnpm db:test:all` runs every SQL suite. `pnpm db:test:tenant-regression` runs the focused SQL
regression, while `pnpm db:test:pool-regression` uses one- and two-connection local pools to prove
context cleanup after commit, rollback, and failure plus simultaneous Alpha/Beta isolation.
The pool command requires an explicit local confirmation and the approved disposable loopback
database. `pnpm verify:tenant-regression-policy` is the static companion and runs in `pnpm check`;
live database commands remain explicit.

SQL helpers remain self-contained in the rollback-only suite because the current pgTAP runner does
not offer an order-independent include mechanism that improves safety. Negative fixtures exist
only in a transaction-scoped test schema and are rolled back. AUTH-001 must preserve this gate, and
every later tenant-owned module must add its own positive, denial, relationship, RLS, audit, and
pool-relevant regression coverage before product work proceeds.

## Environment Variables

The neutral shells require no `.env.local` file or external service. The database commands use the
documented loopback `SUPABASE_DB_URL` through the server-only configuration boundary. Copy
`.env.example` only for local use; `.env.local` and all other local variants remain ignored.

`NODE_ENV` is framework-controlled (`development`, `test`, or `production`), and `CI` is a runtime-provided boolean. Server-only `APP_ENV` describes deployment context (`local`, `test`, `staging`, or `production`). Development defaults to `local`, tests default to `test`, and server validation under production mode requires an explicit `staging` or `production` value. `LOG_LEVEL` is deferred because no logging system consumes it.

No browser variable is currently allowlisted. Future client-safe values must use `NEXT_PUBLIC_`, be
added explicitly to `@graftvision/config/env/client`, and contain nothing confidential.
`SUPABASE_DB_URL` is validated by `@graftvision/config/env/database`, requires loopback in local/test
contexts, and rejects loopback in staging/production contexts. Application and package source must
import validated entries instead of reading `process.env` directly.

Environment parsing occurs when a trusted server module calls `getServerEnvironment`; unused future values are not required during shell builds. Environment errors name the invalid key and expected form without printing its supplied value or the full environment. Tests pass synthetic maps directly to the parsers, restore environment state, and do not load `.env.local`.

When a later approved task introduces a variable:

1. Classify it as runtime, public, private server, build-time, test-only, or local-only.
2. Add it to only the matching schema and tests.
3. Add a safe placeholder to `.env.example` only when developers must configure it.
4. Add it to Turborepo task inputs only when it changes cached output.
5. Never commit the real value or prefix a secret with `NEXT_PUBLIC_`.

## TypeScript and Imports

All workspaces extend the strict root TypeScript configuration. Next.js applications use the shared application configuration and a local `@/*` alias that resolves only to that app's `src` directory. Shared packages use the common package configuration; database, authentication-server, and configuration-server entry points retain explicit `server-only` markers.

Workspace consumers import only through these package exports:

- `@graftvision/ui`
- `@graftvision/database`
- `@graftvision/auth` and `@graftvision/auth/server`
- `@graftvision/config`, `@graftvision/config/env/client`,
  `@graftvision/config/env/database`, and `@graftvision/config/env/server`
- `@graftvision/types`

Deep imports into another workspace's `src` directory are unsupported. The intended dependency direction is applications → shared packages; safe UI → safe types/config only; server packages → safe types/server config when later required; config and types → no privileged workspace packages. Turborepo provides build ordering, so TypeScript project references are intentionally deferred until repository scale demonstrates a need.

## Code Quality and Commits

The root flat ESLint policy applies strict, type-aware TypeScript checks, current Next.js and React rules, practical accessibility checks, import hygiene, and client/server restrictions. `pnpm verify:boundaries` additionally rejects cross-workspace relative imports, package-internal imports, app-to-app imports, prohibited dependency directions, client imports of server-only modules, and dependency cycles.

Prettier uses a conservative repository-wide style for source, configuration, CSS, JSON, and YAML. Approved product documents under `docs/` and the lockfile are intentionally excluded from automatic formatting to avoid destructive churn; root Markdown such as this README remains formatted.

Husky installs a local pre-commit hook during `pnpm install`. The hook runs ESLint fixes followed by Prettier only on supported staged files, then runs the fast boundary audit. It does not build the monorepo, contact GitHub, or require credentials, and lint-staged protects unstaged work while applying fixes. Use `git commit --no-verify` only for a genuine emergency; any bypassed failure must be corrected and `pnpm check` must pass before review.

Commit messages should follow a concise Conventional Commits style without an enforced commit-message hook, for example `chore(tooling): configure staged quality checks`. Keep each commit focused and include the task ID in the body when useful.

## Testing

Vitest is the primary unit and component test runner. Use colocated `*.test.ts` and `*.test.tsx` files; `*.spec.*` remains discoverable for compatibility, but new tests use the primary convention. Applications and `packages/ui` use jsdom for its explicit compatibility with the repository's strict TypeScript, React 19, and Node range; server/configuration packages and non-DOM utilities use Node. React tests use Testing Library with accessible queries, automatic cleanup, and no shallow rendering or snapshot-heavy strategy.

Shared setup stays in the root `testing/` directory because it currently provides only environment isolation and a test-only `server-only` sentinel; a workspace package would add unnecessary production graph surface. Tests restore mocks, timers, globals, and environment stubs, and unexpected `fetch` access fails by default. Prefer pure functions, dependency injection, boundary fakes, and minimal module mocking.

All test data must be unmistakably synthetic. Never use production credentials, patient or clinic records, real contact details, medical notes, images, or identifiers. Empty shells and marker-only packages intentionally use `passWithNoTests` until they gain behaviour worth testing; all eight workspaces still participate in every repository test run. Coverage uses V8 with text, JSON summary, HTML, and LCOV outputs, without a placeholder-era percentage threshold.

### Local real-reconstruction proof of concept

The opt-in local COLMAP proof of concept generates a deterministic, ray-traced asymmetric object from a fixed seed. It produces 24 metadata-free JPEG views with non-duplicated, non-collinear camera poses around the object; it never uses people, patient data, downloaded assets, or external datasets. It validates fixture count, dimensions, camera spacing, and object visibility before invoking COLMAP. A successful run requires a valid sparse model before attempting dense reconstruction and reports only bounded technical geometry metadata. Its temporary local workspace is removed after every run.

Integration tests will be added beside their owning adapters when database, storage, authentication, or other services are approved. End-to-end browser and accessibility automation remain a separate future task; Playwright and Cypress are not part of this foundation.

## AUTH-001 local login foundation

AUTH-001 adds provider-backed email/password login and logout to `apps/web` only. The
implementation follows Supabase SSR guidance reviewed on 2026-07-26, using pinned provider
packages behind `packages/auth`. Server actions own credential submission and logout, `proxy.ts`
refreshes cookie sessions, and protected pages verify the provider user before resolving an
internal identity. The browser never receives a service-role key, database URL, password, access
token, refresh token, or raw provider error.

Local identity linkage is intentionally strict: the verified provider UUID must equal the existing
`platform_user.id`, and its verified email must equal `platform_user.external_identity_id`. The
internal user, at least one membership, and its clinic must all be active before `/clinic` is
available. No account or membership is created from an email match. `/platform` stays denied
because role and permission work is outside AUTH-001.

Run the disposable stack and deterministic synthetic identities with:

```sh
corepack pnpm supabase:start
corepack pnpm db:reset
corepack pnpm auth:seed:local
corepack pnpm auth:verify:local
corepack pnpm auth:test:integration
```

Copy `.env.example` to `.env.local`, then replace its public local key with the value shown by
`corepack pnpm supabase:status` (`ANON_KEY` for the current local gateway; deployed environments may
use the current publishable-key format). The fixture tool obtains its local administrative key directly
from the CLI only while it runs; that key is never an application environment variable. Cookie
sessions are `HttpOnly`, `SameSite=Lax`, path-scoped to `/`, and secure in staging/production.
This server-action-only choice is stricter than the provider browser-readable-cookie default;
browser-side auth state is therefore not used.

Auth audit events remain deferred. Existing audit records require an authenticated internal actor,
tenant context, and an approved action taxonomy, which failed logins do not safely possess.
Registration, recovery, email delivery, MFA, OAuth, platform access, clinic selection, roles,
permissions, and patient modules remain outside this task.

## Documentation-First Development

Start with [`docs/PRD.md`](docs/PRD.md), then follow the delivery sequence in [`docs/TASKS.md`](docs/TASKS.md).

Future work must execute one approved `TASKS.md` task ID at a time. Completing a foundation task does not authorise starting its successor.

## Security Notice

Do not use real patient data, clinic credentials, production secrets, or regulated health information during early development. Security and compliance requirements must be approved before patient-facing implementation begins.

## Assumptions

- Developers use Corepack so the repository-pinned pnpm version is consistent.
- Node.js 22 LTS or Node.js 24+ is available locally.
- Only the disposable local Supabase database and Auth services are required for AUTH-001.
- The minimal shared UI placeholder exists only to verify workspace dependency resolution.

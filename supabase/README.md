# GraftVision Database Migration Guide

## Current state

TENANT-001 establishes a local-only Supabase PostgreSQL foundation with three tables:
`platform_user`, `clinic`, and `clinic_membership`. It includes deny-by-default RLS, transaction-local
trusted tenant context, synthetic pgTAP isolation tests, and a server-only PostgreSQL boundary.
TENANT-003 adds deterministic local/test-only seed data for two synthetic clinics, five internal
platform users, and five memberships. There is no remote project link, provider credential,
generated database type, Auth, Storage, Realtime, patient, clinical, report, scanning,
presentation, 3D, or AI implementation.

SQL remains PostgreSQL-first and must avoid provider-specific features unless a reviewed
requirement needs them. The local stack is disposable and is not a staging or production design.

## Local prerequisites

- Node.js `^22.13.0` or `>=24.0.0`
- pnpm `11.17.0` through Corepack
- Supabase CLI `2.109.1`, pinned as a root development dependency and invoked through pnpm
- Docker Desktop or another Supabase-compatible Docker runtime

Do not install the CLI through a deprecated global npm installation. Do not run `supabase link`,
create a remote project, or substitute a remote database for local tests.

## Tool decision

Repository-owned SQL migrations are the schema source of truth. The pinned Supabase CLI executes
ordered SQL files, local reset, and pgTAP tests. Remote linking is an explicit later operational
action and must never place a project reference or credential in source.

| Approach                                                                | Strengths                                                                                                              | Risks and decision                                                                                                                          |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Supabase CLI-compatible SQL                                             | Native fit for the selected provider; local reset, diff, history, and RLS support; SQL remains reviewable and portable | Selected and pinned for local TENANT-001 execution; remote linking and uncontrolled dashboard use remain prohibited                         |
| Plain PostgreSQL tools (`dbmate`, `node-pg-migrate`, Flyway, Liquibase) | Mature ordering and deployment options; potentially provider-neutral                                                   | Adds another migration authority or runtime and may duplicate provider tooling; defer unless future operational evidence justifies a change |
| ORM-managed migrations (Prisma, Drizzle, Kysely tooling)                | Can align application models and generated types                                                                       | No ORM is selected, generated SQL may hide security details, and early adoption creates unnecessary coupling; defer ORM selection           |

Generated diffs are proposals, never approval. A reviewer must inspect the resulting plain SQL.
Production schema changes through an uncontrolled dashboard workflow are prohibited.

## Directory contract

```text
supabase/
├── config.toml  # Local-only database configuration; non-database services disabled
├── migrations/  # Ordered, immutable SQL migrations
├── seed/
│   ├── 001_tenant_foundation.sql  # Deterministic local/test-only tenant fixtures
│   └── README.md                  # Stable IDs, safety rules, and commands
├── tests/
│   └── database/
│       ├── synthetic_seed_foundation.test.sql
│       └── tenant_isolation.test.sql
└── README.md    # This workflow
```

`supabase/config.toml` enables the disposable local PostgreSQL database, local Auth API, and the
ordered TENANT-003 seed path. Storage, Realtime, Studio, Analytics, and Edge Runtime remain
disabled. The unsupported root `supabase/seed.sql` remains absent. Schema belongs in
migrations; seed fixtures belong under `supabase/seed/`; `packages/database` owns only the
server-only pool and transaction-scoped tenant boundary. Repository tooling owns naming, policy,
immutability, seed safety, and drift checks.

## Local Auth fixtures

After starting and resetting the local stack, run `corepack pnpm auth:seed:local`, followed by
`corepack pnpm auth:verify:local` or `corepack pnpm auth:test:integration`. The guarded, idempotent
tool creates confirmed Auth identities for the synthetic Alpha Owner, Alpha Staff, Beta Owner,
Beta Staff, and Alpha Suspended Member records. It keeps their local-only password inside tooling,
never prints it, and obtains the temporary administrative key from local CLI status rather than an
application environment variable. It rejects non-loopback endpoints, non-local project markers,
and staging/production contexts. No remote Auth project or real credential is used.

## Tenant-context and access convention

The clinic is the tenant root. A membership joins one provider-neutral `platform_user` to one
clinic, and active user, clinic, and membership status must all match the trusted transaction-local
user and clinic context. Missing, invalid, suspended, mismatched, or client-guessed context returns
no rows.

Local tests and the server-only package establish both IDs through a security-definer helper inside
one transaction; commit, rollback, or explicit clearing removes them. The helper is revoked from
ordinary `authenticated` callers. Future authenticated requests must derive the internal user from
verified provider identity, resolve clinic access through active membership on the server, and then
establish the same request-scoped context. A request-body, header, URL, or browser-provided
`clinic_id` alone is never authority.

Every future clinic-owned table must carry `clinic_id`; tenant-scoped unique keys and relationships
must include it where applicable, and cross-clinic foreign keys are prohibited.

## Proposed private bucket strategy

DB-003 recommends a small fixed set of private logical buckets:

- `clinical-private` for final clinic- and patient-owned assets.
- `transfer-private` for temporary, quarantine, rejected, and export objects with separate
  lifecycle controls.
- `platform-private` for platform-owned templates and operational assets.

This avoids one-bucket-per-clinic operational overhead while keeping high-level lifecycle and
ownership classes separate. Tenant isolation remains explicit inside every clinic-owned object
key. The convention is portable to Supabase Storage, S3, R2, and other S3-compatible private object
stores.

No bucket, provider Storage client, policy, object, upload, download, or signed URL has been
created. `[storage]` remains disabled in `config.toml`.

Future storage implementation must use private buckets, deny by default, resolve trusted clinic
membership, prohibit public listing, keep service credentials out of browsers, issue only
short-lived resource-specific operations, finalise through trusted server logic, and test
cross-clinic denial. Temporary objects must not be visible through final clinical APIs;
quarantine and rejected objects must not be rendered; presentation assets must come from an
approved patient-safe manifest.

Repository-owned configuration and reviewed migrations/policies will be authoritative. Manual
bucket creation, public ACL changes, and manual staging or production Storage-policy edits are
prohibited.

## Naming and migration categories

Migration names use:

```text
YYYYMMDDHHMMSS_descriptive_name.sql
```

- The 14-digit timestamp is UTC.
- The description is lowercase snake_case, starts with a letter, and names one logical change
  group.
- Spaces, category-only names, and ambiguous names such as `update.sql`, `changes.sql`,
  `migration.sql`, or `fix.sql` are invalid.
- Run `corepack pnpm migration:create descriptive_name`; do not invent or reuse a timestamp.
- The helper refuses an existing timestamp or filename. If two branches generate the same
  timestamp, recreate one migration with a later UTC timestamp before merge.
- Lexical filename order is application order.
- Once a migration has been applied to staging or another shared environment, it is immutable.
  Correct it with a new migration.

Use task and review metadata in the migration header rather than filename category prefixes.
Prefixes make names noisy without improving deterministic order. Reviewers classify each change
as one or more of: schema creation, constraint, index, RLS policy, function/trigger, reference data,
data backfill, data repair, destructive change, or provider-specific infrastructure.

## Migration header

The creation helper writes comments only. Before review, replace its task placeholder and complete
the purpose, compatibility, transaction, lock, RLS, data, verification, and corrective-plan notes.
The header is review context, not executable approval.

An obviously dangerous statement is rejected unless the same migration contains all three
annotations:

```sql
-- graftvision:dangerous-sql-approved task=DB-000
-- graftvision:dangerous-sql-reason explain_the_reviewed_need
-- graftvision:corrective-plan explain_the_forward_fix_or_restore_path
```

Replace `DB-000` with the explicitly approved task. An annotation does not prove approval; review
evidence and the change record remain mandatory. The verifier is a conservative regular-expression
guardrail, not a SQL parser or a complete safety analysis.

## Local workflow

The local workflow is:

1. Use synthetic data only; never copy production patient or clinic data.
2. Start the local stack with `corepack pnpm supabase:start`.
3. Pull the latest repository state and apply all existing migrations in filename order.
4. Create one migration with `corepack pnpm migration:create descriptive_name`.
5. Reference the approved task and review the SQL, generated diff, category, RLS, constraints,
   indexes, transaction behaviour, locks, and application compatibility.
6. Rebuild locally with `corepack pnpm db:reset`.
7. Run schema tests and positive and negative RLS tests where relevant.
8. Run application compatibility tests for old and new application versions where rollout
   overlaps.
9. Reset an empty local database from repository migrations and run the tests again.
10. Run `corepack pnpm db:test`, then confirm the rebuild is deterministic and both policy
    verifiers pass.
11. Submit the SQL, tests, evidence, forward plan, and corrective plan for review.

The local database must contain synthetic data only. Stop it with `corepack pnpm supabase:stop`.

## Staging workflow

1. Merge only reviewed and approved migrations into the future release branch.
2. Confirm staging uses synthetic or explicitly authorised test data.
3. Create a backup or restore point when the risk assessment requires one.
4. Apply migrations using controlled tooling and a staging-only restricted migration identity.
5. Capture the migration name, checksum, start/end time, actor, tool version, and sanitised output.
6. Run schema, smoke, RLS, and application compatibility tests.
7. Compare migration history and schema metadata with the repository to detect drift.
8. Review logs, table locks, query performance, and background work.
9. Attach evidence to the change record and explicitly approve or reject production promotion.

Failure stops promotion. A new corrective migration fixes shared-environment SQL; the applied file
is not edited.

## Production workflow

1. Confirm the approved release, migration review, and production change record.
2. Confirm backup/restore capability and evidence for every high-risk change.
3. Confirm a forward corrective plan, application rollback or feature containment path, and any
   maintenance or online rollout strategy.
4. Confirm compatibility with the deployed and immediately previous application versions.
5. Rehearse high-risk changes against representative synthetic volume in staging.
6. Apply ordered migrations through controlled tooling with a restricted production migration
   identity; never use a browser or runtime credential.
7. Record actor, approvers, tool version, migration names/checksums, timestamps, sanitised output,
   and result.
8. Verify migration history, schema metadata, constraints, RLS, application health, and critical
   queries.
9. Monitor errors, locks, timeouts, replication/backup effects, and performance for the approved
   observation window.
10. Close the change record or open a corrective migration incident.

No production deployment automation is configured by TENANT-001.

## Expand-and-contract

High-risk production changes use compatible phases across separate releases:

- Add column: add nullable; deploy support; backfill; validate; add constraint later.
- Rename column: add the new column; dual-write if required; backfill; read new; stop old writes;
  remove the old column in a later approved release.
- Change type: add a compatible column; backfill and validate; switch reads/writes; remove the old
  column later.
- Remove data: stop reads; stop writes; archive/export if authorised; verify retention and holds;
  delete only in a later destructive migration.

New application code must tolerate the pre-migration schema during rollout where deployment order
can overlap. Old code must tolerate additive changes until contraction is approved.

## Destructive changes and rollback

Destructive changes include `DROP TABLE`, `DROP COLUMN`, `TRUNCATE`, irreversible rewrites,
narrowing type changes, deletion of reference data, disabling or broadening RLS, removing
constraints, changing ownership, and altering storage references.

They require an explicitly scoped task, data-impact and tenant-impact analysis, clinical/privacy
and security review where relevant, backup and restore evidence, archive/export decisions,
staging rehearsal, production approval, a forward corrective or restore plan, annotations, and
post-change verification. Never hide a destructive operation in an unrelated migration.

Forward-fix is preferred. Shared migrations remain immutable, and down migrations are optional
documentation rather than automatically trusted recovery. Recovery may combine application
rollback, feature containment, a new corrective migration, or a verified backup restore. Data-loss
risk must be explicit. An RLS regression requires immediate containment and security escalation.

## Data migrations

Backfills and repairs must:

- operate within one verified tenant scope at a time and never mix clinics;
- be idempotent or safely resumable where practical and record non-sensitive progress;
- use bounded batches instead of loading entire tables or holding long transactions;
- calculate and verify before/after counts and invariants;
- retain clinically important source values and audit evidence;
- provide preview/dry-run output where useful, without exposing patient content;
- separate high-volume data work from blocking DDL where appropriate; and
- define safe retry, cancellation, failure, and corrective behaviour.

No patient data migration exists in TENANT-001.

## RLS and security-definer changes

RLS is a first-class schema change. Future tenant tables must explicitly enable RLS and deny by
default. Policies must be added in the same migration or a controlled sequence that creates no
exposure window. Every policy change needs named rationale plus positive, negative, cross-tenant,
role, support-access, and service-boundary tests as applicable. Broad `USING (true)` policies and
casual RLS disablement are prohibited.

Security-definer functions are exceptional. TENANT-001 uses narrowly scoped functions with an empty
`search_path`, revoked public execution, trusted transaction-local context, and database tests.
Future functions must preserve those controls, avoid dynamic SQL where practical, audit sensitive
actions when applicable, and include privilege-escalation tests.

## AUDIT-001 append-only audit foundation

The second migration adds only `public.audit_event`, strict validation helpers, one clinic-scoped
writer, one structurally separate platform-system writer, an immutability trigger, forced RLS,
three investigation-oriented indexes, and restrictive foreign keys. It does not alter the tenant
tables or their twelve policies.

Normal `anon` and `authenticated` roles have no audit table privileges, no audit RLS policy, and no
execution right on either writer. This is read-access Option A: there is no product audit read
access until AUDIT-002 can add reviewed role-specific projections. The clinic writer derives its
actor and clinic from the existing trusted transaction-local context and requires active
membership. The platform-system writer is owner-only and cannot represent a human platform actor;
platform-user authority remains deferred.

Audit rows must never be manually updated or deleted. The trigger rejects both operations, and
corrections are new events. Metadata is flat, allowlisted, and capped at 2,048 UTF-8 bytes. Do not
store clinical content, contact data, credentials, tokens, URLs, raw keys, request/response bodies,
file contents, stack traces, or arbitrary free text.

Run all tenant and audit tests or the isolated audit file:

```bash
corepack pnpm db:test
corepack pnpm db:test:audit
corepack pnpm verify:audit-policy
```

The tests are transactional and synthetic. No audit seed rows, UI, API route, authentication flow,
clinical schema, retention deletion, export, support access, remote project, or provider credential
is included.

## TENANT-002 tenant policy families

The third migration adds only reusable functions: immutable owner-only tenant-context setup,
active-membership assertion, a stable security-invoker row predicate, and an immutable-`clinic_id`
trigger. It creates no persistent table or product policy and does not alter existing tenant or
audit policies.

Future clinic-owned tables follow these mandatory patterns:

- physical non-null `clinic_id`;
- parent `unique (clinic_id, id)`;
- child `(clinic_id, parent_id)` composite foreign key;
- tenant-scoped unique constraints and indexes;
- immutable clinic ownership trigger;
- database-generated UTC timestamps and the existing update trigger;
- enabled and forced RLS;
- policies named `<table>_<operation>_active_tenant` or `<table>_deny_direct_<operation>`;
- tenant and membership predicates composed with later permission, state, and approval predicates.

The reusable RLS predicate is explicitly schema-qualified, null-safe, stable, search-path pinned,
security invoker, non-leakproof, and executable by `authenticated` only for policy evaluation.
Context establishment and active-membership assertion remain owner-only. No general service bypass
or administrative onboarding function exists.

`tenant_policy_families.test.sql` creates temporary parent/child fixtures inside its rollback-only
transaction. It proves composite relationships, tenant uniqueness, immutable ownership,
timestamp/status conventions, active-tenant reads, denied direct writes, context-switch rejection,
savepoint cleanup, and audit compatibility without polluting production schema.

```bash
corepack pnpm db:test:tenant-families
corepack pnpm verify:tenant-family-policy
```

## TENANT-003 synthetic tenant seed

The pinned CLI applies `seed/001_tenant_foundation.sql` after the three migrations during the
explicitly local `pnpm db:reset` workflow. The seed creates:

- active `Clinic Alpha` and `Clinic Beta`;
- five active internal platform-user placeholders using `.example.test`;
- two active memberships per clinic; and
- one suspended Clinic Alpha membership for negative access tests.

Stable UUID namespaces begin with `10000000` for users, `20000000` for clinics, and `30000000` for
memberships. “Owner” and “Staff” are documentation labels only; the schema has no roles or
permissions. These provider-neutral internal records are not Auth users, have no passwords, and
cannot log in.

The seed is idempotent through stable identifiers, pre-insert collision checks, and
`ON CONFLICT (id) DO NOTHING`. Unexpected stable-ID, identity, clinic-code, or membership-pair
collisions fail the transaction. It never truncates, deletes, broadly updates, changes schema,
changes RLS, changes privileges, or inserts audit events.

Only local and disposable loopback test databases are permitted. `db:reset` passes `--local`.
Standalone apply and verification commands additionally require the `graftvision-local` project
marker, explicit local confirmation, approved loopback endpoint, matching migration history, and
local administrative user. There is no remote, staging, linked-project, or production seed
command.

```bash
corepack pnpm db:reset
corepack pnpm db:seed
corepack pnpm db:seed:verify
corepack pnpm db:test:seed
corepack pnpm verify:seed-policy
```

Seed-specific pgTAP tests verify stable identities, counts, active and suspended memberships,
cross-clinic denial, missing-context denial, forced RLS, unchanged policies, and audit
immutability. See `seed/README.md` for the complete fixture map and troubleshooting.

## TENANT-004 tenant isolation regression

After a clean `db:reset`, all five database suites run 201 assertions: the preserved 139
tenant-foundation, policy-family, audit, and seed assertions plus 62 focused regression
assertions. The new rollback-only suite covers tenant visibility, membership and inactive states,
context reuse and switch denial, savepoints, composite tenant relationships, immutable ownership,
tenant uniqueness, forced RLS, audit scope and rollback, and deterministic seed invariants.

Its negative controls create an unforced-RLS table, a broad policy, a weakened cross-clinic
relationship, and a status-blind membership lookup only inside a transaction-scoped fixture
schema. The final rollback removes the entire fixture schema and all mutable state. The suite is
self-contained so it has no test-file execution-order dependency and creates no persistent helper
or product table.

```bash
corepack pnpm db:reset
corepack pnpm db:test:all
corepack pnpm db:test:tenant-regression
corepack pnpm db:test:pool-regression
corepack pnpm verify:tenant-regression-policy
```

Static verification complements but does not replace the live reset, pgTAP, and pooled-connection
checks. Every later tenant-owned module must extend the regression suite with its own visibility,
denial, relationship, RLS, audit, and relevant concurrency cases.

## Indexes, constraints, transactions, and locks

- Indexes require a demonstrated query need, duplicate-index review, size/maintenance analysis, and
  minimal locking. Use concurrent creation for large live tables where supported; it cannot run
  inside a normal PostgreSQL transaction. Remove unused indexes in a separate reviewed migration.
- Constraints use staged validation: query existing data, repair/backfill, add with a low-lock
  technique where supported, validate, then enforce the application assumption.
- Standard PostgreSQL DDL should be transactional when safe. Concurrent indexes and some
  provider-specific operations require an explicitly documented non-transactional migration.
  Large backfills should use bounded transactions separate from DDL.
- Review table locks, rewrites, transaction duration, index work, constraint validation, vacuum,
  replication/backup impact, application timeout, and maintenance needs. Rehearse any change that
  can block traffic, rewrite a large relation, or exceed normal request/worker timeouts using
  representative synthetic volume.

## Drift, snapshots, checksums, and audit

Repository migrations are authoritative. A manual local experiment must be captured as reviewed SQL
or discarded. A manual staging or production dashboard change is drift and an incident/change
control exception; stop promotion, capture metadata without sensitive rows, assess exposure, and
write a corrective repository migration.

When environments exist, the controlled pipeline must compare repository filenames/checksums,
provider migration history, and schema metadata. Supabase schema diff may generate diagnostic SQL,
but reviewers must classify every difference. Never automatically apply a diff.

Generated schema snapshots, database types, and ERD output begin only after the first approved
product schema and must be reproducible, reviewed artefacts rather than a second migration
authority. A checksum manifest begins immediately before the first migration is applied to a shared
environment. Thereafter CI compares immutable file checksums and each environment reports applied
history. TENANT-001 has not been applied to a shared environment, so no checksum manifest or
generated snapshot exists.

Migration status is tracked in the approved task, pull request, release record, and future deployment
logs—not a database table. Permitted states are Draft, Reviewed, Approved, Applied locally, Applied
staging, Production approved, Applied production, Failed, and Corrective migration required.

## Review checklist

Every migration review records:

- purpose, task/requirement reference, category, and one-logical-change scope;
- tenant scope, RLS exposure, role/permission effects, and security-definer use;
- constraints, indexes, data volume, query plans, locks, transactions, and performance;
- data transformation, count/invariant evidence, retention, privacy, clinical, and audit impact;
- old/new application compatibility and expand-and-contract sequencing;
- seed/reference-data effect and environment restrictions;
- reversibility, backup/restore requirement, containment, and corrective plan;
- schema/RLS/application tests and deterministic empty-database rebuild evidence; and
- staging result, drift result, production plan, approvers, and observation window.

Combined author/reviewer approval is not sufficient for high-risk work. Required clinical,
privacy, security, and operations approvers follow the change impact.

## Credential separation

- Local: a local administrative role against a disposable synthetic database only.
- Staging: a restricted staging migration identity, separate from the runtime identity.
- Production: a restricted, audited, rotated migration identity held by the approved secret
  manager, never browser-visible and never reused as an application or service-role credential.

Tools must not print credentials. Review artefacts contain sanitised output only. TENANT-001 adds
only the documented local loopback database URL; it adds no remote credential.

## Commands

```bash
# Create a comment-only migration file; does not connect to a database
corepack pnpm migration:create descriptive_name

# Start, inspect, reset, test, and stop the disposable local PostgreSQL stack
corepack pnpm supabase:start
corepack pnpm supabase:status
corepack pnpm db:reset
corepack pnpm db:seed
corepack pnpm db:seed:verify
corepack pnpm db:test
corepack pnpm db:test:audit
corepack pnpm db:test:seed
corepack pnpm db:test:tenant-families
corepack pnpm supabase:stop

# Verify directory, names, order, tenant controls, and local-only configuration
corepack pnpm verify:migration-policy
corepack pnpm verify:tenant-policy
corepack pnpm verify:audit-policy
corepack pnpm verify:seed-policy
corepack pnpm verify:tenant-family-policy

# Exercise helper and verifier behaviour entirely in temporary directories
corepack pnpm verify:migration-fixtures
```

The verifier catches obvious policy errors but cannot prove SQL correctness, tenant isolation,
clinical safety, or complete SQL security.

## Troubleshooting

- If startup reports that Docker is unavailable, start the supported runtime and verify it can run
  containers before retrying.
- If port `54322` is occupied, stop the conflicting local process; do not silently change the
  checked-in database URL or connect to a remote database.
- If a migration fails, read the local error, correct only an unapplied draft migration, then run
  `db:reset`. Never edit a migration already applied to a shared environment.
- If tests fail after a successful reset, confirm only synthetic fixtures are used and run
  `supabase:status`, `verify:migration-policy`, and `verify:tenant-policy`.
- `supabase:stop` preserves a disposable local Docker volume. No running container is required
  after validation.

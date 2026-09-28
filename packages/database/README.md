# @graftvision/database

This package is the server-only PostgreSQL boundary for the TENANT-001 local tenant foundation.
It creates a small `pg` pool, validates trusted UUID tenant context, establishes that context
inside one transaction, exposes a narrow query interface to the callback, and always commits or
rolls back before releasing the connection.

## Boundary

- Import only from trusted server code through `@graftvision/database`.
- Never import this package from browser, shared UI, public-route, Scan, or Present code.
- Call `withLocalTenantContext` with an internally resolved platform-user ID and clinic ID.
- Never accept those IDs directly from untrusted request headers, query strings, or browser state.
- The migration's context setter is a local test/admin primitive and is not granted to
  `authenticated`.
- Errors and health checks deliberately omit connection strings, SQL details, and row data.

## Local use

Set the copyable loopback value from `.env.example`, start the local database, reset migrations,
and run the SQL tests:

```bash
corepack pnpm supabase:start
corepack pnpm db:reset
corepack pnpm db:test
```

The package does not implement provider authentication, authorization roles, tenant creation, clinical
records, patient data, reports, media, scanning, presentation sessions, 3D, or AI.

AUTH-001 adds one read-only identity-linkage query in `auth-identity.ts`. It requires the verified
provider UUID and verified provider email to match the same `platform_user`, then reports only
whether the user and at least one clinic membership are active. It creates no rows, sets no tenant
context, returns no clinic details, and grants no role authority.

## Synthetic tenant fixtures

TENANT-003 keeps stable synthetic fixture definitions in SQL and seed verification tooling rather
than exporting them from this package. That is the smallest boundary for the current need:
application code cannot import fixture identities, and no production-facing fixture API or general
fixture-management service exists.

The guarded root seed runner resolves this package's existing `pg` dependency only for local/test
administrative execution. It verifies the approved loopback database, project marker, migration
history, persistent table foundation, stable records, forced RLS, absence of role tables and Auth
users, and unchanged audit count. Connection details and database errors are redacted.

The platform-user records are internal placeholders, not Auth identities. “Owner” and “Staff” are
fixture labels only and confer no authority. Future package integration tests may consume a
reviewed test-only constants module when a concrete use case exists; TENANT-003 deliberately does
not add one.

## Tenant regression guarantees

TENANT-004 verifies the server-only pool at two levels. A package unit test proves sequential
operations establish fresh Alpha and Beta context on separate completed transactions. The guarded
local integration harness forces physical reuse with a one-connection pool, then runs concurrent
Alpha and Beta transactions through a two-connection pool.

Commit, rollback, and synthetic failure paths all release a connection only after PostgreSQL has
cleared transaction-local context. The failed protected operation leaves neither context nor an
audit event. Concurrent connections see only their own clinic, retain their own actor and clinic
context, and create correctly scoped audit evidence that disappears with rollback.

The harness accepts only an explicitly confirmed disposable loopback database on the approved
local port and database name. Configuration, SQL, identifiers, connection details, and raw
database errors are not emitted through its safe failure contract. Fixture constants and pool
internals remain tooling-only; no test helper is exported from the package.

Future tenant-owned database modules must extend the rollback-only SQL suite and add package or
live-pool coverage for every new context, denial, ownership, audit, error, and concurrency branch.
Security-critical uncovered branches block later product work.

## Reusable tenant policy families

TENANT-002 adds `@graftvision/database/tenant`. `withTenantTransaction` preserves the existing
pool-owned transaction API, while `reuseTenantTransaction` attaches trusted context to an existing
transaction without opening another connection. Same actor/clinic reuse is idempotent. A different
actor or clinic is rejected; operation errors propagate so the outer transaction can roll back.

The trusted future request order is:

1. Authenticate later.
2. Resolve the internal platform user later.
3. Verify active clinic membership.
4. Begin a transaction.
5. Establish owner-only transaction-local context.
6. Execute tenant-scoped work.
7. Write required audit events in the same transaction.
8. Commit or roll back.
9. PostgreSQL removes the context.

Every future clinic-owned table must store `clinic_id`. Referenced parents expose
`unique (clinic_id, id)` and children reference `(clinic_id, parent_id)` to prevent cross-clinic
relationships. Local references use `unique (clinic_id, local_code)` or an equivalent composite.
Global uniqueness is reserved for genuinely platform-wide identifiers. Archived-state uniqueness
requires a later domain-specific decision.

Attach `graftvision_private.prevent_clinic_id_change()` to every future clinic-owned table.
No-op updates are permitted; ownership changes fail with a stable content-free error. Reuse the
existing database-generated UTC `created_at`/`updated_at` convention and `set_updated_at()` trigger.
Use check constraints for small stable statuses, reference tables for governed/evolving catalogues,
and avoid premature PostgreSQL enums.

RLS policies use intent-revealing names such as `<table>_select_active_tenant`. Access always
composes tenant predicate AND active membership AND future permission/role AND record state AND
approval where relevant. `tenant_row_is_accessible` is stable, null-safe, search-path pinned,
security-invoker code; it is not leakproof and supplies no role authority. Ordinary insert/update
policies remain deferred.

Trusted clinic, platform-user, and membership administration remains deferred to later clinic and
RBAC tasks. TENANT-002 adds no broad administrative writer or service-role bypass. Required audit
writes remain composable through the same `TenantTransaction`.

## Append-only audit foundation

AUDIT-001 adds a server-only audit module exported through `@graftvision/database/audit`.
`writeAuditEvent(transaction, input)` must receive an existing `TenantTransaction`, so a future
sensitive state change and its mandatory audit evidence can commit or roll back together. It does
not open a second connection and does not accept actor or clinic identifiers. The private database
function derives both values from trusted transaction-local context and requires an active
membership.

Inputs use controlled action, resource, outcome, source-application, reason-code, request-ID, and
resource-ID contracts. SQL is fixed and parameterised. Database failures become
`AUDIT_WRITE_FAILED` without exposing SQL, identifiers, metadata, or connection details. A required
audit failure must fail the surrounding sensitive operation; asynchronous or best-effort logging
is outside AUDIT-001.

Metadata is a flat allowlist:

- `affected_count`
- `changed_fields`
- `error_code`
- `new_status`
- `policy_decision_code`
- `previous_status`
- `route_family`
- `storage_object_class`

Values are bounded integers, controlled field names, or short categorical codes. Unknown keys,
nested structures, arbitrary free text, clinical content, contact details, credentials, tokens,
signed URLs, request/response bodies, file contents, and raw errors are rejected. The serialised
limit is 2,048 UTF-8 bytes to prevent request-body, clinical-content, stack-trace, or embedded-file
logging.

`audit_event` is append-only. Normal roles have no direct table privileges, no RLS policies, and no
execution right on the private writers. A database trigger also rejects privileged accidental
updates and deletes. Corrections append a new controlled event. No audit read utility, API, route,
screen, search, export, alert, retention job, or full domain catalogue exists; those require later
role and policy work.

## Private storage-key contract

DB-003 adds pure server-only builders, parsers, validators, ownership assertions, controlled types,
and safe errors under `src/storage`, publicly exported through `@graftvision/database/storage`.
Applications and `packages/ui` must not construct keys directly.

The proposed logical buckets are:

- `clinical-private` — final patient assets, clinic assets, reports, and presentation-safe
  derivatives.
- `transfer-private` — temporary uploads, quarantine, rejected objects, and exports with different
  lifecycle controls.
- `platform-private` — platform templates and operational assets, kept outside clinic namespaces.

These constants are architecture proposals only. No provider bucket exists.

### Key shapes

```text
clinics/{clinic_id}/patients/{patient_id}/{resource_namespace}/{resource_id}/{object_class}/{category}/{asset_id}/v{version}/{variant}.{extension}
clinics/{clinic_id}/clinic-assets/{object_class}/{category}/{asset_id}/v{version}/{variant}.{extension}
clinics/{clinic_id}/exports/{export_request_id}/export/export-package/{asset_id}/v{version}/package.{extension}
temporary/clinics/{clinic_id}/uploads/{upload_session_id}/{asset_id}/source.{extension}
quarantine/clinics/{clinic_id}/uploads/{upload_session_id}/{asset_id}/source.bin
rejected/clinics/{clinic_id}/uploads/{upload_session_id}/{asset_id}/source.bin
platform/{resource_namespace}/{resource_id}/{object_class}/{category}/{asset_id}/v{version}/{variant}.{extension}
```

All identifiers are opaque UUIDs. Every segment is validated without silent normalization.
Absolute paths, traversal, percent encoding, separators within segments, duplicate separators,
control characters, whitespace, URL schemes, queries, fragments, unsupported categories,
variants, extensions, namespaces, classes, and versions are rejected. The complete key is never
included in an error.

Originals are immutable object classes. Derivatives and corrected generated artefacts use distinct
asset IDs or explicit `v0001`–`v9999` segments; database metadata will later remain authoritative
for lineage, approval, processing version, and supersession. Internal report,
`report-patient-safe`, and `presentation-safe` objects remain distinct. “Patient-safe” in a key
does not prove Doctor approval.

Original filenames are future display metadata only and never enter a generated key. Extensions
are controlled path hints, not proof of media type. Future metadata must separately retain declared
MIME type, detected content type, validation status, size, checksum, lifecycle state, original
asset lineage, and retention state.

Object-key validation supports tenant security but does not replace database ownership checks,
RLS, provider storage policies, current membership and permission checks, or server-side
authorisation. Cross-clinic moves remain prohibited even when both keys are structurally valid.
No upload, finalisation, copy, move, rendering, signed access, malware scanning, or deletion logic
exists.

## Generated types

Generated database types are deliberately deferred. TENANT-001 has only a three-table foundation,
AUDIT-001 adds one generic table, no application query consumes row shapes, and committing generated
provider output now would add a second maintenance surface without improving the trusted boundary.
A later query-layer task should generate and review types reproducibly from the migration-built
local database.

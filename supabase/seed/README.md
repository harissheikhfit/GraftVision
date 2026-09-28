# Synthetic tenant seed

## Purpose

TENANT-003 provides a deterministic two-clinic baseline for disposable local development and test
databases. It contains only internal platform-user placeholders, clinics, and memberships supported
by the current schema.

The seed is infrastructure fixture setup, not a user action or onboarding workflow. It creates no
audit event. Future runtime administrative operations must remain transactional and audited.

## Synthetic-only rule

Every record is unmistakably synthetic:

- clinic names are `Clinic Alpha` and `Clinic Beta`;
- clinic codes are `clinic-alpha` and `clinic-beta`;
- internal identity placeholders use the reserved `.example.test` domain;
- stable UUID namespaces identify platform users, clinics, and memberships.

These markers are a development-fixture convention, not a production data-classification system.
Never replace them with real clinic, staff, contact, patient, or clinical information.

## Stable identifiers

| Synthetic label        | Stable identifier                      | Internal identity placeholder  |
| ---------------------- | -------------------------------------- | ------------------------------ |
| Alpha Owner            | `10000000-0000-4000-8000-000000000001` | `owner.alpha@example.test`     |
| Alpha Staff            | `10000000-0000-4000-8000-000000000002` | `staff.alpha@example.test`     |
| Beta Owner             | `10000000-0000-4000-8000-000000000003` | `owner.beta@example.test`      |
| Beta Staff             | `10000000-0000-4000-8000-000000000004` | `staff.beta@example.test`      |
| Alpha Suspended Member | `10000000-0000-4000-8000-000000000005` | `suspended.alpha@example.test` |
| Clinic Alpha           | `20000000-0000-4000-8000-000000000001` | `clinic-alpha`                 |
| Clinic Beta            | `20000000-0000-4000-8000-000000000002` | `clinic-beta`                  |

Membership UUIDs use
`30000000-0000-4000-8000-000000000001` through
`30000000-0000-4000-8000-000000000005` in the documented record order.

“Owner” and “Staff” are fixture labels only. They do not create or imply an implemented role,
permission, or authority model.

## Identity and product boundaries

The platform users are provider-neutral internal placeholders. They are not Supabase Auth users,
cannot log in, have no password or credential, and do not pre-empt future identity linkage.

The clinics are disposable fixtures, not examples of trusted clinic onboarding. No patient,
consultation, procedure, follow-up, media, report, scan, presentation, subscription, support,
export, deletion, or other product-domain record is included.

## Execution and reset

The pinned Supabase CLI reads `[db.seed].sql_paths` after applying migrations during:

```bash
corepack pnpm db:reset
```

The repository command includes `--local`; it does not target a linked project. To replay or verify
the seed against an already running approved local database:

```bash
corepack pnpm db:seed
corepack pnpm db:seed:verify
corepack pnpm db:test:seed
corepack pnpm verify:seed-policy
```

Local and disposable loopback test databases are allowed. Staging requires a separate future
explicit command and is not configured. Production execution is prohibited.

## Idempotency and conflicts

The seed uses stable IDs and `ON CONFLICT (id) DO NOTHING`. Before inserting, it checks stable IDs,
identity placeholders, clinic codes, and membership pairs. An unexpected collision fails the whole
transaction; existing records are never silently overwritten.

The seed does not truncate tables, delete records, update unrelated rows, change RLS, grant
privileges, alter schema, or weaken audit immutability. Repeated execution preserves the same IDs,
counts, statuses, and timestamps.

## Troubleshooting

- Start the local stack before running standalone seed commands.
- Use the repository loopback database URL and local project configuration.
- If the command reports a safety rejection, confirm the application environment, loopback host,
  database name, port, and `graftvision-local` project marker.
- If it reports a fixture conflict, inspect only the synthetic UUID ranges and reserved identities;
  do not delete unrelated records or weaken the checks.
- Reset the disposable database when the local baseline may be discarded.

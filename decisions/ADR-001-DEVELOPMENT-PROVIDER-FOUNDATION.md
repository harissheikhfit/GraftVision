# ADR-001: Development Provider Foundation

## Decision record

| Field                 | Value                                                                              |
| --------------------- | ---------------------------------------------------------------------------------- |
| Task                  | DB-001 — Select database/auth/storage development providers                        |
| Status                | Accepted for development planning; selected but not connected                      |
| Decision date         | 2026-07-26                                                                         |
| Documentation checked | 2026-07-26                                                                         |
| Initial market        | Pakistan                                                                           |
| Selected strategy     | Option A — Integrated Supabase foundation                                          |
| Production status     | Conditional on privacy, legal, security, recovery, and account-governance approval |

## Context

GraftVision needs PostgreSQL, strong tenant isolation, private clinical-file storage,
authentication, and narrowly scoped realtime behaviour. The pilot must remain practical for a solo
developer while preserving a route away from any one provider.

This record selects a provider direction only. It does not authorise an account, project,
credential, SDK, database, migration, user, bucket, policy, connection, or product feature.

## Decision

Use an integrated Supabase foundation for the initial development and pilot architecture:

- Supabase-managed PostgreSQL as the system of record.
- Supabase Auth as the identity provider.
- Supabase Storage with private buckets as the initial object store.
- Supabase Realtime private channels for transient delivery signals where later approved.
- The local Supabase stack as the preferred local integration environment once a later task
  authorises installation and configuration.
- Separate GraftVision-owned staging and production projects, provisioned only after their
  respective approval gates.
- A specific South Asia (Mumbai) region is the current deployment candidate because it is the
  nearest listed Supabase region to the Pakistan launch market. The final region remains subject to
  measured connectivity and qualified privacy/legal review.

Supabase is selected because its integrated local and managed stack covers the pilot's database,
identity, object, and realtime needs with the lowest current operational burden. Standard
PostgreSQL, SQL migrations, explicit adapter boundaries, and application-owned authorisation keep
the decision reversible.

## Non-negotiable architecture boundaries

- PostgreSQL remains the source of truth for clinical and workflow state.
- Realtime is a delivery mechanism, never the source of truth.
- The thirteen-role catalogue, clinic memberships, grants, separation of duties, and permission
  evaluation remain in GraftVision-controlled tables and trusted server logic.
- Identity-provider metadata may carry only minimal identity or session context; it does not become
  the authoritative RBAC model.
- Every tenant-sensitive database path must enforce trusted server authorisation and PostgreSQL
  Row-Level Security.
- Storage objects remain private. Access is issued only after current server-side authorisation
  through short-lived signed operations.
- Privileged provider credentials remain server- or worker-only and never enter browser bundles.
- Missed realtime events are recovered by reading persisted state; scan and clinical workflows
  retain polling/manual fallback.
- Provider clients stay behind `packages/database`, `packages/auth`, and future storage/realtime
  adapter boundaries rather than being scattered through applications.

## Evaluation method

Ratings are qualitative:

- **Strong** — directly meets the requirement with documented provider capability and reasonable
  pilot effort.
- **Acceptable** — workable, but needs additional configuration, process, cost, or application
  controls.
- **Weak** — material capability or operational gaps for this pilot.
- **Unknown** — requires account-specific, contractual, regional, or hands-on verification.

The split-provider options are representative deployable strategies, not endorsements of combining
every listed product.

## Thirty-criterion comparison

| Criterion                          | Option A: Supabase integrated                    | Option B1: Neon + Clerk + R2                    | Option B2: RDS + Auth.js + S3                 | Option C: local-first, selection delayed |
| ---------------------------------- | ------------------------------------------------ | ----------------------------------------------- | --------------------------------------------- | ---------------------------------------- |
| 1. PostgreSQL compatibility        | Strong                                           | Strong                                          | Strong                                        | Strong locally; remote unknown           |
| 2. Row-Level Security              | Strong                                           | Strong through PostgreSQL                       | Strong through PostgreSQL                     | Strong locally; remote unknown           |
| 3. Authentication capabilities     | Strong                                           | Strong                                          | Acceptable; application-owned work            | Weak for remote planning                 |
| 4. MFA readiness                   | Strong; TOTP documented                          | Strong on paid Clerk plan                       | Weak; must be designed and operated           | Unknown                                  |
| 5. Invitations                     | Strong; admin invite API                         | Strong                                          | Weak; custom workflow                         | Unknown                                  |
| 6. Password recovery               | Strong                                           | Strong                                          | Weak; custom workflow and delivery            | Unknown                                  |
| 7. Session management              | Strong; advanced limits are paid                 | Strong                                          | Acceptable; database sessions possible        | Unknown                                  |
| 8. Private object storage          | Strong                                           | Strong                                          | Strong                                        | Weak until remote selection              |
| 9. Signed uploads/downloads        | Strong                                           | Strong                                          | Strong                                        | Weak until remote selection              |
| 10. Realtime channels              | Strong                                           | Weak; separate service required                 | Weak; separate service required               | Weak                                     |
| 11. Local development              | Strong integrated Docker stack                   | Acceptable; separate local substitutes          | Acceptable but assembly-heavy                 | Strong                                   |
| 12. Staging/production separation  | Strong with separate projects                    | Strong with separate provider resources         | Strong with separate AWS resources            | Weak until selected                      |
| 13. Backup support                 | Strong for paid database; objects separate       | Strong database history; object plan separate   | Strong                                        | Local-only and manual                    |
| 14. Restore support                | Acceptable; restore downtime and object gap      | Strong database restore window                  | Strong                                        | Weak and operator-dependent              |
| 15. Observability                  | Acceptable on Pro; richer tiers cost more        | Acceptable across three consoles                | Strong but configuration-heavy                | Weak                                     |
| 16. Auditability                   | Acceptable; application audit still mandatory    | Acceptable; fragmented evidence                 | Strong but configuration-heavy                | Weak                                     |
| 17. Data export                    | Strong via PostgreSQL tools and object APIs      | Strong                                          | Strong                                        | Strong locally                           |
| 18. Data deletion                  | Strong primitives; application policy required   | Strong primitives; cross-provider coordination  | Strong primitives; cross-service coordination | Acceptable locally                       |
| 19. Data residency options         | Acceptable; Mumbai available                     | Acceptable; must align three providers          | Strong regional control                       | Unknown for production                   |
| 20. Pakistan accessibility         | Unknown until measured                           | Unknown until measured                          | Unknown until measured                        | Strong local only                        |
| 21. Pilot-stage cost               | Strong integrated starting point                 | Acceptable; multiple paid triggers              | Weak for a small pilot                        | Strong locally, no production path       |
| 22. Cost predictability            | Acceptable; quotas and add-ons published         | Acceptable but fragmented                       | Weak; many metered services                   | Acceptable locally                       |
| 23. Vendor lock-in                 | Acceptable with boundaries                       | Acceptable; more vendors, less integration lock | Acceptable; AWS coupling                      | Strong locally, decision debt remains    |
| 24. Migration difficulty           | Acceptable                                       | Acceptable                                      | Acceptable                                    | Weak because migration plan is deferred  |
| 25. TypeScript/Next.js integration | Strong                                           | Strong                                          | Acceptable                                    | Acceptable                               |
| 26. PWA compatibility              | Strong                                           | Strong                                          | Strong                                        | Strong locally                           |
| 27. Background-job integration     | Acceptable; external worker still needed         | Acceptable; adapters required                   | Strong but operationally heavier              | Weak                                     |
| 28. Future AI/3D integration       | Strong generic data/object primitives            | Strong                                          | Strong                                        | Acceptable locally                       |
| 29. Security posture               | Strong foundation; application controls required | Strong components; integration risk             | Strong controls; configuration burden         | Weak for production                      |
| 30. Solo-developer burden          | Strong                                           | Weak                                            | Weak                                          | Acceptable initially; costly delay later |

## Database-provider decision

### Selected: Supabase-managed PostgreSQL

Supabase provides a dedicated PostgreSQL database, integrates Auth, Storage, and Realtime with that
database, supports PostgreSQL RLS, provides a local stack, and offers managed backups on paid plans.
The schema will remain ordinary PostgreSQL wherever possible.

Required later controls:

- Deny-by-default RLS with explicit two-clinic negative tests.
- Trusted tenant context; never accept `clinic_id` alone as authority.
- SQL migrations tracked in version control.
- Separate runtime and migration database identities.
- Logical exports with `pg_dump` or equivalent, plus restore rehearsals.
- A production backup plan with approved RPO/RTO.
- No provider-specific database feature without a recorded justification and exit plan.

Important limitation: Supabase database backups cover database state but do not restore Storage
object bytes. Database recovery and clinical-object recovery therefore require separate plans.

### Alternatives

- **Neon:** strong portable PostgreSQL, branching, scale-to-zero, and restore history. Deferred
  because it does not by itself remove the need to select and integrate separate production auth,
  object storage, and realtime providers.
- **AWS RDS for PostgreSQL:** strongest infrastructure control, mature backup/restore, and Mumbai
  availability. Deferred because its networking, identity, observability, backup, and cost
  configuration impose substantially more pilot operational work.
- **Local PostgreSQL only:** retained as a portability and unit-test tool, not the production
  provider strategy.

## Authentication-provider decision

### Selected: Supabase Auth

Supabase Auth documents email/password authentication, invitations, password recovery, TOTP/phone
MFA, session records and limits, server-side Next.js support, and administrative session
revocation. Its shared identity and PostgreSQL boundary reduce pilot integration work.

Rules:

- GraftVision owns the product user, clinic membership, role, permission, support-grant, and
  separation-of-duty model.
- Provider user IDs map to stable GraftVision user records.
- Provider claims are hints for identity/session assurance, not permission authority.
- Invitation acceptance does not grant clinic access until the server validates the corresponding
  GraftVision invitation and membership.
- MFA enforcement, recovery assurance, session duration, device/session revocation, and step-up
  actions remain security-policy decisions for later authentication tasks.
- Server-side auth routes must prevent session-bearing responses from being shared through caches.

### Compared alternatives

| Provider             | Strengths                                                                                             | Pilot limitations                                                                                                      | Decision                                           |
| -------------------- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Supabase Auth        | Integrated local stack, PostgreSQL relationship, invite/recovery, MFA, sessions, SSR                  | Advanced session controls require paid plan; SSR helper API maturity must be reviewed during implementation            | Selected                                           |
| Clerk                | Excellent Next.js developer experience, invitations, organisations, session/device controls, paid MFA | Separate identity tenancy can drift from GraftVision RLS/RBAC; another vendor and cost surface                         | Deferred; reconsider for enterprise identity needs |
| Auth.js + PostgreSQL | Open source, database sessions, high control, portable adapters                                       | Credentials flows leave password security, recovery, invitations, MFA, abuse protection, and operations to GraftVision | Rejected for MVP operational burden                |

## Storage-provider decision

### Selected: Supabase Storage

Use private file buckets with tenant-scoped opaque object keys and server-authorised, expiring signed
uploads/downloads. Supabase Storage documents private buckets, RLS-backed access control, signed
URLs, signed upload operations, S3 compatibility, resumable uploads, deletion, and object metadata.

Required later controls:

- No public clinical-media bucket.
- No patient name, phone number, clinic name, or other direct identifier in object keys.
- Store object identity, tenant ownership, checksum, MIME type, size, state, lineage, and retention
  authority in PostgreSQL.
- Treat signed URLs as bearer grants: short expiry, exact operation/object scope, no persistence in
  clinical or audit records.
- Define object backup, inventory, restore, deletion reconciliation, and legal-hold behaviour before
  production.
- Preserve a storage adapter compatible with S3-style object operations.

### Compared alternatives

| Provider         | Strengths                                                                                               | Pilot limitations                                                                              | Decision                                           |
| ---------------- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Supabase Storage | Integrated RLS metadata, private-by-default buckets, signed access, local stack                         | Database backup does not restore object bytes; deeper access logging/recovery needs validation | Selected                                           |
| Cloudflare R2    | S3 API, presigned URLs, low published storage price, free direct egress                                 | Location hints are not guarantees; no Pakistan jurisdiction; separate auth/RLS integration     | Deferred for cost-driven storage scaling           |
| AWS S3           | Mature private buckets, presigned access, Mumbai region, versioning, lifecycle, Object Lock, CloudTrail | Highest IAM, logging, lifecycle, and cost-configuration burden for the pilot                   | Deferred for advanced retention/audit requirements |

## Realtime-provider decision

### Selected: Supabase Realtime for pilot delivery signals

Supabase Realtime supports private channels, RLS-backed channel authorisation, Broadcast, Presence,
and PostgreSQL change delivery. It is sufficient for later pilot flows such as scan progress,
temporary presentation control, background-job status, expiry, and revocation, subject to load and
recovery tests.

Rules:

- Use private, tenant- and session-scoped channels only.
- Validate every publish and subscription on the server or through approved RLS policy.
- Send opaque identifiers and minimum status payloads, not clinical records or signed file URLs.
- Persist authoritative state before publishing an event.
- Recover reconnects and missed events by re-reading persisted state.
- Provide bounded polling and manual refresh/fallback.
- Do not make surgery, approval, or patient-safety transitions depend on a live channel.

Application WebSockets or a managed realtime specialist are deferred until measured concurrency,
regional latency, delivery semantics, or operational evidence shows Supabase Realtime is
insufficient.

## Environment strategy

### Local development

Preferred later workflow: the full local Supabase stack through a Docker-compatible runtime, with
schema, migrations, synthetic seed data, Auth, Storage, and Realtime configuration reproducible from
version-controlled files.

- Never use production data, credentials, dumps, project identifiers, or provider access tokens.
- Local services bind only for development and are never exposed as production infrastructure.
- Reset and reseed must be deterministic.
- RLS, Auth, private Storage, and reconnect behaviour must be testable locally.
- An optional remote development project may be added only for documented platform-parity tests
  that cannot run locally. It remains isolated and synthetic.

No local provider stack is installed or started by this decision.

### Staging

- One separate GraftVision-owned Supabase project.
- Separate database, Auth users, Storage buckets, Realtime channels, keys, email configuration, and
  logs.
- Synthetic or explicitly approved non-production fixtures only.
- No production credentials, imports, bucket replication, or backup restoration.
- Full end-to-end, tenant-isolation, recovery, and migration rehearsal before promotion.
- Candidate region matches production unless a documented test requires otherwise.

### Production

- One separate GraftVision-owned Supabase project.
- Candidate specific region: South Asia (Mumbai), pending legal/privacy and measured-access review.
- Restricted named administrators, MFA, recovery ownership, production-only secrets, and logged
  emergency access.
- Paid plan required before clinical production use; free tier is not approved for production
  patient data.
- Approved backups, independent logical exports, object recovery, monitoring, alerts, migration
  controls, restore rehearsals, and incident procedures.
- Developers have no routine production-data access.

## Provider account and ownership policy

- The Supabase organisation, projects, billing profile, domains, recovery channels, and contractual
  records belong to GraftVision—not a clinic or an individual's personal account.
- Clinics own their clinic and patient data under the approved service contract; GraftVision owns
  the SaaS platform and provider configuration.
- Clinic customers receive no provider-dashboard or infrastructure-administration access.
- Production provider access is least-privilege, named, MFA-protected, periodically reviewed, and
  removed promptly.
- Support or emergency access requires an approved purpose, bounded duration, logged actions, and
  post-access review.
- Billing owner, technical owner, security owner, privacy contact, and recovery custodians must be
  recorded before staging.
- Recovery must use organisationally controlled channels and at least two authorised custodians; it
  must not depend on one personal device or mailbox.

## Pilot cost model

All amounts are estimates in the providers' published currency and must be rechecked before
provisioning.

### Selected Supabase strategy

| Stage or meter              | Published structure checked 2026-07-26                                                                                                  | Planning interpretation                                                                                           |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Local development           | Local CLI stack; developer hardware and container runtime                                                                               | No managed-provider charge                                                                                        |
| Optional remote development | Free plan: two active projects maximum, paused after inactivity                                                                         | Synthetic parity testing only; never production clinical data                                                     |
| Paid organisation           | Pro from USD 25/month; first project included                                                                                           | Minimum production planning tier                                                                                  |
| Additional project          | From USD 10/month                                                                                                                       | A separate staging project implies an estimated starting platform total from USD 35/month before add-ons/overages |
| Database                    | Pro includes 8 GB disk per project, then USD 0.125/GB                                                                                   | Monitor schema, audit, and operational growth                                                                     |
| File storage                | Pro includes 100 GB, then USD 0.0213/GB                                                                                                 | Images, models, and reports can become the dominant meter                                                         |
| Egress                      | Pro includes 250 GB, then USD 0.09/GB; cached egress has separate pricing                                                               | Test Pakistan upload/download and report traffic                                                                  |
| Authentication              | Pro includes 100,000 MAU, then USD 0.00325/MAU                                                                                          | Pilot staff volume should remain below allowance; SMS/advanced MFA is separate                                    |
| Realtime                    | Pro includes 5 million messages and 500 peak connections; published overage USD 2.50/million messages and USD 10/1,000 peak connections | Use minimum payloads and measure reconnect behaviour                                                              |
| Backups                     | Pro includes daily database backups retained seven days                                                                                 | Does not back up Storage object bytes                                                                             |
| PITR                        | Seven-day retention approximately USD 100/month per enabled project and requires qualifying compute                                     | Production RPO decision, not an automatic pilot expense                                                           |
| Observability               | Pro log retention seven days; log drains and richer governance cost more                                                                | Confirm whether pilot incident/audit needs require a higher tier                                                  |

The estimate excludes email/SMS delivery, taxes, exchange rates, custom domains, additional compute,
PITR, log drains, independent object backups, and future workers. A billing calculator and written
quote should be captured before staging and again before production.

### Alternative cost signals

- Neon publishes a free tier and a usage-based Launch plan with a typical example of USD 15/month,
  plus compute, database storage, and restore-history storage. Auth, object storage, and realtime
  would still add separate costs.
- Clerk publishes a free Hobby plan; Pro begins at USD 20/month billed annually and includes MFA and
  configurable sessions. Organisation limits and add-ons introduce additional meters.
- Cloudflare R2 Standard publishes 10 GB-month free, then USD 0.015/GB-month, metered operations, and
  free direct egress.
- AWS RDS and S3 are usage- and region-dependent. The official calculators are required for a
  Mumbai-region estimate; no single flat pilot price is recorded here.

## Data residency and Pakistan considerations

Supabase lists South Asia (Mumbai) as an available specific region, but GraftVision has no Pakistan
in-country provider region selected. Region proximity is not legal approval.

Before staging or production, qualified privacy/legal and security reviewers must determine:

- Whether database, Auth, Storage, Realtime, logs, email, support, and backup data remain in the
  selected region or cross borders.
- Exact storage-object placement, backup locations, replication, subprocessors, support access,
  telemetry, and deletion behaviour.
- Contractual controller/processor responsibilities between each clinic, GraftVision, and the
  provider.
- Patient notice/consent or other lawful basis, photography and clinical-record obligations,
  export/deletion duties, retention, holds, and incident notification.
- Whether provider terms, DPA, security reports, support, billing, and incident channels are
  acceptable for Pakistani clinical data.
- Measured latency, upload reliability, DNS/TLS reachability, and provider-console access from
  Pakistan.

This ADR makes no claim of compliance with Pakistani law or any healthcare/privacy regime.

## Vendor-lock-in controls

- Use standard PostgreSQL types and constraints unless a provider-specific feature is approved.
- Store all schema changes as reviewable SQL migrations.
- Maintain reproducible logical database exports and restore tests.
- Keep domain services independent from provider SDK response shapes.
- Put database, identity, storage, and realtime access behind explicit package-owned adapters.
- Map provider identities through a GraftVision user-account record.
- Keep roles and permissions out of provider-managed organisation/RBAC metadata.
- Use opaque, portable object keys plus an exportable object manifest and checksums.
- Persist realtime state and use an outbox/event contract so another transport can replace it.
- Avoid direct provider calls from application UI modules.
- Record each provider-specific feature, reason, fallback, and exit impact in a future ADR update.
- Define an exit rehearsal: PostgreSQL dump/restore, Auth identity export and forced recovery,
  object copy with integrity verification, credential rotation, DNS/config cutover, and rollback.

## Future environment-variable contract

These are planning names only. They are deliberately absent from `.env.example` and configuration
schemas until an implementation task approves them.

| Category                      | Proposed future names                                              | Boundary                                                              |
| ----------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------- |
| Client-safe                   | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser-visible by design; never privileged                           |
| Server-only runtime           | `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `DATABASE_URL`              | Trusted server only; never logged or bundled                          |
| Migration-only                | `DATABASE_DIRECT_URL`                                              | Local operator or controlled migration runner only                    |
| Local tooling                 | `SUPABASE_PROJECT_REF`, `SUPABASE_ACCESS_TOKEN`                    | Optional remote-management tooling only; never application runtime    |
| Worker-only                   | `WORKER_SUPABASE_URL`, `WORKER_SUPABASE_SECRET_KEY`                | Background-worker secret store only                                   |
| Existing environment selector | `APP_ENV`                                                          | Selects local/test/staging/production configuration; not a credential |

Exact names, key types, rotation, secret stores, validation schemas, and Turborepo cache inputs must
be approved in the task that installs the provider integration. Publishable keys are not
authorisation by themselves; RLS and server checks remain mandatory.

## Future package responsibilities

No implementation is authorised by this section.

### `packages/database`

- Server-only provider client creation and connection selection.
- SQL migrations and transaction utilities.
- Tenant-context and tenant-scoped query helpers.
- RLS test harnesses and migration/restore verification.
- Provider-independent repositories or query boundaries where they reduce coupling.

### `packages/auth`

- Supabase Auth adapter and session verification.
- Provider-identity to GraftVision-user mapping.
- Membership lookup and central permission evaluation.
- MFA/assurance, session revocation, invitation, recovery, and support-access checks.
- No authoritative thirteen-role model in provider metadata.

### `packages/config`

- Typed client/server/worker/local configuration schemas.
- Strict public/private separation and fail-safe validation.
- Environment-specific provider endpoints without secret exposure.
- Tests that prohibit privileged configuration from client exports or build output.

Storage and realtime adapters should be owned by the server-side package that ultimately owns those
operations; they must not be introduced as incidental application utilities.

## Reconsideration triggers

Re-open this decision if any of the following occurs:

- Legal/privacy review rejects available data locations, terms, subprocessors, or cross-border
  processing.
- Pakistan connectivity or upload tests fail the agreed reliability/latency threshold.
- Required RPO/RTO or object recovery cannot be met at acceptable cost.
- Production access control, audit logging, or support evidence requires a plan whose cost is
  unsuitable for the pilot.
- Storage volume or egress makes R2 or S3 materially safer or more economical after integration
  costs.
- Enterprise SSO, SCIM, identity assurance, or organisation administration makes Clerk or another
  identity provider materially stronger.
- Realtime concurrency, ordering, latency, replay, or regional behaviour fails pilot tests.
- Supabase local/managed parity causes unsafe migration or recovery uncertainty.
- Provider pricing, terms, product availability, key model, or platform maturity changes
  materially.
- A clinic requires approved physical or regional isolation not supported by the selected model.

## Unresolved decisions and approval gates

- Final production region and cross-border/data-processing approval.
- Whether staging may use Free or must use Pro for parity and backup behaviour.
- Production backup RPO/RTO, PITR need, and restore rehearsal frequency.
- Independent Storage object backup, versioning, inventory, lifecycle, and legal-hold design.
- Required provider plan for platform audit logs, project-scoped access, support, and compliance
  evidence.
- MFA enforcement by role, session duration, recovery strength, and step-up actions.
- Transactional email/SMS provider, sender-domain controls, deliverability, and message retention.
- Pakistan payment availability, support responsiveness, and measured service accessibility.
- Exact incident, deletion, export, and provider-exit procedures.

These are production gates, not reasons to defer the initial development-provider selection.

## Official evidence register

All sources were checked on 2026-07-26. Capability and price claims must be rechecked before
purchase or implementation.

### Supabase

- [Platform overview](https://supabase.com/docs/guides/platform) — dedicated PostgreSQL, Auth,
  Storage, Realtime, and project model.
- [Database overview](https://supabase.com/docs/guides/database/overview) — PostgreSQL foundation,
  RLS, managed backups, and PITR positioning.
- [Available regions](https://supabase.com/docs/guides/platform/regions) — specific South Asia
  (Mumbai) availability.
- [Local development workflow](https://supabase.com/docs/guides/local-development/cli-workflows) —
  version-controlled local stack, migrations, seeds, and local/linked safety.
- [Auth overview](https://supabase.com/docs/guides/auth) — supported identity methods, JWTs, RLS
  relationship, and server-side support.
- [MFA](https://supabase.com/docs/guides/auth/auth-mfa) — TOTP/phone factors and assurance levels.
- [User sessions](https://supabase.com/docs/guides/auth/sessions) — session IDs, limits, expiry, and
  revocation behaviour.
- [Invite user](https://supabase.com/docs/reference/javascript/auth-admin-inviteuserbyemail) and
  [password recovery](https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail) —
  invitation and recovery capabilities.
- [Storage overview](https://supabase.com/docs/guides/storage),
  [private buckets](https://supabase.com/docs/guides/storage/buckets/fundamentals), and
  [Storage access control](https://supabase.com/docs/guides/storage/security/access-control) —
  private objects, signed access, RLS, and service-key warning.
- [Realtime](https://supabase.com/docs/guides/realtime),
  [private-channel concepts](https://supabase.com/docs/guides/realtime/concepts), and
  [Realtime pricing](https://supabase.com/docs/guides/realtime/pricing) — channel model, private
  authorisation, and usage meters.
- [Database backups](https://supabase.com/docs/guides/platform/backups) — daily backup retention,
  PITR, restore behaviour, and explicit exclusion of Storage object bytes.
- [Pricing](https://supabase.com/pricing) — current plan, quota, storage, Auth, Realtime, backup,
  observability, and project pricing structure.

### Alternatives

- [Neon pricing](https://neon.com/pricing) — free/usage-based plans, PostgreSQL storage, branching,
  restore windows, and observability tiers.
- [Clerk pricing](https://clerk.com/pricing),
  [organisations](https://clerk.com/docs/guides/organizations/overview), and
  [invitations](https://clerk.com/docs/guides/users/inviting) — MFA/session plan boundaries,
  organisation model, and invitations.
- [Auth.js session strategies](https://authjs.dev/concepts/session-strategies),
  [credentials](https://authjs.dev/getting-started/authentication/credentials), and
  [PostgreSQL adapter](https://authjs.dev/getting-started/adapters/pg) — database/JWT sessions,
  adapter portability, and application-owned credential responsibilities.
- [Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing/),
  [presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/), and
  [data location](https://developers.cloudflare.com/r2/reference/data-location/) — storage/operation
  meters, temporary access, and non-guaranteed location hints.
- [Amazon RDS for PostgreSQL](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_PostgreSQL.html),
  [RDS backup/restore](https://docs.aws.amazon.com/AmazonRDS/latest/gettingstartedguide/managing-backup-restore.html),
  [S3 bucket model](https://docs.aws.amazon.com/AmazonS3/latest/userguide/UsingBucket.html),
  [S3 presigned URLs](https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html),
  and [S3 endpoints](https://docs.aws.amazon.com/general/latest/gr/s3.html) — managed PostgreSQL,
  recovery, private objects, signed access, and Mumbai availability.

## Consequences

The decision lowers pilot integration and operations work while retaining an explicit exit path. It
also concentrates database, identity, storage, and realtime dependency in one provider, so adapter
discipline, independent exports, object recovery, and production governance are mandatory.

DB-002 remains the next task. This ADR does not begin migration design or provider implementation.

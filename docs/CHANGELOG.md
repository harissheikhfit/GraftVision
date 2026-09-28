# Changelog

All notable changes to GraftVision will be documented in this file.

The format follows Keep a Changelog principles. Versioning will begin when the first application package is implemented.

## Unreleased

### Changelog process

- Record any repository change that affects behavior, contracts, safety, setup, or contributor expectations.
- Use a dated bullet entry with the relevant task ID when available, plus a short summary of scope and impact.
- Prefer categories in this order: `Added`, `Changed`, `Fixed`, `Security`, `Documentation`, and `Deferred`.
- Include approval, review, or risk notes only when they materially affect the change or its rollout.
- Keep entries synthetic, privacy-safe, and free of secrets, patient data, provider credentials, or internal operational details.
- Do not describe implementation noise or unrelated refactors; keep the note high-signal and reviewable.

### Added

- 2026-09-23 — `SCAN-002`: corrected scan-session and capture authorization to use the existing `SCAN-PERM-001` catalog permission, with pgTAP coverage for the valid grant and `SCAN_SESSION_CREATE_DENIED` without it. Tenant, RLS, and security-definer controls are unchanged.
- 2026-09-23 — `AI-MAP-002C`: added an opt-in local-only synthetic graph setup/verification contract and wired the worker E2E to consume generated tenant-bound IDs and artifact checksums without credentials.
- 2026-09-23 — `AI-MAP-002C`: added a server-only genuine ONNX worker boundary with explicit tenant and reconstruction-worker lease identity, strict finite/bounded output validation, atomic controlled persistence, idempotency, and Doctor-decision-gated proposal provenance. Database execution evidence remains pending.
- 2026-09-23 — `PLAN-002`: recorded invalidation idempotency results as `invalidated` instead of reusing the `finalized` status. Clinical applicability review remains open.
- 2026-09-23 — `PLAN-002`: completed the controlled planning invalidation contract, including stale-state, revision, tenant-denial, idempotency, and audit evidence. Clinical applicability review remains open.
- 2026-09-23 — `PLAN-002`: strengthened the engineering policy verifier so controlled finalization and invalidation markers cannot regress silently. Clinical applicability review remains open.
- 2026-09-23 — `PLAN-002`: expanded planning contract evidence for replay rejection, valid state guards, row locking, and controlled mutation context. Clinical applicability review remains open.
- Initial Git repository scaffold.
- Foundation verification now ignores the disposable repository-local `.tmp` cache during workspace traversal.
- AI-map proposal operations now have an active-session read contract and deterministic PostgreSQL collation checks.
- Planning packages now have a controlled Doctor finalization operation with revision, idempotency, and audit coverage.
- Planning packages now become explicitly stale through a controlled, audited operation when an upstream geometry revision changes.
- Added a bounded, provisional scalp-region domain with immutable versions, explicit source/frame/method lineage, controlled Doctor writes, stale/idempotent revision handling, and audit metadata. Clinical review of the taxonomy and approval semantics remains open.
- Turborepo-ready npm workspace configuration.
- Placeholder workspaces for `web`, `scan`, and `present`.
- Placeholder shared packages for UI, database, authentication, configuration, and types.
- Product, architecture, security, UX, deployment, and backlog documentation placeholders.
- Environment variable and Git ignore templates.

### Documentation

- Established the repository changelog process so `docs/TASKS.md` work can be tracked with task IDs, dates, and risk/approval notes without adding product scope.


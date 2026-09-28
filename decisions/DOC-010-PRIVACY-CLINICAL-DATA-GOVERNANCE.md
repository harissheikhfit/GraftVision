# DOC-010: Privacy and Clinical Data Governance

## Decision record

| Field                       | Value                                                                                     |
| --------------------------- | ----------------------------------------------------------------------------------------- |
| Task                        | DOC-010 — Resolve security and privacy/legal decisions                                    |
| Protocol version            | GV-PRIVACY-MVP-0.1                                                                        |
| Decision date               | 2026-07-30                                                                                |
| Product status              | Dependency-complete as a privacy-by-design product decision record with explicit blockers |
| Legal status                | Qualified Pakistan and applicable-jurisdiction legal review pending                       |
| Clinical status             | Licensed hair-restoration physician review pending                                        |
| Production status           | Real-patient use blocked                                                                  |
| Governing clinical protocol | GV-CLINICAL-MVP-0.1                                                                       |

This record approves GraftVision's MVP privacy-by-design product architecture and records explicit
production blockers. It is not legal advice, regulatory certification, medical approval, a claim
of Pakistan or GDPR compliance, or permission to process real-patient data.

## Proposed controller and processor allocation

| Processing context                   | Proposed controller                          | Proposed processor/service provider             | Boundary                                                                       |
| ------------------------------------ | -------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------ |
| Patient care and clinical records    | FACE Aesthetic Clinic                        | GraftVision                                     | GraftVision acts only on documented clinic instructions                        |
| Platform security and authentication | GraftVision, only where applicable           | Approved infrastructure providers               | Narrowly limited to identity, security, abuse prevention, and access integrity |
| Service reliability                  | GraftVision, only where applicable           | Approved infrastructure providers               | Minimum operational data; no independent clinical purpose                      |
| Legal defence records                | Party determined by applicable facts and law | Approved legal/service providers where required | Minimum necessary, held only under approved authority                          |

The allocation is proposed and requires qualified Pakistan legal confirmation. GraftVision may not
use patient or clinical data for an independent secondary clinical purpose.

## Purpose and data matrix

| Approved purpose                        | Minimum data categories                                                 | Primary actors                                    | Prohibited expansion                                       |
| --------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------- | ---------------------------------------------------------- |
| Patient and consultation administration | Clinic-scoped identity, registration, status, consultation references   | Authorised clinic staff                           | Advertising, unrelated analytics, global identity matching |
| Clinical-care documentation             | Versioned medical and hair-loss history, provenance, review state       | Authorised clinical staff                         | Research, benchmarking, model training, demonstrations     |
| Safety and continuity                   | Allergies, medication status, concerns, warnings, exact history version | Verified Doctor and minimum authorised assistants | Automated diagnosis, clearance, or suitability             |
| Doctor review                           | Draft sections, clinical findings, warnings, source versions            | Verified same-clinic Doctor                       | Assistant or software finalisation                         |
| Security and accountability             | Opaque resource/action references, redacted actor/session context       | Restricted security and audit roles               | Clinical narrative or routine patient profiling            |
| Purpose-bound operational communication | Minimum recipient and workflow status                                   | Authorised clinic workflow                        | Marketing or unrelated engagement                          |

Patient or clinical data may not be used for advertising, unrelated analytics, model training,
product demonstrations, external research, benchmarking, sale, or data brokerage. Any future
secondary use requires separate product approval, legal assessment, notice, and technical controls.

## Consent and notice separation

The following are separate concepts and evidence:

- privacy notice acknowledgement;
- treatment consent;
- clinical-photography consent;
- depth or LiDAR consent;
- AI-processing consent;
- report-sharing consent; and
- marketing consent.

A privacy acknowledgement proves that an approved notice was presented and acknowledged. It is not
automatically treatment, media, AI, sharing, or marketing consent.

Future acknowledgement evidence must include notice identifier and version, language, effective
date, presentation and acknowledgement timestamps, collection channel, clinic, patient or verified
representative, evidence method, and withdrawal/supersession state. Withdrawal is purpose-specific
and does not automatically erase valid past processing, required clinical evidence, audit history,
or legal-hold records.

Approved English and Urdu wording and semantic equivalence remain blocked pending qualified legal
and language review.

## Capacity and representatives

The first real-patient pilot, if later authorised, is restricted to direct adult-patient
interaction. The product must not infer incapacity. Minor, guardian, or authorised-representative
access is not approved for DOC-010 or CONSULT-003.

Any future representative workflow requires approved capacity rules, representative categories,
identity and authority verification, purpose and scope, expiry, revocation, conflict handling, and
legal review. Missing or expired representative authority fails closed.

## Role and projection matrix

| Role/context                                       | Approved clinical projection                                               | Explicit restrictions                                                                                                                              |
| -------------------------------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Verified assigned Doctor                           | Same-clinic consultation and clinical history required for care and review | Requires active user, clinic, membership, readiness, unlocked current session, verification, patient/consultation match, and approved relationship |
| Clinical Assistant                                 | Minimum patient-reported history and draft-preparation projection          | No Doctor verification, finalisation, private notes, unrestricted exports, or overwrite of Doctor-reviewed history                                 |
| Clinic Owner/Administrator                         | Administrative projection only                                             | No automatic clinical visibility; no pilot exception; no Doctor-private notes                                                                      |
| Combined Admin/Doctor                              | Doctor projection only in a valid Doctor-authorised clinical context       | Administrative role alone grants no clinical access                                                                                                |
| Read-Only Clinical Reviewer                        | Explicit minimum consultation-specific read projection                     | Read-only, purpose-bound, approved, revocable, time-bounded; no ordinary export                                                                    |
| Reception, Coordinator, Presentation User, Patient | Only separately approved role/purpose projections                          | No general clinical history or private-note projection                                                                                             |
| Platform roles                                     | Operational platform metadata only                                         | No patient or clinical access                                                                                                                      |
| Platform Support Engineer                          | Operational support metadata only during pilot                             | No patient or clinical access; no impersonation, tenant switching, break-glass, or support grant                                                   |

All projections remain subject to tenant, purpose, role, permission, record state, masking, session,
lock, revocation, and authorization-version checks.

## Doctor-private-note policy

Doctor-private notes are a distinct sensitive data class and projection. Access is limited to:

- the note author;
- the currently assigned verified Doctor where continuity rules permit; and
- an explicitly granted Read-Only Clinical Reviewer.

A newly assigned verified Doctor may access active prior private notes only for a recorded
continuity-of-care purpose. The access requires a sensitive-read audit.

Clinical Assistant, Clinic Owner/Administrator, Reception, Patient, Report Coordinator,
Presentation User, platform roles, and Support are denied by default. Private-note narrative must
not appear in routine patient reports, presentations, notifications, search, analytics, generic
exports, or audit metadata.

Patient-access and export treatment for private notes remains blocked pending qualified counsel.
Corrections create immutable versions. Retraction preserves the original, provenance, and audit
evidence while hiding the retracted version from ordinary active use.

## Read-Only Clinical Reviewer policy

Reviewer access must be consultation-specific, purpose-specific, explicitly approved, read-only,
minimum necessary, revocable, and time-bounded.

Required approvals:

1. current assigned verified Doctor; and
2. approved clinic clinical-governance authority.

A Clinic Administrator acting alone cannot grant reviewer access. Default duration is 72 hours.
The absolute maximum without reapproval is seven days.

Audit grant creation, approval, first access, private-note access, revocation, expiry, and denied
post-expiry use. Cross-clinic reviewer grants are prohibited.

## Patient-safe disclosure matrix

Patient-facing disclosure is created from explicit allowlists, never by filtering an internal
record.

| Required disclosure attribute | Rule                                                                     |
| ----------------------------- | ------------------------------------------------------------------------ |
| Purpose                       | One approved patient-facing purpose                                      |
| Source                        | Exact immutable source version                                           |
| Approval                      | Current approval state and approving authority                           |
| Classification                | Explicit patient-safe disclosure class                                   |
| Lifecycle                     | Creation time plus expiry, revocation, and supersession where applicable |

Always exclude Doctor-private notes, unresolved internal warnings, audit events, internal
provenance, reviewer comments, unapproved AI/device output, internal suitability discussions, and
hidden identifiers.

## Correction, retraction, and versioning

- Corrections create immutable new versions.
- Clinical evidence is never silently replaced.
- Retraction is distinct from correction, archive, and permanent deletion.
- Retraction removes a record from ordinary active use while retaining provenance and audit
  evidence.
- Material correction records downstream impact and requires re-review where applicable.
- A consultation continues to reference the exact history version used for its assessment.

## Retention decision schedule

Retention must use an effective-dated policy model scoped by jurisdiction, clinic, resource class,
patient category, trigger, and legal-hold state.

| Resource class            | Trigger and duration status   | Production treatment |
| ------------------------- | ----------------------------- | -------------------- |
| Identity/contact          | `RETENTION_PERIOD_UNAPPROVED` | Block production     |
| Consultations             | `RETENTION_PERIOD_UNAPPROVED` | Block production     |
| Medical/hair-loss history | `RETENTION_PERIOD_UNAPPROVED` | Block production     |
| Doctor-private notes      | `RETENTION_PERIOD_UNAPPROVED` | Block production     |
| Privacy acknowledgements  | `RETENTION_PERIOD_UNAPPROVED` | Block production     |
| Reviewer grants/events    | `RETENTION_PERIOD_UNAPPROVED` | Block production     |
| Audit evidence            | `RETENTION_PERIOD_UNAPPROVED` | Block production     |
| Export packages/manifests | `RETENTION_PERIOD_UNAPPROVED` | Block production     |
| Temporary files           | `RETENTION_PERIOD_UNAPPROVED` | Block production     |
| Future media/depth        | `RETENTION_PERIOD_UNAPPROVED` | Block production     |
| Future models/derivatives | `RETENTION_PERIOD_UNAPPROVED` | Block production     |
| Backups/tombstones        | `RETENTION_PERIOD_UNAPPROVED` | Block production     |

No Pakistan clinical-retention period may be assumed or hard-coded.

## Deletion and legal-hold rules

Permanent clinical deletion is not approved for DOC-010 or CONSULT-003. Normal clinic users must
not receive a direct permanent-delete action for clinical history.

A future permanent-deletion operation requires verified requester, authority check, complete data
inventory, legal and clinical exception review, hold check, downstream impact manifest,
independent approval, execution evidence, and backup reconciliation.

Legal holds override ordinary deletion. A hold requires authorised actor, controlled reason, owner,
effective date, review date, and controlled release. Archive, correction, retraction, legal hold,
and permanent deletion remain distinct states and operations.

## Export rules

No export workflow is approved in DOC-010. Future exports must distinguish patient-request,
clinic-record, and legal/audit exports.

Routine export excludes private notes unless specifically approved, platform-security data,
unrestricted audit logs, tokens, internal access metadata, and other-clinic information.

Every future export requires an immutable manifest, exact source versions, checksum, encryption,
expiry, retrieval audit, revocation, and omission record. Raw clinical exports must not be delivered
as ordinary email attachments.

## Tenant and minimum-disclosure rules

Prohibited:

- global patient search or identity;
- cross-clinic matching, counts, caches, exports, reviewer grants, storage reuse, or events;
- platform clinical projections; and
- authority inferred from platform scope or a null clinic context.

A patient appearing at two clinics remains independently represented unless a later approved
interoperability task changes the model. Every sensitive operation derives clinic and actor context
from trusted server/session state and enforces forced RLS and same-clinic relationships.

## Processor and residency register

The production region is `PRODUCTION_REGION_UNAPPROVED`. The current Mumbai candidate is not
approved by default. No real-patient data may enter an unapproved production region.

| Provider | Legal entity | Purpose | Data categories | Primary region | Backup region | Support locations | Subprocessors | Encryption | Retention | Deletion | Incident terms | Contract status | Exit process |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| To be approved | Unapproved | Unapproved | Unapproved | `PRODUCTION_REGION_UNAPPROVED` | Unapproved | Unapproved | Unapproved | Evidence required | Unapproved | Evidence required | Unapproved | Unapproved | Required |

A new clinical-data subprocessor requires security, privacy, contractual, region, deletion, and
incident review before use.

## Security baseline

The required baseline is:

- forced RLS and immutable tenant relationships;
- trusted server context and deny-by-default projections;
- private storage and opaque tenant-scoped references;
- encryption in transit, at rest, and for protected backups;
- current session validation, locking, expiry, rotation, and revocation;
- authorization-version enforcement;
- current same-clinic Doctor verification for Doctor authority;
- least-privilege service identities and secret isolation;
- append-only, redacted audit evidence;
- tested restore and deletion/revocation reconciliation;
- periodic access reviews;
- approved vendor and processor register; and
- vulnerability management and incident readiness.

Missing, stale, expired, revoked, locked, inactive, cross-clinic, or unauthorised context fails
closed.

## Incident responsibility matrix

| Responsibility   | Required named owner            | Duties                                                         |
| ---------------- | ------------------------------- | -------------------------------------------------------------- |
| Incident command | Incident commander              | Severity, coordination, decisions, closure                     |
| Security         | Security lead                   | Detection, containment, revocation, evidence                   |
| Clinic response  | Clinic contact                  | Patient-care impact and clinic coordination                    |
| Legal/privacy    | Qualified legal/privacy contact | Notification and legal-duty assessment                         |
| Engineering      | Engineering owner               | Technical containment, recovery, reconciliation                |
| Providers        | Processor contacts              | Provider containment, evidence, and contractual notices        |
| Communications   | Communication authority         | Approved clinic, patient, regulator, and public communications |

Required response sequence:

`detection → containment → revocation → tenant-impact assessment → evidence preservation → processor coordination → legal-notification assessment → recovery → backup/deletion reconciliation → post-incident review`

No notification deadline may be hard-coded until qualified counsel confirms the applicable duty.

## Synthetic privacy-case catalogue

The required synthetic review set is:

1. Clinical Assistant attempts a Doctor-only action.
2. Clinic Owner attempts private-note access.
3. Reviewer grant expires or is revoked.
4. Platform or Support actor attempts clinical access.
5. Clinic A attempts to discover or access Clinic B data.
6. Representative authority is missing or expired.
7. Privacy acknowledgement is withdrawn.
8. Notice version is superseded.
9. Patient requests correction, access, export, or deletion.
10. Legal hold blocks deletion.
11. Retraction preserves history.
12. Export records an omission and excludes prohibited data.
13. Backup restore encounters deleted or revoked state.
14. Subprocessor changes.
15. Cross-border incident occurs.
16. Combined Admin/Doctor uses the wrong authority context.
17. Newly assigned Doctor requests prior private-note access.

The catalogue is approved for synthetic governance review. Execution evidence and required manual
sign-offs remain pending. Only synthetic data may be used.

## Explicit production blockers

| Blocker                 | Required resolution                                       |
| ----------------------- | --------------------------------------------------------- |
| `BLOCKER-LEGAL-001`     | Qualified confirmation of controller/processor allocation |
| `BLOCKER-LEGAL-002`     | Approved lawful basis for health-data purposes            |
| `BLOCKER-LEGAL-003`     | Electronic acknowledgement validity and evidence          |
| `BLOCKER-LEGAL-004`     | Private-note patient disclosure/access/export treatment   |
| `BLOCKER-LEGAL-005`     | Effective-dated retention periods and triggers            |
| `BLOCKER-LEGAL-006`     | Erasure exceptions, deletion approvals, and legal holds   |
| `BLOCKER-LEGAL-007`     | Cross-border transfer requirements and mechanism          |
| `BLOCKER-LEGAL-008`     | Breach duties, recipients, and deadlines                  |
| `BLOCKER-LEGAL-009`     | Capacity, minors, guardians, and representatives          |
| `BLOCKER-REGION-001`    | Approved production and backup regions                    |
| `BLOCKER-PROCESSOR-001` | Completed processor/subprocessor and residency register   |
| `BLOCKER-NOTICE-001`    | Approved English/Urdu notices and equivalence             |
| `BLOCKER-SECURITY-001`  | Security architecture and operational review              |
| `BLOCKER-CLINICAL-001`  | Licensed hair-restoration physician review                |

## Required manual approvals

- Haris Liaqat: product and data-governance boundary.
- Qualified Pakistan privacy/legal counsel: all legal blockers.
- Qualified counsel for every later operating jurisdiction.
- Licensed hair-restoration physician: DOC-009 clinical catalogue and synthetic cases.
- Security reviewer: security baseline, hosting, providers, incident response, and residual risk.
- Privacy reviewer: purpose limitation, projections, disclosures, retention, and processors.
- FACE Aesthetic Clinic Lahore: proposed controller responsibilities and workflow practicality.
- Engineering owner: implementability without weakening tenant, session, RBAC, or audit controls.

## Dependency and implementation boundary

DOC-010 is dependency-complete only as a product decision record with explicit blockers. It removes
the governance-definition dependency for synthetic CONSULT-003 implementation but does not
authorise real-patient use.

This record does not implement CONSULT-003, migrations, roles, permissions, consent or
representative UI, export, deletion, Support access, scanning, QR pairing, realtime, camera, media,
LiDAR, 3D, AI, planning, graft estimation, or Doctor approval.

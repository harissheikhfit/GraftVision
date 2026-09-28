# GraftVision Product Requirements Document

## 1. Document Information

| Field | Value |
|---|---|
| Product | GraftVision |
| Document | Product Requirements Document |
| Version | 1.0 Draft |
| Status | Proposed for product-owner and clinical review |
| Date | 25 July 2026 |
| Product owner | Haris Liaqat |
| Clinical approver | Dr Sheraz |
| Initial clinical validation clinic | FACE Aesthetic Clinic Lahore |
| Initial launch market | Pakistan |
| Intended audience | Product, clinical, design, security, engineering, quality assurance, onboarding, and support teams |
| Next deliverable | System architecture, only after this PRD is approved |

This PRD defines product behaviour and acceptance boundaries. It does not select an implementation architecture, database, API design, framework, vendor, or model.

### Requirement notation

- **Must Have** — required for MVP release.
- **Should Have** — important for MVP when feasible; deferral requires product-owner approval.
- **Could Have** — desirable but not release-blocking.
- **Will Not Have Yet** — explicitly deferred to post-MVP.
- **MVP** — required or eligible for the first production release.
- **Post-MVP** — planned only after the core platform is validated.

## 2. Product Summary

GraftVision is a multi-tenant SaaS platform for hair-transplant and hair-restoration clinics. It digitises and preserves the longitudinal patient journey from initial consultation, through surgery-day planning and procedure documentation, to follow-up and long-term comparison.

The product consists of one shared platform with a private workspace for each clinic. Clinic-owned patients, users, images, scans, reports, clinical notes, and settings must remain isolated from every other clinic. The platform owner owns the software; each clinic owns its clinic and patient data.

GraftVision combines a clinic web workspace, a mobile-first capture application, and a patient-safe presentation application. It supports standardised photography, phone-to-laptop synchronisation, recipient-area marking and measurement, hairline and graft planning, procedure records, follow-ups, versioned reports, and auditability.

AI is assistive. It may propose classifications, regions, quality warnings, measurements, graft ranges, density options, hairline starting points, or comparisons, but the doctor must be able to accept, edit, or reject every suggestion. A final clinical plan is never valid until doctor-approved.

## 3. Vision

GraftVision will give clinics a consistent, secure, and clinically responsible record of every hair-restoration journey. It should replace fragmented photographs, spreadsheets, handwritten planning, disconnected messages, and static reports with a traceable workflow that is easier for staff to complete and safer for patients to view.

The product should help doctors make and communicate decisions without presenting illustrative simulations or AI-assisted suggestions as diagnoses, guarantees, or substitutes for clinical judgement.

## 4. Problem Statement

Hair-restoration consultations and surgical records are often distributed across phones, local folders, messaging applications, paper forms, and individual staff knowledge. Capture conditions vary, measurements and graft allocations may not be traceable to a final approval, and follow-up images may be difficult to compare.

Clinics need:

- a standard, repeatable capture and documentation workflow;
- a complete longitudinal patient record;
- secure separation between clinics and between clinical and patient-safe information;
- explicit doctor approval of plans and reports;
- traceability from preliminary consultation to final procedure;
- consistent follow-up and comparison tools; and
- a presentation experience that cannot expose private notes or unrelated patient information.

## 5. Product Principles

1. **Doctor-approved care:** AI-assisted and calculated outputs remain proposals until a doctor approves them.
2. **Patient safety over automation:** The product must communicate uncertainty and avoid guaranteed outcomes or autonomous diagnosis.
3. **Tenant isolation by default:** Every clinic-owned record is scoped to exactly one clinic.
4. **Longitudinal truth:** Source captures, edits, approvals, procedures, follow-ups, and report versions remain traceable.
5. **Structured capture:** Consistency of photographs and context is as important as image quantity.
6. **Patient-safe disclosure:** Presentation sessions and shared reports contain only explicitly approved content.
7. **Progressive capability:** MVP succeeds with manual and doctor-assisted tools; advanced AI and 3D are enhancements, not dependencies.
8. **Least privilege:** Users see and change only what their role and clinic policy require.
9. **Clinic data ownership:** Clinics can export their data subject to policy, law, and identity verification.
10. **Honest communication:** Illustrative simulations, graft ranges, and AI-assisted suggestions must be labelled and never framed as guaranteed results.

## 6. Business Model

### Initial commercial model

- Manually sold multi-tenant SaaS during the initial launch stage in Pakistan.
- Guided trial or paid pilot.
- Founding clinic onboarding: PKR 30,000.
- Founding clinic monthly subscription: PKR 30,000.
- Manually administered plans, feature entitlements, and usage limits.
- Public self-service signup is not required.

The founding clinic offer is a pilot-stage commercial decision for the initial launch. It is not permanent global pricing and does not require future plans, clinics, or markets to use the same fees.

### Commercial boundaries

The clinical MVP does not include patient billing, clinic financial records, payment collection, invoices, claims, or accounting. Platform-level subscription administration and automatic recurring billing may be introduced later, but must remain separate from clinical records.

## 7. Target Market

### Initial target

- Independent hair-transplant and hair-restoration clinics.
- Clinics with one operational location.
- Clinics performing consultation, procedure, and follow-up workflows.
- Clinics willing to participate in guided onboarding and a pilot.
- Doctors who want standardised visual documentation and traceable planning.

### Future target

- Multi-branch clinic groups.
- White-label partners.
- Clinics offering PRP, beard transplant, eyebrow transplant, and other scalp treatments.
- Clinics requiring deeper imaging, trichoscopy, device-depth data, or advanced analytics.

## 8. User Personas

| Persona | Primary need | Typical context | Key constraint |
|---|---|---|---|
| Platform Owner | Govern product, commercial strategy, and privileged platform decisions | Platform governance | No routine clinical-data access or automatic Doctor authority |
| Platform Administrator | Onboard/manage clinics, plans, status, limits, usage, and platform configuration | Cross-tenant operational administration | Operational metadata by default; no automatic patient clinical access |
| Platform Support Engineer | Diagnose platform and clinic support issues | Metadata-first support; temporary approved clinical scope when necessary | No default clinical access; grants must expire and be audited |
| Clinic Owner | Control the clinic workspace, policy, staff, branding, and data requests | Clinic administration | Clinic ownership does not grant Doctor approval authority |
| Clinic Administrator | Manage clinic users, operational settings, branding, and authorised configuration | Clinic operations | Cannot approve final clinical plans unless separately assigned Doctor |
| Doctor / Hair-Transplant Surgeon | Review history, plan treatment, approve clinical outputs, and document care | Consultation, surgery, procedure, and follow-up | Final clinical responsibility comes only from the Doctor role |
| Clinical Assistant | Prepare patients, capture images, assist scans, and draft authorised records | Phone and clinic workstation | Cannot finalise clinical decisions |
| Procedure Technician | Record authorised procedure details, graft counts, allocation, and images | Procedure workstation | Cannot independently change or approve the final surgical plan |
| Reception User | Register/locate patients, manage basic details/status, and share approved reports | Front desk workstation | No doctor-only notes or graft-plan editing |
| Report Coordinator | Prepare, version, download, and share doctor-approved patient-safe reports | Report workflow | Cannot approve or alter clinical decisions |
| Presentation User | Navigate one temporary approved patient-safe session | Shared LED/display | No patient search, lists, downloads, private data, or dashboard access |
| Read-Only Clinical Reviewer | Inspect explicitly authorised clinical records | Assigned review context | No editing, approval, sharing, export, or alteration without another role |
| Patient | Receive explicitly approved reports, links, or documents | In-clinic display or shared output | No internal clinic dashboard in MVP |

## 9. Roles and Responsibilities

| Role | Responsibilities | Prohibited or restricted actions |
|---|---|---|
| Platform Owner | Own/govern GraftVision; control strategic, commercial, and privileged platform decisions | Routine patient-record access; clinical approval without Doctor role |
| Platform Administrator | Create/manage clinics, plans, usage limits, status, entitlements, and platform settings | Default patient clinical access; Doctor approval |
| Platform Support Engineer | Diagnose operational issues and use approved temporary support access | Standing clinical access; self-approved, unscoped, unlogged, or non-expiring access |
| Clinic Owner | Control clinic workspace, staff, policy, branding, and authorised clinic operations | Cross-clinic access; Doctor approval without separate Doctor role |
| Clinic Administrator | Manage clinic users, branding, operational settings, and authorised configuration | Platform administration; final clinical approval without Doctor role |
| Doctor / Hair-Transplant Surgeon | Assess, review media/models, plan regions/density/grafts/hairline, approve final plans/reports, add private notes | Approving outside authorised clinic/patient scope or without required data |
| Clinical Assistant | Register/prepare patients, capture/upload media, assist scans, and create authorised drafts | Final clinical-plan, hairline, graft-allocation, or report approval |
| Procedure Technician | Record authorised procedure details, follicular-unit counts, implanted allocation, deviations, and images | Independently changing the final surgical plan or resolving clinical differences without Doctor review |
| Reception User | Register/search patients, manage permitted identity/contact/status, and share already approved reports | Doctor-only notes; region, measurement, density, hairline, or graft-plan changes |
| Report Coordinator | Prepare/version patient-safe report drafts and download/share approved versions | Changing clinical source decisions or approving clinical reports |
| Presentation User | Navigate one approved temporary patient-safe presentation | Patient search/list, downloads, export, editing, contacts, internal notes, staff comments, or settings |
| Read-Only Clinical Reviewer | Review explicitly authorised clinical cases without editing | Creation, editing, approval, sharing, export, or deletion unless separately granted by another role |
| Patient | View or receive explicitly approved patient-safe content | Internal clinic dashboard or unapproved clinical/internal content |

## 10. Product Scope

### In scope

- Manually onboarded, isolated clinic workspaces.
- Authentication, sessions, and role-based access control.
- Patient records and longitudinal history.
- Consultation, surgery-day, procedure, and follow-up records.
- Mobile-first guided photography and scan-session capture.
- Phone-to-laptop pairing and synchronisation status.
- Standardised photograph checklists and capture metadata.
- Uploaded or externally generated 3D model management.
- Manual or doctor-assisted region marking and area measurement.
- Density input, graft calculation, allocation, hairline design, and doctor approval.
- AI-assisted suggestions with human review.
- Internal and patient-safe, versioned, watermarked PDF reports.
- Patient-safe presentation mode.
- Clinic branding, statuses, audit logging, retention, export, platform administration, and manual entitlements.

### Product surfaces

| Application | Scope |
|---|---|
| `apps/web` | Public marketing pages, clinic dashboard, platform administration, patient records, consultation planning, procedure records, reports, follow-ups, and clinic settings |
| `apps/scan` | Mobile-first PWA for pairing, guided photography, camera capture, scan progress, upload status, quality warnings, and completion |
| `apps/present` | Full-screen, temporary, patient-safe display of doctor-approved content |

## 11. MVP Scope

The MVP must provide a safe end-to-end clinic workflow without depending on advanced automation.

### Must Have

- Multi-tenant clinic accounts and strict clinic isolation.
- Manually onboarded clinic workspaces and staff.
- Authentication, session expiry, inactivity lock, and role permissions.
- Patient registration, clinical history, consent/acknowledgement, and assigned doctor.
- Standardised phone photography and phone-to-laptop synchronisation.
- Consultation, surgery-day, procedure, follow-up, and longitudinal records.
- Manual or doctor-assisted region marking and area calculation.
- Doctor-selected zone density, calculated graft requirement, and doctor-adjusted allocation.
- Hairline planning and mandatory doctor approval.
- Internal clinical notes and doctor-only notes.
- Patient-safe presentation sessions.
- Watermarked, versioned PDF reports.
- Procedure graft counts and immediate post-procedure images.
- Standardised follow-up records and image comparison.
- Audit logs for sensitive actions.

### Should Have

- Basic image-quality guidance.
- Uploaded or externally generated 3D models.
- Configurable follow-up checkpoints.
- QR or session-code pairing.
- Report verification reference.
- Clinic-managed report templates and branding.

### Could Have

- Basic non-diagnostic rules-based suggestions.
- Overlay alignment assistance for compatible images.
- Configurable clinic usage limits without automated billing.

## 12. Post-MVP Scope

- AI region segmentation and Norwood/Ludwig suggestions.
- Automated image-quality detection.
- Automatic 3D reconstruction.
- Device depth and calibration-based physical scaling.
- Donor-density heatmaps and trichoscopy integration.
- Result-progression scoring.
- Multi-branch clinic management.
- White-label plans.
- Automatic subscription billing.
- Patient portal.
- Native iOS and Android applications.
- Advanced operational and clinical analytics.
- Modules for PRP, beard transplant, eyebrow transplant, and scalp treatments.

Post-MVP functionality must pass the same clinical, privacy, security, and doctor-approval gates as MVP.

## 13. Explicit Non-Goals

The first production version will not provide or claim:

- guaranteed medical accuracy, graft survival, or transplant results;
- autonomous diagnosis or autonomous surgical planning;
- exact donor capacity from ordinary phone images;
- exact follicle counts without suitable imaging;
- perfect or mandatory 3D reconstruction;
- LiDAR-only or other specialised-hardware-only workflows;
- a patient portal or patient access to the clinic dashboard;
- native mobile applications;
- automated WhatsApp Business API messaging;
- patient billing or clinic financial records;
- multi-branch management;
- public self-service clinic signup;
- automatic platform subscription billing; or
- replacement of clinical judgement, consent, or clinic policy.

## 14. Complete Patient Lifecycle

### A. Patient registration

An authorised clinic user creates a clinic-scoped patient with a unique patient ID, personal and contact details, assigned doctor, consultation date, main concern, relevant medical and hair-loss history, and consent/privacy acknowledgement.

### B. Initial consultation with hair present

Staff complete a standard photograph checklist and record capture conditions including dry/wet hair, length, styling, lighting, camera, and device. The doctor records a preliminary assessment, reviews any available preliminary 3D model, marks recipient regions, proposes a hairline, gives a preliminary graft range, adds notes, and approves the consultation report.

### C. Surgery-day shaved assessment

A new scan session is linked to the original consultation. Shaved-scalp images improve visibility. The doctor finalises regions, records frontal, mid-scalp, crown, temple, and total recipient area in cm² where relevant, selects density by zone, reviews the calculated graft requirement, adjusts allocation, finalises the hairline, and approves the final surgical plan. Patient acknowledgement is recorded when clinic policy requires it.

### D. Procedure record

The clinic records date, surgeon, team, technique, extraction times, extracted graft count, follicular-unit breakdown, damaged/discarded grafts, usable total, implanted grafts by zone, changes from plan, procedure notes, and immediate post-procedure images.

### E. Follow-up lifecycle

The clinic schedules configurable checkpoints such as Day 1, Day 7, Day 10–14, and Months 1, 3, 6, 9, 12, and 18. Each record may include standardised photographs, alignment guidance, donor and recipient healing, visible coverage, hairline and crown progression, doctor assessment, patient satisfaction, and next recommendation.

### F. Long-term comparison

Authorised users can compare consultation, surgery-day, immediate post-operative, and follow-up records using side-by-side, overlay, timeline, and compatible 3D comparisons. The patient record retains the complete longitudinal history.

## 15. Detailed Functional Requirements

All detailed requirements in Sections 16–37 are part of this PRD. The following cross-cutting modules establish access and approval behaviour.

### Authentication

| ID | Requirement | Priority | Delivery | Primary user | Acceptance criteria |
|---|---|---|---|---|---|
| AUTH-001 | Each staff user must authenticate with a unique account before accessing a clinic workspace. | Must Have | MVP | All staff | Unauthenticated requests cannot access protected pages or data; shared staff accounts are not required or encouraged. |
| AUTH-002 | The system must issue revocable sessions with configurable expiry and automatic inactivity lock. | Must Have | MVP | Clinic Owner | Expired, revoked, or inactive sessions require re-authentication and cannot continue protected actions. |
| AUTH-003 | Account recovery must verify the user without revealing whether unrelated clinic accounts exist. | Must Have | MVP | All staff | Recovery responses prevent cross-tenant account discovery and recovery events are logged. |
| AUTH-004 | Clinic Owners and authorised Clinic Administrators must be able to disable clinic users and revoke active sessions. | Must Have | MVP | Clinic Owner / Clinic Administrator | Disabled users lose access promptly and existing sessions no longer authorise requests. |
| AUTH-005 | Stronger authentication controls, including MFA policy, should be configurable before broad production rollout. | Should Have | MVP | Platform Owner / Platform Administrator | Approved MFA policy is documented and supported for privileged roles or explicitly deferred with recorded risk acceptance. |

### Role-based access control

| ID | Requirement | Priority | Delivery | Primary user | Acceptance criteria |
|---|---|---|---|---|---|
| RBAC-001 | Every protected action must be authorised against clinic, user, role, explicit permission, record state, and approval requirements; frontend visibility is not authority. | Must Have | MVP | Platform Owner | A user with the wrong clinic, role, permission, record state, or approval context is denied even when directly attempting a hidden or protected action. |
| RBAC-002 | The system must provide the thirteen-role model: Platform Owner, Platform Administrator, Platform Support Engineer, Clinic Owner, Clinic Administrator, Doctor / Hair-Transplant Surgeon, Clinical Assistant, Procedure Technician, Reception User, Report Coordinator, Presentation User, Read-Only Clinical Reviewer, and Patient. | Must Have | MVP | Clinic Owner | All thirteen roles can be assigned only within their permitted scope, and effective permissions match the approved detailed matrix. |
| RBAC-003 | Private doctor notes must be inaccessible to Reception User, Report Coordinator, Presentation User, Patient, and other roles without an explicit authorised clinical grant. | Must Have | MVP | Doctor | Attempts through interface, direct protected action, export, report, support, or presentation do not reveal doctor-only content. |
| RBAC-004 | Only a user holding an active authorised Doctor role may approve a final clinical plan, final hairline, final graft allocation, material clinical amendment, or patient-safe clinical report. | Must Have | MVP | Doctor | Non-doctor users cannot produce valid clinical approval; approval records identify Doctor, clinic, patient, version, and time. |
| RBAC-005 | Permissions should support clinic-policy refinement without allowing clinics to grant cross-tenant or platform-owner powers. | Should Have | MVP | Clinic Owner | Configurable permissions remain within immutable tenant and platform security boundaries. |
| RBAC-006 | A user may hold more than one authorised role where clinic policy permits, but combined roles must not bypass tenant isolation, separation of duties, or Doctor-only approval. | Must Have | MVP | Clinic Owner / Clinic Administrator | Each role assignment is independently authorised and audited; removing a role immediately removes the authority derived from it. |
| RBAC-007 | Platform roles must receive operational metadata by default, not patient clinical access; Platform Support Engineer clinical access must be explicit, scoped, clinic-approved, temporary, revocable, and audited. | Must Have | MVP | Platform Owner / Platform Administrator | Platform users cannot view clinical content without a valid grant, and support access expires or revokes without weakening tenant isolation. |

### Doctor approval workflow

| ID | Requirement | Priority | Delivery | Primary user | Acceptance criteria |
|---|---|---|---|---|---|
| APPROVAL-001 | Preliminary, AI-assisted, calculated, and staff-entered planning outputs must remain unapproved until a doctor approves them. | Must Have | MVP | Doctor | Draft outputs are visibly labelled and cannot be represented as a final surgical plan. |
| APPROVAL-002 | The doctor must be able to accept, edit, or reject suggestions and manually correct regions, density, hairline, and allocation. | Must Have | MVP | Doctor | Each supported suggestion has review controls and saved doctor edits take precedence. |
| APPROVAL-003 | Material edits after approval must invalidate or supersede the approval and require re-approval. | Must Have | MVP | Doctor | The system prevents an edited plan from retaining a misleading approved state. |
| APPROVAL-004 | Approval must record approver, time, version, and patient acknowledgement status where required. | Must Have | MVP | Doctor | The final plan displays a traceable approval record linked to an immutable version. |

## 16. Multi-Tenant Requirements

| ID | Requirement | Priority | Delivery | Primary user | Acceptance criteria |
|---|---|---|---|---|---|
| TENANT-001 | Each clinic must have a private workspace with a stable clinic identifier. | Must Have | MVP | Platform Owner | Clinic records resolve to one clinic and cannot exist without valid clinic ownership. |
| TENANT-002 | Every clinic-owned patient, user, image, scan, model, report, setting, and clinical record must include clinic scope. | Must Have | MVP | Platform Owner | Automated tests reject missing scope and demonstrate that clinic A cannot read or mutate clinic B data. |
| TENANT-003 | Tenant isolation must be enforced at database-access and application-authorisation layers. | Must Have | MVP | Platform Owner | Bypassing interface filters still cannot return another clinic’s records. |
| TENANT-004 | Clinics must be onboarded, activated, suspended, and closed manually by authorised platform staff. | Must Have | MVP | Platform Owner | State changes are permission-controlled, audited, and reflected in clinic access. |
| TENANT-005 | A clinic suspension must preserve records while preventing normal clinic access according to an approved support policy. | Must Have | MVP | Platform Owner | Suspended users cannot enter the workspace; data is not silently deleted. |
| TENANT-006 | Tenant-aware backups, exports, and restoration processes must prevent cross-clinic disclosure. | Must Have | MVP | Platform Owner | Restore/export tests retain correct clinic ownership and do not combine unrelated clinic data. |
| TENANT-007 | Multi-branch hierarchies are deferred. | Will Not Have Yet | Post-MVP | Clinic Owner | MVP supports one clinic workspace without branch-level inheritance or reporting. |

## 17. Patient Record Requirements

| ID | Requirement | Priority | Delivery | Primary user | Acceptance criteria |
|---|---|---|---|---|---|
| PAT-001 | The system must create a clinic-unique patient ID and retain immutable clinic ownership. | Must Have | MVP | Reception User | Duplicate clinic patient IDs are rejected and ownership cannot be moved without an audited administrative process. |
| PAT-002 | The record must store basic personal/contact details, assigned doctor, main concern, relevant medical and hair-loss history, and consent/privacy acknowledgement. | Must Have | MVP | Clinical Assistant | Required fields and consent status are visible, validated, and saved with author and time. |
| PAT-003 | Authorised users must search patients within their clinic by permitted identifiers. | Must Have | MVP | Reception User | Results contain only the active clinic’s patients and respect field-level permissions. |
| PAT-004 | The patient page must present a chronological history of consultations, scans, plans, procedure, reports, and follow-ups. | Must Have | MVP | Doctor | Linked records appear in date order and open only when the user has permission. |
| PAT-005 | Potential duplicate patients must be warned about without exposing another clinic’s records. | Should Have | MVP | Reception User | Duplicate checks operate only within the clinic and allow authorised resolution. |
| PAT-006 | Corrections to identity or clinical data must be attributable and must not erase required history. | Must Have | MVP | Clinic Owner | Sensitive edits retain actor, time, previous value or revision reference, and reason where required. |
| PAT-007 | Patient portal access is deferred. | Will Not Have Yet | Post-MVP | Patient | No MVP route grants patients access to the clinic dashboard. |

## 18. Consultation Requirements

| ID | Requirement | Priority | Delivery | Primary user | Acceptance criteria |
|---|---|---|---|---|---|
| CONS-001 | Authorised staff must create a consultation linked to one patient, clinic, assigned doctor, and consultation date. | Must Have | MVP | Reception User | A consultation cannot be saved with inconsistent clinic ownership or an invalid patient. |
| CONS-002 | Consultations must have explicit draft, ready-for-review, approved, and superseded/cancelled statuses. | Must Have | MVP | Doctor | Allowed transitions are enforced and displayed with actor and time. |
| CONS-003 | The initial consultation must capture standard photos, capture conditions, history, preliminary assessment, recipient regions, proposed hairline, preliminary graft range, and notes. | Must Have | MVP | Doctor | Completeness checks identify missing required elements before approval. |
| CONS-004 | A surgery-day assessment must link to the originating patient and consultation without overwriting the initial record. | Must Have | MVP | Doctor | Both assessments remain independently viewable and traceable. |
| CONS-005 | The system must distinguish preliminary consultation outputs from the doctor-approved final surgical plan. | Must Have | MVP | Patient | All views and reports use the correct label and version state. |
| CONS-006 | Doctors must be able to add private clinical notes that are excluded from patient-safe contexts. | Must Have | MVP | Doctor | Private notes never appear in approved patient reports or presentation payloads. |
| CONS-007 | The system should warn when required consent, capture, measurement, or approval information is incomplete. | Should Have | MVP | Clinical Assistant | Warnings identify missing items without silently blocking permitted draft work. |

## 19. Mobile Capture Requirements

### Mobile scan application

| ID | Requirement | Priority | Delivery | Primary user | Acceptance criteria |
|---|---|---|---|---|---|
| SCAN-001 | `apps/scan` must be a mobile-first web experience usable without a native application install. | Must Have | MVP | Clinical Assistant | A supported phone browser can open and complete the guided capture flow. |
| SCAN-002 | A capture session must link to exactly one clinic, patient, consultation/follow-up context, and initiating user. | Must Have | MVP | Clinical Assistant | Invalid, expired, or mismatched session context cannot upload to a patient record. |
| SCAN-003 | The app must guide users through a configurable required-view checklist with progress. | Must Have | MVP | Clinical Assistant | Users can identify completed, missing, retake-required, and optional views. |
| SCAN-004 | The capture flow must show framing, orientation, lighting, focus, and distance guidance. | Must Have | MVP | Clinical Assistant | Guidance is available before capture and quality warnings are visible before completion. |
| SCAN-005 | Users must be able to review, retake, or remove a capture before session completion. | Must Have | MVP | Clinical Assistant | Only retained captures are attached to the completed session. |
| SCAN-006 | Upload status, retry state, and completion state must be visible. | Must Have | MVP | Clinical Assistant | Interrupted uploads can be identified and retried without creating misleading completion. |
| SCAN-007 | Basic quality guidance may be manual or rules-based and must not claim diagnostic accuracy. | Should Have | MVP | Clinical Assistant | Warnings are labelled as capture guidance and do not block authorised clinical review. |
| SCAN-008 | Native iOS/Android and LiDAR-only capture are deferred. | Will Not Have Yet | Post-MVP | Clinical Assistant | MVP remains functional in supported mobile browsers without specialised hardware. |

### Phone-to-laptop pairing

| ID | Requirement | Priority | Delivery | Primary user | Acceptance criteria |
|---|---|---|---|---|---|
| SYNC-001 | The web workspace must create a short-lived QR code or session code for pairing. | Must Have | MVP | Clinical Assistant | The code links only to the intended clinic-scoped capture session and expires automatically. |
| SYNC-002 | Pairing must not require patient information to be typed on the phone. | Must Have | MVP | Patient | Opening the code reveals only the minimum capture context needed to complete the session. |
| SYNC-003 | Capture progress and upload status must synchronise to the initiating workstation. | Must Have | MVP | Doctor | The workstation reflects received, missing, failed, and completed items without manual refresh where practical. |
| SYNC-004 | Closing, expiring, or revoking a session must prevent additional uploads. | Must Have | MVP | Clinical Assistant | Reuse after closure is rejected and recorded. |
| SYNC-005 | Interrupted sessions must support safe retry without duplicating accepted files. | Must Have | MVP | Clinical Assistant | Retried uploads are idempotent or clearly de-duplicated. |

### Standardised photography

| ID | Requirement | Priority | Delivery | Primary user | Acceptance criteria |
|---|---|---|---|---|---|
| PHOTO-001 | Clinic-configurable templates must define required consultation, surgery-day, post-op, and follow-up views. | Must Have | MVP | Clinic Owner | The appropriate checklist is loaded for each session type. |
| PHOTO-002 | Each photograph must retain capture type, time, device metadata when available, operator, and patient/session link. | Must Have | MVP | Doctor | Metadata is viewable to authorised users and remains clinic-scoped. |
| PHOTO-003 | Capture conditions must include dry/wet state, hair length, styling, lighting, camera/device, and relevant notes. | Must Have | MVP | Clinical Assistant | Required conditions can be completed and are displayed with the image set. |
| PHOTO-004 | The system should guide follow-up users to reproduce previous framing and conditions. | Should Have | MVP | Clinical Assistant | Previous reference and alignment guidance are available without altering the source image. |
| PHOTO-005 | Source images must be preserved separately from derived, annotated, cropped, or presentation-safe variants. | Must Have | MVP | Doctor | Derived assets identify their source and do not overwrite it. |

## 20. 3D Model Requirements

| ID | Requirement | Priority | Delivery | Primary user | Acceptance criteria |
|---|---|---|---|---|---|
| MODEL-001 | MVP should accept uploaded or externally generated 3D models linked to a patient and session. | Should Have | MVP | Doctor | A supported model can be stored, opened, and traced to its clinic, patient, session, and source. |
| MODEL-002 | Models must retain format, source, capture date, processing status, compatibility, scale/calibration status, and version metadata. | Should Have | MVP | Doctor | Users can distinguish calibrated, uncalibrated, failed, and superseded models. |
| MODEL-003 | Screenshots or views used in reports or presentation must be explicitly selected and approved. | Must Have | MVP | Doctor | Unapproved model views do not enter patient-safe outputs. |
| MODEL-004 | Unscaled models must not produce measurements presented as physically exact. | Must Have | MVP | Doctor | The interface labels unavailable or uncalibrated physical scale and blocks misleading units. |
| MODEL-005 | Automatic reconstruction, depth integration, and compatible longitudinal 3D comparison are future capabilities. | Future | Post-MVP | Doctor | MVP does not depend on automated reconstruction or specialised depth data. |

## 21. Measurement Requirements

| ID | Requirement | Priority | Delivery | Primary user | Acceptance criteria |
|---|---|---|---|---|---|
| REGION-001 | Authorised clinical users must draw, edit, label, and remove recipient regions manually. | Must Have | MVP | Doctor | Region edits are visible, reversible before approval, and stored with author and version. |
| REGION-002 | Supported zone labels must include frontal, mid-scalp, crown, and temples where relevant. | Must Have | MVP | Regions can be assigned supported labels without forcing irrelevant zones. |
| REGION-003 | AI-assisted or staff-created regions must be distinguishable from doctor-approved regions. | Must Have | MVP | Origin and approval state are visible and traceable. |
| MEASURE-001 | The system must calculate or accept doctor-entered area in cm² for each zone and total recipient area. | Must Have | MVP | Zone totals and overall total are displayed with method and precision. |
| MEASURE-002 | Measurements must record source asset/model, scale or calibration method, author, time, and version. | Must Have | MVP | An authorised reviewer can determine how each measurement was produced. |
| MEASURE-003 | Doctors must be able to override a calculated measurement with a reason. | Must Have | MVP | The original value remains traceable and the final value is clearly doctor-adjusted. |
| MEASURE-004 | Uncalibrated images must not generate values represented as exact physical measurements. | Must Have | MVP | The system requires calibration or explicit doctor-entered values before showing cm² as final. |
| MEASURE-005 | Recalculation after region or calibration changes must create a new version and invalidate affected approval. | Must Have | MVP | The approved value does not silently change. |

## 22. Graft Planning Requirements

| ID | Requirement | Priority | Delivery | Primary user | Acceptance criteria |
|---|---|---|---|---|---|
| GRAFT-001 | Doctors must enter or select target density by recipient zone. | Must Have | MVP | Doctor | Each planned zone displays its density and unit. |
| GRAFT-002 | The system must calculate a graft requirement from approved area and density inputs using a documented formula. | Must Have | MVP | Calculated zone and total values reproduce the approved inputs and rounding rule. |
| GRAFT-003 | Initial consultations must present a preliminary graft range rather than false precision when measurements are uncertain. | Must Have | MVP | Reports and screens label the value “preliminary graft range” and disclose relevant uncertainty. |
| GRAFT-004 | Doctors must be able to adjust zone allocation, density, and total graft plan with a reason. | Must Have | MVP | Adjusted values are labelled, reconciled, and retained in version history. |
| GRAFT-005 | The final surgical plan must show area, density, graft allocation by zone, total, hairline version, and doctor approval. | Must Have | MVP | Approval is blocked until required plan data is complete and internally consistent. |
| GRAFT-006 | The system must warn when zone allocations do not reconcile with the planned total or procedure total. | Must Have | MVP | Inconsistent totals are visibly flagged before approval or report generation. |
| GRAFT-007 | Donor capacity must not be inferred as exact from ordinary phone images. | Must Have | MVP | No MVP output claims an exact donor capacity without suitable validated input. |

## 23. Hairline Design Requirements

| ID | Requirement | Priority | Delivery | Primary user | Acceptance criteria |
|---|---|---|---|---|---|
| HAIRLINE-001 | Doctors must be able to draw and edit a proposed hairline on a supported patient view. | Must Have | MVP | A hairline can be created, adjusted, removed, and saved without changing the source image. |
| HAIRLINE-002 | The system must preserve hairline versions and identify draft, proposed, and final doctor-approved states. | Must Have | MVP | Users can trace the final hairline to its author, source view, version, and approval. |
| HAIRLINE-003 | Suggested starting points or symmetry guides must remain optional and editable. | Could Have | MVP | A doctor can ignore, move, or remove every guide. |
| HAIRLINE-004 | Patient-facing previews must be labelled as an illustrative simulation, not a guaranteed result. | Must Have | MVP | The label appears on-screen and in any patient-safe output containing the preview. |
| HAIRLINE-005 | Material hairline edits after approval must require a new final surgical plan version. | Must Have | MVP | The prior approved version remains traceable and is not silently overwritten. |

## 24. AI Assistance Requirements

| ID | Requirement | Priority | Delivery | Primary user | Acceptance criteria |
|---|---|---|---|---|---|
| AI-001 | AI-assisted outputs may suggest Norwood/Ludwig classification, regions, crown boundaries, hairline starting points, quality issues, area measurements, graft ranges, density options, or follow-up comparisons. | Future | Post-MVP | Doctor | Each enabled use case has separate validation, labelling, and approval controls. |
| AI-002 | Every AI-assisted output must identify itself as a suggestion and require human review. | Must Have | MVP | Doctor | No suggestion enters an approved plan without an explicit doctor action. |
| AI-003 | Doctors must be able to accept, edit, reject, and manually replace suggestions. | Must Have | MVP | The workflow never forces acceptance and retains the final doctor decision. |
| AI-004 | The system must record model/service version, input reference, output, confidence or limitation metadata when available, reviewer, and disposition. | Must Have | MVP if AI enabled | Platform Owner | An authorised audit can reconstruct which suggestion informed a decision. |
| AI-005 | AI-assisted content must not claim autonomous diagnosis, guaranteed accuracy, graft survival, or outcome. | Must Have | MVP | Patient and clinician interfaces use approved assistive language and disclaimers. |
| AI-006 | Clinics must be able to proceed when AI is unavailable or disabled. | Must Have | MVP | Manual workflows remain functional and AI failure does not block clinical documentation. |
| AI-007 | AI use on clinic data must follow approved consent, data-processing, retention, security, and vendor terms. | Must Have | MVP if AI enabled | Platform Owner | No production AI processing begins without documented governance approval. |
| AI-008 | Doctor correction rate and suggestion performance must be measurable by use case before expansion. | Future | Post-MVP | Product Owner | Evaluation reports use representative data and defined safety thresholds. |

## 25. Procedure Record Requirements

| ID | Requirement | Priority | Delivery | Primary user | Acceptance criteria |
|---|---|---|---|---|---|
| PROC-001 | A procedure record must link to one patient, clinic, final surgical plan, procedure date, and surgeon. | Must Have | MVP | Doctor | Cross-clinic or mismatched plan links are rejected. |
| PROC-002 | The record must support team, technique, extraction start/end, and procedure notes. | Must Have | MVP | Procedure Technician | Required clinic-defined fields are validated and attributable. |
| PROC-003 | The record must capture total extracted grafts and single-, double-, triple-, and four-plus-hair follicular-unit counts. | Must Have | MVP | Procedure Technician | Breakdown totals are automatically checked against extracted/usable totals. |
| PROC-004 | Damaged/discarded grafts, usable graft total, and implanted grafts by zone must be recorded. | Must Have | MVP | Procedure Technician | Reconciliation warnings identify inconsistent extraction, usable, and implantation values; unresolved differences require Doctor review. |
| PROC-005 | Changes from the final surgical plan must include an explanation and author. | Must Have | MVP | Doctor | The record shows planned versus actual allocation and the reason for change; a Procedure Technician cannot alter the approved plan. |
| PROC-006 | Immediate post-procedure images must use a standard checklist and remain linked to the procedure. | Must Have | MVP | Procedure Technician / Clinical Assistant | Missing required images are flagged before procedure completion. |
| PROC-007 | Finalisation must create a traceable, read-only version; later corrections require an addendum or new version. | Must Have | MVP | Doctor | A final record cannot be silently overwritten or finalised by a Procedure Technician. |

## 26. Follow-Up Requirements

| ID | Requirement | Priority | Delivery | Primary user | Acceptance criteria |
|---|---|---|---|---|---|
| FOLLOW-001 | Clinics must configure follow-up checkpoints, including common day and month intervals. | Must Have | MVP | A clinic can enable, disable, or adjust checkpoints without changing another clinic. |
| FOLLOW-002 | Each follow-up must link to the patient and procedure and record scheduled/actual date and status. | Must Have | MVP | The patient timeline shows due, completed, missed, cancelled, and rescheduled follow-ups. |
| FOLLOW-003 | Follow-ups must support standard photos, capture conditions, donor/recipient healing, coverage, hairline/crown progression, doctor assessment, satisfaction, and next recommendation. | Must Have | MVP | Required clinic-defined fields are available and completeness is reported. |
| FOLLOW-004 | The system should provide previous-image alignment and capture-consistency guidance. | Should Have | MVP | The user can reference a comparable prior view without altering either source. |
| FOLLOW-005 | Clinical concerns must be markable for doctor review without generating an autonomous diagnosis. | Must Have | MVP | A concern creates a visible review state and does not present a diagnosis. |
| FOLLOW-006 | Follow-up reports must require doctor approval before patient sharing. | Must Have | MVP | Unapproved reports cannot be shared through patient-safe channels. |

## 27. Comparison Requirements

| ID | Requirement | Priority | Delivery | Primary user | Acceptance criteria |
|---|---|---|---|---|---|
| COMPARE-001 | Authorised users must compare consultation, surgery-day, immediate post-op, and follow-up images side by side. | Must Have | MVP | Users can select compatible timepoints and view labels, dates, and capture conditions. |
| COMPARE-002 | The system should provide an overlay view for compatible, aligned images. | Should Have | MVP | The overlay identifies its source images and does not modify them. |
| COMPARE-003 | The system must provide a chronological timeline of comparable records. | Must Have | MVP | The timeline links each item to its source session and status. |
| COMPARE-004 | Patient-safe comparisons must include only approved images and approved annotations. | Must Have | MVP | Private, rejected, or unapproved assets are absent from presentation and patient reports. |
| COMPARE-005 | Comparisons must not present visual change as guaranteed growth, causation, or validated outcome scoring. | Must Have | MVP | Approved language describes observable comparison and limitations. |
| COMPARE-006 | Compatible 3D model comparison and automated progression scoring are deferred. | Future | Post-MVP | Doctor | MVP comparison remains complete without these capabilities. |

## 28. Report Requirements

### Report types

The product must support Consultation Report, Final Surgical Plan, Procedure Report, Follow-Up Report, Complete Patient Journey Report, Internal Clinical Report, and Patient-Safe Report.

| ID | Requirement | Priority | Delivery | Primary user | Acceptance criteria |
|---|---|---|---|---|---|
| REPORT-001 | Reports must be generated from a defined record version and identify clinic, patient, report type, number, version, author, and generation time. | Must Have | MVP | Report Coordinator | Generated output is traceable to immutable source versions. |
| REPORT-002 | Clinical and patient-shareable reports must require Doctor approval. | Must Have | MVP | Doctor | Unapproved or stale reports cannot enter approved/shareable status; a Report Coordinator cannot approve them. |
| REPORT-003 | Patient-safe reports must support clinic logo/contact, doctor, patient name/ID, date, approved images/model views, assessment, measurements, graft range/plan, recommendation, watermark, number, version, verification reference, and disclaimer. | Must Have | MVP | Report Coordinator | A generated patient-safe report contains configured applicable fields and no disallowed content. |
| REPORT-004 | Internal reports may include private notes, warnings, unapproved suggestions, technical measurements, staff notes, procedure detail, and full timeline subject to role permissions. | Must Have | MVP | Doctor | Internal content is permission-controlled and never reused in patient-safe output by default or exposed to a Report Coordinator without explicit authority. |
| REPORT-005 | Patient-safe output must be built from an allowlist of approved content, not by hiding fields from an internal report. | Must Have | MVP | Report Coordinator | Security tests demonstrate excluded categories cannot leak into patient output. |
| REPORT-006 | PDF generation must produce a stable, readable, printable document with page numbering and clinic branding. | Must Have | MVP | Report Coordinator | Supported reports render without clipped required content at approved page sizes. |
| REPORT-007 | Every patient-safe PDF must carry a configurable visible watermark. | Must Have | MVP | Report Coordinator | The watermark appears on every applicable page and cannot be disabled by unauthorised users. |
| REPORT-008 | Reports must maintain draft, approved, superseded, shared, and revoked states with version history. | Must Have | MVP | Report Coordinator | Users can identify the active version and the status/history of older versions. |
| REPORT-009 | Material source changes must mark affected reports stale and require regeneration/re-approval. | Must Have | MVP | Report Coordinator | A stale report cannot be newly shared as current. |
| REPORT-010 | Sharing must record recipient/channel reference where appropriate, sharer, time, version, and revocation/expiry. | Must Have | MVP | Report Coordinator | The clinic can audit which approved version was shared and when. |
| REPORT-011 | Patient-safe reports must state that AI-assisted content and illustrative simulations are assistive and not guaranteed outcomes. | Must Have | MVP | Doctor | Approved disclaimer text appears whenever such content is included. |

## 29. Presentation Mode Requirements

| ID | Requirement | Priority | Delivery | Primary user | Acceptance criteria |
|---|---|---|---|---|---|
| PRESENT-001 | `apps/present` must open only a temporary, clinic-scoped presentation session. | Must Have | MVP | Presentation User | Direct navigation without a valid session reveals no patient or clinic data. |
| PRESENT-002 | A Doctor or authorised clinic user must explicitly select content, and clinical content must be Doctor-approved before presentation. | Must Have | MVP | Doctor | The session payload contains only selected approved items. |
| PRESENT-003 | Presentation mode must not expose patient lists, phone numbers, private/internal notes, staff comments, unapproved suggestions, navigation, downloads, search, or clinic administration. | Must Have | MVP | Presentation User | Security and visual tests confirm prohibited information and routes are absent. |
| PRESENT-004 | Sessions must expire automatically and support immediate closure/revocation from the clinic workspace. | Must Have | MVP | Presentation User | Expired or revoked displays clear content and cannot reload protected data. |
| PRESENT-005 | The display must be full-screen, legible at distance, and safe from accidental navigation to confidential areas. | Must Have | MVP | Presentation User | Keyboard, pointer, refresh, and route tests cannot escape into the clinic workspace. |
| PRESENT-006 | Patient identifiers should be minimised to the clinic-approved display name or reference. | Should Have | MVP | Doctor | Only configured minimum identity appears in the session. |
| PRESENT-007 | Illustrative simulations and preliminary graft ranges must carry appropriate patient-safe labels. | Must Have | MVP | Doctor | Labels remain visible on all relevant presentation views. |

## 30. Clinic Branding Requirements

| ID | Requirement | Priority | Delivery | Primary user | Acceptance criteria |
|---|---|---|---|---|---|
| BRAND-001 | Clinic owners must configure clinic name, logo, contact details, and report footer/disclaimer within platform limits. | Must Have | MVP | Branding changes affect only the clinic and are previewable before use. |
| BRAND-002 | Branding assets must be validated for supported type, size, dimensions, and safe rendering. | Must Have | MVP | Invalid assets are rejected without affecting existing approved branding. |
| BRAND-003 | Patient-safe reports and presentation must use the active approved clinic branding. | Must Have | MVP | Generated content identifies the correct clinic and branding version. |
| BRAND-004 | Full white-labelling, custom domains, and removal of mandatory platform/legal notices are deferred. | Future | Post-MVP | Clinic Owner | MVP uses bounded branding and preserves required platform/legal disclosures. |

## 31. Platform Administration Requirements

| ID | Requirement | Priority | Delivery | Primary user | Acceptance criteria |
|---|---|---|---|---|---|
| ADMIN-001 | Platform Administrators must manually create, configure, activate, suspend, and close clinic accounts under Platform Owner governance. | Must Have | MVP | Platform Administrator | Each action requires permission, confirmation, reason where appropriate, and audit entry. |
| ADMIN-002 | Platform Administrators must manage plan assignment, feature entitlements, and usage limits without patient billing. | Must Have | MVP | Platform Administrator | Entitlement changes affect only the selected clinic and do not create patient financial records. |
| ADMIN-003 | Platform-role workspaces must favour operational metadata and platform health over clinical content. | Must Have | MVP | Platform Administrator / Platform Support Engineer | Routine platform views do not display patient images, notes, or detailed clinical records. |
| ADMIN-004 | Platform Support Engineer access to clinical data must be explicit, time-limited, least-privilege, clinic-approved, scoped, revocable, and audited. | Must Have | MVP | Platform Support Engineer | Support access requires a reason, named user, approved scope/duration, automatic expiry, and complete sensitive-action history. |
| ADMIN-005 | Platform Owners and authorised Platform Administrators must be able to revoke support access and active clinic sessions during an incident. | Must Have | MVP | Platform Owner / Platform Administrator | Revocation prevents subsequent authorised requests and is audited. |
| PLAN-001 | The system must enforce configured clinic entitlements and usage limits consistently. | Must Have | MVP | A clinic cannot use a disabled feature or exceed a hard limit without an authorised override. |
| PLAN-002 | Clinics must receive a clear warning before a soft usage limit affects workflow. | Should Have | MVP | Warning thresholds and current usage are visible to authorised clinic users. |
| PLAN-003 | Automatic subscription billing is deferred. | Will Not Have Yet | Post-MVP | Platform Owner | MVP plan administration is manual and stores no patient-payment or clinic-accounting records. |

## 32. Role and Permission Summary

| Role | Default authority | Fixed restriction |
|---|---|---|
| Platform Owner | Platform governance, commercial strategy, and privileged platform decisions | No routine clinical access or Doctor authority |
| Platform Administrator | Clinic accounts, plans, limits, status, usage, and platform configuration | Operational metadata by default; no automatic patient access |
| Platform Support Engineer | Operational diagnostics and approved temporary support scope | No default clinical access; grant must be scoped, revocable, expiring, and audited |
| Clinic Owner | Clinic workspace, policy, staff, branding, and authorised data requests | Doctor approval requires separate Doctor role |
| Clinic Administrator | Clinic users, settings, branding, and authorised operations | No platform powers or final clinical approval without Doctor role |
| Doctor / Hair-Transplant Surgeon | Full authorised clinical work, private notes, final plan/hairline/graft/report approval | Authority remains clinic/patient/version scoped |
| Clinical Assistant | Registration, preparation, capture/upload, and authorised clinical drafts | No final clinical approval |
| Procedure Technician | Authorised procedure details, graft counts, actual allocation, and images | Cannot change or approve the final surgical plan; unresolved counts go to Doctor |
| Reception User | Basic identity/contact, registration/status, and sharing of approved reports | No doctor-only notes or graft planning |
| Report Coordinator | Prepare/version/download and share Doctor-approved patient-safe reports | Cannot alter clinical decisions or approve reports |
| Presentation User | Navigate one temporary approved patient-safe session | No lists, search, private data, downloads, exports, edits, or dashboard |
| Read-Only Clinical Reviewer | Review explicitly authorised clinical records | No edit, approval, share, export, or alteration unless another role grants it |
| Patient | Receive explicitly approved reports, links, or documents | No internal clinic dashboard in MVP |

Users may hold more than one authorised role where clinic policy permits. Effective permissions are the permitted combination of active role assignments, but clinical approval always comes only from the Doctor role. The detailed role-permission document is authoritative and may reduce access further without weakening these fixed restrictions.

## 33. Privacy Requirements

| ID | Requirement | Priority | Delivery | Primary user | Acceptance criteria |
|---|---|---|---|---|---|
| PRIVACY-001 | The platform must collect and display only data necessary for approved product workflows. | Must Have | MVP | Product Owner | Each sensitive field has a documented purpose, visibility, and retention basis. |
| PRIVACY-002 | Consent/privacy acknowledgement must be recorded with version, status, time, and collector. | Must Have | MVP | Clinical Assistant | The clinic can demonstrate which acknowledgement applied to a capture or report. |
| PRIVACY-003 | Patient-safe contexts must use approved allowlisted content and data minimisation. | Must Have | MVP | Doctor | Tests confirm private/internal categories do not appear in presentation, shared links, or patient PDFs. |
| PRIVACY-004 | Production patient data must not be used for development, demos, or AI training without explicit approved governance. | Must Have | MVP | Platform Owner | Non-production environments contain synthetic or properly authorised/de-identified data. |
| PRIVACY-005 | Clinics must be able to respond to applicable patient access, correction, export, and deletion requests. | Must Have | MVP | Clinic Owner | The process is permission-controlled, identity-verified, traceable, and subject to retention obligations. |
| PRIVACY-006 | Privacy notices, data-processing terms, and controller/processor responsibilities must be approved for launch jurisdictions. | Must Have | MVP | Product Owner | Legal approval is recorded before production onboarding. |

## 34. Security Requirements

| ID | Requirement | Priority | Delivery | Primary user | Acceptance criteria |
|---|---|---|---|---|---|
| SECURITY-001 | All network traffic containing protected or sensitive data must use encryption in transit. | Must Have | MVP | Platform Owner | Production endpoints reject insecure transport and pass configuration review. |
| SECURITY-002 | Sensitive stored data and backups must use appropriate encryption at rest. | Must Have | MVP | Platform Owner | Encryption coverage and key ownership are documented and tested. |
| SECURITY-003 | Images, scans, models, and reports must be private by default and delivered through authorised, expiring access. | Must Have | MVP | Public unauthenticated object URLs cannot retrieve private assets. |
| SECURITY-004 | Database-level policies and API-level authorisation must enforce clinic and role scope. | Must Have | MVP | Automated negative tests cover cross-tenant and privilege-escalation attempts. |
| SECURITY-005 | Secrets must not be stored in source control, logs, client bundles, reports, or presentation sessions. | Must Have | MVP | Secret scanning and configuration review pass before release. |
| SECURITY-006 | Authentication endpoints and sensitive operations must use rate limiting and abuse protection appropriate to risk. | Must Have | MVP | Defined abuse tests trigger protection without exposing sensitive account information. |
| SECURITY-007 | The product must prevent common injection, request forgery, insecure upload, broken access control, and unsafe rendering risks. | Must Have | MVP | Security testing finds no unresolved release-blocking issue in the approved threat model. |
| SECURITY-008 | Supported uploads must be validated, size-limited, scanned or safely processed, and stored outside executable paths. | Must Have | MVP | Unsupported or malicious test files are rejected or quarantined. |
| SECURITY-009 | Secure, tested backups and restoration procedures must meet approved recovery objectives. | Must Have | MVP | A restoration exercise recovers representative tenant data without cross-tenant disclosure. |
| SECURITY-010 | A vulnerability disclosure, patching, incident response, and access-review process must exist before production. | Must Have | MVP | Owners, severity targets, communication paths, and evidence are documented. |

## 35. Audit Requirements

| ID | Requirement | Priority | Delivery | Primary user | Acceptance criteria |
|---|---|---|---|---|---|
| AUDIT-001 | Audit events must record actor, role, clinic, action, target, time, result, and relevant request/session context. | Must Have | MVP | Sensitive events can be reconstructed without storing secrets or unnecessary clinical content. |
| AUDIT-002 | Events must cover authentication, user/role changes, patient access, exports, deletions, approvals, report sharing, support access, and presentation sessions. | Must Have | MVP | The approved event catalogue has a generated event for each tested action. |
| AUDIT-003 | Audit records must be append-only for normal users and protected from unauthorised modification or deletion. | Must Have | MVP | Clinic and support users cannot alter event history. |
| AUDIT-004 | Authorised clinic and platform users must be able to search/export audit history within their permitted scope. | Must Have | MVP | Queries and exports cannot cross tenant or permission boundaries. |
| AUDIT-005 | Audit retention and alerting rules must be configurable according to legal and operational policy. | Should Have | MVP | Retention is documented and high-risk events can trigger review. |
| AUDIT-006 | Support access must create prominent start, view/action, and end/revocation events. | Must Have | MVP | A support session can be fully traced to request, reason, grantor, operator, actions, and expiry. |

## 36. Data Retention and Export

| ID | Requirement | Priority | Delivery | Primary user | Acceptance criteria |
|---|---|---|---|---|---|
| DATA-001 | Retention schedules must be configurable by data category and launch jurisdiction within platform policy. | Must Have | MVP | Approved rules identify retention, legal hold, deletion, and owner for each category. |
| DATA-002 | Clinics must be able to request an authenticated export of their patients, clinic records, reports, and supported media metadata/files. | Must Have | MVP | The export is clinic-scoped, encrypted or securely delivered, manifest-based, and audited. |
| DATA-003 | Deletion must support pending, approved, completed, failed, and legally retained states. | Must Have | MVP | Users can identify status and retained exceptions without claiming deletion prematurely. |
| DATA-004 | Deleted data must be removed from active systems and age out of backups according to documented policy. | Must Have | MVP | Deletion testing verifies active removal and records the backup-expiry boundary. |
| DATA-005 | Legal or clinical retention holds must override routine deletion with authorised reason and audit. | Must Have | MVP | Held records remain protected until an authorised release. |
| DATA-006 | Source clinical records, approval history, and report versions must not be silently overwritten. | Must Have | MVP | Corrections create a revision, superseding version, or addendum as appropriate. |
| DATA-007 | Clinic closure must follow an approved export, retention, access-removal, and deletion process. | Must Have | MVP | Closure cannot immediately erase records without verified policy steps. |

## 37. Notifications and Statuses

| ID | Requirement | Priority | Delivery | Primary user | Acceptance criteria |
|---|---|---|---|---|---|
| NOTIFY-001 | The system must expose clear status for capture, upload, consultation, approval, procedure, follow-up, report, and presentation workflows. | Must Have | MVP | Authorised users can distinguish draft, in-progress, failed, ready, approved, superseded, expired, and completed states where applicable. |
| NOTIFY-002 | In-product notifications must identify missing required data, failed uploads, approval requests, stale reports, and due follow-ups. | Must Have | MVP | Each notification links to an authorised resolution path and can be acknowledged. |
| NOTIFY-003 | Notifications must not reveal sensitive patient information to unauthorised roles or through insecure channels. | Must Have | MVP | Content is role-aware and uses minimum necessary identifiers. |
| NOTIFY-004 | Clinic-configurable email notifications may be added after privacy and deliverability review. | Could Have | MVP | External messages contain no sensitive clinical detail and honour clinic settings. |
| NOTIFY-005 | Automated WhatsApp Business API messaging is deferred. | Will Not Have Yet | Post-MVP | Clinic Owner | No MVP dependency or release criterion requires WhatsApp automation. |

## 38. Non-Functional Requirements

| ID | Requirement | Priority | Delivery | Primary user | Acceptance criteria |
|---|---|---|---|---|---|
| NFR-001 | The service must be designed for secure tenant isolation, maintainability, observability, and incremental scaling. | Must Have | MVP | Architecture review maps each quality attribute to testable controls. |
| NFR-002 | Clinical writes, approvals, uploads, and report generation must be idempotent or protected from duplicate submission. | Must Have | MVP | Retry tests do not create duplicate approvals, records, or files. |
| NFR-003 | All persisted clinical times must retain an unambiguous timestamp and display in the clinic’s configured timezone. | Must Have | MVP | Cross-timezone tests preserve ordering and original event time. |
| NFR-004 | User-visible calculations must define units, precision, rounding, source, and version. | Must Have | MVP | The same inputs reproduce the displayed result. |
| NFR-005 | Production changes must support controlled rollout, monitoring, and rollback. | Must Have | MVP | Release rehearsal demonstrates rollback without corrupting clinic data. |
| NFR-006 | The platform must separate production, test, and development data and credentials. | Must Have | MVP | Environment review finds no shared production credentials or unauthorised data replication. |
| NFR-007 | Critical workflows must have automated tests covering success, permission denial, validation, interruption, and recovery. | Must Have | MVP | The release test report shows passing coverage for approved critical journeys. |
| NFR-008 | The product should support localisation-ready text and configurable clinic terminology without requiring MVP translation. | Should Have | MVP | User-facing strings and date/number formats can be adapted without changing clinical records. |

## 39. Performance Requirements

Initial targets are product targets and must be confirmed during architecture and pilot planning.

| ID | Requirement | Priority | Delivery | Primary user | Acceptance criteria |
|---|---|---|---|---|---|
| PERF-001 | For normal clinic load, 95% of non-media interactive requests should complete within 2 seconds. | Should Have | MVP | Pilot-like load testing meets the target for agreed key journeys. |
| PERF-002 | Patient search should return the first page within 2 seconds for the approved per-clinic data volume. | Should Have | MVP | Tested clinic dataset meets the target without cross-tenant results. |
| PERF-003 | The scan application must show local feedback immediately and upload progress within 1 second of upload start where the browser permits. | Should Have | MVP | Supported-device tests show responsive capture and visible transfer state. |
| PERF-004 | A normal patient-safe PDF should be generated within 30 seconds, with longer jobs showing progress and safe retry. | Should Have | MVP | Representative reports meet the target or enter a visible recoverable job state. |
| PERF-005 | Presentation navigation should render approved local/session content within 1 second after selection under clinic network conditions. | Should Have | MVP | Pilot display tests meet the target after initial session load. |
| PERF-006 | Capacity assumptions for clinics, users, patients, images, and concurrent sessions must be approved before architecture sign-off. | Must Have | MVP | Load-test volumes and scaling triggers are documented and accepted. |

## 40. Accessibility Requirements

| ID | Requirement | Priority | Delivery | Primary user | Acceptance criteria |
|---|---|---|---|---|---|
| ACCESS-001 | Core web and scan workflows must target WCAG 2.2 AA. | Must Have | MVP | Automated and manual accessibility checks find no unresolved critical barrier in core journeys. |
| ACCESS-002 | Keyboard users must complete core desktop workflows without a pointer, except intrinsically graphical drawing that has an accessible alternative or documented accommodation. | Must Have | MVP | Focus order, controls, dialogs, and approvals are keyboard-operable. |
| ACCESS-003 | Text, status, validation, and approval state must not rely on colour alone. | Must Have | MVP | Visual review confirms labels/icons/text accompany colour cues. |
| ACCESS-004 | Presentation mode must remain legible at distance with scalable type, adequate contrast, and safe full-screen controls. | Must Have | MVP | Approved display-size testing meets defined viewing-distance criteria. |
| ACCESS-005 | Capture instructions must use concise text and visual guidance and remain understandable under common clinic lighting. | Should Have | MVP | Usability testing shows staff can identify required views and correction actions. |
| ACCESS-006 | Reduced motion and assistive-technology semantics should be supported for non-essential animation and controls. | Should Have | MVP | Supported-browser tests respect reduced-motion preference and expose meaningful names/states. |

## 41. Device and Browser Support

| ID | Requirement | Priority | Delivery | Primary user | Acceptance criteria |
|---|---|---|---|---|---|
| DEVICE-001 | `apps/web` must support the current and previous major versions of approved Chromium, Safari, and Firefox desktop browsers. | Must Have | MVP | Critical workflow testing passes on the release support matrix. |
| DEVICE-002 | `apps/scan` must support approved modern iOS Safari and Android Chrome versions with camera and upload permissions. | Must Have | MVP | The standard capture flow passes on the minimum approved device matrix. |
| DEVICE-003 | `apps/present` must support approved LED-connected browsers at common 1080p and 4K display sizes. | Must Have | MVP | Full-screen presentation passes privacy, legibility, and expiry tests. |
| DEVICE-004 | Unsupported browsers or missing camera capabilities must receive a clear, safe message and recovery guidance. | Must Have | MVP | Users are not left in a false completed or blank state. |
| DEVICE-005 | Offline-first clinical operation is not required, but transient connection loss must not silently lose confirmed work. | Should Have | MVP | Draft/retry behaviour is documented and tested for supported interruptions. |

## 42. Error and Recovery Requirements

| ID | Requirement | Priority | Delivery | Primary user | Acceptance criteria |
|---|---|---|---|---|---|
| RECOVERY-001 | User-facing errors must explain what failed, whether data was saved, and the next safe action without exposing sensitive internals. | Must Have | MVP | Error-state tests provide actionable, non-sensitive messages. |
| RECOVERY-002 | Interrupted uploads must resume or retry safely and retain accurate item-level status. | Must Have | MVP | Network interruption tests neither lose accepted files nor mark failed files complete. |
| RECOVERY-003 | Draft clinical records must be protected from accidental navigation or session interruption through save/recovery behaviour. | Must Have | MVP | Approved interruption scenarios recover the latest confirmed draft or clearly identify unsaved changes. |
| RECOVERY-004 | Duplicate submissions must not create duplicate patients, approvals, procedures, or reports. | Must Have | MVP | Repeat and timeout tests result in one canonical operation. |
| RECOVERY-005 | Failed report or processing jobs must be retryable without changing the approved source version. | Must Have | MVP | Retry produces a traceable result from the same source or requires explicit new-version selection. |
| RECOVERY-006 | Administrative restoration must preserve tenant scope, audit continuity, and record relationships. | Must Have | MVP | Recovery rehearsal verifies integrity and isolation for representative records/assets. |

## 43. Analytics and Success Metrics

Product analytics must use minimum necessary, tenant-scoped or appropriately aggregated data. Analytics must not expose clinical content to platform users by default.

| ID | Metric | Definition / initial target |
|---|---|---|
| METRIC-001 | Consultation documentation time | Median time from consultation start to ready-for-doctor-review; improve against pilot baseline |
| METRIC-002 | Standard photograph completion | Percentage of applicable sessions completing the required photo set |
| METRIC-003 | Report completeness | Percentage of reports approved without missing-information rework |
| METRIC-004 | Scan completion success | Percentage of started scan sessions completed with all required uploads |
| METRIC-005 | AI correction rate | Percentage of AI-assisted suggestions edited or rejected by doctors, by use case |
| METRIC-006 | Repeat-scan consistency | Percentage meeting approved view/condition consistency criteria |
| METRIC-007 | Follow-up documentation | Percentage of due follow-ups documented by checkpoint |
| METRIC-008 | Report generation time | Median and 95th-percentile time from request to usable PDF |
| METRIC-009 | Clinic adoption | Active clinics and consultations per clinic per month |
| METRIC-010 | Retention | Monthly retained clinics after pilot/onboarding |
| METRIC-011 | Support burden | Support requests per active clinic and time to resolution |
| METRIC-012 | Tenant isolation incidents | Target: zero |
| METRIC-013 | Report/presentation privacy incidents | Target: zero |

Event definitions, consent basis, retention, staff visibility, and clinic-level analytics access must be approved before production tracking.

## 44. Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Cross-tenant data exposure | Critical privacy and trust failure | Defence-in-depth tenant scope, negative tests, private assets, least privilege, audit, incident response |
| Patient-safe output leaks internal data | Clinical/privacy harm | Allowlist output model, separate presentation/report payloads, automated privacy tests, doctor approval |
| AI or calculations appear authoritative | Unsafe clinical reliance | Assistive labels, uncertainty, editable/rejectable suggestions, mandatory doctor approval, no autonomous claims |
| Inconsistent capture reduces comparison value | Poor clinical utility | Standard templates, metadata, guidance, retakes, follow-up alignment |
| Uncalibrated media yields misleading cm² | Incorrect plan | Calibration status, manual doctor entry, unit/precision rules, block exact claims |
| Graft totals do not reconcile | Procedure/documentation error | Formula transparency, zone/total validation, planned-versus-actual reconciliation |
| Shared display retains data | Privacy exposure | Minimal session payload, full-screen isolation, short expiry, remote revoke, clear-on-close |
| Mobile network interruption loses capture | Workflow delay and duplicate data | Item status, retry/idempotency, draft preservation, clear completion rules |
| Regulatory obligations vary by market | Launch delay or non-compliance | Jurisdiction assessment, approved terms/notices, configurable retention, staged rollout |
| Scope expands around 3D/AI | Delayed MVP | Manual-first acceptance criteria and explicit post-MVP gates |
| Staff resist structured workflow | Low adoption | Guided onboarding, templates, role-specific UX, pilot feedback and metrics |
| Platform support overreaches | Inappropriate clinical access | Metadata-first support, explicit time-limited grants, least privilege, full audit |

## 45. Assumptions

- Initial clinics operate a single branch.
- Clinics are manually contracted, configured, and onboarded.
- Clinics provide authorised staff and designate responsible doctors.
- Clinics determine their lawful basis, patient consent/acknowledgement process, and local clinical retention duties with platform support.
- Supported clinics have reliable modern desktop and phone browsers and a usable clinic network.
- MVP can use manual marking, doctor-entered measurements, doctor-selected density, and uploaded/external 3D models.
- A preliminary graft range may be appropriate when input precision is limited.
- The final surgical plan and clinical reports always require doctor approval.
- Platform-level plan administration can be manual during pilots.
- English is the initial product language; localisation readiness is desirable.
- Production use will not begin until security, privacy, clinical, and operational readiness checks are approved.

## 46. Dependencies

- Product-owner approval of this PRD and unresolved decisions.
- Initial clinical validation with Dr Sheraz at FACE Aesthetic Clinic Lahore, plus additional clinic pilot partners as approved.
- System architecture, data design, permission matrix, user flows, and UI system completed in the repository’s required sequence.
- Legal/privacy assessment for Pakistan as the initial launch market, including applicable data-processing terms.
- Security threat model, access model, retention policy, incident plan, and backup objectives.
- Approved standard photograph protocols and clinical terminology.
- Approved formulas, units, rounding rules, and uncertainty language for measurement and graft planning.
- Browser/device support matrix and representative test devices.
- Storage, PDF, email, 3D, and any AI vendor assessments before selection.
- Synthetic or properly authorised test data and reference media.
- Clinic onboarding, training, support, and escalation procedures.

## 47. Acceptance Criteria

The MVP is acceptable only when:

1. Every Must Have MVP requirement is implemented, tested, and traceable to evidence.
2. Any deferred Should Have item has explicit product-owner approval and documented impact.
3. Cross-tenant read/write attempts and privilege-escalation tests pass with zero known bypasses.
4. Clinic, role, doctor-only, patient-safe, support-access, and presentation restrictions pass negative tests.
5. Registration through follow-up and report sharing works end to end using representative synthetic patients.
6. A clinic can complete a consultation and final surgical plan without AI or automatic 3D reconstruction.
7. Final plans and clinical/patient reports cannot be approved by non-doctors.
8. Measurement method, graft formula, source, versions, edits, approvals, and procedure changes are traceable.
9. Patient-safe PDFs and presentation sessions contain only explicitly approved content.
10. Upload interruption, duplicate submission, expired pairing, stale report, revoked access, and restoration scenarios pass recovery tests.
11. Security, privacy, accessibility, browser/device, performance, backup/restore, and operational reviews are signed off.
12. Product wording contains no prohibited guarantees or autonomous-diagnosis claims.
13. Pilot onboarding, training, support, export, closure, and incident procedures have owners.
14. No open Critical or High release-blocking defect remains without documented executive, security, and clinical risk acceptance.
15. All thirteen role bundles enforce tenant scope, multi-role assignment rules, platform/clinic/clinical separation, Doctor-only approval, temporary support access, patient-safe presentation, and Patient dashboard exclusion.

## 48. Release Phases

| Phase | Outcome | Exit gate |
|---|---|---|
| 0. Product definition | Approved PRD and vision alignment | Product-owner and clinical approval |
| 1. Design foundation | Architecture, schema, permissions, flows, UI system, security plan, and backlog | Cross-functional design review |
| 2. Platform foundation | Tenant onboarding, authentication, RBAC, audit, clinic settings, and patient records | Isolation and access-control evidence |
| 3. Consultation MVP | Capture/pairing, photography, regions, measurement, graft planning, hairline, approval, and presentation | End-to-end consultation acceptance |
| 4. Surgical record and reports | Surgery-day plan, procedure record, PDFs, watermarking, and versioning | Clinical traceability and privacy acceptance |
| 5. Follow-up and pilot | Follow-ups, comparisons, notifications, export, onboarding, and operations | Pilot readiness and clinic sign-off |
| 6. Post-MVP intelligence | Validated 3D automation, AI-assisted features, advanced imaging, analytics, and expansion modules | Separate use-case safety and value gates |

## 49. Open Questions

1. Pakistan is the initial launch market; which privacy, medical-record, and data-residency obligations apply?
2. Confirmed: Haris Liaqat is the product owner and Dr Sheraz is the initial clinical approver.
3. What exact personal, medical-history, consent, and acknowledgement fields are mandatory?
4. Which roles may see all clinic records, and can clinical assistants draft region/graft changes?
5. Must MFA be mandatory for all staff, doctors/owners only, or risk-based?
6. What inactivity and absolute session-expiry periods apply by role and application?
7. What standard photograph views and capture conditions are mandatory for each session type?
8. What calibration methods are acceptable for cm² measurement, and when is doctor-entered area allowed?
9. What formulas, density units, precision, and rounding rules define graft calculations?
10. Is patient acknowledgement of the final surgical plan mandatory, and what constitutes valid acknowledgement?
11. Which 3D formats, file-size limits, and external generators must MVP support?
12. Which report fields and disclaimer wording are mandatory in each launch jurisdiction?
13. How long should presentation sessions and patient report links remain valid?
14. Which patient identity fields may appear on an LED display?
15. What clinic-configurable retention periods are permitted, and what default applies?
16. What export formats and closure timeline are contractually required?
17. What support-access approval model applies during urgent incidents?
18. What clinic volume, patient volume, storage, concurrency, recovery time, and recovery point assumptions should architecture use?
19. Which Should Have features are release-blocking for the paid pilot?
20. FACE Aesthetic Clinic Lahore is the initial clinical validation clinic; which additional pilot clinics and measurable baseline values will be used to validate success?

## 50. Glossary

| Term | Definition |
|---|---|
| AI-assisted | A machine-generated suggestion that requires human review and does not replace clinical judgement |
| Clinic workspace | The private tenant context containing one clinic’s users, patients, records, assets, settings, and reports |
| Doctor-approved | Explicitly reviewed and approved by an authorised doctor, with identity, time, and version recorded |
| Donor area | Scalp area from which follicular units may be extracted; MVP does not infer exact capacity from ordinary phone images |
| Follicular unit | A naturally occurring grouping of one or more hairs; procedure records may categorise units by hair count |
| Graft | A transplanted follicular unit; counts must distinguish extracted, damaged/discarded, usable, and implanted values |
| Illustrative simulation | A visual aid for discussion that is not a prediction or guarantee of outcome |
| Patient-safe | Explicitly approved and filtered for patient viewing, excluding internal, private, or unapproved information |
| Preliminary graft range | A non-final range used when consultation inputs or measurement precision do not support a final value |
| Recipient area | The scalp region planned to receive grafts, divided into clinically relevant zones |
| Final surgical plan | The versioned recipient-area, density, graft-allocation, and hairline plan explicitly approved by a doctor |
| Region | A labelled area drawn or suggested on an image or compatible model |
| Scan session | A clinic-scoped capture session linking a mobile device to a patient workflow |
| Tenant | A clinic organisation whose records and access are isolated from all other clinics |
| Watermark | A visible mark applied to patient-safe reports to identify their controlled/documentary nature |

## Final Release and Approval Appendices

### MVP release checklist

- [x] Product owner and clinical approver are named.
- [ ] All Must Have MVP requirements have traceable test evidence.
- [ ] Tenant isolation and RBAC negative tests pass.
- [ ] All thirteen roles and permitted multi-role combinations pass positive and negative authorisation tests.
- [ ] Patient registration-to-long-term-follow-up workflow passes.
- [ ] Manual workflow succeeds with AI and automatic 3D disabled.
- [ ] Doctor approval and re-approval rules pass.
- [ ] Procedure graft and follicular-unit reconciliation passes.
- [ ] Patient-safe report allowlist and watermark tests pass.
- [ ] Presentation expiry, revocation, and privacy tests pass.
- [ ] Upload interruption, retry, and duplicate-protection tests pass.
- [ ] Security, privacy, legal, clinical, accessibility, performance, and operational reviews are approved.
- [ ] Backup restoration, tenant export, deletion, clinic closure, and incident response are rehearsed.
- [ ] Pilot clinic onboarding, training, support, and success-measurement plans are ready.
- [ ] No prohibited accuracy, autonomy, donor-capacity, survival, or result guarantee appears in product content.
- [ ] Release decision and any accepted residual risk are documented.

### Post-MVP roadmap summary

1. Validate AI-assisted image quality, region segmentation, and classification suggestions.
2. Add automatic 3D reconstruction, depth integration, and calibrated scaling.
3. Evaluate donor-density heatmaps, trichoscopy, and progression scoring.
4. Introduce multi-branch management, white-label options, and advanced analytics.
5. Add platform subscription automation without mixing it with patient finances.
6. Consider a patient portal and native applications after privacy and support validation.
7. Expand into PRP, beard, eyebrow, and additional scalp-treatment workflows.

Every roadmap item requires its own product, clinical, data, safety, privacy, security, and value assessment.

### Unresolved product decisions

Product-owner approval is required for:

- Pakistan launch compliance posture and any requirements for later markets;
- required patient, history, consent, and acknowledgement fields;
- detailed role-permission boundaries and support-access approval;
- MFA, session-expiry, and inactivity-lock policy;
- standard photo protocols and supported device matrix;
- measurement calibration, graft formula, units, precision, and rounding;
- required 3D formats and whether 3D upload is release-blocking;
- report templates, disclaimers, watermark, verification, and link expiry;
- presentation identity minimisation and session duration;
- patient/clinic retention, export, deletion, and closure policy;
- pilot entitlements, limits, volumes, service targets, and Should Have scope; and
- additional pilot clinics beyond FACE Aesthetic Clinic Lahore, baseline metrics, success thresholds, and release approvers.

### PRD approval checklist

- [ ] Product summary, principles, scope, and non-goals are approved.
- [ ] Business model and ownership boundaries are approved.
- [ ] The thirteen-role model, multi-role rules, and clinical responsibilities are approved.
- [ ] Complete patient lifecycle is clinically validated.
- [ ] MVP and post-MVP separation is accepted.
- [ ] Functional requirements and MoSCoW priorities are approved.
- [ ] AI-assisted language, limitations, and doctor-approval model are approved.
- [ ] Privacy, security, audit, retention, and support-access requirements are approved.
- [ ] Non-functional, performance, accessibility, device, and recovery targets are accepted.
- [ ] Success metrics, risks, assumptions, and dependencies have owners.
- [ ] Open questions have decisions, owners, and due dates.
- [ ] Product owner signs off.
- [ ] Clinical approver signs off.
- [ ] Security/privacy approver signs off.
- [ ] The team is authorised to begin `docs/SYSTEM_ARCHITECTURE.md`.

# GraftVision Roles and Permissions

## 1. Document Information

| Field | Value |
|---|---|
| Product | GraftVision |
| Document | Role and Permission Specification |
| Version | 1.0 Draft |
| Status | Proposed for product-owner, clinical, privacy, and security approval |
| Product owner | Haris Liaqat |
| Initial clinical approver | Dr Sheraz |
| Initial validation clinic | FACE Aesthetic Clinic Lahore |
| Initial launch market | Pakistan |
| Scope | MVP access-control model with identified post-MVP controls |

This defines product access rules, not authentication, architecture, data, API, or interface implementation.

## 2. Purpose

This document defines who may act on sensitive clinic and patient information, under which conditions, and with what approval and audit obligations. It protects tenant isolation, doctor control, least privilege, separation of duties, patient-safe disclosure, and traceable exceptions.

A role name is not a security control. Frontend visibility may simplify work, but hidden controls do not establish authority. Every protected read, write, approval, share, export, or deletion requires independent authorisation against the user, clinic, role, grants, record state, and required approval.

## 3. Access-Control Principles

1. **Default deny:** Only an active explicit permission allows an action.
2. **Tenant before role:** A role in clinic A gives no authority in clinic B.
3. **Least privilege:** Defaults include only necessary access.
4. **Doctor approval:** Only a Doctor approves final clinical plans and reports.
5. **Separation of duties:** Preparation, approval, sharing, export, deletion, and support are distinct.
6. **Patient-safe disclosure:** External contexts use approved content, never filtered internal records.
7. **No implicit inheritance:** Seniority does not grant clinical authority.
8. **Immediate effect:** Deactivation, removal, and role changes apply immediately.
9. **Time-bounded exceptions:** Temporary access has scope, reason, approver, and expiry.
10. **Traceability:** Sensitive and high-risk actions are logged.
11. **Manual safety:** AI-assisted features do not change authority.
12. **Backend enforcement:** Hidden controls, URLs, caches, and file references cannot bypass authorisation.

## 4. Tenant-Isolation Principles

| ID | Permission or restriction | Allowed roles | Denied roles | Conditions | Audit requirement | Stage | Acceptance criteria |
|---|---|---|---|---|---|---|---|
| TENANT-ACCESS-001 | Access clinic-owned records only within an authorised active clinic membership. | Clinic roles assigned to that clinic | All users outside that clinic | User, clinic membership, role, and session are active. | Denials and sensitive access logged according to policy. | MVP | Attempts using another clinic’s identifiers, links, files, searches, exports, or cached state return no data and perform no action. |
| TENANT-ACCESS-002 | Platform roles see operational metadata by default, not patient clinical content. | Platform Owner, Platform Administrator, Platform Support Engineer | N/A | Clinical content requires a separate approved temporary support grant. | Metadata access follows platform policy; every clinical grant and use is logged. | MVP | Normal platform screens and authorised operations expose no patient images, histories, notes, plans, or reports. |
| TENANT-ACCESS-003 | A user may belong only to clinics that explicitly invited or provisioned that user. | Clinic Owner, Clinic Administrator | Other clinic roles | Each membership has its own role bundle and status. | Membership creation, change, and removal logged. | MVP | Membership in one clinic does not create discovery or access in any other clinic. |
| TENANT-ACCESS-004 | Cross-clinic access is prohibited until a separately approved multi-branch product model exists. | None by default | All roles | No manual override may bypass clinic scope. | All attempted overrides logged as high risk. | MVP | Tests prove that combined roles, support tools, exports, presentation sessions, and file links preserve clinic isolation. |

Users with authorised roles in multiple clinics must select an active clinic; permissions are evaluated separately.

## 5. Role Catalogue

| Role | Purpose | Default scope | Critical boundary |
|---|---|---|---|
| Platform Owner | Commercial and technical platform control. | Platform metadata | No routine clinical access or doctor authority |
| Platform Administrator | Clinics, plans, limits, status, and settings. | Platform administration | No default clinical content or doctor approval |
| Platform Support Engineer | Diagnoses support issues. | Diagnostics; approved temporary scope | No default patient access |
| Clinic Owner | Controls clinic workspace, policy, staff, branding, and data requests. | Assigned clinic | Doctor authority requires separate Doctor role |
| Clinic Administrator | Manages users and operations. | Assigned clinic | No platform or doctor authority |
| Doctor / Hair-Transplant Surgeon | Clinical review, planning, procedure, and approval. | Authorised clinic patients | Final clinical approver |
| Clinical Assistant | Patient preparation, capture, upload, and drafts. | Authorised patients | No final approval |
| Procedure Technician | Authorised procedure data and images. | Assigned procedures | No plan change or final approval |
| Reception User | Registration, basic identity/contact, and report status. | Basic clinic records | No private notes or planning |
| Report Coordinator | Prepares and shares approved patient-safe reports. | Approved report inputs | No clinical change or approval |
| Presentation User | Operates one patient-safe session. | Temporary session | No dashboard, search, download, export, or edit |
| Read-Only Clinical Reviewer | Inspects assigned clinical records. | Assigned cases | No edit, approval, sharing, export, or deletion |
| Patient | Receives approved reports or links. | Approved own output | No internal dashboard in MVP |

## 6. Role Hierarchy

Roles are organised by responsibility, not by a single ladder:

- **Platform governance:** Platform Owner → Platform Administrator → Platform Support Engineer.
- **Clinic governance:** Clinic Owner → Clinic Administrator.
- **Clinical authority:** Doctor → Clinical Assistant / Procedure Technician.
- **Clinic operations:** Clinic Administrator → Reception User / Report Coordinator.
- **Restricted observation:** Read-Only Clinical Reviewer.
- **Patient-safe delivery:** Presentation User and Patient.

Arrows indicate delegation, not inheritance. Platform or Clinic seniority does not grant Doctor permission; a Doctor does not inherit subscription or staff administration.

## 7. Permission Categories

| State | Meaning |
|---|---|
| Full | All scoped non-approval operations |
| Create | Create a scoped record or draft |
| Read | View permitted content |
| Update | Change an editable record |
| Approve | Approve a defined version |
| Share | Release approved patient-safe content |
| Export | Create/retrieve an approved export |
| Delete | Perform a policy-approved deletion stage |
| Read-only | View without other actions |
| Masked | View minimum/redacted fields |
| None | No permission |
| Temporary | Permission exists only within a scoped, expiring grant or session |
| Explicit approval required | Separate authorised approval is required |

States are not interchangeable: `Update` does not imply `Approve`, `Approve` does not imply `Share`, `Read` does not imply `Export`, and administrative `Full` excludes doctor-only authority.

## 8. Detailed Permission Matrix

### Matrix legend

`F` Full, `C` Create, `R` Read, `U` Update, `A` Approve, `S` Share, `E` Export, `D` Delete, `RO` Read-only, `M` Masked, `T` Temporary, `X` explicit approval required, and `—` None.

Role abbreviations: `PO` Platform Owner, `PA` Platform Administrator, `PS` Platform Support Engineer, `CO` Clinic Owner, `CA` Clinic Administrator, `DR` Doctor, `AS` Clinical Assistant, `PT` Procedure Technician, `RX` Reception User, `RC` Report Coordinator, `PV` Presentation User, `RR` Read-Only Clinical Reviewer, `PN` Patient.

| Action | PO | PA | PS | CO | CA | DR | AS | PT | RX | RC | PV | RR | PN |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Create clinic | F | C | — | — | — | — | — | — | — | — | — | — | — |
| Suspend clinic | A | U/X | — | — | — | — | — | — | — | — | — | — | — |
| Configure clinic branding | — | T/X | — | F | F | — | — | — | — | U | — | RO | — |
| Invite users | — | T/X | — | F | C/U | — | — | — | — | — | — | — | — |
| Deactivate users | — | T/X | — | F | U | — | — | — | — | — | — | — | — |
| Register patient | — | — | T/X | F | F | C | C | — | C | — | — | — | — |
| View basic patient identity | — | — | T/X | R | R | R | R | M | R | M | M/T | RO | M |
| View contact details | — | — | T/X | R | R | R | R | — | R | M | — | M/X | M |
| View medical history | — | — | T/X | R/X | R/X | R | R | M/X | — | — | — | RO/X | M |
| View doctor-only notes | — | — | T/X | — | — | F | — | — | — | — | — | RO/X | — |
| Edit patient profile | — | — | T/X | U | U | U | U/X | — | U | — | — | — | — |
| Start consultation | — | — | T/X | C | C | C | C | — | C/X | — | — | — | — |
| Capture scalp images | — | — | T/X | — | — | C/U | C/U | C/U/X | — | — | — | — | — |
| Upload scan media | — | — | T/X | — | — | C/U | C/U | C/U/X | — | — | — | — | — |
| View raw images | — | — | T/X | R/X | R/X | R | R | R/X | — | M/X | — | RO/X | — |
| View 3D model | — | — | T/X | R/X | R/X | R | R | R/X | — | M/X | M/T | RO/X | M |
| Mark scalp regions | — | — | T/X | — | — | C/U/A | C/U draft | — | — | — | — | RO | — |
| Edit measurements | — | — | T/X | — | — | C/U/A | C/U draft | — | — | — | — | RO | — |
| Set density | — | — | T/X | — | — | C/U/A | C/U draft/X | — | — | — | — | RO | — |
| Calculate graft range | — | — | T/X | — | — | C/U/A | C/U draft | — | — | — | — | RO | — |
| Modify graft allocation | — | — | T/X | — | — | U/A | U draft/X | — | — | — | — | RO | — |
| Approve final graft plan | — | — | — | — | — | A | — | — | — | — | — | — | — |
| Approve final hairline | — | — | — | — | — | A | — | — | — | — | — | — | — |
| Record procedure details | — | — | T/X | — | — | C/U/A | C/U | C/U | — | — | — | RO | — |
| Record extracted graft counts | — | — | T/X | — | — | C/U/A | C/U/X | C/U | — | — | — | RO | — |
| Record implanted graft allocation | — | — | T/X | — | — | C/U/A | C/U/X | C/U | — | — | — | RO | — |
| Upload postoperative photographs | — | — | T/X | — | — | C/U | C/U | C/U | — | — | — | RO | — |
| Create follow-up record | — | — | T/X | — | C/X | C/U/A | C/U | — | C/X | — | — | RO | — |
| Compare longitudinal images | — | — | T/X | R/X | R/X | F | R | R/X | — | M/X | M/T | RO | M |
| Generate internal report | — | — | T/X | C/X | — | C/U/A | C/U draft/X | — | — | — | — | RO | — |
| Generate patient-safe report | — | — | T/X | C/X | C/X | C/U/A | C/U draft | — | — | C/U | — | RO | — |
| Approve patient-safe report | — | — | — | — | — | A | — | — | — | — | — | — | — |
| Share patient-safe report | — | — | T/X | S | S/X | S | S/X | — | S | S | — | — | Receive |
| Download report | — | — | T/X | R | R/X | R | R/X | — | R approved | R approved | — | RO/X | R approved |
| Open presentation mode | — | — | — | C/X | C/X | C | C/X | — | — | — | T | — | View/T |
| Control presentation content | — | — | — | — | — | A/U | U approved set/X | — | — | U approved set/X | T navigation | — | — |
| Export patient data | — | — | T/X | E/A | E/X | E/X | — | — | — | — | — | — | Receive/X |
| Request permanent deletion | — | — | — | C | C | C/X | — | — | — | — | — | — | Request/X |
| Approve permanent deletion | — | U/X | — | A/X | — | — | — | — | — | — | — | — | — |
| View audit logs | R platform | R platform | R own/T | R clinic | R clinic | R own/X | R own | R own | R own | R own | — | RO/X | — |
| Request support access | — | — | — | C | C | C | — | — | — | — | — | — | — |
| Approve support access | — | — | — | A | A/X | A/X | — | — | — | — | — | — | — |
| Access subscription details | F | R/U | — | R | R | — | — | — | — | — | — | — | — |
| Change clinic plan | A | U | — | Request | Request | — | — | — | — | — | — | — | — |
| View platform usage | F | R | M operational | R clinic | R clinic | — | — | — | — | — | — | — | — |
| Configure retention settings | A policy | U policy | — | U clinic/X | U clinic/X | — | — | — | — | — | — | — | — |

The matrix defines defaults. `X` requires the specified workflow. Clinic policy may reduce access but cannot weaken tenant, platform, doctor, private-note, disclosure, export, or deletion boundaries.

## 9. Patient Record Permissions

| ID | Permission or restriction | Allowed roles | Denied roles | Conditions | Audit requirement | Stage | Acceptance criteria |
|---|---|---|---|---|---|---|---|
| PATIENT-PERM-001 | Create and update basic patient identity, contact, assignment, and registration data. | Clinic Owner, Clinic Administrator, Doctor, Clinical Assistant, Reception User | Platform roles by default, Presentation User, Patient | Active clinic membership; field-level limits apply. | Create and sensitive identity changes logged. | MVP | Each allowed role sees only permitted fields; unauthorised field changes fail even if submitted directly. |
| PATIENT-PERM-002 | Read medical history only when clinically or operationally necessary. | Doctor; Clinical Assistant; explicitly authorised Clinic Owner, Clinic Administrator, Procedure Technician, Reviewer | Reception, Report Coordinator, Presentation User, Patient except approved output | Patient and purpose in scope; masked access where sufficient. | Sensitive views logged according to policy. | MVP | Reception and presentation contexts cannot retrieve history; reviewer access is read-only and scoped. |
| PATIENT-PERM-003 | Read doctor-only notes. | Doctor; explicitly granted Read-Only Clinical Reviewer | All other roles | Reviewer grant names patients/cases and is clinically approved. | Every non-author view and all changes logged. | MVP | Notes are absent from search snippets, reports, exports, notifications, and presentation unless a separately approved internal export explicitly includes them. |

## 10. Consultation Permissions

| ID | Permission or restriction | Allowed roles | Denied roles | Conditions | Audit requirement | Stage | Acceptance criteria |
|---|---|---|---|---|---|---|---|
| CONSULT-PERM-001 | Start and prepare a consultation draft. | Doctor, Clinical Assistant; Clinic Owner/Administrator; Reception when enabled | Platform roles by default, Technician, Coordinator, Presentation, Patient | Correct patient and assigned clinic; reception cannot edit clinical sections. | Creator and status changes logged. | MVP | Draft sections enforce field-level permissions and cannot be represented as approved. |
| CONSULT-PERM-002 | Edit clinical assessment and finalise consultation content. | Doctor; Clinical Assistant for authorised drafts | Other roles | Assistant changes remain draft; finalisation requires Doctor. | Material edits, reviewer, and approval logged. | MVP | A non-doctor cannot transition the clinical consultation to doctor-approved state. |

## 11. Scan and Photography Permissions

| ID | Permission or restriction | Allowed roles | Denied roles | Conditions | Audit requirement | Stage | Acceptance criteria |
|---|---|---|---|---|---|---|---|
| SCAN-PERM-001 | Start capture, take photographs, upload scan media, review, retake, and complete capture. | Doctor, Clinical Assistant; Procedure Technician for assigned procedure media | Reception, Coordinator, Reviewer, Patient, platform roles by default | Short-lived patient/session scope; source media remains private. | Session start, pairing, uploads, deletion/retake, completion, and actor logged. | MVP | Expired or mismatched sessions cannot upload; completion accurately reflects accepted files. |
| SCAN-PERM-002 | View raw clinical images. | Doctor, Clinical Assistant; scoped Technician/Reviewer; clinic leaders only by policy | Reception, Presentation User, Patient, platform roles by default | Minimum necessary patient scope. | Sensitive raw-image access and downloads logged according to policy. | MVP | Possession of a URL or report reference cannot retrieve raw media without current permission. |

## 12. 3D Model Permissions

| ID | Permission or restriction | Allowed roles | Denied roles | Conditions | Audit requirement | Stage | Acceptance criteria |
|---|---|---|---|---|---|---|---|
| MODEL-PERM-001 | Upload, associate, review, and version a 3D model. | Doctor; Clinical Assistant for draft upload | Reception, Coordinator, Presentation User, Patient; platform roles by default | Correct clinic, patient, and session; compatibility and scale status visible. | Upload, association, replacement, and view logged. | MVP | Assistant cannot approve a model-derived clinical decision; source and version remain traceable. |
| MODEL-PERM-002 | Display a 3D view to a patient. | Doctor selects/approves; Presentation User navigates temporary session | All others without approved session | Only an approved patient-safe view; no raw metadata or private annotation. | Selection, session display, and expiry logged. | MVP | Presentation cannot open arbitrary models or switch patients. |

## 13. Measurement Permissions

| ID | Permission or restriction | Allowed roles | Denied roles | Conditions | Audit requirement | Stage | Acceptance criteria |
|---|---|---|---|---|---|---|---|
| MEASURE-PERM-001 | Draw regions and create or edit measurements. | Doctor; Clinical Assistant for draft values | All other roles | Method, units, source, calibration, and version recorded. | Each material edit and origin logged. | MVP | Assistant values remain unapproved; uncalibrated media cannot appear as exact final measurement. |
| MEASURE-PERM-002 | Approve final recipient-area measurements. | Doctor only | Every non-doctor role | Doctor has active clinic authority and reviews the exact version. | Approval, version, time, and later invalidation logged. | MVP | Direct requests from non-doctors fail; later material edits remove current approval. |

## 14. Graft Planning Permissions

| ID | Permission or restriction | Allowed roles | Denied roles | Conditions | Audit requirement | Stage | Acceptance criteria |
|---|---|---|---|---|---|---|---|
| GRAFT-PERM-001 | Enter density, calculate a preliminary graft range, and draft zone allocation. | Doctor; Clinical Assistant when explicitly enabled | Technician, Reception, Coordinator, Presentation, Reviewer, Patient | Assistant values remain draft; formula and source are visible. | Inputs, calculation version, and changes logged. | MVP | A draft cannot be labelled final or doctor-approved. |
| GRAFT-PERM-002 | Modify and approve the final graft allocation. | Doctor only | Every non-doctor role | Required areas and density complete; doctor reviews exact version. | Original, adjustment reason, approval, and supersession logged. | MVP | Only a Doctor can create valid approval; inconsistent totals block approval. |

## 15. Hairline Design Permissions

| ID | Permission or restriction | Allowed roles | Denied roles | Conditions | Audit requirement | Stage | Acceptance criteria |
|---|---|---|---|---|---|---|---|
| HAIRLINE-PERM-001 | Draw or edit a proposed hairline. | Doctor; Clinical Assistant for explicitly authorised draft | Other roles | Source image and version retained; draft clearly labelled. | Creation and material edits logged. | MVP | Source media is unchanged and assistant draft has no approval authority. |
| HAIRLINE-PERM-002 | Approve the final hairline. | Doctor only | Every non-doctor role | Doctor reviews the version included in the final surgical plan. | Approval and subsequent invalidation logged. | MVP | Any material post-approval edit requires reapproval. |

## 16. AI Suggestion Permissions

| ID | Permission or restriction | Allowed roles | Denied roles | Conditions | Audit requirement | Stage | Acceptance criteria |
|---|---|---|---|---|---|---|---|
| AI-PERM-001 | View and evaluate AI-assisted clinical suggestions. | Doctor; Clinical Assistant for preparation; Reviewer when scoped | Reception, Presentation User, Patient unless approved patient-safe explanation | Suggestion is labelled, limitations visible, manual alternative available. | Suggestion version, viewer/reviewer, disposition, and correction logged. | MVP if enabled | No suggestion silently changes an approved clinical value. |
| AI-PERM-002 | Accept, edit, reject, or replace an AI-assisted suggestion for final use. | Doctor only for final clinical use | Every non-doctor role | Doctor acts on the exact suggestion/version and final plan still requires approval. | Decision and final doctor-authored value logged. | MVP if enabled | AI cannot create a valid final approval or bypass manual controls. |

## 17. Doctor Approval Permissions

| ID | Permission or restriction | Allowed roles | Denied roles | Conditions | Audit requirement | Stage | Acceptance criteria |
|---|---|---|---|---|---|---|---|
| ROLE-001 | Approve final recipient measurements, graft plan, hairline, final surgical plan, and clinical/patient-safe report. | Doctor only | All platform, administrative, assistant, technician, reception, coordinator, presentation, reviewer, and patient roles | Doctor is active in the clinic; required content complete; exact version reviewed. | Approver, clinic, patient, item, version, time, and result logged. | MVP | Tests for every non-doctor role fail at both visible workflow and direct action levels. |
| ROLE-002 | Combined roles do not permit a user to approve their own unauthorised action outside Doctor authority. | User separately assigned Doctor may approve | Users without Doctor role | Doctor role assignment follows elevated workflow; conflicts reviewed. | Role assignment and approval linked in audit history. | MVP | Clinic Owner or Administrator without Doctor role cannot approve; removing Doctor role ends approval authority immediately. |

## 18. Procedure Record Permissions

| ID | Permission or restriction | Allowed roles | Denied roles | Conditions | Audit requirement | Stage | Acceptance criteria |
|---|---|---|---|---|---|---|---|
| PROC-PERM-001 | Record procedure details, extraction counts, follicular-unit breakdown, implanted allocation, and post-op media. | Doctor, Procedure Technician; Clinical Assistant when authorised | Reception, Coordinator, Presentation, Patient; platform roles by default | Assigned procedure; final plan visible but protected from unauthorised change. | Entry, editor, time, reconciliations, and changes from plan logged. | MVP | Technician can record actuals but cannot edit the approved hairline or plan. |
| PROC-PERM-002 | Finalise procedure record or approve correction/addendum. | Doctor only | Every non-doctor role | Totals reconciled or exception reason recorded; exact version reviewed. | Finalisation and addenda fully logged. | MVP | Technician/assistant drafts remain pending; final record cannot be silently overwritten. |

## 19. Follow-Up Permissions

| ID | Permission or restriction | Allowed roles | Denied roles | Conditions | Audit requirement | Stage | Acceptance criteria |
|---|---|---|---|---|---|---|---|
| FOLLOW-PERM-001 | Create follow-up record, capture standard images, and draft observations. | Doctor, Clinical Assistant; operational creation by Clinic Administrator/Reception if enabled | Presentation User, Patient, platform roles by default | Correct patient/procedure; non-clinical roles cannot enter doctor assessment. | Creator, captures, edits, and status logged. | MVP | Field permissions prevent operational users from editing clinical assessment. |
| FOLLOW-PERM-002 | Complete doctor assessment and approve follow-up report. | Doctor only | Every non-doctor role | Required record and images reviewed. | Assessment, approval, and later changes logged. | MVP | Only approved patient-safe follow-up content can be shared. |

## 20. Report Permissions

| ID | Permission or restriction | Allowed roles | Denied roles | Conditions | Audit requirement | Stage | Acceptance criteria |
|---|---|---|---|---|---|---|---|
| REPORT-PERM-001 | Generate internal clinical report. | Doctor; authorised assistant for draft; Clinic Owner only with clinical grant | Reception, Coordinator by default, Presentation, Patient, platform roles by default | Internal permissions evaluated for every included field. | Generation, source version, and downloads logged. | MVP | Private notes and internal content cannot appear through patient links. |
| REPORT-PERM-002 | Prepare a patient-safe report. | Doctor, Report Coordinator, Clinical Assistant when authorised | Reception, Presentation User, Patient, platform roles by default | Only approved/eligible allowlisted content; preparation creates draft. | Preparer, source versions, and changes logged. | MVP | Coordinator cannot modify clinical source decisions or approve the report. |
| REPORT-PERM-003 | Approve a patient-safe report. | Doctor only | Every non-doctor role | Doctor reviews exact version, watermark, disclaimer, and included content. | Approval and invalidation logged. | MVP | Stale, rejected, or unapproved reports cannot be shared. |
| REPORT-PERM-004 | Share an approved patient-safe report. | Doctor, Report Coordinator, Reception; Clinic Owner/Administrator; Assistant when authorised | Platform roles by default, Presentation User, Reviewer | Active approved version; permitted channel/recipient; minimum identity. | Sharer, version, channel reference, time, expiry/revocation logged. | MVP | Internal reports are never retrievable through the patient-safe link. |

## 21. Presentation Mode Permissions

| ID | Permission or restriction | Allowed roles | Denied roles | Conditions | Audit requirement | Stage | Acceptance criteria |
|---|---|---|---|---|---|---|---|
| PRESENT-PERM-001 | Create and approve presentation content. | Doctor; operational session creation by authorised clinic role after doctor approval | Presentation User, Patient, platform roles | Allowlisted doctor-approved items; one patient; short duration. | Creator, approver, selected versions, start, and expiry logged. | MVP | Session contains no contacts, private notes, staff comments, patient lists, administration, or unapproved content. |
| PRESENT-PERM-002 | Navigate an active patient-safe session. | Presentation User; Patient as viewer | All roles without session | Temporary token/session; no search, dashboard, download, export, or edit. | Open, navigation where required, close, revoke, and expiry logged. | MVP | Refresh, direct URL, back navigation, or expired credentials cannot expose internal data. |
| PRESENT-PERM-003 | Presentation access never grants source-record access. | None beyond separate clinic permissions | Presentation User and Patient specifically | Approved derivatives only; private time-limited files. | Denied source requests and abnormal access logged. | MVP | A presentation user cannot browse patients or retrieve raw source media. |

## 22. Clinic Branding and Settings Permissions

| ID | Permission or restriction | Allowed roles | Denied roles | Conditions | Audit requirement | Stage | Acceptance criteria |
|---|---|---|---|---|---|---|---|
| ADMIN-PERM-001 | Configure clinic branding, contact details, report defaults, and permitted operational settings. | Clinic Owner, Clinic Administrator; Report Coordinator for assigned report presentation settings | Other clinic roles; platform support without grant | Within platform policy; preview before activation. | Material settings and actor logged. | MVP | Changes affect only the clinic and cannot remove mandatory privacy or safety content. |
| ADMIN-PERM-002 | Configure clinic retention within platform/legal bounds. | Clinic Owner; Clinic Administrator with explicit approval | Other roles | Cannot exceed or undercut mandatory policy; changes are prospective unless approved otherwise. | Old/new values, approver, and time logged. | MVP | Invalid settings are rejected and another clinic is unaffected. |

## 23. User-Management Permissions

| ID | Permission or restriction | Allowed roles | Denied roles | Conditions | Audit requirement | Stage | Acceptance criteria |
|---|---|---|---|---|---|---|---|
| ADMIN-PERM-003 | Invite, assign allowed clinic roles, deactivate, and remove clinic users. | Clinic Owner, Clinic Administrator | All other clinic roles; platform roles except approved administrative support | Cannot grant Platform roles; Doctor assignment follows elevated approval. | Invitation, role changes, deactivation, and actor logged. | MVP | New access is scoped to the clinic; removal invalidates future access immediately. |
| ADMIN-PERM-004 | Manage Platform Administrator and Support Engineer accounts. | Platform Owner; delegated Platform Administrator within policy | All clinic roles | Privileged assignment requires strong approval and review. | Every privileged lifecycle event logged and reviewed. | MVP | Clinic users cannot self-grant or request platform authority through clinic workflows. |

## 24. Subscription and Plan Permissions

| ID | Permission or restriction | Allowed roles | Denied roles | Conditions | Audit requirement | Stage | Acceptance criteria |
|---|---|---|---|---|---|---|---|
| ADMIN-PERM-005 | View clinic plan, entitlements, usage limits, and subscription status. | Platform Owner, Platform Administrator, Clinic Owner, Clinic Administrator | Clinical/operational roles by default, Patient | Clinic roles see their clinic only; no patient payment or clinic finance records exist. | Plan views/exports logged as policy requires; changes always logged. | MVP | A clinic cannot view another clinic’s terms or usage. |
| ADMIN-PERM-006 | Change clinic plan, limits, status, or entitlements. | Platform Owner, Platform Administrator | All clinic roles; Support Engineer | Authorised commercial decision; founding PKR 30,000 onboarding and monthly offer remains pilot-stage, not universal pricing. | Old/new terms, actor, reason, effective time logged. | MVP | Clinic Owner may request but cannot directly activate unapproved entitlements. |

## 25. Audit Log Permissions

| ID | Permission or restriction | Allowed roles | Denied roles | Conditions | Audit requirement | Stage | Acceptance criteria |
|---|---|---|---|---|---|---|---|
| AUDIT-PERM-001 | View platform audit events. | Platform Owner, Platform Administrator; Support Engineer for own/support scope | Clinic roles except their tenant view | Minimum necessary; clinical content excluded from routine platform log views. | Audit-log access is itself logged. | MVP | Platform viewers cannot use logs to recover unauthorised clinical content. |
| AUDIT-PERM-002 | View clinic audit events. | Clinic Owner, Clinic Administrator; Doctor/other staff for own or authorised case scope | Other clinics, Presentation User, Patient | Tenant-scoped, role-filtered, read-only. | Searches and exports logged. | MVP | Audit users cannot modify/delete events or cross clinic boundaries. |

## 26. Data Export Permissions

| ID | Permission or restriction | Allowed roles | Denied roles | Conditions | Audit requirement | Stage | Acceptance criteria |
|---|---|---|---|---|---|---|---|
| EXPORT-PERM-001 | Request and approve clinic or patient data export. | Clinic Owner; Clinic Administrator with explicit approval; Doctor may request patient-specific clinical export | Reception, Assistant, Technician, Coordinator, Presentation, Reviewer; platform support by default | Identity verified; scope, purpose, recipient, and delivery approved; legal holds respected. | Request, approver, scope, creation, access, expiry, and result logged. | MVP | Export contains only authorised clinic data and is securely time-limited. |
| EXPORT-PERM-002 | Platform staff assist with an export only under an approved request. | Platform Administrator; Support Engineer temporarily | Platform staff without request | Clinic approval and defined operational scope; no reuse of content. | Every access and export action logged. | MVP | Staff cannot initiate a clinic clinical export for convenience or support discovery. |

## 27. Data Deletion Permissions

| ID | Permission or restriction | Allowed roles | Denied roles | Conditions | Audit requirement | Stage | Acceptance criteria |
|---|---|---|---|---|---|---|---|
| DELETE-PERM-001 | Request deletion of a patient record. | Clinic Owner, Clinic Administrator; Doctor for an authorised patient; Patient through verified clinic request | Other roles | Impact and linked records shown; retention/legal constraints checked. | Requester, reason, scope, and time logged. | MVP | Request alone does not permanently delete data. |
| DELETE-PERM-002 | Approve permanent deletion. | Clinic Owner plus required higher-authority/platform policy approval | Doctor alone, administrator alone, all lower roles, Support Engineer | Soft-delete/archive first; retention period complete; export offered/required; no hold; separation of duties. | Every stage, approver, executor, exception, and result logged. | MVP | Permanent deletion cannot occur from a single low-authority action or bypass linked-record checks. |

Deletion workflow:

1. An authorised user requests deletion.
2. The product shows impact and linked records.
3. A higher-authority user approves or rejects the request.
4. The record enters a soft-deleted or archived state.
5. The applicable retention period and any hold apply.
6. Permanent deletion follows approved policy.
7. Every stage is audit logged.
8. An export is offered or required where policy demands it.

## 28. Support Access Permissions

| ID | Permission or restriction | Allowed roles | Denied roles | Conditions | Audit requirement | Stage | Acceptance criteria |
|---|---|---|---|---|---|---|---|
| SUPPORT-PERM-001 | Request or approve temporary platform support access. | Request: Clinic Owner, Clinic Administrator, Doctor. Approve: authorised Clinic Owner/Administrator; Doctor for clinical patient scope. | Reception, Assistant, Technician, Coordinator, Presentation, Reviewer, Patient | Reason, module/patient scope, support user, duration, and permitted actions selected. | Request, approval, denial, and revocation logged. | MVP | No Support Engineer gains clinical access before an active approved grant. |
| SUPPORT-PERM-002 | Use temporary clinical support access. | Named Platform Support Engineer | All other platform users unless separately named | Minimum scope; short expiry; no approval, sharing, export, deletion, or role change unless separately authorised. | Session start, every sensitive view/action, end, expiry, and revoke logged. | MVP | Grant expires automatically, clinic can revoke immediately, and activity is attributable. |
| SUPPORT-PERM-003 | Platform staff see operational metadata without a clinical grant. | Platform Owner, Platform Administrator, Support Engineer | N/A | Data minimised; no patient images, history, private notes, plans, or reports. | Administrative actions logged. | MVP | Routine troubleshooting succeeds without default patient-content access. |

Support-access workflow:

1. The clinic requests or approves support access.
2. The authorised clinic approver selects the scope.
3. The approver selects the duration.
4. Specific patient or module access is selected where required.
5. The named support user receives temporary access.
6. All views and actions are logged.
7. Access expires automatically.
8. The clinic can revoke access immediately.

## 29. Emergency Access Rules

Break-glass emergency access is **Post-MVP only**. MVP support access must follow the normal approved temporary workflow; operational urgency does not permit silent access.

| ID | Permission or restriction | Allowed roles | Denied roles | Conditions | Audit requirement | Stage | Acceptance criteria |
|---|---|---|---|---|---|---|---|
| SUPPORT-PERM-004 | Invoke break-glass access during a defined emergency. | Specifically authorised senior platform incident role | All other roles | Reason required; tenant remains fixed; minimum scope; very short expiry; clinic leadership notified; no tenant-isolation bypass. | Real-time high-risk event plus complete access/action history and mandatory review. | Post-MVP | Access cannot cross tenants, silently extend, suppress notification, or avoid retrospective approval and incident review. |

## 30. Session and Device Rules

| ID | Permission or restriction | Allowed roles | Denied roles | Conditions | Audit requirement | Stage | Acceptance criteria |
|---|---|---|---|---|---|---|---|
| ROLE-003 | Use an authenticated clinic or platform session. | Active staff users | Deactivated, removed, expired, or suspended users | Configured absolute expiry, inactivity lock, active role and clinic context. | Authentication, expiry, revoke, and high-risk device events logged. | MVP | Role removal or deactivation blocks subsequent protected actions immediately. |
| ROLE-004 | Use scan or presentation device session. | Named capture/presentation roles | General users without session | Single clinic/patient purpose, minimum data, short expiry, revocable, no inherited dashboard access. | Pair/open, device/session, close, revoke, and expiry logged. | MVP | Session reuse, patient switching, and access after expiry fail. |
| ROLE-005 | Sensitive file access. | Users with current source-record permission or valid patient-safe session | Everyone else | Private, time-limited access; permission rechecked where required. | Downloads and abnormal denials logged according to risk. | MVP | Copying a file address does not create durable unauthorised access. |

## 31. Role Assignment Rules

| ID | Permission or restriction | Allowed roles | Denied roles | Conditions | Audit requirement | Stage | Acceptance criteria |
|---|---|---|---|---|---|---|---|
| ROLE-006 | Assign standard clinic roles. | Clinic Owner, Clinic Administrator | All other roles | Assigner cannot grant powers they are prohibited from administering; clinic scope fixed. | Assigner, target, old/new roles, reason, time logged. | MVP | Assignment takes effect immediately and never creates another clinic membership implicitly. |
| ROLE-007 | Assign Doctor or other high-risk role. | Clinic Owner with designated clinical/ownership verification; approved governance process | Clinic Administrator acting alone, all lower roles | Identity and professional/clinic authority verified; conflicts reviewed. | Elevated approval evidence and assignment logged. | MVP | A user cannot self-assign; doctor approval authority begins only after completed assignment. |
| ROLE-008 | Combine compatible role bundles. | Clinic Owner under approved policy | Users requesting incompatible elevation | Effective permissions are unioned only within immutable restrictions; separation-of-duties review required. | Combination and review outcome logged. | MVP | Clinic Owner + Doctor works only when both roles are valid; administrative seniority alone never implies Doctor. |

## 32. Role Revocation Rules

| ID | Permission or restriction | Allowed roles | Denied roles | Conditions | Audit requirement | Stage | Acceptance criteria |
|---|---|---|---|---|---|---|---|
| ROLE-009 | Revoke a clinic role or deactivate membership. | Clinic Owner, Clinic Administrator; platform administrator under approved clinic-support process | All other roles | Cannot remove the last accountable Clinic Owner without transfer/closure workflow. | Revoker, target, reason, time, session revocation logged. | MVP | New requests fail immediately; active temporary grants and sessions are revoked or re-evaluated. |
| ROLE-010 | Revoke platform privileged role. | Platform Owner; separately authorised platform governance | Clinic roles and target user acting alone | Continuity and incident policy followed. | Full privileged lifecycle logged. | MVP | Removed platform user loses administrative and support authority immediately. |

## 33. Conflict-of-Interest and Separation-of-Duties Rules

- Clinic Owner and Doctor require separate assignments; ownership never substitutes for clinical approval.
- Report preparers approve only when separately authorised as Doctor and reviewing the final version.
- Support Engineers cannot approve or extend their grant, erase its audit, or delegate it.
- A deletion requester cannot be the sole permanent-deletion approver.
- Platform plans remain separate from clinical decisions.
- Sharing cannot convert a draft into an approved report.
- Technicians cannot alter plans to reconcile actuals; Doctor review is required.
- Reviewers cannot export or redistribute.

## 34. Minimum-Privilege Defaults

New users have no access until invited into a clinic with one approved bundle; optional permissions start disabled. Support sees metadata, Reception sees basic records, Coordinators see patient-safe inputs, Presentation receives one session, Reviewers receive assigned read-only cases, and Patients receive approved output. Clinic policy may restrict access further. Commercial tiers cannot weaken fixed safety controls.

## 35. Permission Escalation Workflow

1. User requests permission, scope, purpose, and duration.
2. Risk, conflicts, and required approver are identified.
3. The approver checks minimum necessity.
4. Clinical authority, export, deletion, and support receive elevated review.
5. Access receives scope and expiry where applicable.
6. The user receives restrictions.
7. The logged change applies immediately.
8. Denial records a safe outcome.
9. High-risk access enters the next review.

No escalation may grant cross-tenant access or allow a non-doctor to approve a final clinical plan.

## 36. Temporary Access Workflow

Every temporary grant identifies user, clinic, scope, actions, purpose, approver, start, and expiry. It uses the shortest duration, prevents delegation, expires automatically, supports revocation, rechecks status, ends on deactivation/suspension, and creates an audit trail. Renewal requires new approval.

## 37. Access Review Requirements

| Review | Owner | Minimum scope | Timing |
|---|---|---|---|
| Clinic user review | Clinic Owner | Users, roles, combinations, grants | Before production and recurring |
| Doctor authority review | Clinic/clinical leadership | Active Doctors and authority | Assignment, change, recurring |
| Platform privileged review | Platform Owner | Administrators, Support, grants | Recurring and after incidents |
| Support access review | Clinic/platform leadership | Reason, scope, actions, expiry | After sensitive support |
| Export/deletion review | Clinic/policy owner | Requests, approvals, outcomes | Each event and recurring |
| Staff exit review | Responsible administrator | Sessions, membership, work | Immediately at exit |

Reviews must remove dormant, duplicate, excessive, or unexplained access.

## 38. Clinic Closure and Staff Exit Rules

Clinic closure requires authorised status, export/retention review, staff revocation, session closure, and a documented data path; it does not silently delete records.

Staff exit immediately revokes access and grants, reassigns pending work, and preserves authorship/audit. The last Clinic Owner requires a replacement or closure workflow. A departing Doctor’s prior approvals remain attributable but grant no future authority.

## 39. Acceptance Criteria

MVP acceptance requires:

1. All thirteen bundles and matrix actions have approved positive and negative tests.
2. No supported path permits cross-clinic discovery or action.
3. Interface and direct protected actions return the same authority result.
4. Only an active Doctor approves final clinical items.
5. Reception has no doctor-note or planning access.
6. Assistants and Technicians cannot final-approve.
7. Coordinators cannot change clinical decisions or share drafts.
8. Presentation cannot browse, search, download, export, edit, or escape its session.
9. Support has no default clinical access; grants expire, revoke, and audit correctly.
10. File access is private and time-limited.
11. Role changes and deactivation apply immediately.
12. Export and deletion use elevated approval and audit.
13. Patient-safe links never expose internal reports.
14. Combined roles preserve fixed boundaries.
15. Break-glass remains disabled Post-MVP scope.
16. Product, clinical, privacy/security, and clinic reviewers approve high-risk permissions.

## 40. Open Decisions

1. Who verifies and approves Doctor assignments?
2. Does Clinic Owner include medical-history access?
3. Which planning fields may Assistants draft?
4. Which procedure fields belong to Assistants versus Technicians?
5. May Reception start a consultation shell?
6. Which fields may Report Coordinators use?
7. May Reviewers see doctor-only notes, and with whose approval?
8. Who approves operational versus patient-specific support access?
9. What are maximum support and presentation durations?
10. Does patient export also require Doctor approval?
11. Who provides higher approval for permanent deletion?
12. Which retention settings may Pakistan clinics change?
13. What access-review intervals apply?
14. Which events require real-time notification?
15. Which roles require MFA?
16. How is temporary staff coverage limited?
17. When is second-doctor report review required?
18. Which metadata is sufficient for support?

## 41. Approval Checklist

The PRD, this role-permission specification, `USER_FLOWS.md`, and `SYSTEM_ARCHITECTURE.md` consistently use the thirteen-role model. Remaining decisions concern permission boundaries, role verification, combined roles, support duration, separation of duties, and visibility—not the number of roles.

- [ ] Haris Liaqat approves the thirteen-role model.
- [ ] Dr Sheraz approves doctor-only authority.
- [ ] FACE Aesthetic Clinic Lahore validates clinic defaults.
- [ ] Platform role separation is approved.
- [ ] Clinic governance separation is approved.
- [ ] Operational and restricted-role boundaries are approved.
- [ ] The action matrix is approved.
- [ ] High-risk workflows are approved.
- [ ] Pakistan launch privacy/security review confirms the minimum controls.
- [ ] Open decisions have owners.
- [ ] Remaining permission and policy decisions have owners and do not change the aligned thirteen-role model.
- [ ] This document is authorised for use by the next planning stage.

## MVP Role Bundle Summary

| Role | Default MVP bundle |
|---|---|
| Platform Owner | Platform control and governance; metadata by default |
| Platform Administrator | Clinics, status, plans, limits, entitlements, settings |
| Platform Support Engineer | Diagnostics; temporary approved scope only |
| Clinic Owner | Clinic administration and data requests; Doctor is separate |
| Clinic Administrator | Users and operations; no final clinical authority |
| Doctor | Full authorised clinical work and final approval |
| Clinical Assistant | Preparation, capture, upload, drafts; no approval |
| Procedure Technician | Assigned procedure data/media; no plan approval |
| Reception User | Basic registration/status and approved sharing |
| Report Coordinator | Patient-safe drafts and approved sharing |
| Presentation User | One temporary patient-safe session |
| Read-Only Clinical Reviewer | Assigned read-only cases |
| Patient | Approved output only; no dashboard |

## High-Risk Permission Checklist

- [ ] All role combinations preserve tenant isolation.
- [ ] Non-doctors cannot final-approve.
- [ ] Doctor notes stay out of non-clinical contexts.
- [ ] Raw media requires clinical permission.
- [ ] Support grants approve, scope, expire, revoke, and audit.
- [ ] Presentation has one patient and no dashboard escape.
- [ ] Only approved patient-safe reports are shared.
- [ ] Patient links never expose internal reports.
- [ ] Export approves, secures, expires, and audits.
- [ ] Deletion uses elevated approval and retention.
- [ ] Role removal revokes immediately.
- [ ] Sensitive files never become public.
- [ ] Combined roles receive conflict review.
- [ ] Break-glass remains Post-MVP and tenant-bound.

## Unresolved Permission Decisions

Section 40 requires product, clinical, security, or clinic approval. Until resolved, use minimum privilege: no optional clinical visibility, assistant final authority, reviewer access to doctor notes, unapproved clinical support access, or permanent deletion.

## Role-Permission Approval Checklist

- [ ] Roles and domains have owners.
- [ ] Allowed and denied roles are approved.
- [ ] Defaults implement least privilege.
- [ ] Doctor-only authority is fixed.
- [ ] Tenant scope precedes role checks.
- [ ] Platform roles lack default clinical access.
- [ ] Patient-safe allowlists are approved.
- [ ] Sensitive-action audit coverage is approved.
- [ ] Access lifecycle is approved.
- [ ] High-risk workflows have approvers.
- [ ] Open decisions use approved or safer defaults.
- [ ] Product Owner signs off.
- [ ] Clinical approver signs off.
- [ ] Privacy/security reviewer signs off.

## Recommended Next Document

After this role-permission specification is approved, the recommended next document is `docs/USER_FLOWS.md`. It should translate these permissions into role-specific journeys, denied states, approval hand-offs, support access, presentation, export, deletion, and recovery flows without changing the boundaries defined here.

# GraftVision Product Principles

## 1. Document Information

| Field | Value |
|---|---|
| Product | GraftVision |
| Document | Product Principles |
| Version | 1.0 Draft |
| Status | Proposed for product-owner and clinical approval |
| Product owner | Haris Liaqat |
| Initial clinical approver | Dr Sheraz |
| Initial validation clinic | FACE Aesthetic Clinic Lahore |
| Initial launch market | Pakistan |
| Commercial context | Manually sold multi-tenant SaaS; founding offer of PKR 30,000 onboarding and PKR 30,000 monthly |

This document defines enduring behaviour, not architecture, data, APIs, interfaces, or delivery tasks.

## 2. Purpose

Product principles guide failure, uncertainty, conflict, and commercial pressure. A principle states enduring behaviour; a functional requirement states a release capability or outcome.

They apply across product, clinical, design, engineering, security, privacy, support, and commercial decisions without replacing clinical judgement or formal review.

## 3. Relationship to PRD, Vision, and Role Permissions

- `PRD.md` defines scope, priorities, and acceptance.
- `VISION.md` defines purpose and intended experience.
- `ROLE_PERMISSIONS.md` defines who may perform sensitive actions.
- This document defines behaviour under uncertainty, interruption, dispute, change, or commercial pressure.

Inconsistency requires product, clinical, privacy, or security review; principles cannot silently weaken requirements or permissions.

## 4. Core Product Philosophy

| ID | Principle | Why it exists | Required product behaviour | Prohibited behaviour | Relevance | Acceptance criteria |
|---|---|---|---|---|---|---|
| CORE-PRINCIPLE-001 | Preserve the complete patient journey. | Hair restoration develops across consultation, procedure, and follow-up. | Connect every stage while preserving its date, context, author, and status. | Treating a scan or report as the entire product. | MVP | A returning patient’s earlier records remain understandable and linked. |
| CORE-PRINCIPLE-003 | MVP value must exist before advanced AI or 3D. | Clinics need reliable workflows now. | Deliver secure history, standard capture, manual planning, approval, reports, procedures, and follow-up first. | Making MVP completion depend on advanced automation. | MVP | The complete core journey works with AI and automatic 3D disabled. |

## 5. Clinical Safety Principles

| ID | Principle | Why it exists | Required product behaviour | Prohibited behaviour | Relevance | Acceptance criteria |
|---|---|---|---|---|---|---|
| CLINICAL-PRINCIPLE-001 | Clinical claims cannot exceed validated evidence. | Unsupported confidence can mislead doctors and patients. | State uncertainty, supported use, limitations, and review status. | Guaranteed accuracy, graft survival, donor area capacity, follicle counts, or results without suitable evidence. | MVP and Post-MVP | Product wording passes clinical review and contains no unsupported guarantee. |
| CLINICAL-PRINCIPLE-002 | Illustrative simulation is not prediction. | A visual aid can be mistaken for an outcome. | Label visualisations as an “illustrative simulation” or approved equivalent and explain limits. | Presenting a simulated hairline or appearance as guaranteed. | MVP | The label remains visible wherever the simulation is displayed or reported. |

## 6. Doctor-Control Principles

| ID | Principle | Why it exists | Required product behaviour | Prohibited behaviour | Relevance | Acceptance criteria |
|---|---|---|---|---|---|---|
| DOCTOR-PRINCIPLE-001 | Doctor-approved, never AI-finalised. | Final clinical responsibility belongs to an authorised Doctor. | Record approving Doctor, time, clinic, patient, item, and version. | AI or a non-doctor approving diagnosis, graft allocation, hairline, final surgical plan, or patient report. | MVP | Every final clinical state has a valid Doctor approval record. |
| DOCTOR-PRINCIPLE-002 | Doctor correction always takes precedence. | Suggestions and calculations may be incomplete or unsuitable. | Allow manual region, measurement, density, allocation, and hairline changes with reason and version. | Locking a Doctor into an automated result. | MVP | A Doctor can reject all suggestions and still complete the workflow. |

## 7. AI-Assistance Principles

| ID | Principle | Why it exists | Required product behaviour | Prohibited behaviour | Relevance | Acceptance criteria |
|---|---|---|---|---|---|---|
| AI-PRINCIPLE-001 | AI may suggest, highlight, rank, estimate, detect, compare, or warn. | Assistance can improve consistency without transferring authority. | Label AI-assisted output, show limitations, and provide accept/edit/reject controls. | Autonomous diagnosis, approval, final allocation, final hairline, report approval, or outcome guarantee. | MVP if enabled; Post-MVP | No AI action can create a final clinical approval. |
| AI-PRINCIPLE-003 | Clinical correction is valuable evidence. | Doctor disagreement informs safety and quality. | Preserve original suggestion, confidence when available, Doctor correction, Doctor identity, time, and final value. | Silently replacing the source suggestion. | MVP if AI enabled | Evaluation can reconstruct suggestion and disposition without changing the clinical record. |

## 8. Manual-Fallback Principles

| ID | Principle | Why it exists | Required product behaviour | Prohibited behaviour | Relevance | Acceptance criteria |
|---|---|---|---|---|---|---|
| FALLBACK-PRINCIPLE-001 | AI failure reduces convenience, not clinical utility. | External or advanced services can fail. | Preserve manual region marking, measurement entry, density selection, graft adjustment, hairline editing, and report approval. | Blocking consultation because AI is unavailable. | MVP | All critical workflows pass with AI disabled. |
| FALLBACK-PRINCIPLE-002 | 3D failure must fall back to supported 2D/manual work. | Reconstruction is not guaranteed. | Preserve source images and allow manual planning with clear limitations. | Treating a failed 3D job as lost consultation data. | MVP | A failed model does not prevent final surgical plan preparation. |

## 9. Measurement and Accuracy Principles

| ID | Principle | Why it exists | Required product behaviour | Prohibited behaviour | Relevance | Acceptance criteria |
|---|---|---|---|---|---|---|
| MEASURE-PRINCIPLE-001 | Never fabricate precision. | Image scale and quality may be inadequate. | Use ranges, preliminary labels, recapture, or Doctor-entered values; avoid unsupported decimals. | Confident cm² values without reliable scale or confirmation. | MVP | Unconfirmed scale cannot produce an exact final physical measurement. |
| MEASURE-PRINCIPLE-002 | Measurement provenance is part of the value. | Numbers require context. | Preserve source media/model, calibration, method, units, precision, author, and version. | Showing an unexplained area or graft value. | MVP | An authorised reviewer can reproduce or explain the displayed value. |
| MEASURE-PRINCIPLE-003 | Preliminary and final values remain separate. | Hair-present consultation and shaved assessment differ. | Preserve preliminary graft range, surgery-day measurement, planned, extracted, usable, and implanted grafts independently. | Silently overwriting one value with another. | MVP | The timeline shows each value and its clinical stage. |

## 10. 3D Model Principles

| ID | Principle | Why it exists | Required product behaviour | Prohibited behaviour | Relevance | Acceptance criteria |
|---|---|---|---|---|---|---|
| MODEL-PRINCIPLE-002 | Model failure preserves source evidence. | Reconstruction may fail or load incorrectly. | Keep source images, failure status, retry option, and manual fallback. | Replacing source captures with an unusable derived model. | MVP | A model failure can be retried without duplicating or losing source records. |

## 11. Photography and Capture Principles

| ID | Principle | Why it exists | Required product behaviour | Prohibited behaviour | Relevance | Acceptance criteria |
|---|---|---|---|---|---|---|
| CAPTURE-PRINCIPLE-001 | Standardisation before automation. | Consistent inputs create clinical value. | Guide angle, distance, lighting, hair condition, position, background, and completeness before automating interpretation. | Using automation to conceal inconsistent capture. | MVP | Required views and conditions are visible and completeness is explicit. |
| CAPTURE-PRINCIPLE-002 | Source images are immutable evidence. | Crops and annotations may change. | Preserve source separately from derived, annotated, report, and presentation variants. | Destructively editing the only source image. | MVP | Every derivative identifies its source. |
| CAPTURE-PRINCIPLE-003 | Incomplete or poor capture remains honest. | A weak image may reduce reliability. | Request retake, allow justified continuation, and record quality limitations. | Marking an incomplete scan complete or hiding poor quality. | MVP | Completion and limitation states reflect accepted files accurately. |

## 12. Patient-Lifecycle Principles

| ID | Principle | Why it exists | Required product behaviour | Prohibited behaviour | Relevance | Acceptance criteria |
|---|---|---|---|---|---|---|
| LIFECYCLE-PRINCIPLE-001 | Patient journey, not one-time scanning. | Clinical value accumulates across time. | Connect registration, consultation, surgery day, procedure, post-op, follow-up, and reports. | Creating disconnected records for each encounter by default. | MVP | A patient timeline links every authorised stage. |
| LIFECYCLE-PRINCIPLE-002 | Multiple consultations and procedures remain distinct. | A patient may return or undergo another procedure. | Create new linked episodes without erasing earlier plans or outcomes. | Reusing old approval for a new procedure. | MVP | Each episode has its own dates, source records, plan, approval, and procedure. |

## 13. Longitudinal Record Principles

| ID | Principle | Why it exists | Required product behaviour | Prohibited behaviour | Relevance | Acceptance criteria |
|---|---|---|---|---|---|---|
| LIFECYCLE-PRINCIPLE-003 | The past remains interpretable years later. | Long-term follow-up is central to the product. | Preserve terminology, versions, source context, approval, and capture conditions. | Replacing past state with the latest record. | MVP | A returning patient’s history can be understood without relying on staff memory. |
| LIFECYCLE-PRINCIPLE-004 | Comparison quality depends on capture consistency. | Differences may reflect technique rather than clinical change. | Guide repeated angle, distance, lighting, hair condition, position, and background; flag mismatches. | Presenting unmatched photos as equally reliable. | MVP | Comparison identifies material capture differences and reduced reliability. |

## 14. Data-Integrity Principles

| ID | Principle | Why it exists | Required product behaviour | Prohibited behaviour | Relevance | Acceptance criteria |
|---|---|---|---|---|---|---|
| DATA-PRINCIPLE-001 | No destructive editing of approved history. | Clinical history must remain traceable. | Use new versions, amendments, corrections, and superseded status. | Silent overwrite of approved records. | MVP | Prior approved versions remain retrievable to authorised users. |
| DATA-PRINCIPLE-002 | Errors never cross patient boundaries. | Retry, caches, sessions, or links can misassociate data. | Bind every operation to verified clinic, patient, and session context. | Showing or attaching one patient’s data to another. | MVP | Negative tests cover retries, URLs, caches, reuse, and delayed jobs. |
| DATA-PRINCIPLE-003 | Reconciliation exposes differences. | Planned, extracted, usable, and implanted counts may differ. | Display each value, validate totals, and require explanation/Doctor review. | Changing the plan to conceal actual differences. | MVP | A procedure can finalise only with balanced totals or approved explanation. |

## 15. Multi-Tenant Principles

| ID | Principle | Why it exists | Required product behaviour | Prohibited behaviour | Relevance | Acceptance criteria |
|---|---|---|---|---|---|---|
| TENANT-PRINCIPLE-001 | Tenant isolation is absolute. | Clinics entrust private patient and operational data. | Scope patients, users, images, models, reports, settings, files, and audit data to an authorised clinic. | Cross-clinic discovery or access through any interface, job, file, export, or support path. | MVP | Clinic A cannot access or infer clinic B data. |

## 16. Privacy-by-Design Principles

| ID | Principle | Why it exists | Required product behaviour | Prohibited behaviour | Relevance | Acceptance criteria |
|---|---|---|---|---|---|---|
| PRIVACY-PRINCIPLE-001 | Clinical information is private by default. | Hidden controls do not enforce privacy. | Authorise reading, editing, approval, sharing, export, presentation, and deletion independently. | Relying on hidden buttons or guessed URLs for security. | MVP | Direct unauthorised actions fail even when interface controls are bypassed. |

## 17. Presentation-Safety Principles

| ID | Principle | Why it exists | Required product behaviour | Prohibited behaviour | Relevance | Acceptance criteria |
|---|---|---|---|---|---|---|
| PRESENT-PRINCIPLE-001 | Presentation is a separate product surface. | Mirroring the dashboard risks exposure. | Show one patient’s approved content in a temporary session. | Dashboard, patient lists, contacts, private notes, warnings, staff comments, audit, subscriptions, or administration. | MVP | Presentation cannot browse, search, download, export, edit, or escape its session. |

## 18. Report and Disclosure Principles

| ID | Principle | Why it exists | Required product behaviour | Prohibited behaviour | Relevance | Acceptance criteria |
|---|---|---|---|---|---|---|
| REPORT-PRINCIPLE-001 | Reports are controlled disclosures. | Generation, approval, download, and sharing have different risks. | Authorise each action separately; version, watermark, trace, and protect patient-safe output. | Treating generation as approval or approval as public sharing. | MVP | Only the active approved patient-safe version can be newly shared. |
| REPORT-PRINCIPLE-002 | Internal and patient-safe reports remain distinct. | Internal content may harm privacy if exposed. | Build patient-safe reports from an approved allowlist. | Hiding fields from an internal report and calling it patient-safe. | MVP | Patient links cannot retrieve internal reports or doctor-only notes. |
| REPORT-PRINCIPLE-003 | Corrected shared reports remain historically traceable. | Recipients may possess an older version. | Supersede the old version, approve the correction, record sharing, and support notification/revocation policy. | Silently replacing a shared report. | MVP | The clinic can identify who received each version and which is current. |

## 19. Approval and Versioning Principles

| ID | Principle | Why it exists | Required product behaviour | Prohibited behaviour | Relevance | Acceptance criteria |
|---|---|---|---|---|---|---|
| VERSION-PRINCIPLE-001 | Approval belongs to an exact version. | Content may change after review. | Bind approval to content version and invalidate on material edit. | Moving approval to changed content. | MVP | Audit can reconstruct the exact approved version. |
| VERSION-PRINCIPLE-002 | Preliminary and final plans coexist. | Consultation and surgery-day evidence differ. | Preserve hair-present estimate, shaved assessment, preliminary graft range, and final surgical plan. | Making a later plan erase the earlier clinical context. | MVP | Each plan has distinct status, source, Doctor, and time. |

## 20. Failure-Recovery Principles

| ID | Principle | Why it exists | Required product behaviour | Prohibited behaviour | Relevance | Acceptance criteria |
|---|---|---|---|---|---|---|
| RECOVERY-PRINCIPLE-001 | Safe recovery over silent failure. | False completion can corrupt clinical work. | State what succeeded, failed, was saved, must retry, may duplicate, and can continue manually. | Claiming success before durable confirmation. | MVP | Failure tests produce accurate, actionable, non-sensitive status. |
| RECOVERY-PRINCIPLE-002 | Retry must be idempotent or visibly reconciled. | Repeated actions can duplicate files or records. | Detect accepted work and reuse or de-duplicate safely. | Creating silent duplicate patients, uploads, reports, or approvals. | MVP | Repeating an interrupted action yields one canonical outcome. |
| RECOVERY-PRINCIPLE-003 | Incomplete work can span sessions. | Clinical workflows may not finish at once. | Save attributable drafts and show missing work on return. | Marking a draft complete or losing confirmed work. | MVP | A later authorised session resumes from the last confirmed state. |

## 21. Offline and Connectivity Principles

| ID | Principle | Why it exists | Required product behaviour | Prohibited behaviour | Relevance | Acceptance criteria |
|---|---|---|---|---|---|---|
| OFFLINE-PRINCIPLE-001 | Connectivity loss creates an explicit degraded state. | Phone, laptop, or clinic internet may disconnect. | Show local/pending/confirmed items, prevent false completion, and provide retry/manual continuation. | Implying synchronisation without confirmation. | MVP | Disconnect tests identify exactly which items reached the patient record. |
| OFFLINE-PRINCIPLE-002 | Local drafts are temporary and patient-bound. | Incomplete device data can create privacy risk. | Protect, identify, expire, reconcile, or safely discard local drafts. | Reusing a local draft for another patient. | MVP | Local recovery cannot cross clinic or patient boundaries. |

## 22. Concurrent-Editing Principles

| ID | Principle | Why it exists | Required product behaviour | Prohibited behaviour | Relevance | Acceptance criteria |
|---|---|---|---|---|---|---|
| CONCURRENCY-PRINCIPLE-001 | Conflicting edits must be visible. | Two users may change one consultation. | Detect stale versions, preserve both drafts where needed, and require deliberate reconciliation. | Last-write-wins overwrite of clinical work without warning. | MVP | A stale save cannot silently replace a newer clinical version. |

## 23. Auditability Principles

| ID | Principle | Why it exists | Required product behaviour | Prohibited behaviour | Relevance | Acceptance criteria |
|---|---|---|---|---|---|---|
| AUDIT-PRINCIPLE-001 | Sensitive actions remain attributable. | Trust requires reconstruction of decisions and disclosure. | Log actor, clinic, action, target, time, result, version, and relevant grant/session. | Unlogged approval, export, deletion, support access, share, or role change. | MVP | Approved audit tests reconstruct each high-risk event. |

## 24. Data Portability Principles

| ID | Principle | Why it exists | Required product behaviour | Prohibited behaviour | Relevance | Acceptance criteria |
|---|---|---|---|---|---|---|
| PORTABILITY-PRINCIPLE-001 | Clinic data is portable; software remains GraftVision property. | Clinics own their patient and clinic data. | Provide authorised, secure, traceable exports of supported clinic data. | Exporting source code, proprietary algorithms, architecture, internal tools, or another clinic’s configuration. | MVP | Export scope is verified, clinic-bound, time-limited, and logged. |

## 25. Deletion and Retention Principles

| ID | Principle | Why it exists | Required product behaviour | Prohibited behaviour | Relevance | Acceptance criteria |
|---|---|---|---|---|---|---|
| DELETE-PRINCIPLE-001 | Recoverable state precedes permanent deletion. | Accidental deletion and retention obligations exist. | Archive/soft-delete first, show impact, apply retention/hold, and require elevated approval. | Immediate irreversible deletion by an ordinary user. | MVP | Accidental archive can be restored before permanent-deletion conditions complete. |
| DELETE-PRINCIPLE-002 | Closure or inactive subscription does not silently erase data. | Commercial state and clinical retention are different. | Restrict normal access according to policy while preserving export, retention, and closure workflow. | Using subscription expiry as automatic deletion. | MVP | Inactive clinics follow documented access and data disposition states. |

## 26. Clinic Customisation Principles

| ID | Principle | Why it exists | Required product behaviour | Prohibited behaviour | Relevance | Acceptance criteria |
|---|---|---|---|---|---|---|
| CUSTOM-PRINCIPLE-001 | Configuration is bounded. | Clinics need fit without unmaintainable divergence. | Configure branding, Doctor profiles, report layout, modules, capture protocols, wording, and limits within policy. | Weakening safety/privacy or creating uncontrolled behaviour. | MVP and Post-MVP | Configuration remains tenant-scoped and compatible with shared upgrades. |

## 27. SaaS Product Consistency Principles

| ID | Principle | Why it exists | Required product behaviour | Prohibited behaviour | Relevance | Acceptance criteria |
|---|---|---|---|---|---|---|
| SAAS-PRINCIPLE-001 | One shared product serves isolated clinics. | Shared improvement is the SaaS advantage. | Apply common safety, privacy, data, and lifecycle semantics across tiers. | Separate clinic codebases or weaker privacy on lower plans. | MVP | All clinics receive the GraftVision Standard. |

## 28. Design and Usability Principles

| ID | Principle | Why it exists | Required product behaviour | Prohibited behaviour | Relevance | Acceptance criteria |
|---|---|---|---|---|---|---|
| DESIGN-PRINCIPLE-001 | Calm clarity over cognitive load. | Clinical consultation requires attention and confidence. | Show current patient, stage, status, source, limitation, and next action clearly. | Decorative complexity that obscures clinical state. | MVP | Users can identify saved, draft, failed, approved, and stale states. |

## 29. Accessibility Principles

| ID | Principle | Why it exists | Required product behaviour | Prohibited behaviour | Relevance | Acceptance criteria |
|---|---|---|---|---|---|---|
| ACCESS-PRINCIPLE-001 | Core workflows are perceivable and operable. | Access needs vary among clinic staff and patients. | Use readable text, contrast, keyboard support, semantics, and non-colour status cues. | Making clinical status depend only on colour or fine pointer control. | MVP | Core workflows meet the approved accessibility target. |

## 30. Performance Principles

| ID | Principle | Why it exists | Required product behaviour | Prohibited behaviour | Relevance | Acceptance criteria |
|---|---|---|---|---|---|---|
| PERF-PRINCIPLE-001 | Slow work remains visibly in progress. | Media and reports may take time. | Show queued/running/delayed/failed/completed status and safe retry. | Freezing, duplicate submission, or false completion. | MVP | Delayed jobs preserve source version and progress state. |

## 31. Device-Compatibility Principles

| ID | Principle | Why it exists | Required product behaviour | Prohibited behaviour | Relevance | Acceptance criteria |
|---|---|---|---|---|---|---|
| DEVICE-PRINCIPLE-001 | MVP works on approved ordinary devices. | Special hardware would limit adoption. | Support defined modern laptop, phone, and LED browser capabilities with clear checks. | Requiring native apps, LiDAR, or automatic 3D for core value. | MVP | Supported-device tests complete the manual journey. |

## 32. Support-Access Principles

| ID | Principle | Why it exists | Required product behaviour | Prohibited behaviour | Relevance | Acceptance criteria |
|---|---|---|---|---|---|---|
| SUPPORT-PRINCIPLE-001 | Platform support sees metadata first. | Most diagnosis should not require clinical content. | Prefer clinic status, user counts, storage, errors, jobs, logs, and feature configuration. | Default access to patient images, notes, plans, or reports. | MVP | Support can inspect operational health without patient content. |
| SUPPORT-PRINCIPLE-002 | Clinical support access is explicit and temporary. | Exceptional access requires clinic control. | Require clinic approval, reason, named user, scope, duration, audit, expiry, and revoke. | Broad, standing, self-approved, or cross-tenant access. | MVP | Access ends automatically and every sensitive action is attributable. |

## 33. Commercial Product Principles

| ID | Principle | Why it exists | Required product behaviour | Prohibited behaviour | Relevance | Acceptance criteria |
|---|---|---|---|---|---|---|
| COMMERCIAL-PRINCIPLE-001 | Commercial state does not redefine clinical truth. | Plans and subscriptions are separate from patient care. | Preserve clinical history, export, retention, and approved closure rules when subscription changes. | Altering clinical records because a plan ends. | MVP | Inactive subscription follows a documented, non-destructive state. |
| COMMERCIAL-PRINCIPLE-003 | Patient finance stays outside the product. | GraftVision is a clinical workflow platform. | Keep patient payments and clinic financial management excluded. | Expanding clinical records into accounting without an approved scope decision. | MVP | No core workflow requires patient-payment data. |

## 34. Feature Prioritisation Principles

| ID | Principle | Why it exists | Required product behaviour | Prohibited behaviour | Relevance | Acceptance criteria |
|---|---|---|---|---|---|---|
| DECISION-PRINCIPLE-001 | Prioritise clinical workflow and measurable value. | Novelty can distract from core problems. | Prefer consultation, planning, documentation, procedure, follow-up, privacy, and recovery improvements. | Prioritising spectacle without validated benefit. | MVP and Post-MVP | Each feature names user value and success evidence. |
| DECISION-PRINCIPLE-002 | Safety and shared-product fit are gates. | A feature may help one clinic while harming others. | Require Doctor control, privacy, isolation, fallback, audit, portability, and no fork. | Approving a feature that fails a non-negotiable gate. | MVP and Post-MVP | Decision record shows every gate and review outcome. |

## 35. Product Decision Framework

Every proposed feature is assessed against:

1. Does it improve consultation, planning, documentation, procedure records, or follow-up?
2. Does it preserve Doctor control?
3. Does it protect patient privacy?
4. Does it maintain tenant isolation?
5. Does it work across clinics without a code fork?
6. Does it have a safe manual fallback?
7. Does it create measurable value beyond visual novelty?
8. Does it avoid unsupported clinical claims?
9. Can it be audited?
10. Can clinics export the resulting patient data?
11. Can the workflow recover if the feature fails?
12. Does it belong in GraftVision or an external integration?

| Outcome | Use when |
|---|---|
| Approve | All mandatory gates pass and value is clear |
| Approve for pilot | Value is plausible but operational evidence is needed |
| Defer | Valuable, but timing, dependencies, or readiness are insufficient |
| Require clinical validation | Clinical safety, accuracy, or claims need evidence |
| Require privacy review | Data use or disclosure needs formal review |
| Require security review | Threat, access, storage, or integration risk is unresolved |
| Build as external integration | Capability is valuable but not a core platform responsibility |
| Reject | It fails a non-negotiable principle or lacks meaningful value |

Doctor control, isolation, privacy, and claim boundaries cannot be traded for revenue or speed.

## 36. Product Behaviour Scenarios

| Scenario ID | Situation | Expected behaviour | User message or status | Manual fallback | Data preserved | Audit | Recovery condition | Stage |
|---|---|---|---|---|---|---|---|---|
| SCENARIO-001 | AI unavailable | Skip AI; keep workflow usable. | “AI assistance unavailable; continue manually.” | Manual regions, measures, density, grafts, hairline, approval | Draft and inputs | Outage/job status | Manual completion or service retry | MVP |
| SCENARIO-002 | AI low confidence | Show uncertainty; require review. | “Low confidence—confirm or recapture.” | Doctor edit/replace | Suggestion, confidence, input | Review/disposition | Doctor confirmation or recapture | MVP if AI |
| SCENARIO-003 | Doctor rejects AI | Use Doctor decision. | “Suggestion rejected.” | Fully manual value | Original, correction, Doctor, time | Rejection | Doctor-approved manual result | MVP if AI |
| SCENARIO-004 | 3D reconstruction fails | Keep sources; mark failure. | “3D processing failed; images are safe.” | 2D/manual planning | Images, job, error | Job failure/retry | Manual completion or successful retry | MVP |
| SCENARIO-005 | 3D model loads incorrectly | Stop clinical use of model version. | “Model unavailable or incompatible.” | Source images/other version | Model/source/version | Load failure | Valid model or manual continuation | MVP |
| SCENARIO-006 | Scale unconfirmed | Do not show exact final cm². | “Physical scale not confirmed.” | Doctor entry or recapture/calibration | Source and scale status | Override/confirmation | Reliable scale or Doctor-confirmed value | MVP |
| SCENARIO-007 | Camera permission denied | Explain permission/device path. | “Camera access is required for capture.” | Upload approved existing image or another device | Session context | Permission denial | Permission granted or alternate capture | MVP |
| SCENARIO-008 | Internet disconnects during capture | Distinguish local, pending, confirmed. | “Offline—uploads paused.” | Continue permitted local capture or document manually | Local draft and confirmed uploads | Disconnect/reconnect | Reconcile same patient session | MVP |
| SCENARIO-009 | Upload stops halfway | Show item-level failure; retry safely. | “Upload incomplete—retry this image.” | Retake/manual upload | Accepted bytes/status/source | Failure/retry | One confirmed canonical file | MVP |
| SCENARIO-010 | Duplicate upload | Detect and reconcile. | “Duplicate detected.” | Select canonical item | Both references until resolved | De-duplication | One retained source with history | MVP |
| SCENARIO-011 | Laptop loses live session | Preserve phone session and confirmed media. | “Live view disconnected.” | Reopen same session or review later | Session, progress, files | Disconnect/rejoin | Correct authorised workstation reconnects | MVP |
| SCENARIO-012 | LED disconnects | Clear/suspend sensitive display. | “Presentation disconnected.” | Continue discussion on authorised device | Approved selection and session | Disconnect | Valid session reconnects | MVP |
| SCENARIO-013 | Presentation expires | Remove content and require new session. | “Session expired.” | Doctor creates new approved session | Prior session audit | Expiry | New authorised session | MVP |
| SCENARIO-014 | Wrong patient opened | Block use and require confirmation. | “Patient/session mismatch.” | Close and open correct record | Both records unchanged | High-risk denial | Correct clinic/patient verified | MVP |
| SCENARIO-015 | Scan incomplete | Keep draft; list missing views. | “Capture incomplete.” | Justified manual continuation or recapture | Accepted images/conditions | Status change | Required set complete or exception approved | MVP |
| SCENARIO-016 | Poor image quality | Warn and avoid reliable-analysis claim. | “Image quality may reduce reliability.” | Retake or Doctor review | Source and quality note | Warning/disposition | Better image or documented acceptance | MVP |
| SCENARIO-017 | Follow-up angle mismatch | Flag reduced comparison reliability. | “Capture conditions differ.” | Side-by-side with limitation or recapture | Both originals/conditions | Comparison limitation | Matched recapture or acknowledged limit | MVP |
| SCENARIO-018 | Concurrent consultation edits | Detect stale version; reconcile. | “A newer version exists.” | Merge/re-enter selected changes | Both drafts/authors | Conflict/resolution | One deliberate new version | MVP |
| SCENARIO-019 | Approved graft plan updated | Create draft and invalidate approval. | “Plan changed—reapproval required.” | Doctor reviews new version | Old/new plans and approval | Change/reapproval | New Doctor approval | MVP |
| SCENARIO-020 | Shared report corrected | Supersede, regenerate, reapprove, trace recipients. | “A corrected version is available.” | Clinic contacts recipient manually | All report/share versions | Correction/share/revoke | Corrected approved version shared | MVP |
| SCENARIO-021 | Staff loses access mid-session | Block subsequent actions immediately. | “Access changed; sign in or contact administrator.” | Another authorised user continues | Confirmed work/audit | Revocation/denials | Valid reassignment | MVP |
| SCENARIO-022 | Temporary support requested | Use scoped approval workflow. | “Support access pending approval.” | Metadata-only diagnosis | Request/scope/reason | Full grant lifecycle | Approved named temporary grant | MVP |
| SCENARIO-023 | Support grant expires | End clinical access automatically. | “Support access expired.” | New request if needed | Actions and expiry | Expiry/denials | New approval | MVP |
| SCENARIO-024 | Subscription inactive | Restrict normal use per policy; preserve data. | “Clinic subscription inactive.” | Contact platform; authorised export/closure | All clinic records | Status/access | Reactivation or closure process | MVP |
| SCENARIO-025 | Clinic requests export | Verify, approve, generate securely. | “Export requested/in progress/ready.” | Assisted export process | Scope/manifest/files | Full export lifecycle | Secure retrieval or expiry | MVP |
| SCENARIO-026 | Patient accidentally archived | Keep recoverable state. | “Record archived.” | Authorised restore | Complete record/history | Archive/restore | Verified restoration | MVP |
| SCENARIO-027 | Permanent deletion requested | Show impact; require elevated approval and retention. | “Deletion pending review.” | Archive/hold/export | Request, links, approvals | Every deletion stage | Policy-complete deletion or rejection | MVP |
| SCENARIO-028 | Report generation fails | Preserve source version; retry. | “Report generation failed.” | Manual approved communication if policy allows | Source/version/job | Failure/retry | Valid PDF from same approved version | MVP |
| SCENARIO-029 | PDF link expires | Deny file and allow authorised re-share. | “Link expired.” | Recipient requests new link | Report/share history | Expiry/re-share | New approved link | MVP |
| SCENARIO-030 | Procedure grafts differ from plan | Show planned versus actual and require explanation. | “Procedure differs from plan.” | Doctor documents variance | Plan and actuals | Variance/review | Doctor-approved procedure record | MVP |
| SCENARIO-031 | Extracted totals do not balance | Block finalisation or record approved exception. | “Extracted counts do not reconcile.” | Recount/manual correction | Entered counts/edits | Changes/exception | Balanced totals or Doctor exception | MVP |
| SCENARIO-032 | Implanted allocation differs from usable | Flag reconciliation issue. | “Implanted allocation does not match usable total.” | Manual zone review | All component totals | Reconciliation | Balanced values or approved explanation | MVP |
| SCENARIO-033 | Patient returns years later | Open preserved longitudinal history. | “Previous history available.” | Manual review of archived media | All retained episodes/versions | Sensitive access | New linked consultation | MVP |
| SCENARIO-034 | Second procedure | Create new linked episode. | “New procedure episode.” | Manual linkage confirmation | Earlier and new records | Creation/link | Separately approved new plan | MVP |
| SCENARIO-035 | Unsupported clinic workflow | Evaluate through decision framework. | “Request under product review.” | Supported standard workflow/integration | Request and decision | Decision record | Approve, pilot, integrate, defer, reject | MVP/Post-MVP |
| SCENARIO-036 | Autonomous diagnosis requested | Reject boundary violation. | “GraftVision does not provide autonomous diagnosis.” | Doctor-led assessment | Request/decision | Rejection | None unless reframed as assistive | MVP/Post-MVP |
| SCENARIO-037 | Guaranteed prediction language requested | Reject or replace with approved language. | “Guaranteed outcome claims are not supported.” | Illustrative simulation with disclaimer | Request/approved wording | Decision | Clinically approved non-guaranteed wording | MVP |
| SCENARIO-038 | Unsupported browser/device | Stop unsafe capability; preserve work. | “This device is unsupported.” | Supported device/manual workflow | Confirmed server state | Compatibility failure | Supported environment | MVP |
| SCENARIO-039 | Local storage has incomplete draft | Verify clinic/patient before recovery. | “Incomplete draft found.” | Discard or reconcile safely | Encrypted/scoped draft metadata | Recovery/discard | Correct authorised recovery or deletion | MVP |
| SCENARIO-040 | Background job delayed | Show delayed status; avoid duplicate job. | “Processing delayed; your source is safe.” | Continue other/manual work | Source, job, attempts | Delay/retry | Completion, safe retry, or cancellation | MVP |

## 37. Principles Acceptance Criteria

### Product principles summary

GraftVision preserves the patient journey, Doctor control, manual utility, standardised evidence, honest precision, tenant isolation, patient-safe disclosure, versioned history, visible recovery, shared SaaS consistency, clinic data portability, and GraftVision software ownership.

### High-risk product-behaviour checklist

- [ ] AI cannot diagnose, approve, finalise, or guarantee.
- [ ] Manual workflows complete the core journey.
- [ ] Unreliable scale cannot produce exact final measurement.
- [ ] Approved records and reports cannot be silently overwritten.
- [ ] Cross-clinic and cross-patient leakage tests pass.
- [ ] Presentation contains only approved patient-safe content.
- [ ] Internal reports cannot enter patient links.
- [ ] Support clinical access approves, scopes, expires, revokes, and audits.
- [ ] Connectivity, retry, concurrency, and delayed-job tests preserve confirmed work.
- [ ] Subscription change does not silently delete clinical history.
- [ ] Export excludes GraftVision intellectual property and other clinics.
- [ ] Clinic customisation cannot weaken the shared product standard.

### Acceptance criteria

1. Principles have accountable owners.
2. Requirements and tests reference stable IDs.
3. Forty scenarios have approved behaviour, fallback, preservation, audit, and recovery.
4. MVP passes with AI and automatic 3D disabled.
5. Negative tests prove all privacy boundaries.
6. Required clinical terminology is consistent.
7. Open decisions use the safer default.

## 38. Unresolved Product Decisions

1. What confidence or quality thresholds trigger recapture, manual confirmation, or suppression for each AI-assisted use?
2. Which physical-scaling methods are accepted for final recipient area measurement?
3. What offline/local draft duration, protection, and cleanup policy applies to capture devices?
4. How should concurrent drafts be reconciled, and which fields require explicit conflict review?
5. Which report corrections require recipient notification or link revocation?
6. What access remains available when a clinic subscription becomes inactive?
7. What recovery window applies to accidental archive or deletion?
8. What maximum support and presentation durations apply?
9. Which comparison differences make a follow-up view unsuitable rather than merely limited?
10. What reconciliation exceptions may a Doctor approve for procedure graft totals?
11. Which clinic customisations qualify for configuration, platform feature, or external integration?
12. Which approved patient-facing label accompanies each illustrative simulation?

Product approval covers commercial and workflow decisions; clinical approval covers measurement, AI-assisted behaviour, reconciliation, comparison, simulation, and claims; privacy/security approval covers offline data, support, export, deletion, sharing, and sessions.

## 39. Approval Checklist

- [ ] Haris Liaqat approves the core, SaaS, commercial, and decision principles.
- [ ] Dr Sheraz approves clinical safety, Doctor control, measurement, planning, comparison, and claim principles.
- [ ] FACE Aesthetic Clinic Lahore validates capture, consultation, procedure, follow-up, presentation, and recovery behaviour.
- [ ] Privacy/security review approves tenant, patient, support, file, export, deletion, offline, and presentation boundaries.
- [ ] Every mandatory principle is represented by a stable ID.
- [ ] All forty scenarios have been reviewed.
- [ ] Manual fallbacks are accepted for every critical workflow.
- [ ] The product team accepts safe rejection of autonomous diagnosis and guaranteed prediction requests.
- [ ] Unresolved decisions have owners and review dates.
- [ ] This document is authorised for use in user-flow design.

## 40. Recommended Next Document

The recommended next document is `docs/USER_FLOWS.md`. It should translate the approved documents into role-specific journeys, alternate paths, denials, hand-offs, recovery, and longitudinal workflows without weakening these principles.

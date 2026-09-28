# GraftVision Vision

## Document Information

| Field | Decision |
|---|---|
| Product | GraftVision |
| Product owner | Haris Liaqat |
| Initial clinical validation clinic | FACE Aesthetic Clinic Lahore |
| Initial clinical approver | Dr Sheraz |
| Initial launch market | Pakistan |
| Commercial model | Manually sold multi-tenant SaaS |
| Founding clinic offer | PKR 30,000 onboarding and PKR 30,000 monthly |
| Status | Proposed for product-owner and clinical approval |

This document defines the enduring direction of GraftVision. It explains why the product exists, what experience it should create, the boundaries it must preserve, and the principles that should guide future decisions. It does not define implementation architecture or replace the detailed requirements in the PRD.

## Why GraftVision Exists

Hair-restoration care unfolds over time, but its records are often fragmented across photographs, handwritten notes, spreadsheets, messages, and local folders. The complete patient journey becomes difficult to reconstruct, compare, approve, or explain.

GraftVision exists to give that journey a durable structure.

The product should connect the moment a patient first presents with hair, the preliminary assessment, standardised photography, proposed hairline and preliminary graft range, the surgery-day shaved assessment, final recipient-area measurements, doctor-approved graft allocation, the final hairline, procedure and follicular-unit documentation, immediate post-procedure records, follow-up photography, progress comparisons, and long-term history.

The aim is to help a clinic capture what happened, understand what was proposed, preserve who approved it, document what was performed, and follow what changed over time. The record should remain coherent even when staff or devices change.

## The Vision

GraftVision will become the complete digital consultation, surgical-planning, procedure-documentation, and long-term follow-up platform for hair-restoration clinics.

One shared SaaS platform will serve multiple clinics while giving each a private workspace. GraftVision owns the platform; each clinic owns its clinic and patient data. Clinics benefit from one improving product rather than divergent software codebases.

The product must be useful without perfect automation. Doctors must be able to complete planning and approve the final surgical plan through reliable manual workflows. AI-assisted capabilities and automatic 3D reconstruction may later improve speed and consistency, but they are enhancements, not substitutes.

The lasting vision is a trustworthy longitudinal record: every important image, plan, decision, approval, procedure detail, report version, and follow-up remains connected to the same patient journey.

## The Problems GraftVision Solves

### Fragmented clinical records

GraftVision should replace scattered photographs, plans, graft counts, reports, and follow-ups with structured, linked records.

### Inconsistent photography

GraftVision should guide repeatable views and preserve relevant conditions because angle, lighting, hair state, distance, device, and framing affect comparison.

### Lost context between consultation and surgery

The initial plan with hair present and surgery-day shaved assessment must both remain visible, showing how the proposal evolved into the final surgical plan.

### Unexplained planning numbers

A graft number should show its area, density, method, assumptions, and doctor adjustment. Uncertain values remain a preliminary graft range; final values trace to a doctor-approved plan.

### Privacy risks during consultation

A shared LED must show only explicitly approved material, never the working dashboard, contacts, private notes, staff comments, or other patients.

### Weak continuity after the procedure

The record should continue through immediate post-procedure documentation, scheduled follow-ups, standardised photography, and long-term comparison.

## The Defining Product Experience

A patient enters the consultation room. Staff opens the correct patient record on the clinic workstation. The doctor or assistant starts a guided capture session and uses a phone to take the required scalp photographs. The phone provides clear guidance while the doctor’s laptop shows session progress and received images.

The doctor reviews the history, imagery, recipient areas, measurements, density, preliminary graft range, and hairline. Any AI-assisted suggestion is visibly provisional and can be accepted, edited, rejected, or replaced manually.

On the LED, only selected doctor-approved images, measurements, plans, and illustrative simulations appear. Contacts, private notes, staff comments, other patients, administration, and unapproved suggestions remain absent.

The doctor approves the clinical plan. GraftVision produces a clinic-branded, watermarked, versioned PDF that distinguishes assistive content from clinical decisions and does not promise a guaranteed outcome.

On surgery day, a shaved-scalp assessment links to the original consultation. The final surgical plan, actual procedure, immediate post-operative record, and follow-ups continue the same timeline.

At any point, an authorised clinic user can understand the complete patient journey without searching across disconnected devices and folders.

## The Patient Experience

The patient should experience a calm, understandable consultation in which technology supports the conversation. Only relevant, approved information should appear: the current condition, areas under discussion, proposed plan, evidence limits, and next stage.

Any illustrative simulation must be presented as an aid to discussion, not as a prediction. Any preliminary graft range must be identified as preliminary. AI-assisted content must not be framed as a diagnosis or as more authoritative than the doctor’s judgement. The final surgical plan must be clearly doctor-approved.

The patient should not be exposed to private clinic operations or unrelated records. Reports and presentation sessions should disclose only what the clinic has approved for sharing. The experience should build confidence through clarity and traceability, not through spectacle or unsupported claims.

Follow-up photography and comparison should help the clinic explain progression honestly, including capture differences and visual limitations.

## The Doctor Experience

The doctor should remain in control of every clinical conclusion and final plan. GraftVision should organise relevant history, images, models, measurements, density choices, graft allocations, hairline versions, procedure details, and follow-ups without forcing the doctor to trust an unexplained output.

Manual control must exist at every critical point: doctors can correct regions, review measurements, change density or allocation, revise hairlines, reject suggestions, and keep private notes private.

The product should make the difference between a preliminary consultation and a final surgical plan unmistakable. It should preserve the reasoning and changes between them. Approval should be deliberate and traceable, not implied by simply viewing or saving a screen.

The product must not create false certainty or turn the doctor into a passive reviewer of machine decisions.

## The Staff Experience

Assistants and reception staff need focused workflows: structured registration, clear required details, visible capture progress, and recoverable failures.

Concise guidance should let staff reproduce required views and record comparison conditions without advanced photography expertise.

Role boundaries must remain clear. Assistants may prepare records, capture images, and enter authorised procedure information, but they cannot approve the final clinical plan. Reception users may register patients, locate permitted records, see report status, and share approved reports, but they cannot access private doctor notes or change clinical planning.

Statuses should make completion, failure, review, and approval needs unambiguous.

## The Platform-Owner Vision

GraftVision should be one coherent product serving many clinics, not a collection of custom clinic systems. Haris Liaqat, as product owner, is responsible for preserving the product direction while learning from FACE Aesthetic Clinic Lahore, Dr Sheraz, and later pilot clinics.

The platform owner should be able to onboard clinics manually, manage plans and feature access, understand product usage, support clinic operations, and monitor platform health. This role should not routinely browse patient clinical information. Any exceptional support access must be explicit, limited, and traceable.

The product should grow through repeatable capabilities, not uncontrolled one-off customisation. Configuration may cover branding, roles, reports, capture protocols, and appropriate workflow settings without creating separate products.

Long-term advantage should come from trusted workflow, longitudinal records, validation, and responsible assistance—not data lock-in.

## Unique Value and Product Identity

GraftVision is defined by connecting the full lifecycle while preserving doctor control and patient-safe communication. It is:

- not a generic CRM, because it structures clinical capture, planning, approvals, procedures, reports, and follow-up;
- not a photo gallery, because images retain capture and clinical context;
- not a diagnosis engine or autonomous surgical-planning system, because doctors make the final decisions;
- not a payment-management platform, because patient and clinic finances are outside the clinical product;
- not a simple graft calculator, because planning connects area, density, hairline, approval, procedure, and follow-up;
- not a one-time scalp scanner, because it preserves longitudinal history; and
- not a marketing-only before-and-after generator, because comparisons remain contextual and honest about limitations.

## Product Principles

### Doctor-approved, never AI finalised

AI-assisted suggestions remain editable or rejectable. The final surgical plan is always doctor-approved.

### Patient journey, not one-time scan

The longitudinal record runs from first consultation to long-term follow-up; scanning is one activity within it.

### Standardisation before automation

Automation should build on consistent capture and structured context, not conceal poor inputs.

### Privacy by design

Minimise sensitive information, align access to responsibility, and construct patient-safe output from approved content.

### Tenant isolation by default

Every clinic receives a private workspace isolated from every other clinic.

### Presentation-safe by design

Patient presentation is a separate restricted experience, not a hidden version of the clinic workspace.

### Structured records instead of scattered files

Clinical media and documents retain patient, session, purpose, author, status, and version context.

### Transparent measurements instead of unexplained AI numbers

Area, density, and graft plans show source, assumptions, units, and doctor adjustments without false precision.

### Manual fallback for every critical AI feature

Critical workflows continue when AI-assisted services fail, are disabled, or are unapproved.

### Useful before advanced AI

MVP value comes from standardisation, traceability, privacy, and doctor-approved planning—not advanced AI.

### One shared product, not separate clinic codebases

One product should improve through bounded configuration and broadly useful capabilities.

### Clinic-configurable, not infinitely customised

Configuration may adapt branding and workflow, but cannot compromise coherence, safety, privacy, or maintainability.

### Longitudinal evidence over marketing spectacle

Favour traceable comparison and honest history over visual effects that exaggerate certainty.

### Secure portability without surrendering software ownership

Clinics can securely export their data; GraftVision retains ownership of the software platform.

### Clinical accuracy claims only after validation

Accuracy claims cannot exceed evidence for the use, population, device, and workflow.

### Elegant, calm, premium clinical design

The product should feel calm and premium, using visual quality for comprehension rather than distraction.

## Clinical Safety Principles

GraftVision supports documentation and decisions; it does not replace the doctor or guarantee accuracy, donor capacity, follicle counts, graft survival, or results.

When evidence is uncertain, use a preliminary graft range. Uncalibrated imagery must not produce apparently exact physical measurements.

AI-assisted outputs remain reviewable. Doctors can correct regions, density, allocation, and hairlines; reject suggestions; add private notes; and approve the final surgical plan.

Illustrative simulations must be labelled and explained as visual aids, not predicted outcomes. Material changes after approval should create a renewed review rather than silently preserving the appearance of approval.

FACE Aesthetic Clinic Lahore and Dr Sheraz provide initial validation, but one clinic’s findings are not universal evidence.

## Privacy Principles

Privacy is a product property, not a final review step.

Clinics own their data: records remain private, access follows roles, support access is exceptional and traceable, and export is secure and verified.

Patient-safe output begins with approved content, not an internal record with fields hidden later. Private notes, warnings, comments, contacts, unapproved suggestions, unrelated records, and administration remain excluded.

Software ownership never justifies routine clinical browsing. Support access needs purpose, limited duration, permission, and audit.

Pakistan launch requires legal and security review of privacy, consent, retention, healthcare records, and cross-border processing.

## Design Philosophy

GraftVision should feel calm in a setting that can be emotionally significant for patients. Interfaces should use clear hierarchy, restrained visual language, readable clinical terminology, and direct status communication.

The product should show the right amount of information for the current role and moment. A doctor planning recipient areas needs detail and control. An assistant capturing photographs needs guidance and progress. A patient viewing an LED needs clarity and privacy. A platform operator needs service and account context without routine clinical exposure.

Visualisations should explain rather than impress. Hairline overlays, region markings, comparisons, and illustrative simulations should make their source and status evident. Draft, suggested, doctor-adjusted, doctor-approved, stale, and superseded states should not be visually confused.

Premium design means disciplined usefulness: fast orientation, consistent language, careful spacing, accessible contrast, legibility at distance, safe recovery, and no avoidable exposure of sensitive data.

## Technology Philosophy

Technology choices should serve the clinical workflow, privacy model, and long-term product integrity. GraftVision should prefer dependable, observable, supportable capabilities over novelty.

The product should work across ordinary modern clinic laptops, phones, and LED-connected displays. It should not require native applications, LiDAR, or specialised equipment to deliver its MVP value. Enhanced devices may improve later capabilities, but the core workflow should remain accessible.

Failures must be recoverable. A lost connection, failed upload, unavailable AI-assisted service, or incomplete 3D process should create a clear state and a safe next action. It should not silently lose confirmed work, produce a false completion, or block a doctor from using manual tools.

Technology should preserve source material, versions, approvals, and patient history. It should support one shared multi-tenant product and bounded clinic configuration. Specific architecture, vendors, and implementation patterns belong in later documents and must be judged against this vision.

## AI Philosophy

AI should earn a place in GraftVision by improving consistency, attention, or efficiency while preserving doctor control. It is not the product’s authority.

AI-assisted capabilities may suggest image-quality issues, classifications, hair-loss regions, crown boundaries, recipient zones, hairline starting points, area measurements, preliminary graft ranges, density options, or follow-up comparisons. Each use case requires separate validation. Performance in one task does not prove clinical suitability in another.

Suggestions must be distinguishable from doctor-approved decisions. Relevant limitations should be visible. The doctor must be able to accept, edit, reject, or replace the suggestion. Corrections should inform product evaluation, including how often doctors change or reject an output.

No production AI-assisted feature should use clinic data outside approved consent, privacy, security, retention, and vendor boundaries. No feature should claim guaranteed accuracy or autonomous diagnosis. The safest useful manual workflow should remain available whenever AI is absent.

## MVP Philosophy

The MVP is not a reduced demonstration of future AI. It is a useful clinical product in its own right.

It should prove that a clinic can maintain an isolated workspace, register a patient, capture standardised photographs on a phone, synchronise the session with a laptop, document an initial consultation, mark recipient areas, record or calculate transparent measurements, select density, establish a preliminary graft range, design a hairline, obtain doctor approval, present approved material safely, and generate a watermarked report.

It should then carry the same patient through a surgery-day shaved assessment, final surgical plan, procedure and graft documentation, immediate post-procedure images, follow-ups, comparisons, and long-term history.

Manual region marking, doctor-entered measurements, doctor-selected density, doctor-adjusted graft allocation, and uploaded or externally generated 3D models are acceptable. Advanced AI, automatic 3D reconstruction, native mobile applications, multi-branch management, patient portals, and automatic billing should not delay the core product.

MVP quality is defined by safety, completeness, privacy, recovery, and real clinic usefulness—not by the number of automated features.

## SaaS and Commercial Philosophy

GraftVision will launch in Pakistan as a manually sold multi-tenant SaaS product. Clinics will be onboarded through guided trials or paid pilots rather than public self-service signup.

The founding clinic offer is PKR 30,000 for onboarding and PKR 30,000 per month. This offer establishes an initial commercial frame, not a permanent promise that every future plan or clinic will have identical pricing.

The onboarding fee should reflect real setup work: clinic configuration, staff preparation, workflow alignment, initial training, and supported adoption. The monthly subscription should fund continued access to the shared platform, support, security, maintenance, and product improvement.

GraftVision retains ownership of the software platform. Clinics own their clinic and patient data. Secure data portability should protect clinic autonomy without transferring ownership of the product, its general workflows, or its future improvements.

Subscription tiers may later vary by usage, features, support, branding, or advanced capabilities, but a lower tier must never weaken essential tenant isolation, patient privacy, doctor approval, auditability, or safe manual fallback. Patient payments and clinic financial management remain outside the product.

## The GraftVision Standard

Every clinic should receive the following minimum experience regardless of subscription tier:

1. **Private clinic workspace:** A clearly isolated workspace that cannot expose another clinic’s users, patients, settings, images, scans, or reports.
2. **Secure patient record:** A structured, access-controlled record that connects the complete patient lifecycle.
3. **Standardised image capture:** Guided capture with defined views, conditions, progress, retakes, and clear failure recovery.
4. **Longitudinal consultation history:** Initial consultation, surgery-day assessment, procedure, immediate post-operative record, follow-ups, and comparisons remain connected.
5. **Doctor-approved planning:** Recipient areas, measurements, density, graft allocation, hairline, and final surgical plan remain under doctor control.
6. **Patient-safe presentation mode:** Temporary approved presentation content with no private notes, contacts, unrelated patients, or internal administration.
7. **Traceable reports:** Approved, versioned, clinic-branded reports that identify their status and source and use appropriate disclaimers and watermarking.
8. **Auditability:** Sensitive access, changes, approvals, exports, report sharing, support access, and presentation activity remain attributable.
9. **Data export:** The clinic can obtain its data through a secure, verified, policy-compliant process.
10. **Manual fallback when automation fails:** Critical consultation, planning, procedure, reporting, and follow-up work can continue safely without advanced AI or automatic 3D processing.

Commercial differentiation may add capacity, convenience, advanced analysis, services, or configuration. It must not create a lower standard of privacy or clinical responsibility.

## What GraftVision Must Never Become

GraftVision must never become a system that treats a machine suggestion as the final clinical decision.

It must never become a generic contact-management product with clinical images attached as an afterthought; a photo gallery without context; a black-box diagnosis engine; an autonomous surgical-planning system; a payment-management platform; a simple graft calculator presented as a complete consultation; a one-time scanner that loses the patient’s history; or a marketing-only before-and-after generator.

It must never make ordinary phone imagery appear capable of exact donor-capacity or follicle-count measurement without suitable evidence. It must never describe an illustrative simulation as a predicted result. It must never use visual polish to conceal uncertainty.

It must never expose one clinic’s data to another, weaken privacy for a cheaper subscription, or make patient-safe presentation depend on staff remembering to hide confidential information.

It must never surrender product coherence to unlimited clinic-specific forks. Nor should it use software ownership to deny clinics secure access to their own data.

If growth requires sacrificing doctor control, privacy, traceability, honest claims, or safe fallback, that growth is outside the GraftVision vision.

## Five-Year Product Direction

### Year 1: Prove the standard

Validate the complete MVP workflow with FACE Aesthetic Clinic Lahore and additional manually onboarded clinics in Pakistan. Establish reliable capture protocols, doctor-approved planning, procedure documentation, follow-up consistency, patient-safe reporting, onboarding, support, and measurable clinic value.

### Year 2: Improve consistency

Refine workflow quality using pilot evidence. Introduce carefully validated AI-assisted capture quality, region suggestions, or classifications where they reduce effort without weakening doctor control. Improve comparison consistency, clinic configuration, and operational insight.

### Year 3: Deepen measurement and visual understanding

Evaluate automatic 3D reconstruction, device-depth inputs, calibration-based physical scaling, trichoscopy integration, and donor-density analysis. Each capability should be introduced only when its limitations, supported devices, and clinical role are clear.

### Year 4: Expand the platform responsibly

Support multi-branch organisations, advanced analytics, selected white-label options, patient access where justified, and additional hair-restoration workflows. Maintain one shared product and the GraftVision Standard.

### Year 5: Become the longitudinal record for hair restoration

Develop a mature platform capable of supporting consultation, planning, procedure documentation, outcome review, and responsible research or benchmarking where clinics and patients have provided appropriate authority. Expand beyond Pakistan only with market-specific legal, clinical, privacy, and operational readiness.

The direction is deliberately staged. Dates do not override safety, evidence, or product value.

## Definition of Product Success

GraftVision succeeds when clinics use it as the dependable record of the complete patient journey, not merely as an occasional presentation tool.

Success should be visible in shorter and more consistent consultation documentation, higher completion of standard photograph sets, fewer reports delayed by missing information, reliable scan completion, traceable doctor approvals, faster generation of patient-safe reports, stronger follow-up documentation, and meaningful longitudinal comparisons.

Commercially, success means active clinics continue using and paying for the product because it improves their workflow and patient communication. The number of active clinics, retained clinics, consultations per clinic, onboarding success, and support burden should guide product decisions.

Clinically, success means doctors remain in control and can explain the basis of the final surgical plan. AI correction and rejection rates should be measured honestly rather than hidden.

Operationally, success requires zero cross-tenant data-isolation incidents and zero patient-report or presentation privacy incidents. These are not aspirational marketing metrics; they are minimum trust conditions.

The strongest signal of success is continuity: a clinic can open a patient years later and understand the initial concern, what was proposed, what was approved, what was performed, how the patient progressed, and which information was shared.

## Product Decision Test

For every future feature, the team should ask:

1. Does this improve clinical consultation, planning, documentation, or follow-up?
2. Does this preserve doctor control?
3. Does this protect patient privacy?
4. Does this work across multiple clinics without custom code forks?
5. Does this create measurable value beyond visual novelty?
6. Can the workflow recover safely if AI or 3D processing fails?
7. Does it belong in GraftVision or in an external integration?

If a proposed feature fails these tests, it should be rejected or reconsidered. A feature should not enter the roadmap merely because it is technically possible, visually impressive, requested by one clinic, or likely to create a short-term sales advantage.

## Vision Approval Checklist

- [ ] Haris Liaqat approves the purpose, ownership model, launch market, and commercial direction.
- [ ] Dr Sheraz approves the clinical-control and safety principles.
- [ ] FACE Aesthetic Clinic Lahore agrees that the defining experience reflects the initial validation workflow.
- [ ] The complete patient lifecycle is accepted as the product’s organising model.
- [ ] Doctor-approved planning and manual fallback are accepted as non-negotiable.
- [ ] AI-assisted terminology and claim boundaries are approved.
- [ ] The GraftVision Standard is approved for every subscription tier.
- [ ] Clinic data ownership and GraftVision software ownership are accepted.
- [ ] Patient-safe presentation and report boundaries are approved.
- [ ] The five-year direction is accepted as directional rather than a delivery commitment.
- [ ] Conflicts or stale decisions in the PRD have been logged for later product-owner review.
- [ ] The team is authorised to proceed to the recommended next document.

## Product Principles Summary

GraftVision follows a clear order of trust: preserve the patient journey, standardise the evidence, protect the clinic boundary, keep presentation patient-safe, make calculations transparent, preserve manual control, require doctor approval, and automate only where validation proves value. It is one configurable SaaS product, useful before advanced AI, designed for secure data portability, honest clinical communication, and calm premium consultation experiences.

## Product Manifesto

GraftVision exists to preserve the complete truth of a hair-restoration journey. We will replace scattered files with structured history, unexplained numbers with transparent planning, unsafe screen sharing with patient-safe presentation, and automation theatre with responsible assistance. Clinics will own their data; GraftVision will own and improve the shared product. Doctors will remain the final clinical authority. Every image, measurement, plan, procedure record, comparison, and report should earn trust through context, privacy, traceability, and honest limits. We will build what remains useful when AI is unavailable, what remains understandable years later, and what serves clinical care beyond the moment of a demo.

## Recommended Next Document

After product-owner and clinical approval of this vision and reconciliation of the PRD’s stale ownership and launch decisions, the recommended next document is `docs/SYSTEM_ARCHITECTURE.md`. It should translate the approved PRD and vision into system boundaries and quality attributes without changing the product principles established here.

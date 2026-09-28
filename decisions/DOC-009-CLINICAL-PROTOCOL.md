# DOC-009: MVP Clinical History and Hair-Loss Protocol

## Decision record

| Field                  | Value                                                                                                     |
| ---------------------- | --------------------------------------------------------------------------------------------------------- |
| Task                   | DOC-009 — Resolve clinical decisions                                                                      |
| Protocol version       | GV-CLINICAL-MVP-0.1                                                                                       |
| Decision date          | 2026-07-30                                                                                                |
| Product approval       | Approved for synthetic implementation planning                                                            |
| Medical approval       | Pending licensed hair-restoration physician review                                                        |
| Privacy/legal approval | Pending qualified review for Pakistan and each operating jurisdiction                                     |
| Production status      | Real-patient use blocked                                                                                  |
| Scope                  | Medical history, hair-loss history, provenance, review, role, versioning, warning, and private-note rules |

This record approves the GraftVision MVP data model, role boundaries, versioning rules, and
clinical-product limitations for synthetic implementation planning. It is not medical advice,
medical clearance, regulatory approval, privacy approval, or medico-legal approval.

## Record ownership and version binding

- Patient-longitudinal clinical history and consultation-specific hair-loss history/assessment
  context are distinct records.
- Every consultation references the exact longitudinal-history version used during assessment.
- A later longitudinal-history update never changes the version previously relied upon by a
  consultation.
- Original patient-reported provenance is preserved when a clinician reviews, verifies, challenges,
  or supersedes information.

## General medical-history catalogue

### General health status

- `no-known-significant-condition`
- `condition-reported`
- `uncertain`
- `not-assessed`

### Allergies

Status:

- `none-reported`
- `allergy-reported`
- `uncertain`
- `not-assessed`

An allergy entry may contain substance/category, reported reaction, severity
(`mild`, `moderate`, `severe`, or `unknown`), source, and verification state. The product must
never represent `none-reported` as “no allergies.”

### Medications

Status:

- `none-reported`
- `medication-reported`
- `uncertain`
- `not-assessed`

A medication entry may contain medication name, controlled category, optional reported purpose,
status (`active`, `stopped`, or `uncertain`), source, and verification state. GraftVision must not
generate stopping instructions, interaction conclusions, or treatment instructions.

### Previous operation and anaesthesia

Approved fields are previous-procedure status, procedure description, approximate year,
complication reported (`yes`, `no`, or `uncertain`), and anaesthesia issue reported
(`yes`, `no`, or `uncertain`).

### Bleeding and healing

Approved reported fields are:

- bleeding disorder;
- excessive bleeding history;
- anticoagulant or antiplatelet use;
- poor wound healing;
- hypertrophic scarring;
- keloid scarring;
- previous procedural infection;
- `uncertain`; and
- `not-assessed`.

### Tobacco and nicotine

Status:

- `never`
- `former`
- `current`
- `unknown`
- `not-assessed`

Optional controlled product categories are `cigarettes`, `vaping`, `smokeless-nicotine`, `other`,
and `undisclosed`.

### Relevant health warnings

Controlled categories are:

- cardiovascular concern;
- blood-pressure concern;
- diabetes/glucose-control concern;
- immune/inflammatory concern;
- active infection concern;
- active scalp-disorder concern;
- bleeding/clotting concern;
- anaesthesia concern;
- psychiatric/expectation concern; and
- other Doctor-reviewed concern.

These are reported or clinician-observed concerns, never software-confirmed diagnoses.

## Hair-loss-history catalogue

### Primary concern

- frontal recession
- temporal recession
- frontal thinning
- mid-scalp thinning
- crown thinning
- diffuse thinning
- patchy loss
- donor-area thinning
- hairline shape concern
- previous-transplant concern
- other
- uncertain

### Onset and duration

Onset is an approximate date or age and is explicitly marked approximate where applicable.

Duration:

- under 6 months
- 6–12 months
- 1–3 years
- 3–5 years
- over 5 years
- uncertain

### Progression

- stable
- slowly progressive
- rapidly progressive
- episodic
- improved
- uncertain
- not-assessed

### Shedding

- no increased shedding reported
- increased shedding reported
- episodic shedding
- uncertain
- not-assessed

### Pattern classification

- Hamilton–Norwood
- Ludwig
- Christmas-tree pattern
- other clinician-defined pattern
- unclassified
- uncertain

Pattern classifications are documentation aids, not a complete diagnosis, suitability decision, or
automatic graft formula.

### Scalp symptoms

- itching
- pain/tenderness
- burning
- scaling/flaking
- redness
- pustules/discharge
- crusting
- scarring
- none reported
- uncertain
- not-assessed

### Family history

- maternal
- paternal
- siblings
- none reported
- uncertain
- not-assessed

### Previous treatments

An entry may contain a controlled treatment category, treatment name, approximate start/end,
ongoing status, reported result, reported adverse effect, optional controlled reason stopped,
source, and verification state.

Reported result:

- improved
- stabilised
- no noticeable change
- worsened
- intolerant
- uncertain
- not-assessed

Previous-procedure category:

- FUE
- FUT/strip
- scalp procedure
- non-surgical restoration procedure
- unknown procedure
- other

Previous-procedure details may include approximate date, optional clinic/country, reported graft
count marked unverified unless documented, donor region, recipient region, reported complications,
and source-document availability.

### Patient goals

- restore frontal hairline
- increase frontal density
- improve mid-scalp density
- improve crown coverage
- repair previous transplant
- improve temporal points
- preserve donor area
- understand candidacy
- understand realistic options
- other

Goals remain patient-reported and are never presented as an approved treatment plan.

## Source, certainty, and review state

Approved source vocabulary:

- `patient-reported`
- `caregiver-reported`
- `prior-record`
- `clinician-observed`
- `clinician-measured`
- `device-generated`
- `imported`
- `system-suggested`
- `unknown`

AI or software output must use `system-suggested` and must never claim `clinician-observed` or
`clinician-measured` provenance.

Approved certainty/review vocabulary:

- `reported`
- `observed`
- `measured`
- `documented`
- `verified`
- `uncertain`
- `not-assessed`
- `contradicted`

Approved section review states:

- `draft`
- `submitted-for-review`
- `Doctor-reviewed`
- `amendment-required`
- `superseded`
- `retracted`

`Doctor-reviewed` means the Doctor reviewed that version; it does not mean every reported fact was
independently proven.

## Required-field and completion rules

No medical-history field is required merely to create a consultation draft.

Before preliminary-assessment submission, require:

- current hair-loss concern;
- onset or `uncertain`;
- progression or `not-assessed`;
- previous hair-procedure status;
- medication status;
- allergy status;
- medical-condition status;
- scalp-symptom status; and
- source for each completed section.

Before Doctor clinical finalisation, require explicit Doctor review of:

- allergies;
- medications;
- medical conditions;
- bleeding/healing concerns;
- previous procedures;
- scalp symptoms;
- hair-loss pattern;
- progression;
- patient goals; and
- unresolved warnings.

`not-assessed` is permitted during drafting but blocks finalisation for Doctor-required safety
sections.

## Narrative boundaries

Structured fields are used first. Maximum clarification lengths are:

- 500 characters per structured entry;
- 1,500 characters per section summary; and
- 3,000 characters per Doctor-private-note version.

Prohibited narrative includes full copied medical records, identity documents, payment data,
passwords or credentials, unrelated third-party information, discriminatory commentary,
unsupported diagnostic certainty, treatment guarantees, and non-clinical personal judgements.

## Role and access matrix

### Clinical Assistant

May draft patient-reported history, structure patient-provided information, mark sections
incomplete or uncertain, submit drafts for Doctor review, and correct clerical errors before Doctor
review.

May not diagnose, verify findings as a Doctor, approve transplant suitability, approve a hairline
or graft estimate, dismiss clinical warnings, finalise a clinical assessment, or overwrite
Doctor-reviewed history.

### Verified same-clinic Doctor

May create or edit clinical findings, verify or challenge reported information, review Assistant
drafts, request amendment, mark concerns for investigation, approve clinical-section versions,
retract erroneous Doctor-authored versions, and create corrected superseding versions.

### Read-Only Clinical Reviewer

Access must be explicit, consultation-specific, time-bounded, and independently authorised. A
reviewer may not edit history or private notes, assign a Doctor, change consultation status, approve
treatment without separate approval authority, or download unrestricted exports.

### Doctor-private notes

- Stored separately from general clinical history.
- Only the verified assigned Doctor may create a note in MVP.
- Access is limited to the author, the currently assigned verified Doctor, and a specifically
  authorised reviewer only after a future controlled grant is approved.
- Clinical Assistant, Reception, Clinic Owner/Administrator, Report Coordinator, Presentation
  User, Patient, platform roles, and Support roles are denied by default.
- Clinic ownership grants no automatic access.
- Amendments create immutable versions.
- Retraction requires verified Doctor authority and a controlled reason, preserves the original,
  creates a revision and audit event, and hides the note from ordinary active views without
  physical deletion.

## Material changes and versioning

A new clinical version is required when changing:

- allergy status or substance;
- medication status or a material medication;
- significant medical-condition status;
- bleeding/healing concern;
- previous-procedure history;
- hair-loss pattern;
- progression;
- scalp warning;
- clinician assessment;
- suitability concern;
- a Doctor-reviewed section; or
- source/verification of a safety-relevant field.

Spelling, punctuation, formatting, and non-semantic ordering are non-material changes.

A material change after preliminary assessment preserves the prior version, marks dependent output
stale, requires Doctor re-review, and never silently preserves the applicability of prior approval.

Consultation status interaction:

| Status             | Clinical-history behaviour                                                                                          |
| ------------------ | ------------------------------------------------------------------------------------------------------------------- |
| `draft`            | Drafting allowed; incomplete required fields permitted                                                              |
| `in-progress`      | Drafting and review allowed; material changes create versions                                                       |
| `capture-complete` | Amendments allowed; material changes mark downstream work for review                                                |
| `review-required`  | Doctor review expected; Assistant cannot finalise                                                                   |
| `completed`        | No silent editing; correction requires controlled amendment/reopen and preserves the completed version              |
| `cancelled`        | Ordinary clinical editing disabled; authorised reading/retention remains policy-controlled and history is preserved |

## Warning language and product limitations

Approved non-diagnostic warnings include:

- Doctor review required before proceeding.
- Active scalp concern reported.
- Medication information requires review.
- Allergy information incomplete.
- Previous procedure details unverified.
- Rapid or unexpected hair loss requires clinical assessment.

The product must not display “safe for surgery,” “not suitable for transplant,” “diagnosis
confirmed,” “medically cleared,” or “guaranteed result.”

Original photographs remain primary evidence. Classifications, measurements, device outputs, and
future AI outputs are supportive evidence with method/version provenance. No automated or
Assistant-generated output becomes final without verified Doctor review.

## Audit policy

Audit clinical-section creation, material amendment, Doctor review, amendment request, retraction,
superseding version, private-note creation/amendment/retraction, policy-required sensitive
private-note access, and high-risk denied access.

Audit metadata is limited to opaque references, section/field codes, action, version, controlled
reason, timestamp, and redacted actor context. It must never contain narrative clinical content,
full field values, patient identity, medication names, allergy substances, note content, request
bodies, tokens, or cookies.

## Synthetic-case protocol

The required synthetic review set is:

1. uncomplicated pattern hair loss;
2. uncertain or rapid progression;
3. active scalp symptoms;
4. reported allergy;
5. anticoagulant or bleeding concern;
6. previous transplant;
7. poor healing or keloid concern;
8. diffuse or atypical loss;
9. Assistant draft requiring Doctor amendment;
10. private-note access denial;
11. material amendment invalidating downstream work; and
12. completed consultation requiring controlled correction.

The cases are approved as the required synthetic review catalogue. Execution evidence and licensed
hair-restoration physician sign-off remain pending. Only synthetic data may be used.

## Remaining approval boundary

Before real-patient enablement:

- a licensed hair-restoration physician must review and sign off the complete catalogue, warning
  language, limitations, workflows, and executed synthetic cases; and
- qualified privacy/legal reviewers must approve Pakistan and operating-jurisdiction requirements,
  including lawful basis, sensitive clinical fields, capacity and representatives, notices or
  consent, retention, amendment/retraction, disclosure, export, and deletion.

DOC-010 remains responsible for the unresolved security and privacy/legal decisions. This protocol
does not authorise CONSULT-003 implementation, real-patient use, scanning, media, LiDAR,
reconstruction, AI, hairline planning, graft planning, or Doctor approval.

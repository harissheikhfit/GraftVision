# GraftVision AI Roadmap

## Document Status

Placeholder — AI and 3D work is the final stage in the required delivery sequence.

## Guiding Principles

## Candidate Use Cases

## Explicit Non-Goals

## Data Readiness

## Consent and Governance

## Human Oversight

## Evaluation Framework

## Safety and Bias

## Model and Vendor Assessment

## Deployment and Monitoring

## Stage Gates

### AI-MAP-002B2 runtime contract repair

The synthetic/non-patient expanded ONNX POC uses `onnxruntime-node@1.18.0` with the committed
`graftvision-synthetic-scalp-segmentation-expanded-0.1.0.onnx` artifact. Its exact input contract
is `input`, `float32`, `[1, 100]`, with synthetic byte values normalized to `[0, 1]`; its output is
`output`, `float32`, `[1, 500]`. The artifact is ONNX IR 10, opset 13, and has SHA-256
`c5da94a32c18e367f7087cfcca541fc56287673af853a2c16be6c2d78ad16eb5`.

The B2 test requires native `InferenceSession.create()` and `session.run()` and validates the
expanded 4-landmark, 6-curve, 9-region contract. This is a synthetic/non-patient model-runtime
integration POC. It does not establish clinical validity, clinical accuracy, or patient-specific
treatment recommendations.

The current implementation adds a server-only worker boundary around
`OnnxAiMapInferenceAdapter`. It requires the transaction tenant clinic, an explicit worker
identity, and an unexpired reconstruction-job lease before beginning execution. The worker keeps
the exact `[1, 100]` to `[1, 500]` contract, rejects non-finite or out-of-bounds geometry, and
persists output through the controlled database gateway. The import path requires an accepted or
modified Doctor decision for the same clinic-owned suggestion before writing provenance.

AI-MAP-002C remains in progress until local database reset and pgTAP execution evidence pass;
this does not establish clinical approval or production readiness.

The opt-in worker E2E consumes a generated JSON contract from
`.graftvision-tmp/ai-map-002c-fixture.json`. Create and verify it only against the disposable local
stack after the synthetic seed and local Auth fixtures are present:
`corepack pnpm ai-map:fixture:setup` and `corepack pnpm ai-map:fixture:verify`. The tool derives the
clinic and Doctor from the approved seed, creates only synthetic patient/consultation/scan data,
retains an active Doctor session and reconstruction-worker lease, verifies every tenant-bound
reconstruction/model/annotation link and artifact checksum, and emits no credentials. Run the
worker E2E only with `GRAFTVISION_AI_MAP_E2E=1`; it remains opt-in and does not establish clinical
validity or production readiness.

### AI-MAP-002C trusted genuine inference execution contract

The genuine runtime is admitted only through a server-controlled execution binding. The binding
pins the reconstruction artifact checksum, model package lineage, adapter and pipeline versions,
and the exact `[1, 100]` input to `[1, 500]` output contract. Output persistence is atomic and
rejects malformed entity sets; failed execution does not produce a proposal. AI output remains a
proposal only: Doctor review and an explicit import into a draft annotation are required before
it can affect clinical annotation state. No fallback inference or clinical decision is created by
this milestone.

## Research Questions

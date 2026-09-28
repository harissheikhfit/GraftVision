import { describe, expect, it, vi } from "vitest";

import {
  assessScanTechnicalMetrics,
  createReconstructionJob,
  createScanSession,
  createScanAnalyzerHandoff,
  generateScanToken,
  hashScanToken,
  overrideScanQualityResult,
  pairScanSession,
  readScanPackageReadiness,
  readReconstructionJobStatus,
  readScanQualityMatrix,
  requestScanQualityRetake,
  transitionScanSessionStatus,
} from "./scan-session";
import { DatabaseBoundaryError } from "./server";

import type { TenantTransaction } from "./server";

const context = {
  applicationSessionId: "11111111-1111-4111-8111-111111111111",
  providerIdentityId: "22222222-2222-4222-8222-222222222222",
};
const scanSessionId = "33333333-3333-4333-8333-333333333333";
const patientId = "44444444-4444-4444-8444-444444444444";
const consultationId = "55555555-5555-4555-8555-555555555555";
const idempotencyKey = "66666666-6666-4666-8666-666666666666";

describe("Scan Session Crypto Utilities", () => {
  it("generates a random 256-bit token encoded as base64url", () => {
    const { rawToken } = generateScanToken();
    expect(rawToken.length).toBe(43);
    expect(rawToken).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("hashes the token deterministically using HMAC-SHA256", () => {
    const token = "dummy-token";
    const secret = "dummy-secret";

    const hash1 = hashScanToken(token, secret);
    const hash2 = hashScanToken(token, secret);

    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("produces different hashes for different secrets", () => {
    const token = "dummy-token";
    const hash1 = hashScanToken(token, "secret-1");
    const hash2 = hashScanToken(token, "secret-2");
    expect(hash1).not.toBe(hash2);
  });

  it("fails if no secret is provided", () => {
    expect(() => hashScanToken("dummy-token", "")).toThrow(
      "Scan token hashing requires a secret key.",
    );
  });
});

describe("Scan Session Database Boundary", () => {
  it("creates an analyzer handoff through the readiness-bound database operation", async () => {
    const transaction = {
      query: vi.fn().mockResolvedValue({
        rows: [{ handoff_id: scanSessionId, is_new: true, quality_review_revision: 8 }],
      }),
    } as unknown as TenantTransaction;
    await expect(
      createScanAnalyzerHandoff(transaction, {
        ...context,
        expectedQualityReviewRevision: 8,
        idempotencyKey,
        scanSessionId,
      }),
    ).resolves.toEqual({ handoffId: scanSessionId, isNew: true, qualityReviewRevision: 8 });
  });

  it("maps the safe deterministic technical quality result", async () => {
    const transaction = {
      query: vi.fn().mockResolvedValue({
        rows: [{ quality_state: "retake_required", reason_code: "IMAGE_TOO_BLURRY" }],
      }),
    } as unknown as TenantTransaction;

    await expect(
      assessScanTechnicalMetrics(transaction, {
        blurVariance: 20,
        brightness: 128,
        duplicateChecksum: false,
        framingCoverage: 0.5,
        height: 1080,
        orientation: 1,
        width: 1920,
      }),
    ).resolves.toEqual({ qualityState: "retake_required", reasonCode: "IMAGE_TOO_BLURRY" });
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(transaction.query).toHaveBeenCalledWith(
      "select * from graftvision_private.assess_scan_technical_metrics($1::integer,$2::integer,$3::numeric,$4::numeric,$5::numeric,$6::integer,$7::boolean)",
      [1920, 1080, 20, 128, 0.5, 1, false],
    );
  });

  it("creates a scan session through the controlled database operation", async () => {
    const row = {
      scan_session_id: scanSessionId,
      revision: 1,
      is_new: true,
    };
    const transaction = {
      query: vi.fn().mockResolvedValue({ rows: [row] }),
    } as unknown as TenantTransaction;

    const projection = await createScanSession(transaction, {
      ...context,
      id: scanSessionId,
      patientId,
      consultationId,
      tokenHash: "test-hash",
      expiresAt: new Date("2026-07-29T00:00:00Z"),
      idempotencyKey,
    });

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(transaction.query).toHaveBeenCalledWith(
      "select * from graftvision_private.create_scan_session($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::uuid,$6::text,$7::timestamptz,$8::text)",
      [
        context.applicationSessionId,
        context.providerIdentityId,
        scanSessionId,
        patientId,
        consultationId,
        "test-hash",
        new Date("2026-07-29T00:00:00Z"),
        idempotencyKey,
      ],
    );
    expect(projection).toEqual({
      id: scanSessionId,
      revision: 1,
      status: "created",
      isNew: true,
    });
  });

  it("pairs a scan session through the controlled database operation", async () => {
    const row = {
      scan_session_id: scanSessionId,
      revision: 2,
      status: "paired",
    };
    const transaction = {
      query: vi.fn().mockResolvedValue({ rows: [row] }),
    } as unknown as TenantTransaction;

    const projection = await pairScanSession(transaction, {
      ...context,
      scanSessionId,
      pairingNonce: "nonce",
      idempotencyKey,
    });

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(transaction.query).toHaveBeenCalledWith(
      "select * from graftvision_private.pair_scan_session($1::uuid,$2::uuid,$3::uuid,$4::text,$5::text)",
      [
        context.applicationSessionId,
        context.providerIdentityId,
        scanSessionId,
        "nonce",
        idempotencyKey,
      ],
    );
    expect(projection).toEqual({
      id: scanSessionId,
      revision: 2,
      status: "paired",
    });
  });

  it("transitions scan session status through the controlled database operation", async () => {
    const row = {
      scan_session_id: scanSessionId,
      revision: 3,
      status: "completed",
    };
    const transaction = {
      query: vi.fn().mockResolvedValue({ rows: [row] }),
    } as unknown as TenantTransaction;

    const projection = await transitionScanSessionStatus(transaction, {
      ...context,
      scanSessionId,
      newStatus: "completed",
      reason: null,
      idempotencyKey,
    });

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(transaction.query).toHaveBeenCalledWith(
      "select * from graftvision_private.transition_scan_session_status($1::uuid,$2::uuid,$3::uuid,$4::text,$5::text,$6::text)",
      [
        context.applicationSessionId,
        context.providerIdentityId,
        scanSessionId,
        "completed",
        null,
        idempotencyKey,
      ],
    );
    expect(projection).toEqual({
      id: scanSessionId,
      revision: 3,
      status: "completed",
    });
  });

  it("throws boundary error if database row is not returned on creation", async () => {
    const transaction = {
      query: vi.fn().mockResolvedValue({ rows: [] }),
    } as unknown as TenantTransaction;

    await expect(
      createScanSession(transaction, {
        ...context,
        id: scanSessionId,
        patientId,
        consultationId,
        tokenHash: "test-hash",
        expiresAt: new Date("2026-07-29T00:00:00Z"),
        idempotencyKey,
      }),
    ).rejects.toThrow(DatabaseBoundaryError);
  });

  it("requests a quality retake through the controlled database operation", async () => {
    const assetId = "77777777-7777-4777-8777-777777777777";
    const transaction = {
      query: vi.fn().mockResolvedValue({
        rows: [{ result_id: assetId, revision: 3, is_new: true }],
      }),
    } as unknown as TenantTransaction;

    const projection = await requestScanQualityRetake(transaction, {
      ...context,
      assetId,
      captureStep: "front",
      expectedRevision: 2,
      idempotencyKey,
      reasonCode: "IMAGE_TOO_BLURRY",
      scanSessionId,
    });

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(transaction.query).toHaveBeenCalledWith(
      "select * from graftvision_private.request_scan_quality_retake($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::text,$6::integer,$7::text,$8::text)",
      [
        context.applicationSessionId,
        context.providerIdentityId,
        scanSessionId,
        assetId,
        "front",
        2,
        "IMAGE_TOO_BLURRY",
        idempotencyKey,
      ],
    );
    expect(projection).toEqual({ id: assetId, revision: 3, isNew: true });
  });

  it("does not expose media or patient data from a retake projection", async () => {
    const transaction = {
      query: vi.fn().mockResolvedValue({
        rows: [{ result_id: scanSessionId, revision: 3, is_new: false }],
      }),
    } as unknown as TenantTransaction;

    await expect(
      requestScanQualityRetake(transaction, {
        ...context,
        assetId: "77777777-7777-4777-8777-777777777777",
        captureStep: "front",
        expectedRevision: 2,
        idempotencyKey,
        reasonCode: "IMAGE_TOO_BLURRY",
        scanSessionId,
      }),
    ).resolves.toEqual({ id: scanSessionId, revision: 3, isNew: false });
  });

  it("records a Doctor quality override through the controlled database operation", async () => {
    const assetId = "77777777-7777-4777-8777-777777777777";
    const transaction = {
      query: vi.fn().mockResolvedValue({
        rows: [{ result_id: assetId, revision: 4, is_new: true }],
      }),
    } as unknown as TenantTransaction;

    await expect(
      overrideScanQualityResult(transaction, {
        ...context,
        assetId,
        captureStep: "front",
        expectedRevision: 3,
        idempotencyKey,
        overrideReasonCode: "ACCEPTABLE_FOR_TECHNICAL_REVIEW",
        scanSessionId,
      }),
    ).resolves.toEqual({ id: assetId, revision: 4, isNew: true });

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(transaction.query).toHaveBeenCalledWith(
      "select * from graftvision_private.override_scan_quality_result($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::text,$6::integer,$7::text,$8::uuid)",
      [
        context.applicationSessionId,
        context.providerIdentityId,
        scanSessionId,
        assetId,
        "front",
        3,
        "ACCEPTABLE_FOR_TECHNICAL_REVIEW",
        idempotencyKey,
      ],
    );
  });

  it("rejects an invalid override idempotency key before the database boundary", async () => {
    const transaction = { query: vi.fn() } as unknown as TenantTransaction;

    await expect(
      overrideScanQualityResult(transaction, {
        ...context,
        assetId: "77777777-7777-4777-8777-777777777777",
        captureStep: "front",
        expectedRevision: 3,
        idempotencyKey: "not-a-uuid",
        overrideReasonCode: "ACCEPTABLE_FOR_TECHNICAL_REVIEW",
        scanSessionId,
      }),
    ).rejects.toThrow(DatabaseBoundaryError);
  });

  it("maps the safe current quality matrix", async () => {
    const transaction = {
      query: vi.fn().mockResolvedValue({
        rows: [
          {
            asset_id: "77777777-7777-4777-8777-777777777777",
            capture_step: "front",
            doctor_overridden: false,
            quality_result_id: "88888888-8888-4888-8888-888888888888",
            quality_revision: 2,
            quality_state: "passed",
            reason_code: null,
            retake_requested: false,
            stale: false,
            validated_at: new Date("2026-08-02T00:00:00Z"),
            validator_version: "technical.v1",
          },
        ],
      }),
    } as unknown as TenantTransaction;

    await expect(
      readScanQualityMatrix(transaction, { ...context, scanSessionId }),
    ).resolves.toEqual([
      {
        assetId: "77777777-7777-4777-8777-777777777777",
        captureStep: "front",
        doctorOverridden: false,
        qualityResultId: "88888888-8888-4888-8888-888888888888",
        qualityRevision: 2,
        qualityState: "passed",
        reasonCode: null,
        retakeRequested: false,
        stale: false,
        validatedAt: new Date("2026-08-02T00:00:00Z"),
        validatorVersion: "technical.v1",
      },
    ]);
  });

  it("maps bounded readiness blockers without sensitive fields", async () => {
    const transaction = {
      query: vi.fn().mockResolvedValue({
        rows: [
          {
            blocker_codes: ["QUALITY_WARNING"],
            evaluated_at: new Date("2026-08-02T00:00:00Z"),
            is_ready: false,
            quality_review_revision: 2,
            ready_angle_count: 6,
            required_angle_count: 7,
          },
        ],
      }),
    } as unknown as TenantTransaction;

    await expect(
      readScanPackageReadiness(transaction, { ...context, scanSessionId }),
    ).resolves.toEqual({
      blockerCodes: ["QUALITY_WARNING"],
      evaluatedAt: new Date("2026-08-02T00:00:00Z"),
      isReady: false,
      qualityReviewRevision: 2,
      readyAngleCount: 6,
      requiredAngleCount: 7,
    });
  });

  it("creates a reconstruction job through the typed trusted boundary", async () => {
    const handoffId = "99999999-9999-4999-8999-999999999999";
    const jobId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const manifestId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const transaction = {
      query: vi.fn().mockResolvedValue({
        rows: [{ is_new: true, job_id: jobId, manifest_id: manifestId, revision: 1 }],
      }),
    } as unknown as TenantTransaction;

    await expect(
      createReconstructionJob(transaction, {
        ...context,
        analyzerHandoffId: handoffId,
        expectedQualityReviewRevision: 4,
        idempotencyKey,
      }),
    ).resolves.toEqual({ id: jobId, isNew: true, manifestId, revision: 1 });
  });

  it("maps only the safe reconstruction job status projection", async () => {
    const jobId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const manifestId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const transaction = {
      query: vi.fn().mockResolvedValue({
        rows: [
          {
            attempt_count: 1,
            cancellation_eligible: true,
            completed_at: null,
            created_at: new Date("2026-08-02T00:00:00Z"),
            failure_code: null,
            job_id: jobId,
            manifest_id: manifestId,
            progress_percentage: 20,
            progress_stage: "preparing_assets",
            retry_eligible: false,
            revision: 3,
            started_at: null,
            state: "running",
          },
        ],
      }),
    } as unknown as TenantTransaction;

    await expect(readReconstructionJobStatus(transaction, { ...context, jobId })).resolves.toEqual({
      attemptCount: 1,
      cancellationEligible: true,
      completedAt: null,
      createdAt: new Date("2026-08-02T00:00:00Z"),
      failureCode: null,
      id: jobId,
      manifestId,
      progressPercentage: 20,
      progressStage: "preparing_assets",
      retryEligible: false,
      revision: 3,
      startedAt: null,
      state: "running",
    });
  });
});

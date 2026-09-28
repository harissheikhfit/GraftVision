import { describe, expect, it, vi } from "vitest";

import {
  attestClinicOnboarding,
  CLINIC_ONBOARDING_ATTESTATION_CODES,
  CLINIC_ONBOARDING_PERMISSION,
  CLINIC_ONBOARDING_STATES,
  readClinicOnboarding,
} from "./clinic-onboarding";
import { DatabaseBoundaryError } from "./server";

const context = {
  applicationSessionId: "11111111-1111-4111-8111-111111111111",
  providerIdentityId: "22222222-2222-4222-8222-222222222222",
};

describe("clinic onboarding boundary", () => {
  it("preserves the approved permission, states, and attestation codes", () => {
    expect(CLINIC_ONBOARDING_PERMISSION).toBe("ADMIN-PERM-001");
    expect(CLINIC_ONBOARDING_STATES).toEqual(["not_ready", "ready", "reopened"]);
    expect(CLINIC_ONBOARDING_ATTESTATION_CODES).toEqual([
      "PROTOCOL_TEMPLATE_READY",
      "SECURITY_READY",
    ]);
  });

  it("maps the authoritative checklist without exposing evidence", async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [
        {
          checklist: {
            branding_present: false,
            clinic_active: true,
            clinic_owner: true,
            clinic_profile: true,
            protocol_template_ready: false,
            security_ready: true,
            staff_configured: true,
            timezone_valid: true,
            verified_doctor: true,
          },
          clinic_id: "33333333-3333-4333-8333-333333333333",
          protocol_expires_at: null,
          protocol_revision: 0,
          protocol_status: "missing",
          readiness_revision: 2,
          readiness_state: "not_ready",
          security_expires_at: null,
          security_revision: 1,
          security_status: "attested",
        },
      ],
    });
    const result = await readClinicOnboarding({ query }, context);
    expect(result.state).toBe("not_ready");
    expect(result.checklist.brandingPresent).toBe(false);
    expect(result.checklist.protocolTemplateReady).toBe(false);
    expect(JSON.stringify(result)).not.toMatch(/note|evidence|protocol_contents/iu);
  });

  it("uses a controlled optimistic-concurrency call", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ result: "updated" }] });
    await expect(
      attestClinicOnboarding(
        { query },
        {
          ...context,
          attestationCode: "SECURITY_READY",
          expectedRevision: 0,
          status: "attested",
        },
      ),
    ).resolves.toBe("updated");
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("graftvision_private.attest_clinic_onboarding"),
      expect.arrayContaining(["SECURITY_READY", "attested", 0]),
    );
  });

  it("rejects invalid trusted context and stale local expiry", async () => {
    await expect(
      readClinicOnboarding(
        { query: vi.fn() },
        {
          ...context,
          applicationSessionId: "forged",
        },
      ),
    ).rejects.toBeInstanceOf(DatabaseBoundaryError);
    await expect(
      attestClinicOnboarding(
        { query: vi.fn() },
        {
          ...context,
          attestationCode: "SECURITY_READY",
          expectedRevision: 1,
          expiresAt: new Date(0),
          status: "attested",
        },
      ),
    ).rejects.toBeInstanceOf(DatabaseBoundaryError);
  });
});

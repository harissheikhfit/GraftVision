import { describe, expect, it, vi } from "vitest";

import {
  CLINIC_BRANDING_BUCKET,
  CLINIC_BRANDING_MAX_BYTES,
  CLINIC_BRANDING_PERMISSION,
  createClinicLogoObjectKey,
  isSafeClinicBrandAccent,
  readClinicBranding,
  updateClinicBranding,
  validateClinicLogo,
  type TenantTransaction,
} from "./index";

import type { QueryResult } from "pg";

const context = {
  applicationSessionId: "d4000000-0000-4000-8000-000000000001",
  providerIdentityId: "d1000000-0000-4000-8000-000000000001",
};

function transactionReturning(row: unknown) {
  const result: QueryResult = {
    command: "SELECT",
    fields: [],
    oid: 0,
    rowCount: 1,
    rows: [row],
  };
  const query = vi.fn(() => Promise.resolve(result));
  const transaction: TenantTransaction = { query };
  return { query, transaction };
}

function png(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(24);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10]);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return bytes;
}

describe("clinic branding boundary", () => {
  it("uses the approved permission and private bucket", () => {
    expect(CLINIC_BRANDING_PERMISSION).toBe("ADMIN-PERM-001");
    expect(CLINIC_BRANDING_BUCKET).toBe("clinic-branding-private");
  });

  it("validates signatures, dimensions, MIME, and bounded storage keys", () => {
    const logo = validateClinicLogo(png(512, 512), "image/png");
    expect(logo).toMatchObject({ extension: "png", height: 512, width: 512 });
    expect(
      createClinicLogoObjectKey({
        assetId: "d5000000-0000-4000-8000-000000000001",
        clinicId: "d2000000-0000-4000-8000-000000000001",
        extension: logo.extension,
        version: 2,
      }),
    ).toBe(
      "clinics/d2000000-0000-4000-8000-000000000001/clinic-assets/clinic-branding/clinic-logo/d5000000-0000-4000-8000-000000000001/v0002/original.png",
    );
    expect(() => validateClinicLogo(png(128, 512), "image/png")).toThrow("dimensions");
    expect(() => validateClinicLogo(png(512, 512), "image/jpeg")).toThrow("signature");
    expect(() =>
      validateClinicLogo(new Uint8Array(CLINIC_BRANDING_MAX_BYTES + 1), "image/png"),
    ).toThrow("size");
  });

  it("sanitises SVG and rejects active or external content", () => {
    const safe = new TextEncoder().encode(
      '<svg width="512" height="512"><path d="M0 0h1v1z"/></svg>',
    );
    expect(validateClinicLogo(safe, "image/svg+xml")).toMatchObject({
      extension: "svg",
      height: 512,
      width: 512,
    });
    for (const source of [
      '<svg width="512" height="512"><script>alert(1)</script></svg>',
      '<svg width="512" height="512"><image href="https://assets.example.test/logo.png"/></svg>',
      '<svg width="512" height="512" onload="alert(1)"></svg>',
    ]) {
      expect(() => validateClinicLogo(new TextEncoder().encode(source), "image/svg+xml")).toThrow(
        "signature",
      );
    }
  });

  it("accepts controlled accessible accents and rejects unsafe colour input", () => {
    expect(isSafeClinicBrandAccent("#14532d")).toBe(true);
    expect(isSafeClinicBrandAccent("#ffffff")).toBe(false);
    expect(isSafeClinicBrandAccent("#dddddd")).toBe(false);
    expect(isSafeClinicBrandAccent("linear-gradient(red, blue)")).toBe(false);
    expect(isSafeClinicBrandAccent("var(--gv-color-error)")).toBe(false);
  });

  it("maps the routine branding projection without object bytes", async () => {
    const updatedAt = new Date();
    const { transaction } = transactionReturning({
      branding_revision: 2,
      clinic_id: "d2000000-0000-4000-8000-000000000001",
      clinic_name: "FACE Clinic",
      link_accent: "#155e75",
      logo_height: 512,
      logo_mime_type: "image/png",
      logo_object_key: "clinics/example",
      logo_width: 512,
      presentation_title_text: "FACE Consultation",
      primary_accent: "#14532d",
      report_header_text: "FACE Report",
      secondary_accent: "#0f766e",
      selected_control_accent: "#166534",
      updated_at: updatedAt,
      updated_by_platform_user_id: context.providerIdentityId,
    });
    await expect(readClinicBranding(transaction, context)).resolves.toMatchObject({
      brandingRevision: 2,
      clinicName: "FACE Clinic",
      logoMimeType: "image/png",
    });
  });

  it("updates through the controlled optimistic-concurrency function", async () => {
    const { query, transaction } = transactionReturning({ result: "updated" });
    await expect(
      updateClinicBranding(transaction, {
        ...context,
        clinicName: "FACE Clinic",
        expectedRevision: 1,
        linkAccent: "#155e75",
        logoMode: "keep",
        presentationTitleText: "FACE Consultation",
        primaryAccent: "#14532d",
        reportHeaderText: "FACE Report",
        secondaryAccent: "#0f766e",
        selectedControlAccent: "#166534",
      }),
    ).resolves.toBe("updated");
    expect(query).toHaveBeenCalledWith(expect.stringContaining("update_clinic_branding"), [
      context.applicationSessionId,
      context.providerIdentityId,
      1,
      "FACE Clinic",
      "FACE Report",
      "FACE Consultation",
      "#14532d",
      "#0f766e",
      "#155e75",
      "#166534",
      "keep",
      null,
      null,
      null,
      null,
      "BRANDING_UPDATED",
    ]);
  });
});

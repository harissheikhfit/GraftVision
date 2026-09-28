import { describe, expect, it } from "vitest";

import {
  PATIENT_RESOURCE_NAMESPACES,
  STORAGE_ASSET_CATEGORIES,
  STORAGE_BUCKETS,
  STORAGE_EXTENSIONS,
  STORAGE_OBJECT_CLASSES,
  StorageKeyError,
  assertStorageKeyBelongsToClinic,
  buildClinicAssetKey,
  buildExportKey,
  buildPatientAssetKey,
  buildPlatformAssetKey,
  buildQuarantineKey,
  buildRejectedKey,
  buildTemporaryUploadKey,
  getStorageObjectClass,
  isClinicScopedKey,
  parseFinalStorageKey,
  parseStorageKey,
  validateStorageKey,
  type PatientAssetKeyInput,
  type PatientResourceNamespace,
  type StorageAssetCategory,
  type StorageExtension,
  type StorageObjectClass,
  type StorageVariant,
} from "./storage-key";

const clinicAlphaId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const clinicBetaId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const patientId = "11111111-1111-4111-8111-111111111111";
const resourceId = "22222222-2222-4222-8222-222222222222";
const assetId = "33333333-3333-4333-8333-333333333333";
const uploadSessionId = "44444444-4444-4444-8444-444444444444";

const patientImageInput: PatientAssetKeyInput = {
  assetCategory: "front",
  assetId,
  clinicId: clinicAlphaId,
  extension: "webp",
  objectClass: "clinical-image-original",
  patientId,
  resourceId,
  resourceNamespace: "consultations",
  variant: "original",
  version: 1,
};

describe("storage-key builders", () => {
  it("builds a valid clinic asset key", () => {
    expect(
      buildClinicAssetKey({
        assetCategory: "clinic-logo",
        assetId,
        clinicId: clinicAlphaId,
        extension: "png",
        objectClass: "platform-asset",
        variant: "original",
        version: 1,
      }),
    ).toBe(
      `clinics/${clinicAlphaId}/clinic-assets/platform-asset/clinic-logo/${assetId}/v0001/original.png`,
    );
  });

  it("builds a valid patient asset key", () => {
    expect(buildPatientAssetKey(patientImageInput)).toBe(
      `clinics/${clinicAlphaId}/patients/${patientId}/consultations/${resourceId}/clinical-image-original/front/${assetId}/v0001/original.webp`,
    );
  });

  it("builds a valid temporary upload key", () => {
    expect(
      buildTemporaryUploadKey({
        assetId,
        clinicId: clinicAlphaId,
        extension: "heic",
        uploadSessionId,
      }),
    ).toBe(`temporary/clinics/${clinicAlphaId}/uploads/${uploadSessionId}/${assetId}/source.heic`);
  });

  it("builds distinct quarantine and rejected keys", () => {
    const input = { assetId, clinicId: clinicAlphaId, uploadSessionId };

    expect(buildQuarantineKey(input)).toBe(
      `quarantine/clinics/${clinicAlphaId}/uploads/${uploadSessionId}/${assetId}/source.bin`,
    );
    expect(buildRejectedKey(input)).toBe(
      `rejected/clinics/${clinicAlphaId}/uploads/${uploadSessionId}/${assetId}/source.bin`,
    );
  });

  it("builds a valid internal report key", () => {
    expect(
      buildPatientAssetKey({
        ...patientImageInput,
        assetCategory: "report-asset",
        extension: "pdf",
        objectClass: "report-internal",
        resourceNamespace: "reports",
        variant: "report-internal",
        version: 12,
      }),
    ).toContain("/report-internal/report-asset/");
  });

  it("builds a valid patient-safe report key", () => {
    expect(
      buildPatientAssetKey({
        ...patientImageInput,
        assetCategory: "report-asset",
        extension: "pdf",
        objectClass: "report-patient-safe",
        resourceNamespace: "reports",
        variant: "report-patient-safe",
      }),
    ).toContain("/report-patient-safe/report-asset/");
  });

  it("builds a valid presentation-safe derivative key", () => {
    expect(
      buildPatientAssetKey({
        ...patientImageInput,
        assetCategory: "presentation-asset",
        objectClass: "presentation-safe",
        resourceNamespace: "presentations",
        variant: "presentation",
      }),
    ).toContain("/presentations/");
  });

  it("builds a request-scoped export key", () => {
    expect(
      buildExportKey({
        assetId,
        clinicId: clinicAlphaId,
        exportRequestId: resourceId,
        extension: "zip",
        version: 2,
      }),
    ).toBe(
      `clinics/${clinicAlphaId}/exports/${resourceId}/export/export-package/${assetId}/v0002/package.zip`,
    );
  });

  it("builds platform and clinic namespaces separately", () => {
    const key = buildPlatformAssetKey({
      assetCategory: "template",
      assetId,
      extension: "json",
      objectClass: "platform-asset",
      resourceId,
      resourceNamespace: "templates",
      variant: "original",
      version: 1,
    });

    expect(key.startsWith("platform/")).toBe(true);
    expect(isClinicScopedKey(key)).toBe(false);
  });
});

describe("storage-key parsing and ownership", () => {
  it("parses a valid patient key", () => {
    expect(parseStorageKey(buildPatientAssetKey(patientImageInput))).toMatchObject({
      assetCategory: "front",
      bucket: STORAGE_BUCKETS.clinicalPrivate,
      clinicId: clinicAlphaId,
      kind: "patient",
      objectClass: "clinical-image-original",
      patientId,
      version: 1,
    });
  });

  it("round-trips every supported key shape", () => {
    const keys = [
      buildPatientAssetKey(patientImageInput),
      buildClinicAssetKey({
        assetCategory: "report-header",
        assetId,
        clinicId: clinicAlphaId,
        extension: "png",
        objectClass: "platform-asset",
        variant: "original",
        version: 1,
      }),
      buildExportKey({
        assetId,
        clinicId: clinicAlphaId,
        exportRequestId: resourceId,
        extension: "json",
        version: 1,
      }),
      buildPlatformAssetKey({
        assetCategory: "template",
        assetId,
        extension: "json",
        objectClass: "platform-asset",
        resourceId,
        resourceNamespace: "templates",
        variant: "original",
        version: 1,
      }),
      buildTemporaryUploadKey({
        assetId,
        clinicId: clinicAlphaId,
        extension: "jpg",
        uploadSessionId,
      }),
    ];

    for (const key of keys) {
      expect(validateStorageKey(key)).toBe(key);
      expect(parseStorageKey(key).key).toBe(key);
    }
  });

  it("asserts matching clinic ownership", () => {
    expect(
      assertStorageKeyBelongsToClinic(buildPatientAssetKey(patientImageInput), clinicAlphaId)
        .clinicId,
    ).toBe(clinicAlphaId);
  });

  it("rejects a clinic mismatch without revealing either tenant identifier", () => {
    const key = buildPatientAssetKey(patientImageInput);

    try {
      assertStorageKeyBelongsToClinic(key, clinicBetaId);
      expect.unreachable("tenant mismatch must throw");
    } catch (error: unknown) {
      expect(error).toEqual(new StorageKeyError("STORAGE_TENANT_MISMATCH"));

      if (error instanceof Error) {
        expect(error.message).not.toContain(clinicAlphaId);
        expect(error.message).not.toContain(clinicBetaId);
        expect(error.message).not.toContain(key);
      }
    }
  });

  it("does not treat a platform key as clinic owned", () => {
    const key = buildPlatformAssetKey({
      assetCategory: "template",
      assetId,
      extension: "json",
      objectClass: "platform-asset",
      resourceId,
      resourceNamespace: "templates",
      variant: "original",
      version: 1,
    });

    expect(() => assertStorageKeyBelongsToClinic(key, clinicAlphaId)).toThrowError(
      expect.objectContaining({ code: "STORAGE_TENANT_MISMATCH" }),
    );
  });

  it("returns the object class without exposing the full key", () => {
    expect(getStorageObjectClass(buildPatientAssetKey(patientImageInput))).toBe(
      "clinical-image-original",
    );
    expect(
      getStorageObjectClass(
        buildQuarantineKey({ assetId, clinicId: clinicAlphaId, uploadSessionId }),
      ),
    ).toBe("quarantine");
  });

  it("does not parse temporary or quarantine objects as final assets", () => {
    const input = { assetId, clinicId: clinicAlphaId, uploadSessionId };

    expect(() =>
      parseFinalStorageKey(buildTemporaryUploadKey({ ...input, extension: "png" })),
    ).toThrowError(expect.objectContaining({ code: "INVALID_STORAGE_KEY" }));
    expect(() => parseFinalStorageKey(buildQuarantineKey(input))).toThrowError(
      expect.objectContaining({ code: "INVALID_STORAGE_KEY" }),
    );
  });
});

describe("storage-key validation", () => {
  it.each([
    ["missing clinic ID", { ...patientImageInput, clinicId: "" }],
    ["missing patient ID", { ...patientImageInput, patientId: "" }],
    ["invalid UUID", { ...patientImageInput, assetId: "invalid-id" }],
  ])("rejects %s", (_description, input) => {
    expect(() => buildPatientAssetKey(input)).toThrowError(
      expect.objectContaining({ code: "INVALID_STORAGE_SEGMENT" }),
    );
  });

  it("rejects an invalid resource namespace", () => {
    expect(() =>
      buildPatientAssetKey({
        ...patientImageInput,
        resourceNamespace: "unknown" as PatientResourceNamespace,
      }),
    ).toThrowError(expect.objectContaining({ code: "UNSUPPORTED_STORAGE_NAMESPACE" }));
  });

  it("rejects an invalid category", () => {
    expect(() =>
      buildPatientAssetKey({
        ...patientImageInput,
        assetCategory: "unknown" as StorageAssetCategory,
      }),
    ).toThrowError(expect.objectContaining({ code: "UNSUPPORTED_STORAGE_CATEGORY" }));
  });

  it("rejects an invalid object class", () => {
    expect(() =>
      buildPatientAssetKey({
        ...patientImageInput,
        objectClass: "unknown" as StorageObjectClass,
      }),
    ).toThrowError(expect.objectContaining({ code: "UNSUPPORTED_STORAGE_OBJECT_CLASS" }));
  });

  it("rejects invalid and incompatible variants", () => {
    expect(() =>
      buildPatientAssetKey({
        ...patientImageInput,
        variant: "unknown" as StorageVariant,
      }),
    ).toThrowError(expect.objectContaining({ code: "UNSUPPORTED_STORAGE_VARIANT" }));
    expect(() => buildPatientAssetKey({ ...patientImageInput, variant: "thumbnail" })).toThrowError(
      expect.objectContaining({ code: "UNSUPPORTED_STORAGE_VARIANT" }),
    );
  });

  it("rejects invalid and incompatible extensions", () => {
    expect(() =>
      buildPatientAssetKey({
        ...patientImageInput,
        extension: "exe" as StorageExtension,
      }),
    ).toThrowError(expect.objectContaining({ code: "UNSUPPORTED_STORAGE_EXTENSION" }));
    expect(() => buildPatientAssetKey({ ...patientImageInput, extension: "pdf" })).toThrowError(
      expect.objectContaining({ code: "UNSUPPORTED_STORAGE_EXTENSION" }),
    );
  });

  it.each([0, -1, 1.5, 10_000, Number.NaN])("rejects invalid version %s", (version) => {
    expect(() => buildPatientAssetKey({ ...patientImageInput, version })).toThrowError(
      expect.objectContaining({ code: "INVALID_STORAGE_VERSION" }),
    );
  });

  it.each([
    ["dot traversal", "../clinics"],
    ["encoded traversal", "clinics%2fescape"],
    ["slash injection", `clinics/${clinicAlphaId}//patients`],
    ["backslash injection", `clinics\\${clinicAlphaId}`],
    ["null-byte injection", `clinics/${clinicAlphaId}\0/object`],
    ["query-string injection", `clinics/${clinicAlphaId}?other=1`],
    ["fragment injection", `clinics/${clinicAlphaId}#other`],
    ["absolute path", `/clinics/${clinicAlphaId}`],
    ["leading whitespace", ` clinics/${clinicAlphaId}`],
    ["trailing whitespace", `clinics/${clinicAlphaId} `],
    ["control character", `clinics/${clinicAlphaId}\n/object`],
    ["URL scheme", `s3://clinics/${clinicAlphaId}`],
  ])("rejects %s", (_description, key) => {
    expect(() => parseStorageKey(key)).toThrowError(StorageKeyError);
  });

  it("uses deterministic generated fixtures to reject unsafe segments", () => {
    const unsafeFragments = [".", "..", "%2e%2e", "%252e", "\\", "/", "\0", "\t", " ", "?x", "#x"];

    for (const [index, fragment] of unsafeFragments.entries()) {
      const generatedKey =
        index % 2 === 0
          ? `clinics/${clinicAlphaId}/${fragment}/asset`
          : `temporary/clinics/${clinicAlphaId}/uploads/${fragment}`;

      expect(() => parseStorageKey(generatedKey)).toThrowError(StorageKeyError);
    }
  });

  it("never uses a user filename as a generated key", () => {
    const generated = buildPatientAssetKey(patientImageInput);

    for (const unsafeFilename of [
      "person@fixtures.example.test",
      "00000000000.jpg",
      "named-person-front.jpg",
      "../../source.jpg",
    ]) {
      expect(generated).not.toContain(unsafeFilename);
      expect(() => parseStorageKey(unsafeFilename)).toThrowError(StorageKeyError);
    }
  });

  it("keeps internal and patient-safe report classes separate", () => {
    const internal = buildPatientAssetKey({
      ...patientImageInput,
      assetCategory: "report-asset",
      extension: "pdf",
      objectClass: "report-internal",
      resourceNamespace: "reports",
      variant: "report-internal",
    });
    const patientSafe = buildPatientAssetKey({
      ...patientImageInput,
      assetCategory: "report-asset",
      extension: "pdf",
      objectClass: "report-patient-safe",
      resourceNamespace: "reports",
      variant: "report-patient-safe",
    });

    expect(internal).not.toBe(patientSafe);
    expect(getStorageObjectClass(internal)).toBe("report-internal");
    expect(getStorageObjectClass(patientSafe)).toBe("report-patient-safe");
  });

  it("exposes the complete controlled taxonomy without enabling features", () => {
    expect(PATIENT_RESOURCE_NAMESPACES).toContain("follow-ups");
    expect(STORAGE_ASSET_CATEGORIES).toContain("model-screenshot");
    expect(STORAGE_EXTENSIONS).toContain("glb");
    expect(STORAGE_OBJECT_CLASSES).toHaveLength(17);
    expect(STORAGE_OBJECT_CLASSES).toContain("clinic-branding");
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const fixtures = vi.hoisted(() => ({
  createAuthAdminClient: vi.fn(),
  createSignedUrl: vi.fn(),
  from: vi.fn(),
  remove: vi.fn(),
  upload: vi.fn(),
}));

vi.mock("./admin", () => ({ createAuthAdminClient: fixtures.createAuthAdminClient }));

import {
  createPrivateClinicBrandingUrl,
  removePrivateClinicBrandingObject,
  uploadPrivateClinicBrandingObject,
} from "./private-storage";

const objectKey =
  "clinics/d2000000-0000-4000-8000-000000000001/clinic-assets/clinic-branding/clinic-logo/d5000000-0000-4000-8000-000000000001/v0002/original.png";

describe("private clinic branding storage", () => {
  beforeEach(() => {
    fixtures.from.mockReturnValue({
      createSignedUrl: fixtures.createSignedUrl,
      remove: fixtures.remove,
      upload: fixtures.upload,
    });
    fixtures.createAuthAdminClient.mockReturnValue({ storage: { from: fixtures.from } });
  });

  it("uploads without overwrite to the reviewed private bucket", async () => {
    fixtures.upload.mockResolvedValue({ error: null });
    await expect(
      uploadPrivateClinicBrandingObject({
        bytes: new Uint8Array([1, 2, 3]),
        contentType: "image/png",
        objectKey,
      }),
    ).resolves.toBeUndefined();
    expect(fixtures.from).toHaveBeenCalledWith("clinic-branding-private");
    expect(fixtures.upload).toHaveBeenCalledWith(
      objectKey,
      expect.any(Uint8Array),
      expect.objectContaining({ contentType: "image/png", upsert: false }),
    );
  });

  it("creates only short-lived signed URLs and removes exact objects", async () => {
    fixtures.createSignedUrl.mockResolvedValue({
      data: { signedUrl: "https://storage.example.test/signed" },
      error: null,
    });
    fixtures.remove.mockResolvedValue({ error: null });
    await expect(createPrivateClinicBrandingUrl(objectKey)).resolves.toContain("/signed");
    expect(fixtures.createSignedUrl).toHaveBeenCalledWith(objectKey, 300);
    await expect(removePrivateClinicBrandingObject(objectKey)).resolves.toBeUndefined();
    expect(fixtures.remove).toHaveBeenCalledWith([objectKey]);
  });

  it("rejects untrusted or cross-feature object keys before provider access", async () => {
    await expect(
      createPrivateClinicBrandingUrl(
        "clinics/d2000000-0000-4000-8000-000000000001/clinic-assets/report-internal/file.pdf",
      ),
    ).rejects.toMatchObject({ code: "AUTH_PERMISSION_DENIED" });
    expect(fixtures.createAuthAdminClient).not.toHaveBeenCalled();
  });
});

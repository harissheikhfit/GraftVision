import "server-only";

import { AuthBoundaryError } from "../shared/errors";

import { createAuthAdminClient } from "./admin";

const clinicBrandingBucket = "clinic-branding-private";
const clinicalBucket = "clinical-private";

function safeStorageKey(value: string): boolean {
  return (
    /^clinics\/[0-9a-f-]{36}\/clinic-assets\/clinic-branding\/clinic-logo\/[0-9a-f-]{36}\/v[0-9]{4}\/original\.(?:jpeg|jpg|png|svg|webp)$/u.test(
      value,
    ) && !value.includes("..")
  );
}

function assertStorageKey(objectKey: string): void {
  if (!safeStorageKey(objectKey)) {
    throw new AuthBoundaryError("AUTH_PERMISSION_DENIED");
  }
}

function assertClinicalStorageKey(objectKey: string): void {
  if (
    !/^clinics\/[0-9a-f-]{36}\/patients\/[0-9a-f-]{36}\/consultations\/[0-9a-f-]{36}\/clinical-image-original\/(?:front|left_profile|right_profile|crown|donor_rear|donor_left|donor_right)\/[0-9a-f-]{36}\/v0001\/original\.(?:jpeg|png|webp)$/u.test(
      objectKey,
    ) ||
    objectKey.includes("..")
  )
    throw new AuthBoundaryError("AUTH_PERMISSION_DENIED");
}

export async function uploadPrivateClinicalCaptureObject(input: {
  readonly bytes: Uint8Array;
  readonly contentType: "image/jpeg" | "image/png" | "image/webp";
  readonly objectKey: string;
}): Promise<void> {
  assertClinicalStorageKey(input.objectKey);
  const { error } = await createAuthAdminClient()
    .storage.from(clinicalBucket)
    .upload(input.objectKey, input.bytes, {
      cacheControl: "0",
      contentType: input.contentType,
      upsert: false,
    });
  if (error) throw new AuthBoundaryError("AUTH_CONFIGURATION_INVALID");
}

export async function createPrivateClinicalCaptureUrl(objectKey: string): Promise<string> {
  assertClinicalStorageKey(objectKey);
  const { data, error } = await createAuthAdminClient()
    .storage.from(clinicalBucket)
    .createSignedUrl(objectKey, 60);
  if (error || !data.signedUrl) throw new AuthBoundaryError("AUTH_CONFIGURATION_INVALID");
  return data.signedUrl;
}

export async function createPrivateReconstructionArtifactUrl(objectKey: string): Promise<string> {
  if (
    !/^reconstruction\/artifacts\/[0-9a-f-]{36}\/(?:model\.glb|cloud\.ply|mesh\.(?:glb|obj)|preview\.(?:png|webp)|metadata\.json)$/u.test(
      objectKey,
    ) ||
    objectKey.includes("..")
  )
    throw new AuthBoundaryError("AUTH_PERMISSION_DENIED");
  const { data, error } = await createAuthAdminClient()
    .storage.from(clinicalBucket)
    .createSignedUrl(objectKey, 60);
  if (error || !data.signedUrl) throw new AuthBoundaryError("AUTH_CONFIGURATION_INVALID");
  return data.signedUrl;
}

export async function uploadPrivateClinicBrandingObject(input: {
  readonly bytes: Uint8Array;
  readonly contentType: string;
  readonly objectKey: string;
}): Promise<void> {
  assertStorageKey(input.objectKey);
  const { error } = await createAuthAdminClient()
    .storage.from(clinicBrandingBucket)
    .upload(input.objectKey, input.bytes, {
      cacheControl: "3600",
      contentType: input.contentType,
      upsert: false,
    });
  if (error) throw new AuthBoundaryError("AUTH_CONFIGURATION_INVALID");
}

export async function removePrivateClinicBrandingObject(objectKey: string): Promise<void> {
  assertStorageKey(objectKey);
  const { error } = await createAuthAdminClient()
    .storage.from(clinicBrandingBucket)
    .remove([objectKey]);
  if (error) throw new AuthBoundaryError("AUTH_CONFIGURATION_INVALID");
}

export async function createPrivateClinicBrandingUrl(objectKey: string): Promise<string> {
  assertStorageKey(objectKey);
  const { data, error } = await createAuthAdminClient()
    .storage.from(clinicBrandingBucket)
    .createSignedUrl(objectKey, 300);
  if (error || !data.signedUrl) throw new AuthBoundaryError("AUTH_CONFIGURATION_INVALID");
  return data.signedUrl;
}

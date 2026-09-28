import "server-only";

import { DatabaseBoundaryError, type TenantTransaction } from "./server";
import { buildClinicAssetKey, type StorageExtension, type ValidatedStorageKey } from "./storage";

export const CLINIC_BRANDING_PERMISSION = "ADMIN-PERM-001" as const;
export const CLINIC_BRANDING_BUCKET = "clinic-branding-private" as const;
export const CLINIC_BRANDING_MAX_BYTES = 2_097_152;
export const CLINIC_BRANDING_MIN_DIMENSION = 256;
export const CLINIC_BRANDING_MAX_DIMENSION = 2048;

export interface ClinicBrandingContext {
  readonly applicationSessionId: string;
  readonly providerIdentityId: string;
}

export interface ClinicBranding {
  readonly brandingRevision: number;
  readonly clinicId: string;
  readonly clinicName: string;
  readonly linkAccent: string;
  readonly logoHeight: number | null;
  readonly logoMimeType: ClinicLogoMimeType | null;
  readonly logoObjectKey: string | null;
  readonly logoWidth: number | null;
  readonly presentationTitleText: string;
  readonly primaryAccent: string;
  readonly reportHeaderText: string;
  readonly secondaryAccent: string;
  readonly selectedControlAccent: string;
  readonly updatedAt: Date;
  readonly updatedBy: string | null;
}

export type ClinicBrandingUpdateResult = "conflict" | "unchanged" | "updated";
export type ClinicLogoMimeType = "image/jpeg" | "image/png" | "image/svg+xml" | "image/webp";
export type ClinicLogoMode = "keep" | "remove" | "replace";

export interface ValidatedClinicLogo {
  readonly bytes: Uint8Array;
  readonly extension: Extract<StorageExtension, "jpeg" | "png" | "svg" | "webp">;
  readonly height: number;
  readonly mimeType: ClinicLogoMimeType;
  readonly width: number;
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const hexPattern = /^#[0-9a-f]{6}$/u;
const logoMimeTypes = new Set<ClinicLogoMimeType>([
  "image/jpeg",
  "image/png",
  "image/svg+xml",
  "image/webp",
]);

function fail(message: string): never {
  throw new DatabaseBoundaryError(message);
}

function assertContext(context: ClinicBrandingContext): void {
  if (
    !uuidPattern.test(context.applicationSessionId) ||
    !uuidPattern.test(context.providerIdentityId)
  ) {
    fail("Clinic branding context is invalid.");
  }
}

function validateBoundedText(value: string, field: string, maximum: number): void {
  const hasControlCharacter = [...value].some((character) => {
    const codePoint = character.codePointAt(0);
    return codePoint !== undefined && (codePoint < 32 || codePoint === 127);
  });
  if (value !== value.trim() || value.length < 1 || value.length > maximum || hasControlCharacter) {
    fail(`${field} is invalid.`);
  }
}

function linearChannel(value: number): number {
  const channel = value / 255;
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(hex: string): number {
  const red = Number.parseInt(hex.slice(1, 3), 16);
  const green = Number.parseInt(hex.slice(3, 5), 16);
  const blue = Number.parseInt(hex.slice(5, 7), 16);
  return 0.2126 * linearChannel(red) + 0.7152 * linearChannel(green) + 0.0722 * linearChannel(blue);
}

export function isSafeClinicBrandAccent(value: string): boolean {
  if (!hexPattern.test(value)) return false;
  const channels = [
    Number.parseInt(value.slice(1, 3), 16),
    Number.parseInt(value.slice(3, 5), 16),
    Number.parseInt(value.slice(5, 7), 16),
  ];
  const luminance = relativeLuminance(value);
  const bestTextContrast = Math.max(1.05 / (luminance + 0.05), (luminance + 0.05) / 0.05);
  const lightSurfaceContrast = 1.05 / (luminance + 0.05);
  return (
    bestTextContrast >= 4.5 &&
    lightSurfaceContrast >= 3 &&
    Math.max(...channels) - Math.min(...channels) <= 220
  );
}

function assertDimensions(width: number, height: number): void {
  if (
    width < CLINIC_BRANDING_MIN_DIMENSION ||
    width > CLINIC_BRANDING_MAX_DIMENSION ||
    height < CLINIC_BRANDING_MIN_DIMENSION ||
    height > CLINIC_BRANDING_MAX_DIMENSION
  ) {
    fail("Clinic logo dimensions are invalid.");
  }
}

function pngDimensions(bytes: Uint8Array): readonly [number, number] | null {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (bytes.length < 24 || !signature.every((value, index) => bytes[index] === value)) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return [view.getUint32(16), view.getUint32(20)];
}

function jpegDimensions(bytes: Uint8Array): readonly [number, number] | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = bytes[offset + 1] ?? 0;
    if (marker === 0xd9 || marker === 0xda) break;
    const length = ((bytes[offset + 2] ?? 0) << 8) + (bytes[offset + 3] ?? 0);
    if (length < 2 || offset + length + 2 > bytes.length) return null;
    if (
      [0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(
        marker,
      )
    ) {
      return [
        ((bytes[offset + 7] ?? 0) << 8) + (bytes[offset + 8] ?? 0),
        ((bytes[offset + 5] ?? 0) << 8) + (bytes[offset + 6] ?? 0),
      ];
    }
    offset += length + 2;
  }
  return null;
}

function webpDimensions(bytes: Uint8Array): readonly [number, number] | null {
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.subarray(start, end));
  if (bytes.length < 30 || ascii(0, 4) !== "RIFF" || ascii(8, 12) !== "WEBP") return null;
  const chunk = ascii(12, 16);
  if (chunk === "VP8X") {
    const width = 1 + (bytes[24] ?? 0) + ((bytes[25] ?? 0) << 8) + ((bytes[26] ?? 0) << 16);
    const height = 1 + (bytes[27] ?? 0) + ((bytes[28] ?? 0) << 8) + ((bytes[29] ?? 0) << 16);
    return [width, height];
  }
  if (chunk === "VP8 " && bytes.length >= 30) {
    return [
      (((bytes[27] ?? 0) << 8) | (bytes[26] ?? 0)) & 0x3fff,
      (((bytes[29] ?? 0) << 8) | (bytes[28] ?? 0)) & 0x3fff,
    ];
  }
  if (chunk === "VP8L" && bytes.length >= 25 && bytes[20] === 0x2f) {
    const bits =
      (bytes[21] ?? 0) |
      ((bytes[22] ?? 0) << 8) |
      ((bytes[23] ?? 0) << 16) |
      ((bytes[24] ?? 0) << 24);
    return [(bits & 0x3fff) + 1, ((bits >> 14) & 0x3fff) + 1];
  }
  return null;
}

function svgDimensions(bytes: Uint8Array): {
  readonly bytes: Uint8Array;
  readonly dimensions: readonly [number, number];
} | null {
  let source: string;
  try {
    source = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
  if (
    !/^\s*<svg\b/iu.test(source) ||
    /<(?:script|foreignObject|iframe|object|embed|audio|video)\b/iu.test(source) ||
    /\son[a-z]+\s*=/iu.test(source) ||
    /\b(?:href|src)\s*=\s*["']\s*(?:https?:|\/\/|data:|javascript:)/iu.test(source) ||
    /<!DOCTYPE|<!ENTITY|@import|url\s*\(/iu.test(source)
  ) {
    return null;
  }
  const root = source.match(/^\s*<svg\b[^>]*>/iu)?.[0];
  if (!root) return null;
  const number = (name: string) => {
    const value = new RegExp(`\\b${name}\\s*=\\s*["']([0-9]+(?:\\.[0-9]+)?)(?:px)?["']`, "iu").exec(
      root,
    )?.[1];
    return value ? Math.round(Number(value)) : null;
  };
  let width = number("width");
  let height = number("height");
  if (width === null || height === null) {
    const viewBox = /\bviewBox\s*=\s*["'][^\s"']+\s+[^\s"']+\s+([0-9.]+)\s+([0-9.]+)["']/iu.exec(
      root,
    );
    width = viewBox?.[1] ? Math.round(Number(viewBox[1])) : null;
    height = viewBox?.[2] ? Math.round(Number(viewBox[2])) : null;
  }
  if (!width || !height) return null;
  return { bytes: new TextEncoder().encode(source.trim()), dimensions: [width, height] };
}

export function validateClinicLogo(
  input: Uint8Array,
  declaredMimeType: string,
): ValidatedClinicLogo {
  if (input.byteLength < 1 || input.byteLength > CLINIC_BRANDING_MAX_BYTES) {
    fail("Clinic logo size is invalid.");
  }
  if (!logoMimeTypes.has(declaredMimeType as ClinicLogoMimeType)) {
    fail("Clinic logo type is invalid.");
  }
  let bytes = input;
  let dimensions: readonly [number, number] | null = null;
  let extension: ValidatedClinicLogo["extension"];
  switch (declaredMimeType as ClinicLogoMimeType) {
    case "image/png":
      dimensions = pngDimensions(bytes);
      extension = "png";
      break;
    case "image/jpeg":
      dimensions = jpegDimensions(bytes);
      extension = "jpeg";
      break;
    case "image/webp":
      dimensions = webpDimensions(bytes);
      extension = "webp";
      break;
    case "image/svg+xml": {
      const svg = svgDimensions(bytes);
      dimensions = svg?.dimensions ?? null;
      bytes = svg?.bytes ?? bytes;
      extension = "svg";
      break;
    }
  }
  if (!dimensions) fail("Clinic logo signature is invalid.");
  assertDimensions(dimensions[0], dimensions[1]);
  return {
    bytes,
    extension,
    height: dimensions[1],
    mimeType: declaredMimeType as ClinicLogoMimeType,
    width: dimensions[0],
  };
}

export function createClinicLogoObjectKey(input: {
  readonly assetId: string;
  readonly clinicId: string;
  readonly extension: ValidatedClinicLogo["extension"];
  readonly version: number;
}): ValidatedStorageKey {
  return buildClinicAssetKey({
    assetCategory: "clinic-logo",
    assetId: input.assetId,
    clinicId: input.clinicId,
    extension: input.extension,
    objectClass: "clinic-branding",
    variant: "original",
    version: input.version,
  });
}

export async function readClinicBranding(
  transaction: TenantTransaction,
  context: ClinicBrandingContext,
): Promise<ClinicBranding> {
  assertContext(context);
  const result = await transaction.query<{
    readonly branding_revision: number;
    readonly clinic_id: string;
    readonly clinic_name: string;
    readonly link_accent: string;
    readonly logo_height: number | null;
    readonly logo_mime_type: ClinicLogoMimeType | null;
    readonly logo_object_key: string | null;
    readonly logo_width: number | null;
    readonly presentation_title_text: string;
    readonly primary_accent: string;
    readonly report_header_text: string;
    readonly secondary_accent: string;
    readonly selected_control_accent: string;
    readonly updated_at: Date;
    readonly updated_by_platform_user_id: string | null;
  }>("select * from graftvision_private.read_clinic_branding($1::uuid, $2::uuid)", [
    context.applicationSessionId,
    context.providerIdentityId,
  ]);
  const row = result.rows[0];
  if (!row) fail("Clinic branding is unavailable.");
  return {
    brandingRevision: row.branding_revision,
    clinicId: row.clinic_id,
    clinicName: row.clinic_name,
    linkAccent: row.link_accent,
    logoHeight: row.logo_height,
    logoMimeType: row.logo_mime_type,
    logoObjectKey: row.logo_object_key,
    logoWidth: row.logo_width,
    presentationTitleText: row.presentation_title_text,
    primaryAccent: row.primary_accent,
    reportHeaderText: row.report_header_text,
    secondaryAccent: row.secondary_accent,
    selectedControlAccent: row.selected_control_accent,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by_platform_user_id,
  };
}

export async function updateClinicBranding(
  transaction: TenantTransaction,
  input: ClinicBrandingContext & {
    readonly clinicName: string;
    readonly expectedRevision: number;
    readonly linkAccent: string;
    readonly logo?: {
      readonly height: number;
      readonly mimeType: ClinicLogoMimeType;
      readonly objectKey: string;
      readonly width: number;
    };
    readonly logoMode: ClinicLogoMode;
    readonly presentationTitleText: string;
    readonly primaryAccent: string;
    readonly reportHeaderText: string;
    readonly secondaryAccent: string;
    readonly selectedControlAccent: string;
  },
): Promise<ClinicBrandingUpdateResult> {
  assertContext(input);
  validateBoundedText(input.clinicName, "clinicName", 160);
  validateBoundedText(input.reportHeaderText, "reportHeaderText", 120);
  validateBoundedText(input.presentationTitleText, "presentationTitleText", 80);
  for (const accent of [
    input.primaryAccent,
    input.secondaryAccent,
    input.linkAccent,
    input.selectedControlAccent,
  ]) {
    if (!isSafeClinicBrandAccent(accent)) fail("Clinic branding accent is invalid.");
  }
  if (!Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 1) {
    fail("expectedRevision is invalid.");
  }
  if (input.logoMode === "replace" && !input.logo) fail("Replacement logo is required.");
  if (input.logoMode !== "replace" && input.logo) fail("Logo metadata is invalid.");
  const result = await transaction.query<{ readonly result: ClinicBrandingUpdateResult }>(
    `select graftvision_private.update_clinic_branding(
      $1::uuid, $2::uuid, $3::integer, $4::text, $5::text, $6::text,
      $7::text, $8::text, $9::text, $10::text, $11::text, $12::text,
      $13::text, $14::integer, $15::integer, $16::text
    ) as result`,
    [
      input.applicationSessionId,
      input.providerIdentityId,
      input.expectedRevision,
      input.clinicName,
      input.reportHeaderText,
      input.presentationTitleText,
      input.primaryAccent,
      input.secondaryAccent,
      input.linkAccent,
      input.selectedControlAccent,
      input.logoMode,
      input.logo?.objectKey ?? null,
      input.logo?.mimeType ?? null,
      input.logo?.width ?? null,
      input.logo?.height ?? null,
      input.logoMode === "remove" ? "LOGO_REMOVED" : "BRANDING_UPDATED",
    ],
  );
  const outcome = result.rows[0]?.result;
  if (!outcome) fail("Clinic branding update failed.");
  return outcome;
}

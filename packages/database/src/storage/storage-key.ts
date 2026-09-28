import "server-only";

export const STORAGE_BUCKETS = {
  clinicBrandingPrivate: "clinic-branding-private",
  clinicalPrivate: "clinical-private",
  platformPrivate: "platform-private",
  transferPrivate: "transfer-private",
} as const;

export const PATIENT_RESOURCE_NAMESPACES = [
  "ai-inputs",
  "ai-outputs",
  "comparisons",
  "consultations",
  "follow-ups",
  "models",
  "presentations",
  "procedures",
  "reports",
  "surgery-assessments",
] as const;

export const PLATFORM_RESOURCE_NAMESPACES = ["operations", "platform-assets", "templates"] as const;

export const STORAGE_OBJECT_CLASSES = [
  "ai-input",
  "ai-output",
  "clinical-image-derivative",
  "clinical-image-original",
  "clinical-video-original",
  "clinic-branding",
  "comparison-output",
  "export",
  "model-derivative",
  "model-original",
  "model-screenshot",
  "platform-asset",
  "presentation-safe",
  "report-internal",
  "report-patient-safe",
  "report-support",
  "thumbnail",
] as const;

// This storage taxonomy is provisional and requires later clinical protocol approval.
export const STORAGE_ASSET_CATEGORIES = [
  "ai-input",
  "ai-output",
  "clinical-video",
  "clinic-logo",
  "comparison-output",
  "crown",
  "document",
  "export-package",
  "follow-up",
  "front",
  "front-down",
  "left-donor",
  "left-temple",
  "model",
  "model-screenshot",
  "postoperative",
  "presentation-asset",
  "rear-donor",
  "report-asset",
  "report-header",
  "right-donor",
  "right-temple",
  "signature",
  "template",
  "top",
] as const;

export const STORAGE_VARIANTS = [
  "comparison",
  "model-preview",
  "normalised",
  "original",
  "package",
  "presentation",
  "preview",
  "report-internal",
  "report-patient-safe",
  "thumbnail",
] as const;

// These extensions are path-safe hints, not an upload acceptance or content-validation policy.
export const STORAGE_EXTENSIONS = [
  "bin",
  "csv",
  "glb",
  "gltf",
  "heic",
  "jpeg",
  "jpg",
  "json",
  "mov",
  "mp4",
  "pdf",
  "png",
  "svg",
  "webp",
  "zip",
] as const;

export const STORAGE_ERROR_CODES = [
  "INVALID_STORAGE_KEY",
  "INVALID_STORAGE_SEGMENT",
  "INVALID_STORAGE_VERSION",
  "STORAGE_TENANT_MISMATCH",
  "UNSUPPORTED_STORAGE_CATEGORY",
  "UNSUPPORTED_STORAGE_EXTENSION",
  "UNSUPPORTED_STORAGE_NAMESPACE",
  "UNSUPPORTED_STORAGE_OBJECT_CLASS",
  "UNSUPPORTED_STORAGE_VARIANT",
] as const;

export type StorageBucket = (typeof STORAGE_BUCKETS)[keyof typeof STORAGE_BUCKETS];
export type PatientResourceNamespace = (typeof PATIENT_RESOURCE_NAMESPACES)[number];
export type PlatformResourceNamespace = (typeof PLATFORM_RESOURCE_NAMESPACES)[number];
export type StorageObjectClass = (typeof STORAGE_OBJECT_CLASSES)[number];
export type StorageAssetCategory = (typeof STORAGE_ASSET_CATEGORIES)[number];
export type StorageVariant = (typeof STORAGE_VARIANTS)[number];
export type StorageExtension = (typeof STORAGE_EXTENSIONS)[number];
export type StorageErrorCode = (typeof STORAGE_ERROR_CODES)[number];
export type StorageLifecycle = "final" | "quarantine" | "rejected" | "temporary";
export type ValidatedStorageKey = string & { readonly __validatedStorageKey: unique symbol };

export interface PatientAssetKeyInput {
  readonly assetCategory: StorageAssetCategory;
  readonly assetId: string;
  readonly clinicId: string;
  readonly extension: StorageExtension;
  readonly objectClass: StorageObjectClass;
  readonly patientId: string;
  readonly resourceId: string;
  readonly resourceNamespace: PatientResourceNamespace;
  readonly variant: StorageVariant;
  readonly version: number;
}

export interface ClinicAssetKeyInput {
  readonly assetCategory: StorageAssetCategory;
  readonly assetId: string;
  readonly clinicId: string;
  readonly extension: StorageExtension;
  readonly objectClass: StorageObjectClass;
  readonly variant: StorageVariant;
  readonly version: number;
}

export interface PlatformAssetKeyInput {
  readonly assetCategory: StorageAssetCategory;
  readonly assetId: string;
  readonly extension: StorageExtension;
  readonly objectClass: StorageObjectClass;
  readonly resourceId: string;
  readonly resourceNamespace: PlatformResourceNamespace;
  readonly variant: StorageVariant;
  readonly version: number;
}

export interface TransferAssetKeyInput {
  readonly assetId: string;
  readonly clinicId: string;
  readonly extension: StorageExtension;
  readonly uploadSessionId: string;
}

export interface ExportAssetKeyInput {
  readonly assetId: string;
  readonly clinicId: string;
  readonly exportRequestId: string;
  readonly extension: Extract<StorageExtension, "csv" | "json" | "zip">;
  readonly version: number;
}

export interface StorageMetadataContract {
  readonly assetCategory: StorageAssetCategory;
  readonly assetId: string;
  readonly bucket: StorageBucket;
  readonly checksum?: string;
  readonly clinicId?: string;
  readonly declaredMimeType?: string;
  readonly detectedMimeType?: string;
  readonly extension: StorageExtension;
  readonly objectKey: ValidatedStorageKey;
  readonly originalAssetId?: string;
  readonly patientId?: string;
  readonly processingStatus?: string;
  readonly resourceId?: string;
  readonly resourceNamespace?: PatientResourceNamespace | PlatformResourceNamespace | "exports";
  readonly retentionState?: string;
  readonly sizeBytes?: number;
  readonly uploadStatus?: string;
  readonly variant: StorageVariant | "source";
  readonly version?: number;
}

interface ParsedBase {
  readonly assetId: string;
  readonly bucket: StorageBucket;
  readonly extension: StorageExtension;
  readonly key: ValidatedStorageKey;
  readonly lifecycle: StorageLifecycle;
}

export interface ParsedPatientAssetKey extends ParsedBase {
  readonly assetCategory: StorageAssetCategory;
  readonly clinicId: string;
  readonly kind: "patient";
  readonly lifecycle: "final";
  readonly objectClass: StorageObjectClass;
  readonly patientId: string;
  readonly resourceId: string;
  readonly resourceNamespace: PatientResourceNamespace;
  readonly variant: StorageVariant;
  readonly version: number;
}

export interface ParsedClinicAssetKey extends ParsedBase {
  readonly assetCategory: StorageAssetCategory;
  readonly clinicId: string;
  readonly kind: "clinic";
  readonly lifecycle: "final";
  readonly objectClass: StorageObjectClass;
  readonly variant: StorageVariant;
  readonly version: number;
}

export interface ParsedExportAssetKey extends ParsedBase {
  readonly assetCategory: "export-package";
  readonly clinicId: string;
  readonly exportRequestId: string;
  readonly kind: "export";
  readonly lifecycle: "final";
  readonly objectClass: "export";
  readonly variant: "package";
  readonly version: number;
}

export interface ParsedPlatformAssetKey extends ParsedBase {
  readonly assetCategory: StorageAssetCategory;
  readonly kind: "platform";
  readonly lifecycle: "final";
  readonly objectClass: StorageObjectClass;
  readonly resourceId: string;
  readonly resourceNamespace: PlatformResourceNamespace;
  readonly variant: StorageVariant;
  readonly version: number;
}

export interface ParsedTransferAssetKey extends ParsedBase {
  readonly clinicId: string;
  readonly kind: "transfer";
  readonly lifecycle: "quarantine" | "rejected" | "temporary";
  readonly uploadSessionId: string;
  readonly variant: "source";
}

export type ParsedStorageKey =
  | ParsedClinicAssetKey
  | ParsedExportAssetKey
  | ParsedPatientAssetKey
  | ParsedPlatformAssetKey
  | ParsedTransferAssetKey;

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const safeKeyPattern = /^[a-z0-9./-]+$/u;
const versionPattern = /^v([0-9]{4})$/u;
const filePattern = /^([a-z0-9-]+)\.([a-z0-9]+)$/u;

const patientNamespaceSet = new Set<string>(PATIENT_RESOURCE_NAMESPACES);
const platformNamespaceSet = new Set<string>(PLATFORM_RESOURCE_NAMESPACES);
const objectClassSet = new Set<string>(STORAGE_OBJECT_CLASSES);
const categorySet = new Set<string>(STORAGE_ASSET_CATEGORIES);
const variantSet = new Set<string>(STORAGE_VARIANTS);
const extensionSet = new Set<string>(STORAGE_EXTENSIONS);

const objectClassVariants: Readonly<Record<StorageObjectClass, readonly StorageVariant[]>> = {
  "ai-input": ["original"],
  "ai-output": ["preview", "comparison", "model-preview"],
  "clinical-image-derivative": [
    "normalised",
    "preview",
    "report-internal",
    "report-patient-safe",
    "presentation",
  ],
  "clinical-image-original": ["original"],
  "clinical-video-original": ["original"],
  "clinic-branding": ["original"],
  "comparison-output": ["comparison"],
  export: ["package"],
  "model-derivative": ["model-preview", "preview"],
  "model-original": ["original"],
  "model-screenshot": ["preview", "report-internal", "report-patient-safe", "presentation"],
  "platform-asset": ["original", "preview"],
  "presentation-safe": ["presentation"],
  "report-internal": ["report-internal"],
  "report-patient-safe": ["report-patient-safe"],
  "report-support": ["original", "preview"],
  thumbnail: ["thumbnail"],
};

const objectClassExtensions: Readonly<Record<StorageObjectClass, readonly StorageExtension[]>> = {
  "ai-input": ["glb", "gltf", "jpeg", "jpg", "png", "webp"],
  "ai-output": ["glb", "gltf", "jpeg", "jpg", "json", "png", "webp"],
  "clinical-image-derivative": ["jpeg", "jpg", "png", "webp"],
  "clinical-image-original": ["heic", "jpeg", "jpg", "png", "webp"],
  "clinical-video-original": ["mov", "mp4"],
  "clinic-branding": ["jpeg", "jpg", "png", "svg", "webp"],
  "comparison-output": ["jpeg", "jpg", "png", "webp"],
  export: ["csv", "json", "zip"],
  "model-derivative": ["glb", "gltf"],
  "model-original": ["glb", "gltf"],
  "model-screenshot": ["jpeg", "jpg", "png", "webp"],
  "platform-asset": ["jpeg", "jpg", "json", "pdf", "png", "webp"],
  "presentation-safe": ["jpeg", "jpg", "png", "webp"],
  "report-internal": ["pdf"],
  "report-patient-safe": ["pdf"],
  "report-support": ["jpeg", "jpg", "png", "webp"],
  thumbnail: ["jpeg", "jpg", "png", "webp"],
};

const errorMessages: Readonly<Record<StorageErrorCode, string>> = {
  INVALID_STORAGE_KEY: "Storage key is invalid.",
  INVALID_STORAGE_SEGMENT: "Storage key contains an invalid segment.",
  INVALID_STORAGE_VERSION: "Storage version is invalid.",
  STORAGE_TENANT_MISMATCH: "Storage key does not belong to the trusted clinic.",
  UNSUPPORTED_STORAGE_CATEGORY: "Storage category is unsupported.",
  UNSUPPORTED_STORAGE_EXTENSION: "Storage extension is unsupported.",
  UNSUPPORTED_STORAGE_NAMESPACE: "Storage namespace is unsupported.",
  UNSUPPORTED_STORAGE_OBJECT_CLASS: "Storage object class is unsupported.",
  UNSUPPORTED_STORAGE_VARIANT: "Storage variant is unsupported.",
};

export class StorageKeyError extends Error {
  public readonly code: StorageErrorCode;

  public constructor(code: StorageErrorCode) {
    super(errorMessages[code]);
    this.name = "StorageKeyError";
    this.code = code;
  }
}

function fail(code: StorageErrorCode): never {
  throw new StorageKeyError(code);
}

function assertUuid(value: string): string {
  if (!uuidPattern.test(value)) {
    fail("INVALID_STORAGE_SEGMENT");
  }

  return value;
}

function assertMember<Value extends string>(
  value: string,
  values: ReadonlySet<string>,
  code: StorageErrorCode,
): Value {
  if (!values.has(value)) {
    fail(code);
  }

  return value as Value;
}

function assertObjectClass(value: string): StorageObjectClass {
  return assertMember<StorageObjectClass>(
    value,
    objectClassSet,
    "UNSUPPORTED_STORAGE_OBJECT_CLASS",
  );
}

function assertCategory(value: string): StorageAssetCategory {
  return assertMember<StorageAssetCategory>(value, categorySet, "UNSUPPORTED_STORAGE_CATEGORY");
}

function assertVariant(value: string): StorageVariant {
  return assertMember<StorageVariant>(value, variantSet, "UNSUPPORTED_STORAGE_VARIANT");
}

function assertExtension(value: string): StorageExtension {
  return assertMember<StorageExtension>(value, extensionSet, "UNSUPPORTED_STORAGE_EXTENSION");
}

function assertVersion(value: number): string {
  if (!Number.isSafeInteger(value) || value < 1 || value > 9999) {
    fail("INVALID_STORAGE_VERSION");
  }

  return `v${value.toString().padStart(4, "0")}`;
}

function parseVersion(value: string): number {
  const match = versionPattern.exec(value);
  const version = match?.[1] ? Number.parseInt(match[1], 10) : Number.NaN;

  if (!Number.isSafeInteger(version) || version < 1) {
    fail("INVALID_STORAGE_VERSION");
  }

  return version;
}

function assertObjectCompatibility(
  objectClass: StorageObjectClass,
  variant: StorageVariant,
  extension: StorageExtension,
): void {
  if (!objectClassVariants[objectClass].includes(variant)) {
    fail("UNSUPPORTED_STORAGE_VARIANT");
  }

  if (!objectClassExtensions[objectClass].includes(extension)) {
    fail("UNSUPPORTED_STORAGE_EXTENSION");
  }
}

function buildVersionedFile(variant: StorageVariant, extension: StorageExtension): string {
  return `${variant}.${extension}`;
}

function validateRawKey(key: string): string[] {
  const hasControlCharacter = [...key].some((character) => {
    const codePoint = character.codePointAt(0);
    return codePoint !== undefined && (codePoint <= 31 || codePoint === 127);
  });

  if (
    key.length < 1 ||
    key.length > 1024 ||
    key !== key.trim() ||
    key.startsWith("/") ||
    key.includes("//") ||
    key.includes("\\") ||
    key.includes("%") ||
    key.includes("?") ||
    key.includes("#") ||
    key.includes("\0") ||
    hasControlCharacter ||
    /^[a-z][a-z0-9+.-]*:/iu.test(key) ||
    !safeKeyPattern.test(key)
  ) {
    fail("INVALID_STORAGE_KEY");
  }

  const segments = key.split("/");

  if (
    segments.some(
      (segment) =>
        segment.length === 0 || segment === "." || segment === ".." || segment !== segment.trim(),
    )
  ) {
    fail("INVALID_STORAGE_SEGMENT");
  }

  return segments;
}

function parseFile(value: string): {
  readonly extension: StorageExtension;
  readonly variant: StorageVariant;
} {
  const match = filePattern.exec(value);

  if (!match?.[1] || !match[2]) {
    fail("INVALID_STORAGE_KEY");
  }

  return {
    extension: assertExtension(match[2]),
    variant: assertVariant(match[1]),
  };
}

function asValidatedKey(key: string): ValidatedStorageKey {
  return key as ValidatedStorageKey;
}

function buildFinalKey(segments: readonly string[]): ValidatedStorageKey {
  return validateStorageKey(segments.join("/"));
}

export function buildPatientAssetKey(input: PatientAssetKeyInput): ValidatedStorageKey {
  const objectClass = assertObjectClass(input.objectClass);
  const category = assertCategory(input.assetCategory);
  const variant = assertVariant(input.variant);
  const extension = assertExtension(input.extension);
  const resourceNamespace = assertMember<PatientResourceNamespace>(
    input.resourceNamespace,
    patientNamespaceSet,
    "UNSUPPORTED_STORAGE_NAMESPACE",
  );
  assertObjectCompatibility(objectClass, variant, extension);

  return buildFinalKey([
    "clinics",
    assertUuid(input.clinicId),
    "patients",
    assertUuid(input.patientId),
    resourceNamespace,
    assertUuid(input.resourceId),
    objectClass,
    category,
    assertUuid(input.assetId),
    assertVersion(input.version),
    buildVersionedFile(variant, extension),
  ]);
}

export function buildClinicAssetKey(input: ClinicAssetKeyInput): ValidatedStorageKey {
  const objectClass = assertObjectClass(input.objectClass);
  const category = assertCategory(input.assetCategory);
  const variant = assertVariant(input.variant);
  const extension = assertExtension(input.extension);
  assertObjectCompatibility(objectClass, variant, extension);

  return buildFinalKey([
    "clinics",
    assertUuid(input.clinicId),
    "clinic-assets",
    objectClass,
    category,
    assertUuid(input.assetId),
    assertVersion(input.version),
    buildVersionedFile(variant, extension),
  ]);
}

export function buildPlatformAssetKey(input: PlatformAssetKeyInput): ValidatedStorageKey {
  const objectClass = assertObjectClass(input.objectClass);
  const category = assertCategory(input.assetCategory);
  const variant = assertVariant(input.variant);
  const extension = assertExtension(input.extension);
  const resourceNamespace = assertMember<PlatformResourceNamespace>(
    input.resourceNamespace,
    platformNamespaceSet,
    "UNSUPPORTED_STORAGE_NAMESPACE",
  );
  assertObjectCompatibility(objectClass, variant, extension);

  return buildFinalKey([
    "platform",
    resourceNamespace,
    assertUuid(input.resourceId),
    objectClass,
    category,
    assertUuid(input.assetId),
    assertVersion(input.version),
    buildVersionedFile(variant, extension),
  ]);
}

export function buildExportKey(input: ExportAssetKeyInput): ValidatedStorageKey {
  const extension = assertExtension(input.extension);
  assertObjectCompatibility("export", "package", extension);

  return buildFinalKey([
    "clinics",
    assertUuid(input.clinicId),
    "exports",
    assertUuid(input.exportRequestId),
    "export",
    "export-package",
    assertUuid(input.assetId),
    assertVersion(input.version),
    buildVersionedFile("package", extension),
  ]);
}

function buildTransferKey(
  lifecycle: ParsedTransferAssetKey["lifecycle"],
  input: TransferAssetKeyInput,
): ValidatedStorageKey {
  const extension = assertExtension(input.extension);

  if ((lifecycle === "quarantine" || lifecycle === "rejected") && extension !== "bin") {
    fail("UNSUPPORTED_STORAGE_EXTENSION");
  }

  return validateStorageKey(
    [
      lifecycle,
      "clinics",
      assertUuid(input.clinicId),
      "uploads",
      assertUuid(input.uploadSessionId),
      assertUuid(input.assetId),
      `source.${extension}`,
    ].join("/"),
  );
}

export function buildTemporaryUploadKey(input: TransferAssetKeyInput): ValidatedStorageKey {
  return buildTransferKey("temporary", input);
}

export function buildQuarantineKey(
  input: Omit<TransferAssetKeyInput, "extension">,
): ValidatedStorageKey {
  return buildTransferKey("quarantine", { ...input, extension: "bin" });
}

export function buildRejectedKey(
  input: Omit<TransferAssetKeyInput, "extension">,
): ValidatedStorageKey {
  return buildTransferKey("rejected", { ...input, extension: "bin" });
}

function parseTransferKey(
  key: string,
  segments: string[],
  lifecycle: ParsedTransferAssetKey["lifecycle"],
): ParsedTransferAssetKey {
  if (segments.length !== 7 || segments[1] !== "clinics" || segments[3] !== "uploads") {
    fail("INVALID_STORAGE_KEY");
  }

  const file = /^source\.([a-z0-9]+)$/u.exec(segments[6] ?? "");

  if (!file?.[1]) {
    fail("INVALID_STORAGE_KEY");
  }

  const extension = assertExtension(file[1]);

  if ((lifecycle === "quarantine" || lifecycle === "rejected") && extension !== "bin") {
    fail("UNSUPPORTED_STORAGE_EXTENSION");
  }

  return {
    assetId: assertUuid(segments[5] ?? ""),
    bucket: STORAGE_BUCKETS.transferPrivate,
    clinicId: assertUuid(segments[2] ?? ""),
    extension,
    key: asValidatedKey(key),
    kind: "transfer",
    lifecycle,
    uploadSessionId: assertUuid(segments[4] ?? ""),
    variant: "source",
  };
}

function parsePatientKey(key: string, segments: string[]): ParsedPatientAssetKey {
  if (segments.length !== 11 || segments[2] !== "patients") {
    fail("INVALID_STORAGE_KEY");
  }

  const objectClass = assertObjectClass(segments[6] ?? "");
  const file = parseFile(segments[10] ?? "");
  assertObjectCompatibility(objectClass, file.variant, file.extension);

  return {
    assetCategory: assertCategory(segments[7] ?? ""),
    assetId: assertUuid(segments[8] ?? ""),
    bucket: STORAGE_BUCKETS.clinicalPrivate,
    clinicId: assertUuid(segments[1] ?? ""),
    extension: file.extension,
    key: asValidatedKey(key),
    kind: "patient",
    lifecycle: "final",
    objectClass,
    patientId: assertUuid(segments[3] ?? ""),
    resourceId: assertUuid(segments[5] ?? ""),
    resourceNamespace: assertMember<PatientResourceNamespace>(
      segments[4] ?? "",
      patientNamespaceSet,
      "UNSUPPORTED_STORAGE_NAMESPACE",
    ),
    variant: file.variant,
    version: parseVersion(segments[9] ?? ""),
  };
}

function parseClinicAssetKey(key: string, segments: string[]): ParsedClinicAssetKey {
  if (segments.length !== 8 || segments[2] !== "clinic-assets") {
    fail("INVALID_STORAGE_KEY");
  }

  const objectClass = assertObjectClass(segments[3] ?? "");
  const file = parseFile(segments[7] ?? "");
  assertObjectCompatibility(objectClass, file.variant, file.extension);

  return {
    assetCategory: assertCategory(segments[4] ?? ""),
    assetId: assertUuid(segments[5] ?? ""),
    bucket: STORAGE_BUCKETS.clinicalPrivate,
    clinicId: assertUuid(segments[1] ?? ""),
    extension: file.extension,
    key: asValidatedKey(key),
    kind: "clinic",
    lifecycle: "final",
    objectClass,
    variant: file.variant,
    version: parseVersion(segments[6] ?? ""),
  };
}

function parseExportKey(key: string, segments: string[]): ParsedExportAssetKey {
  if (
    segments.length !== 9 ||
    segments[2] !== "exports" ||
    segments[4] !== "export" ||
    segments[5] !== "export-package"
  ) {
    fail("INVALID_STORAGE_KEY");
  }

  const file = parseFile(segments[8] ?? "");

  if (file.variant !== "package") {
    fail("UNSUPPORTED_STORAGE_VARIANT");
  }

  assertObjectCompatibility("export", file.variant, file.extension);

  return {
    assetCategory: "export-package",
    assetId: assertUuid(segments[6] ?? ""),
    bucket: STORAGE_BUCKETS.transferPrivate,
    clinicId: assertUuid(segments[1] ?? ""),
    exportRequestId: assertUuid(segments[3] ?? ""),
    extension: file.extension,
    key: asValidatedKey(key),
    kind: "export",
    lifecycle: "final",
    objectClass: "export",
    variant: "package",
    version: parseVersion(segments[7] ?? ""),
  };
}

function parsePlatformKey(key: string, segments: string[]): ParsedPlatformAssetKey {
  if (segments.length !== 8) {
    fail("INVALID_STORAGE_KEY");
  }

  const objectClass = assertObjectClass(segments[3] ?? "");
  const file = parseFile(segments[7] ?? "");
  assertObjectCompatibility(objectClass, file.variant, file.extension);

  return {
    assetCategory: assertCategory(segments[4] ?? ""),
    assetId: assertUuid(segments[5] ?? ""),
    bucket: STORAGE_BUCKETS.platformPrivate,
    extension: file.extension,
    key: asValidatedKey(key),
    kind: "platform",
    lifecycle: "final",
    objectClass,
    resourceId: assertUuid(segments[2] ?? ""),
    resourceNamespace: assertMember<PlatformResourceNamespace>(
      segments[1] ?? "",
      platformNamespaceSet,
      "UNSUPPORTED_STORAGE_NAMESPACE",
    ),
    variant: file.variant,
    version: parseVersion(segments[6] ?? ""),
  };
}

export function parseStorageKey(key: string): ParsedStorageKey {
  const segments = validateRawKey(key);
  const root = segments[0];

  if (root === "temporary" || root === "quarantine" || root === "rejected") {
    return parseTransferKey(key, segments, root);
  }

  if (root === "platform") {
    return parsePlatformKey(key, segments);
  }

  if (root !== "clinics") {
    fail("INVALID_STORAGE_KEY");
  }

  if (segments[2] === "patients") {
    return parsePatientKey(key, segments);
  }

  if (segments[2] === "clinic-assets") {
    return parseClinicAssetKey(key, segments);
  }

  if (segments[2] === "exports") {
    return parseExportKey(key, segments);
  }

  fail("UNSUPPORTED_STORAGE_NAMESPACE");
}

export function validateStorageKey(key: string): ValidatedStorageKey {
  return parseStorageKey(key).key;
}

export function parseFinalStorageKey(
  key: string,
): Exclude<ParsedStorageKey, ParsedTransferAssetKey> {
  const parsed = parseStorageKey(key);

  if (parsed.kind === "transfer") {
    fail("INVALID_STORAGE_KEY");
  }

  return parsed;
}

export function isClinicScopedKey(key: string): boolean {
  try {
    const parsed = parseStorageKey(key);
    return parsed.kind !== "platform";
  } catch {
    return false;
  }
}

export function assertStorageKeyBelongsToClinic(
  key: string,
  trustedClinicId: string,
): ParsedClinicAssetKey | ParsedExportAssetKey | ParsedPatientAssetKey | ParsedTransferAssetKey {
  const trustedId = assertUuid(trustedClinicId);
  const parsed = parseStorageKey(key);

  if (parsed.kind === "platform" || parsed.clinicId !== trustedId) {
    fail("STORAGE_TENANT_MISMATCH");
  }

  return parsed;
}

export function getStorageObjectClass(
  key: string,
): StorageObjectClass | ParsedTransferAssetKey["lifecycle"] {
  const parsed = parseStorageKey(key);
  return parsed.kind === "transfer" ? parsed.lifecycle : parsed.objectClass;
}

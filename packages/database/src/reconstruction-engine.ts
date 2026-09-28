import "server-only";

import { createHash } from "node:crypto";

export interface PreparedReconstructionInput {
  readonly captureStep: string;
  readonly normalizedChecksum: string;
}

export interface SyntheticReconstructionArtifact {
  readonly bytes: Uint8Array;
  readonly checksum: string;
  readonly configurationVersion: "recon-config-synthetic-v1";
  readonly engineName: "recon-engine-synthetic-v1";
  readonly engineVersion: "1.0.0";
  readonly geometry: {
    readonly boundingBoxMm: readonly [number, number, number];
    readonly faceCount: number;
    readonly pointCount: number;
    readonly vertexCount: number;
  };
  readonly mimeType: "model/gltf-binary";
}

const REQUIRED_STEPS = [
  "front",
  "left_profile",
  "right_profile",
  "crown",
  "donor_rear",
  "donor_left",
  "donor_right",
] as const;

/**
 * Pipeline-only geometry: this is deliberately not photogrammetry or clinical analysis.
 * It emits a valid, deterministic GLB envelope so the protected output lifecycle can be
 * exercised until a separately approved reconstruction engine is integrated.
 */
export function executeSyntheticReconstruction(
  inputs: readonly PreparedReconstructionInput[],
): SyntheticReconstructionArtifact {
  const ordered = [...inputs].sort(
    (left, right) =>
      REQUIRED_STEPS.indexOf(left.captureStep as (typeof REQUIRED_STEPS)[number]) -
      REQUIRED_STEPS.indexOf(right.captureStep as (typeof REQUIRED_STEPS)[number]),
  );
  if (
    ordered.length !== REQUIRED_STEPS.length ||
    ordered.some((input, index) => input.captureStep !== REQUIRED_STEPS[index])
  ) {
    throw new Error("Synthetic reconstruction requires the exact seven capture steps.");
  }

  const sourceDigest = createHash("sha256")
    .update("recon-engine-synthetic-v1:1.0.0:recon-config-synthetic-v1")
    .update(ordered.map((input) => input.normalizedChecksum).join(":"))
    .digest("hex");
  const json = Buffer.from(
    JSON.stringify({
      asset: { version: "2.0", generator: "recon-engine-synthetic-v1" },
      extras: { sourceDigest },
    }),
    "utf8",
  );
  const paddedLength = Math.ceil(json.length / 4) * 4;
  const bytes = Buffer.alloc(20 + paddedLength, 0x20);
  bytes.writeUInt32LE(bytes.length, 8);
  bytes.write("glTF", 0, "ascii");
  bytes.writeUInt32LE(2, 4);
  bytes.writeUInt32LE(paddedLength, 12);
  bytes.write("JSON", 16, "ascii");
  json.copy(bytes, 20);

  return {
    bytes,
    checksum: createHash("sha256").update(bytes).digest("hex"),
    configurationVersion: "recon-config-synthetic-v1",
    engineName: "recon-engine-synthetic-v1",
    engineVersion: "1.0.0",
    geometry: { boundingBoxMm: [1, 1, 1], faceCount: 0, pointCount: 0, vertexCount: 1 },
    mimeType: "model/gltf-binary",
  };
}

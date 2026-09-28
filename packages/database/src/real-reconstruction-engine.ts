import "server-only";

import { execFile as nodeExecFile } from "node:child_process";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

const execFile = promisify(nodeExecFile);

export const REAL_ENGINE_NAME = "COLMAP" as const;
export const REAL_ENGINE_VERSION = "4.1.1" as const;
export const REAL_ENGINE_LICENSE = "BSD-3-Clause" as const;
export const REAL_ENGINE_ADAPTER_VERSION = "recon-colmap-adapter-v2" as const;
export const REAL_ENGINE_CONFIGURATION_VERSION = "recon-colmap-config-v2" as const;

export const RECONSTRUCTION_ARTIFACT_TYPES = [
  "mesh_glb",
  "sparse_point_cloud",
  "dense_point_cloud",
  "surface_mesh",
  "reconstruction_preview",
  "bounded_metadata",
] as const;
export const RECONSTRUCTION_ARTIFACT_MIME_TYPES = [
  "model/gltf-binary",
  "application/ply",
  "model/obj",
  "application/json",
  "image/png",
  "image/webp",
  "application/octet-stream",
] as const;
export const RECONSTRUCTION_EXECUTION_MODES = ["synthetic", "sparse_cpu", "dense_cuda"] as const;
export type ReconstructionArtifactType = (typeof RECONSTRUCTION_ARTIFACT_TYPES)[number];
export type ReconstructionArtifactMimeType = (typeof RECONSTRUCTION_ARTIFACT_MIME_TYPES)[number];
export type ReconstructionArtifactExecutionMode = (typeof RECONSTRUCTION_EXECUTION_MODES)[number];
export interface ReconstructionGeometrySummary {
  readonly boundingBoxMax: readonly [number, number, number];
  readonly boundingBoxMin: readonly [number, number, number];
  readonly faceCount: number;
  readonly pointCount: number;
  readonly unitCode: "MILLIMETRE";
  readonly vertexCount: number;
}

export interface RealReconstructionEngineConfig {
  readonly enabled: boolean;
  readonly executablePath: string;
  readonly maximumOutputBytes: number;
  readonly requiredVersion: typeof REAL_ENGINE_VERSION;
  readonly temporaryDirectoryRoot: string;
  readonly timeoutMs: number;
}

export interface ProcessResult {
  readonly exitCode: number;
  readonly stderr: string;
  readonly stdout: string;
}

export interface ReconstructionProcessRunner {
  run(
    executable: string,
    arguments_: readonly string[],
    options: { readonly cwd: string; readonly timeoutMs: number },
  ): Promise<ProcessResult>;
}

export interface RealEngineOutput {
  readonly byteSize: number;
  readonly checksum: string;
  readonly configurationVersion: typeof REAL_ENGINE_CONFIGURATION_VERSION;
  readonly engineName: typeof REAL_ENGINE_NAME;
  readonly engineVersion: typeof REAL_ENGINE_VERSION;
  readonly mimeType: "model/gltf-binary";
  readonly outputPath: string;
}

export class RealReconstructionEngineError extends Error {
  constructor(
    readonly code:
      | "ENGINE_BINARY_UNAVAILABLE"
      | "ENGINE_EXECUTION_FAILED"
      | "ENGINE_OUTPUT_INVALID"
      | "ENGINE_DISABLED",
    message: string,
  ) {
    super(message);
  }
}

export const systemProcessRunner: ReconstructionProcessRunner = {
  async run(executable, arguments_, options) {
    try {
      const result = await execFile(executable, [...arguments_], {
        cwd: options.cwd,
        encoding: "utf8",
        maxBuffer: 64 * 1024,
        env: {
          NODE_ENV: process.env.NODE_ENV,
          PATH: process.env.PATH,
          QT_QPA_PLATFORM: "offscreen",
        },
        shell: false,
        timeout: options.timeoutMs,
        windowsHide: true,
      });
      return { exitCode: 0, stderr: result.stderr, stdout: result.stdout };
    } catch (error) {
      const candidate = error as { code?: string | number; stderr?: string; stdout?: string };
      if (candidate.code === "ENOENT")
        throw new RealReconstructionEngineError(
          "ENGINE_BINARY_UNAVAILABLE",
          "Configured COLMAP binary is unavailable.",
        );
      return {
        exitCode: typeof candidate.code === "number" ? candidate.code : 1,
        stderr: candidate.stderr?.slice(0, 4096) ?? "",
        stdout: candidate.stdout?.slice(0, 4096) ?? "",
      };
    }
  },
};

export function getRealReconstructionEngineConfig(
  values: NodeJS.ProcessEnv = process.env,
): RealReconstructionEngineConfig {
  const enabled = values.ENABLE_REAL_RECONSTRUCTION === "true";
  const executablePath = values.RECONSTRUCTION_ENGINE_EXECUTABLE ?? "";
  const temporaryDirectoryRoot = values.RECONSTRUCTION_TEMP_DIRECTORY ?? "";
  const timeoutMs = Number(values.RECONSTRUCTION_ENGINE_TIMEOUT_MS ?? "300000");
  const maximumOutputBytes = Number(values.RECONSTRUCTION_MAX_OUTPUT_BYTES ?? "52428800");
  const requiredVersion = values.RECONSTRUCTION_ENGINE_REQUIRED_VERSION ?? REAL_ENGINE_VERSION;
  if (!enabled)
    return {
      enabled,
      executablePath,
      temporaryDirectoryRoot,
      timeoutMs,
      maximumOutputBytes,
      requiredVersion: REAL_ENGINE_VERSION,
    };
  if (
    !path.isAbsolute(executablePath) ||
    !path.isAbsolute(temporaryDirectoryRoot) ||
    !Number.isSafeInteger(timeoutMs) ||
    timeoutMs < 1000 ||
    !Number.isSafeInteger(maximumOutputBytes) ||
    maximumOutputBytes < 1
  ) {
    throw new RealReconstructionEngineError(
      "ENGINE_DISABLED",
      "Real reconstruction configuration is invalid.",
    );
  }
  if (requiredVersion !== REAL_ENGINE_VERSION)
    throw new RealReconstructionEngineError(
      "ENGINE_DISABLED",
      "Configured COLMAP version is not approved.",
    );
  return {
    enabled,
    executablePath,
    temporaryDirectoryRoot,
    timeoutMs,
    maximumOutputBytes,
    requiredVersion,
  };
}

function within(root: string, candidate: string): string {
  const resolvedRoot = path.resolve(root);
  const resolvedCandidate = path.resolve(candidate);
  if (
    path.relative(resolvedRoot, resolvedCandidate).startsWith("..") ||
    path.isAbsolute(path.relative(resolvedRoot, resolvedCandidate))
  )
    throw new RealReconstructionEngineError(
      "ENGINE_OUTPUT_INVALID",
      "Engine path escapes the job workspace.",
    );
  return resolvedCandidate;
}

export function buildColmapCommand(workspace: string, imageDirectory: string): readonly string[] {
  const safeWorkspace = within(workspace, workspace);
  const safeImages = within(workspace, imageDirectory);
  return [
    "feature_extractor",
    "--database_path",
    path.join(safeWorkspace, "database.db"),
    "--image_path",
    safeImages,
    "--ImageReader.single_camera",
    "1",
    "--FeatureExtraction.use_gpu",
    "0",
  ];
}

export async function detectColmapVersion(
  config: RealReconstructionEngineConfig,
  runner: ReconstructionProcessRunner = systemProcessRunner,
): Promise<boolean> {
  if (!config.enabled) return false;
  const result = await runner.run(config.executablePath, ["feature_extractor", "-h"], {
    cwd: config.temporaryDirectoryRoot,
    timeoutMs: config.timeoutMs,
  });
  return (
    result.exitCode === 0 &&
    new RegExp(`COLMAP[^\\d]*${config.requiredVersion.replaceAll(".", "\\.")}`, "iu").test(
      `${result.stdout}\n${result.stderr}`,
    )
  );
}

export async function validateGlbOutput(
  outputPath: string,
  maximumOutputBytes: number,
): Promise<RealEngineOutput> {
  const content = await fs.readFile(outputPath);
  if (
    content.byteLength < 20 ||
    content.byteLength > maximumOutputBytes ||
    content.subarray(0, 4).toString("ascii") !== "glTF"
  )
    throw new RealReconstructionEngineError(
      "ENGINE_OUTPUT_INVALID",
      "Reconstruction output is not a bounded GLB artifact.",
    );
  return {
    byteSize: content.byteLength,
    checksum: createHash("sha256").update(content).digest("hex"),
    configurationVersion: REAL_ENGINE_CONFIGURATION_VERSION,
    engineName: REAL_ENGINE_NAME,
    engineVersion: REAL_ENGINE_VERSION,
    mimeType: "model/gltf-binary",
    outputPath,
  };
}

export async function executeColmapProofOfConcept(
  input: { readonly imageDirectory: string; readonly workspace: string },
  config: RealReconstructionEngineConfig,
  runner: ReconstructionProcessRunner = systemProcessRunner,
): Promise<ProcessResult> {
  if (!config.enabled)
    throw new RealReconstructionEngineError("ENGINE_DISABLED", "Real reconstruction is disabled.");
  const workspace = within(config.temporaryDirectoryRoot, input.workspace);
  const imageDirectory = within(workspace, input.imageDirectory);
  const result = await runner.run(
    config.executablePath,
    buildColmapCommand(workspace, imageDirectory),
    { cwd: workspace, timeoutMs: config.timeoutMs },
  );
  if (result.exitCode !== 0)
    throw new RealReconstructionEngineError(
      "ENGINE_EXECUTION_FAILED",
      "COLMAP reconstruction failed.",
    );
  return result;
}

import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

if (!process.argv.includes("--confirm-local-real-reconstruction-poc")) {
  throw new Error("Refusing to run without --confirm-local-real-reconstruction-poc.");
}

const run = promisify(execFile);
const localEnvironment = Object.fromEntries(
  (await readFile(path.join(process.cwd(), ".env.local"), "utf8").catch(() => ""))
    .split(/\r?\n/u)
    .map((line) => /^([A-Z][A-Z0-9_]*)=(.*)$/u.exec(line))
    .filter((entry) => entry !== null)
    .map((entry) => [entry[1], entry[2]]),
);
const environment = { ...localEnvironment, ...process.env };
const executable = environment.RECONSTRUCTION_ENGINE_EXECUTABLE;
const enabled = environment.ENABLE_REAL_RECONSTRUCTION === "true";
const requiredVersion = environment.RECONSTRUCTION_ENGINE_REQUIRED_VERSION;
const timeout = Number(environment.RECONSTRUCTION_ENGINE_TIMEOUT_MS ?? "300000");
const maximumOutputBytes = Number(environment.RECONSTRUCTION_MAX_OUTPUT_BYTES ?? "52428800");
const root =
  environment.RECONSTRUCTION_TEMP_DIRECTORY ?? path.join(os.tmpdir(), "graftvision-reconstruction");
const fixtureId = "generated-synthetic-asymmetric-raytraced-object-v2";
const width = 800;
const height = 600;
const focalLength = 700;
const viewCount = 24;
const fixtureSeed = 20260803;

if (!enabled || !executable || requiredVersion !== "4.1.1") {
  console.log(
    "Real reconstruction is disabled or incorrectly configured; no real reconstruction executed.",
  );
  process.exit(0);
}

function safeDiagnostic(error) {
  const candidate = error;
  return String(candidate?.stderr ?? "")
    .slice(0, 4096)
    .replaceAll(/\/private\/tmp\/[^\s]+/gu, "[workspace]");
}

async function invoke(stage, args, cwd, stages) {
  const startedAt = Date.now();
  try {
    const output = await run(executable, args, {
      cwd,
      env: { PATH: process.env.PATH, QT_QPA_PLATFORM: "offscreen" },
      maxBuffer: 64 * 1024,
      shell: false,
      timeout,
    });
    stages.push({ duration_ms: Date.now() - startedAt, exit_code: 0, stage });
    return output;
  } catch (error) {
    const candidate = error;
    stages.push({
      duration_ms: Date.now() - startedAt,
      exit_code: typeof candidate?.code === "number" ? candidate.code : 1,
      stage,
    });
    throw new Error(
      `COLMAP_STAGE_FAILED stage=${stage} exit=${typeof candidate?.code === "number" ? candidate.code : 1} stderr=${safeDiagnostic(error)}`,
    );
  }
}

function normalize(vector) {
  const length = Math.hypot(...vector);
  return vector.map((value) => value / length);
}

function subtract(left, right) {
  return left.map((value, index) => value - right[index]);
}

function add(left, right) {
  return left.map((value, index) => value + right[index]);
}

function scale(vector, amount) {
  return vector.map((value) => value * amount);
}

function dot(left, right) {
  return left[0] * right[0] + left[1] * right[1] + left[2] * right[2];
}

function cross(left, right) {
  return [
    left[1] * right[2] - left[2] * right[1],
    left[2] * right[0] - left[0] * right[2],
    left[0] * right[1] - left[1] * right[0],
  ];
}

const boxes = [
  { id: 1, maximum: [0.8, 0.73, 1.35], minimum: [-0.8, -0.73, -0.15] },
  { id: 2, maximum: [-0.35, 1.05, 0.73], minimum: [-1.2, 0.5, -0.05] },
  { id: 3, maximum: [1.16, 0.18, 1.9], minimum: [0.54, -0.42, 0.28] },
  { id: 4, maximum: [0.24, 0.28, 2.35], minimum: [-0.28, -0.28, 1.25] },
];
const light = normalize([-0.55, -0.35, 1]);

function rayBox(origin, direction, box, maximumDistance = Infinity) {
  let near = -Infinity;
  let far = Infinity;
  let axis = 0;
  let sign = 1;
  for (let index = 0; index < 3; index += 1) {
    const inverse = 1 / direction[index];
    let first = (box.minimum[index] - origin[index]) * inverse;
    let second = (box.maximum[index] - origin[index]) * inverse;
    const faceSign = first > second ? 1 : -1;
    if (first > second) [first, second] = [second, first];
    if (first > near) {
      near = first;
      axis = index;
      sign = faceSign;
    }
    far = Math.min(far, second);
  }
  if (far < Math.max(near, 0.001) || near > maximumDistance) return null;
  const distance = near > 0.001 ? near : far;
  return { axis, box, distance, sign };
}

function intersectScene(origin, direction, maximumDistance = Infinity) {
  let result = null;
  for (const box of boxes) {
    const hit = rayBox(origin, direction, box, maximumDistance);
    if (hit && (!result || hit.distance < result.distance)) result = hit;
  }
  return result;
}

function faceNormal(hit) {
  const normal = [0, 0, 0];
  normal[hit.axis] = hit.sign;
  return normal;
}

function texture(hit, point) {
  const uvAxes = hit.axis === 0 ? [1, 2] : hit.axis === 1 ? [0, 2] : [0, 1];
  const u = point[uvAxes[0]];
  const v = point[uvAxes[1]];
  const checker = (Math.floor((u + 4) * 9) + Math.floor((v + 4) * 9) + hit.box.id) & 1;
  const stripe = Math.sin((u * 31 + v * 17 + hit.box.id * 11) * 1.3) > 0 ? 1 : 0;
  const micro = Math.sin(u * 71 + v * 54 + hit.box.id * 19 + fixtureSeed) * 0.5 + 0.5;
  const colour = [
    48 + hit.box.id * 35 + checker * 58,
    34 + hit.box.id * 27 + stripe * 75,
    26 + hit.box.id * 19 + (checker ^ stripe) * 82,
  ];
  return colour.map((channel) => Math.min(255, Math.max(0, channel * (0.64 + micro * 0.36))));
}

function cameraPose(index) {
  const azimuth = (index / viewCount) * Math.PI * 2;
  const elevation = 0.2 + ((index % 4) - 1.5) * 0.07;
  const radius = 5.4 + ((index % 3) - 1) * 0.12;
  return [
    radius * Math.cos(azimuth),
    radius * Math.sin(azimuth),
    1.15 + radius * Math.sin(elevation),
  ];
}

function renderView(camera) {
  const target = [0, 0, 0.75];
  const forward = normalize(subtract(target, camera));
  const right = normalize(cross(forward, [0, 0, 1]));
  const up = normalize(cross(right, forward));
  const pixels = Buffer.alloc(width * height * 3);
  let visibleObjectPixels = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const direction = normalize(
        add(
          add(forward, scale(right, (x - width / 2) / focalLength)),
          scale(up, -(y - height / 2) / focalLength),
        ),
      );
      const hit = intersectScene(camera, direction);
      let colour;
      if (hit) {
        visibleObjectPixels += 1;
        const point = add(camera, scale(direction, hit.distance));
        const normal = faceNormal(hit);
        const shadowOrigin = add(point, scale(normal, 0.002));
        const shadow = intersectScene(shadowOrigin, light) !== null;
        const diffuse = Math.max(0.12, dot(normal, light));
        colour = texture(hit, point).map((value) =>
          Math.round(value * (shadow ? 0.22 : 0.28 + diffuse * 0.73)),
        );
      } else if (direction[2] < -0.001) {
        const floorDistance = -camera[2] / direction[2];
        const point = add(camera, scale(direction, floorDistance));
        const shadowHit = intersectScene(add(point, [0, 0, 0.002]), light);
        const floorTexture = 0.85 + 0.1 * Math.sin(point[0] * 8) * Math.sin(point[1] * 8);
        const brightness = shadowHit ? 0.5 : floorTexture;
        colour = [
          Math.round(118 * brightness),
          Math.round(125 * brightness),
          Math.round(132 * brightness),
        ];
      } else {
        const gradient = 0.78 + (1 - y / height) * 0.18;
        colour = [
          Math.round(160 * gradient),
          Math.round(181 * gradient),
          Math.round(206 * gradient),
        ];
      }
      const offset = (y * width + x) * 3;
      pixels[offset] = colour[0];
      pixels[offset + 1] = colour[1];
      pixels[offset + 2] = colour[2];
    }
  }
  return {
    ppm: Buffer.concat([Buffer.from(`P6\n${width} ${height}\n255\n`), pixels]),
    visibleObjectPixels,
  };
}

function validateCameraPoses(poses) {
  if (poses.length < 20 || poses.length > 30) throw new Error("FIXTURE_VIEW_COUNT_INVALID");
  for (let index = 0; index < poses.length; index += 1) {
    for (let peer = index + 1; peer < poses.length; peer += 1) {
      if (Math.hypot(...subtract(poses[index], poses[peer])) < 0.25)
        throw new Error("FIXTURE_CAMERA_POSE_DUPLICATE");
    }
  }
  const nearestDistances = poses.map((pose, index) =>
    Math.min(
      ...poses
        .filter((_, peer) => peer !== index)
        .map((peer) => Math.hypot(...subtract(pose, peer))),
    ),
  );
  if (nearestDistances.some((distance) => distance < 0.4 || distance > 2.2))
    throw new Error("FIXTURE_CAMERA_SPACING_DEGENERATE");
}

async function validateJpegDimensions(images) {
  for (const image of images) {
    const output = await run("/usr/bin/sips", ["-g", "pixelWidth", "-g", "pixelHeight", image], {
      maxBuffer: 4096,
      shell: false,
      timeout: 30000,
    });
    if (!new RegExp(`pixelWidth: ${width}[\\s\\S]*pixelHeight: ${height}`, "u").test(output.stdout))
      throw new Error("FIXTURE_DIMENSIONS_INVALID");
  }
}

async function countTextModelRows(file) {
  return (await readFile(file, "utf8"))
    .split("\n")
    .filter((line) => line.length > 0 && !line.startsWith("#")).length;
}

async function validateDensePly(file) {
  const artifact = await readFile(file);
  if (artifact.byteLength < 1 || artifact.byteLength > maximumOutputBytes)
    throw new Error("GEOMETRY_ARTIFACT_SIZE_INVALID");
  const headerEnd = artifact.indexOf(Buffer.from("end_header\n"));
  if (headerEnd < 0) throw new Error("GEOMETRY_PLY_HEADER_INVALID");
  const header = artifact.subarray(0, headerEnd + 11).toString("ascii");
  const vertices = Number(/element vertex (\d+)/u.exec(header)?.[1]);
  if (!Number.isSafeInteger(vertices) || vertices < 1)
    throw new Error("GEOMETRY_VERTEX_COUNT_INVALID");
  const format = /format (ascii|binary_little_endian) 1\.0/u.exec(header)?.[1];
  const vertexProperties = header
    .slice(header.indexOf("element vertex"), header.indexOf("element face"))
    .split("\n")
    .filter((line) => line.startsWith("property "));
  const scalarTypes = new Map([
    ["float", 4],
    ["float32", 4],
    ["uchar", 1],
    ["uint8", 1],
  ]);
  const sizes = vertexProperties.map((line) => scalarTypes.get(line.split(" ")[1]));
  if (format !== "binary_little_endian" || sizes.some((size) => size === undefined))
    throw new Error("GEOMETRY_PLY_FORMAT_UNSUPPORTED");
  const stride = sizes.reduce((total, size) => total + size, 0);
  if (artifact.byteLength < headerEnd + 11 + vertices * stride)
    throw new Error("GEOMETRY_PLY_TRUNCATED");
  const data = new DataView(
    artifact.buffer,
    artifact.byteOffset + headerEnd + 11,
    vertices * stride,
  );
  const offsets = ["x", "y", "z"].map((name) => {
    const position = vertexProperties.findIndex((property) => property.endsWith(` ${name}`));
    return sizes.slice(0, position).reduce((total, size) => total + size, 0);
  });
  const bounds = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  for (let index = 0; index < vertices; index += 1) {
    for (let axis = 0; axis < 3; axis += 1) {
      const value = data.getFloat32(index * stride + offsets[axis], true);
      if (!Number.isFinite(value)) throw new Error("GEOMETRY_COORDINATES_INVALID");
      bounds[axis] = Math.min(bounds[axis], value);
      bounds[axis + 3] = Math.max(bounds[axis + 3], value);
    }
  }
  return { artifact, bounds, vertices };
}

async function main() {
  await mkdir(root, { recursive: true });
  const stages = [];
  const version = await invoke("version_check", ["feature_extractor", "-h"], root, stages);
  if (
    !new RegExp(`COLMAP[^\\d]*${requiredVersion.replaceAll(".", "\\.")}`, "iu").test(
      `${version.stdout}\n${version.stderr}`,
    )
  )
    throw new Error("COLMAP_VERSION_MISMATCH");
  const workspace = await mkdtemp(path.join(root, "recon-poc-"));
  const images = path.join(workspace, "images");
  const database = path.join(workspace, "database.db");
  const sparse = path.join(workspace, "sparse");
  const textModel = path.join(workspace, "text-model");
  const sparsePly = path.join(workspace, "sparse.ply");
  const dense = path.join(workspace, "dense");
  const start = Date.now();
  try {
    await mkdir(images);
    const poses = Array.from({ length: viewCount }, (_, index) => cameraPose(index));
    validateCameraPoses(poses);
    const outputImages = [];
    for (const [index, pose] of poses.entries()) {
      const ppm = path.join(images, `synthetic-${String(index).padStart(2, "0")}.ppm`);
      const jpeg = path.join(images, `synthetic-${String(index).padStart(2, "0")}.jpg`);
      const image = renderView(pose);
      if (image.visibleObjectPixels < width * height * 0.035)
        throw new Error("FIXTURE_OBJECT_NOT_VISIBLE");
      await writeFile(ppm, image.ppm);
      await run("/usr/bin/sips", ["-s", "format", "jpeg", ppm, "--out", jpeg], {
        maxBuffer: 4096,
        shell: false,
        timeout: 30000,
      });
      await rm(ppm);
      outputImages.push(jpeg);
    }
    await validateJpegDimensions(outputImages);
    await invoke(
      "feature_extraction",
      [
        "feature_extractor",
        "--database_path",
        database,
        "--image_path",
        images,
        "--ImageReader.single_camera",
        "1",
        "--ImageReader.camera_model",
        "PINHOLE",
        "--ImageReader.camera_params",
        `${focalLength},${focalLength},${width / 2},${height / 2}`,
        "--FeatureExtraction.use_gpu",
        "0",
      ],
      workspace,
      stages,
    );
    await invoke(
      "exhaustive_matching",
      ["exhaustive_matcher", "--database_path", database, "--FeatureMatching.use_gpu", "0"],
      workspace,
      stages,
    );
    await mkdir(sparse);
    await invoke(
      "sparse_mapping",
      [
        "mapper",
        "--database_path",
        database,
        "--image_path",
        images,
        "--output_path",
        sparse,
        "--Mapper.init_min_num_inliers",
        "20",
        "--Mapper.init_min_tri_angle",
        "1",
        "--Mapper.filter_max_reproj_error",
        "8",
      ],
      workspace,
      stages,
    );
    const sparseModel = path.join(sparse, "0");
    await Promise.all(
      ["cameras.bin", "images.bin", "points3D.bin"].map(async (file) => {
        if ((await stat(path.join(sparseModel, file))).size < 1)
          throw new Error("SPARSE_MODEL_INVALID");
      }),
    );
    await mkdir(textModel);
    await invoke(
      "sparse_text_conversion",
      [
        "model_converter",
        "--input_path",
        sparseModel,
        "--output_path",
        textModel,
        "--output_type",
        "TXT",
      ],
      workspace,
      stages,
    );
    const registeredImages = await countTextModelRows(path.join(textModel, "images.txt"));
    const sparsePoints = await countTextModelRows(path.join(textModel, "points3D.txt"));
    if (registeredImages <= 2 || sparsePoints < 1) throw new Error("SPARSE_GEOMETRY_INSUFFICIENT");
    await invoke(
      "sparse_ply_conversion",
      [
        "model_converter",
        "--input_path",
        sparseModel,
        "--output_path",
        sparsePly,
        "--output_type",
        "PLY",
      ],
      workspace,
      stages,
    );
    const sparseGeometry = await validateDensePly(sparsePly);
    let artifact = sparseGeometry.artifact;
    let artifactRelativePath = "sparse.ply";
    let bounds = sparseGeometry.bounds;
    let denseVertexCount = null;
    let denseStatus = "not_attempted";
    try {
      await invoke(
        "image_undistortion",
        [
          "image_undistorter",
          "--image_path",
          images,
          "--input_path",
          sparseModel,
          "--output_path",
          dense,
          "--output_type",
          "COLMAP",
        ],
        workspace,
        stages,
      );
      await invoke(
        "patch_match_stereo",
        ["patch_match_stereo", "--workspace_path", dense, "--workspace_format", "COLMAP"],
        workspace,
        stages,
      );
      const fused = path.join(dense, "fused.ply");
      await invoke(
        "stereo_fusion",
        [
          "stereo_fusion",
          "--workspace_path",
          dense,
          "--workspace_format",
          "COLMAP",
          "--output_path",
          fused,
        ],
        workspace,
        stages,
      );
      const denseGeometry = await validateDensePly(fused);
      artifact = denseGeometry.artifact;
      artifactRelativePath = "dense/fused.ply";
      bounds = denseGeometry.bounds;
      denseVertexCount = denseGeometry.vertices;
      denseStatus = "completed";
    } catch (error) {
      if (!String(error.message ?? error).includes("Dense stereo reconstruction requires CUDA"))
        throw error;
      denseStatus = "unavailable_no_cuda";
    }
    console.log(
      JSON.stringify({
        artifact_format: "PLY",
        artifact_relative_path: artifactRelativePath,
        artifact_sha256: createHash("sha256").update(artifact).digest("hex"),
        bounding_box: { max: bounds.slice(3), min: bounds.slice(0, 3) },
        dense_status: denseStatus,
        dense_vertex_count: denseVertexCount,
        execution_duration_ms: Date.now() - start,
        fixture_set: fixtureId,
        fixture_views: viewCount,
        registered_image_count: registeredImages,
        sparse_point_count: sparsePoints,
        stages,
      }),
    );
  } catch (error) {
    console.error(
      JSON.stringify({
        execution_duration_ms: Date.now() - start,
        fixture_set: fixtureId,
        stages,
        failure: String(error.message ?? error).replaceAll(
          /\/private\/tmp\/[^\s]+/gu,
          "[workspace]",
        ),
      }),
    );
    throw error;
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
}

await main();

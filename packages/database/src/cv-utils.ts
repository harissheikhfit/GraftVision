import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";

export interface PpmImage {
  width: number;
  height: number;
  pixels: Uint8Array; // RGB triplets
}

// Generate a synthetic PPM image representing a rendering of a scalp from a specific view.
export async function generateSyntheticHeadView(
  workspace: string,
  viewIndex: number,
  seed: number,
): Promise<string> {
  const width = 128;
  const height = 128;
  const pixels = new Uint8Array(width * height * 3);

  // Deterministic random
  const rng = (function (s) {
    return function () {
      s = Math.sin(s) * 10000;
      return s - Math.floor(s);
    };
  })(seed + viewIndex * 1337);

  const cx = Math.floor(width / 2 + (rng() * 10 - 5));
  const cy = Math.floor(height / 2 + (rng() * 10 - 5));
  const radius = 40;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 3;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < radius) {
        // Scalp area
        pixels[idx] = 200; // R
        pixels[idx + 1] = 180; // G
        pixels[idx + 2] = 160; // B

        // Crown marker (a distinct red dot)
        if (Math.abs(x - cx) < 3 && Math.abs(y - (cy - 10)) < 3) {
          pixels[idx] = 255;
          pixels[idx + 1] = 0;
          pixels[idx + 2] = 0;
        }
      } else {
        // Background
        pixels[idx] = 0;
        pixels[idx + 1] = 0;
        pixels[idx + 2] = 0;
      }
    }
  }

  // Write PPM (P6 binary format for easier reading/writing)
  const header = Buffer.from(`P6\n${width} ${height}\n255\n`);
  const outBuffer = Buffer.concat([header, Buffer.from(pixels)]);

  const filepath = path.join(workspace, `synthetic_view_${viewIndex}.ppm`);
  await fs.writeFile(filepath, outBuffer);
  return filepath;
}

export async function parsePpm(filepath: string): Promise<PpmImage> {
  const buffer = await fs.readFile(filepath);

  let offset = 0;
  const readToken = () => {
    while (offset < buffer.length && (buffer[offset] ?? 0) <= 32) offset++;
    if (offset >= buffer.length) return null;
    const start = offset;
    while (offset < buffer.length && (buffer[offset] ?? 0) > 32) offset++;
    return buffer.toString("utf8", start, offset);
  };

  const magic = readToken();
  if (magic !== "P6") throw new Error("Only binary PPM (P6) is supported.");

  const width = parseInt(readToken() || "0", 10);
  const height = parseInt(readToken() || "0", 10);
  const maxVal = parseInt(readToken() || "0", 10);

  if (width <= 0 || height <= 0 || maxVal !== 255) {
    throw new Error("Invalid PPM header.");
  }

  // Skip exactly one whitespace character after maxVal
  offset++;

  const expectedBytes = width * height * 3;
  const pixels = new Uint8Array(buffer.buffer, buffer.byteOffset + offset, expectedBytes);
  if (pixels.length < expectedBytes) {
    throw new Error("Corrupted PPM file: missing pixel data.");
  }

  return { width, height, pixels };
}

export function detectCrownCenter(
  image: PpmImage,
): { x: number; y: number; strength: number } | null {
  // Scan for the distinct red crown marker [255, 0, 0]
  let sumX = 0,
    sumY = 0,
    count = 0;
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      const idx = (y * image.width + x) * 3;
      if (
        (image.pixels[idx] ?? 0) > 200 &&
        (image.pixels[idx + 1] ?? 0) < 50 &&
        (image.pixels[idx + 2] ?? 0) < 50
      ) {
        sumX += x;
        sumY += y;
        count++;
      }
    }
  }

  if (count === 0) return null;
  return { x: sumX / count, y: sumY / count, strength: count > 5 ? 1.0 : count / 5.0 };
}

export function detectHairlineContour(image: PpmImage): Array<{ x: number; y: number }> | null {
  // Simple edge detection: find top boundary of the scalp circle
  const contour = [];
  for (let x = 0; x < image.width; x += 10) {
    // step by 10 for keypoints
    for (let y = 0; y < image.height; y++) {
      const idx = (y * image.width + x) * 3;
      if ((image.pixels[idx] ?? 0) > 100) {
        // Hit scalp
        contour.push({ x, y });
        break; // Only want the top edge for "hairline" in this POC
      }
    }
  }

  if (contour.length < 3) return null;
  return contour;
}

export function project2DTo3D(
  point2D: { x: number; y: number },
  imageWidth: number,
  imageHeight: number,
  _viewIndex: number,
): { x: number; y: number; z: number } {
  // Deterministic mock projection: maps 2D point back to 3D normalized sphere [-2, 2]
  // In reality, this uses raycasting from a known camera pose.
  const nx = (point2D.x / imageWidth) * 4 - 2;
  const ny = (point2D.y / imageHeight) * 4 - 2;
  // Make it perfectly deterministic but valid in range
  return { x: nx, y: ny, z: 0.1 };
}

export function calculateConfidence(
  strength: number,
  viewCount: number,
  maxReprojectionError: number,
): number {
  let conf = strength * 0.5 + (viewCount >= 2 ? 0.3 : 0.1) - maxReprojectionError * 0.1;
  if (conf < 0) conf = 0;
  if (conf > 1) conf = 1;
  return conf;
}

export function getQualityState(confidence: number): "high" | "medium" | "low" | "insufficient" {
  if (confidence > 0.8) return "high";
  if (confidence > 0.5) return "medium";
  if (confidence > 0.2) return "low";
  return "insufficient";
}

import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { test, expect } from "vitest";

import { AiMapInferenceError } from "./ai-map-inference";
import { RealAiMapInferenceAdapter } from "./real-ai-map-adapter";

test("real ai map inference poc - valid pipeline", async () => {
  const adapter = new RealAiMapInferenceAdapter();
  await adapter.initialize({
    timeoutMs: 30000,
    temporaryDirectoryRoot: tmpdir(),
  });

  const workspace = tmpdir();
  const dummyArtifactPath = join(workspace, `dummy-artifact-${Date.now()}.glb`);
  await fs.writeFile(
    dummyArtifactPath,
    Buffer.from("glTF\x02\x00\x00\x00\x14\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00", "ascii"),
  );

  try {
    const result = await adapter.execute(
      {
        workspace,
        reconstructionArtifactPath: dummyArtifactPath,
      },
      {
        onProgress: (pct, status) => {
          console.log(`[${pct}%] ${status}`);
        },
      },
    );

    // Verify constraints
    expect(result.landmarks.length).toBeGreaterThan(0);
    expect(result.landmarks.every((l) => l.landmark_code === "crown_center_reference")).toBe(true);

    expect(result.curves.length).toBeGreaterThan(0);
    expect(result.curves.every((c) => c.curve_code === "current_hairline")).toBe(true);

    expect(result.regions.length).toBe(0); // Scope narrowed
    expect(result.overallConfidence).toBeGreaterThanOrEqual(0.0);
    expect(result.overallConfidence).toBeLessThanOrEqual(1.0);

    // Verify coordinate bounds [-2, 2]
    for (const l of result.landmarks) {
      expect(l.normalized_coordinate[0]).toBeGreaterThanOrEqual(-2);
      expect(l.normalized_coordinate[0]).toBeLessThanOrEqual(2);
      expect(l.normalized_coordinate[1]).toBeGreaterThanOrEqual(-2);
      expect(l.normalized_coordinate[1]).toBeLessThanOrEqual(2);
      expect(l.normalized_coordinate[2]).toBeGreaterThanOrEqual(-2);
      expect(l.normalized_coordinate[2]).toBeLessThanOrEqual(2);
    }
  } finally {
    await adapter.cleanup();
    await fs.unlink(dummyArtifactPath).catch(() => {});
  }
});

test("real ai map inference poc - unreadable artifact", async () => {
  const adapter = new RealAiMapInferenceAdapter();
  await adapter.initialize({
    timeoutMs: 30000,
    temporaryDirectoryRoot: tmpdir(),
  });

  await expect(
    adapter.execute({
      workspace: tmpdir(),
      reconstructionArtifactPath: "/path/that/does/not/exist.glb",
    }),
  ).rejects.toThrowError(AiMapInferenceError);
});

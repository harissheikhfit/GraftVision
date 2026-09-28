import { describe, expect, it } from "vitest";

import {
  authorizeWorkerReconstructionArtifactUpload,
  readWorkerReconstructionContext,
} from "./reconstruction-worker-gateway";

import type { TenantTransaction } from "./server";

const id = "11111111-1111-4111-8111-111111111111";
const transaction = {
  query: () =>
    Promise.resolve({
      rows: [
        {
          job_id: id,
          prepared_manifest_id: id,
          attempt_count: 1,
          revision: 4,
          execution_mode: "dense_cuda",
          engine_name: "COLMAP",
          engine_version: "4.1.1",
          configuration_version: "recon-colmap-config-v2",
        },
      ],
    }),
} as unknown as TenantTransaction;
describe("reconstruction worker gateway", () => {
  it("maps only a bounded lease-scoped context", async () => {
    expect(
      await readWorkerReconstructionContext(transaction, {
        jobId: id,
        workerId: id,
        attemptCount: 1,
      }),
    ).toMatchObject({ engineName: "COLMAP", executionMode: "dense_cuda" });
  });
  it("rejects arbitrary artifact types before SQL", async () => {
    await expect(
      authorizeWorkerReconstructionArtifactUpload(transaction, {
        jobId: id,
        workerId: id,
        attemptCount: 1,
        artifactType: "arbitrary",
        mimeType: "application/json",
      }),
    ).rejects.toThrow("artifactType");
  });
});

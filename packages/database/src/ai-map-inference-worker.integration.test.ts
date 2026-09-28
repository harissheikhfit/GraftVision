import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { executeAiMapInferenceWorker } from "./ai-map-inference-worker.js";
import { AiMapInferenceError } from "./ai-map-inference.js";
import {
  importAiMapSuggestionToDraft,
  queueAiMapProposal,
  recordAiMapProposalDecision,
} from "./ai-map.js";
import { OnnxAiMapInferenceAdapter } from "./onnx-ai-map-adapter.js";
import { closeDatabasePool, createDatabasePool, withLocalTenantContext } from "./server.js";

interface PersistedExecutionRow {
  readonly package_state: string;
  readonly execution_state: string;
  readonly output_recorded: boolean;
  readonly reconstruction_job_id: string;
  readonly reconstruction_artifact_id: string;
  readonly reconstruction_output_manifest_id: string;
  readonly model_package_id: string;
}

const enabled = process.env.GRAFTVISION_AI_MAP_E2E === "1";
interface AiMapFixtureContract {
  readonly annotationPackageId: string;
  readonly artifactChecksum: string;
  readonly artifactPath: string;
  readonly clinicId: string;
  readonly doctorId: string;
  readonly handoffId: string;
  readonly reconstructionAttempt: string;
  readonly reconstructionJobId: string;
  readonly scanSessionId: string;
  readonly sessionId: string;
  readonly workerId: string;
}

async function loadFixture(): Promise<AiMapFixtureContract> {
  const fixturePath = resolve(
    process.env.GRAFTVISION_AI_MAP_FIXTURE_PATH ??
      join(process.cwd(), ".graftvision-tmp", "ai-map-002c-fixture.json"),
  );
  const parsed = JSON.parse(
    await fs.readFile(fixturePath, "utf8"),
  ) as Partial<AiMapFixtureContract>;
  const required = [
    "annotationPackageId",
    "artifactChecksum",
    "artifactPath",
    "clinicId",
    "doctorId",
    "handoffId",
    "reconstructionAttempt",
    "reconstructionJobId",
    "scanSessionId",
    "sessionId",
    "workerId",
  ] as const;
  for (const name of required) {
    if (typeof parsed[name] !== "string" || parsed[name].length === 0)
      throw new Error(`Generated local AI-MAP fixture is missing ${name}.`);
  }
  if (!resolve(parsed.artifactPath!).startsWith(dirname(resolve(fixturePath))))
    throw new Error("Generated local AI-MAP artifact path escaped its fixture directory.");
  return parsed as AiMapFixtureContract;
}

describe("AI-MAP-002C real worker integration", () => {
  it.skipIf(!enabled)(
    "persists trusted ONNX lineage, completion/failure lifecycle, and Doctor draft import",
    async () => {
      const generatedFixture = await loadFixture();

      const pool = createDatabasePool({
        ...process.env,
        SUPABASE_DB_URL:
          process.env.SUPABASE_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
      });
      const workspace = await fs.mkdtemp(join(tmpdir(), "graftvision-ai-map-e2e-"));
      const adapter = new OnnxAiMapInferenceAdapter();
      const {
        clinicId,
        doctorId,
        sessionId,
        scanSessionId,
        handoffId,
        annotationPackageId,
        workerId,
        reconstructionJobId,
        reconstructionAttempt,
        artifactPath,
        artifactChecksum,
      } = generatedFixture;
      const attemptCount = Number(reconstructionAttempt);

      try {
        const queue = await withLocalTenantContext(
          pool,
          { clinicId, platformUserId: doctorId },
          (tx) =>
            queueAiMapProposal(tx, {
              applicationSessionId: sessionId,
              providerIdentityId: doctorId,
              scanSessionId,
              analyzerHandoffId: handoffId,
              idempotencyKey: crypto.randomUUID(),
            }),
        );

        const result = await withLocalTenantContext(
          pool,
          { clinicId, platformUserId: workerId },
          (tx) =>
            executeAiMapInferenceWorker(
              tx,
              {
                proposalId: queue.proposalId,
                clinicId,
                workerId,
                reconstructionJobId,
                reconstructionAttemptCount: attemptCount,
                artifactPath,
                artifactChecksum,
                idempotencyKey: crypto.randomUUID(),
                workspace,
              },
              adapter,
            ),
        );

        expect(result.isNew).toBe(true);
        expect(result.output?.landmarks).toHaveLength(4);
        expect(result.output?.curves).toHaveLength(6);
        expect(result.output?.regions).toHaveLength(9);

        const persisted = await pool.query<PersistedExecutionRow>(
          `select p.package_state, e.execution_state, e.output_recorded,
                  e.reconstruction_job_id, e.reconstruction_artifact_id,
                  e.reconstruction_output_manifest_id, e.model_package_id
             from public.ai_map_proposal_package p
             join public.ai_map_inference_execution e on e.proposal_package_id = p.id
            where p.id = $1::uuid`,
          [queue.proposalId],
        );
        expect(persisted.rows[0]).toMatchObject({
          package_state: "completed",
          execution_state: "completed",
          output_recorded: true,
          reconstruction_job_id: reconstructionJobId,
        });
        expect(persisted.rows[0]?.reconstruction_artifact_id).toBeTruthy();
        expect(persisted.rows[0]?.reconstruction_output_manifest_id).toBeTruthy();
        expect(persisted.rows[0]?.model_package_id).toBeTruthy();

        const suggestion = await pool.query<{ readonly id: string }>(
          `select id from public.ai_map_proposal_landmark
            where proposal_package_id = $1::uuid order by id limit 1`,
          [queue.proposalId],
        );
        const suggestionId = suggestion.rows[0]?.id;
        expect(suggestionId).toBeTruthy();

        await withLocalTenantContext(pool, { clinicId, platformUserId: doctorId }, async (tx) => {
          await expect(
            importAiMapSuggestionToDraft(tx, {
              applicationSessionId: sessionId,
              providerIdentityId: doctorId,
              annotationPackageId,
              suggestionId: suggestionId!,
              suggestionKind: "landmark",
              expectedPackageRevision: 1,
              idempotencyKey: crypto.randomUUID(),
            }),
          ).rejects.toThrow("AI_MAP_DOCTOR_DECISION_REQUIRED");

          await recordAiMapProposalDecision(tx, {
            applicationSessionId: sessionId,
            providerIdentityId: doctorId,
            proposalPackageId: queue.proposalId,
            suggestionId: suggestionId!,
            suggestionKind: "landmark",
            decisionType: "accepted",
            idempotencyKey: crypto.randomUUID(),
          });

          const imported = await importAiMapSuggestionToDraft(tx, {
            applicationSessionId: sessionId,
            providerIdentityId: doctorId,
            annotationPackageId,
            suggestionId: suggestionId!,
            suggestionKind: "landmark",
            expectedPackageRevision: 1,
            idempotencyKey: crypto.randomUUID(),
          });
          expect(imported.isNew).toBe(true);
        });

        const failedQueue = await withLocalTenantContext(
          pool,
          { clinicId, platformUserId: doctorId },
          (tx) =>
            queueAiMapProposal(tx, {
              applicationSessionId: sessionId,
              providerIdentityId: doctorId,
              scanSessionId,
              analyzerHandoffId: handoffId,
              idempotencyKey: crypto.randomUUID(),
            }),
        );
        await expect(
          withLocalTenantContext(pool, { clinicId, platformUserId: workerId }, (tx) =>
            executeAiMapInferenceWorker(
              tx,
              {
                proposalId: failedQueue.proposalId,
                clinicId,
                workerId,
                reconstructionJobId,
                reconstructionAttemptCount: attemptCount,
                artifactPath: join(workspace, "missing.glb"),
                artifactChecksum,
                idempotencyKey: crypto.randomUUID(),
                workspace,
              },
              adapter,
            ),
          ),
        ).rejects.toBeInstanceOf(AiMapInferenceError);
        await expect(
          pool.query(
            `select package_state from public.ai_map_proposal_package where id = $1::uuid`,
            [failedQueue.proposalId],
          ),
        ).resolves.toMatchObject({ rows: [{ package_state: "failed" }] });
      } finally {
        await adapter.cleanup().catch(() => undefined);
        await fs.rm(workspace, { recursive: true, force: true });
        await closeDatabasePool(pool);
      }
    },
    180_000,
  );
});

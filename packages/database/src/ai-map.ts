import "server-only";

import {
  type LandmarkCode,
  type CurveCode,
  type RegionCode,
  type CurveControlPoint,
} from "./model-annotation";
import { DatabaseBoundaryError, type TenantTransaction } from "./server";

export interface AiMapProposalPackage {
  id: string;
  clinic_id: string;
  scan_session_id: string;
  analyzer_handoff_id: string;
  package_state: "queued" | "running" | "completed" | "failed" | "stale" | "superseded";
  overall_confidence: number | null;
  quality_state: "high" | "medium" | "low" | "insufficient" | null;
  created_at: string;
}

export interface AiMapProposalLandmark {
  id: string;
  proposal_package_id: string;
  landmark_code: LandmarkCode;
  normalized_coordinate: [number, number, number];
  confidence: number;
}

export interface AiMapProposalCurve {
  id: string;
  proposal_package_id: string;
  curve_code: CurveCode;
  control_points: CurveControlPoint[];
  closed: boolean;
  confidence: number;
}

export interface AiMapProposalRegion {
  id: string;
  proposal_package_id: string;
  region_code: RegionCode;
  boundary_points: CurveControlPoint[];
  closed: boolean;
  confidence: number;
}

export async function queueAiMapProposal(
  tx: TenantTransaction,
  input: {
    applicationSessionId: string;
    providerIdentityId: string;
    scanSessionId: string;
    analyzerHandoffId: string;
    idempotencyKey: string;
  },
): Promise<{ proposalId: string; isNew: boolean }> {
  const { rows } = await tx.query<{ proposal_id: string; is_new: boolean }>(
    `select proposal_id, is_new from graftvision_private.queue_ai_map_proposal($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid)`,
    [
      input.applicationSessionId,
      input.providerIdentityId,
      input.scanSessionId,
      input.analyzerHandoffId,
      input.idempotencyKey,
    ],
  );

  if (!rows[0]) throw new DatabaseBoundaryError("Failed to queue AI proposal.");
  return { proposalId: rows[0].proposal_id, isNew: rows[0].is_new };
}

export async function importAiMapSuggestionToDraft(
  tx: TenantTransaction,
  input: {
    applicationSessionId: string;
    providerIdentityId: string;
    annotationPackageId: string;
    suggestionId: string;
    suggestionKind: "landmark" | "curve" | "region";
    expectedPackageRevision: number;
    idempotencyKey: string;
  },
): Promise<{ versionId: string; packageRevision: number; isNew: boolean }> {
  const { rows } = await tx.query<{
    version_id: string;
    package_revision: number;
    is_new: boolean;
  }>(
    `select version_id, package_revision, is_new from graftvision_private.import_ai_map_suggestion_to_draft($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::text, $6::integer, $7::uuid)`,
    [
      input.applicationSessionId,
      input.providerIdentityId,
      input.annotationPackageId,
      input.suggestionId,
      input.suggestionKind,
      input.expectedPackageRevision,
      input.idempotencyKey,
    ],
  );

  if (!rows[0]) throw new DatabaseBoundaryError("Failed to import AI suggestion.");
  return {
    versionId: rows[0].version_id,
    packageRevision: rows[0].package_revision,
    isNew: rows[0].is_new,
  };
}

export async function recordAiMapProposalDecision(
  tx: TenantTransaction,
  input: {
    applicationSessionId: string;
    providerIdentityId: string;
    proposalPackageId: string;
    suggestionId: string;
    suggestionKind: "landmark" | "curve" | "region";
    decisionType: "accepted" | "rejected" | "modified";
    idempotencyKey: string;
  },
): Promise<void> {
  await tx.query(
    `select graftvision_private.record_ai_map_proposal_decision($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::text, $6::text, $7::uuid)`,
    [
      input.applicationSessionId,
      input.providerIdentityId,
      input.proposalPackageId,
      input.suggestionId,
      input.suggestionKind,
      input.decisionType,
      input.idempotencyKey,
    ],
  );
}

export async function readAiMapProposalPackage(
  tx: TenantTransaction,
  input: {
    scanSessionId: string;
  },
): Promise<{
  proposalPackage: AiMapProposalPackage | null;
  landmarks: AiMapProposalLandmark[];
  curves: AiMapProposalCurve[];
  regions: AiMapProposalRegion[];
}> {
  const { rows: packageRows } = await tx.query<AiMapProposalPackage>(
    `select id, clinic_id, scan_session_id, analyzer_handoff_id, package_state, overall_confidence, quality_state, created_at
     from public.ai_map_proposal_package
     where scan_session_id = $1::uuid order by created_at desc limit 1`,
    [input.scanSessionId],
  );

  if (packageRows.length === 0 || !packageRows[0]) {
    return { proposalPackage: null, landmarks: [], curves: [], regions: [] };
  }

  const proposalPackage = packageRows[0];
  const proposalId = proposalPackage.id;

  const [landmarksRes, curvesRes, regionsRes] = await Promise.all([
    tx.query<AiMapProposalLandmark>(
      `select id, proposal_package_id, landmark_code, normalized_coordinate, confidence
       from public.ai_map_proposal_landmark where proposal_package_id = $1::uuid`,
      [proposalId],
    ),
    tx.query<AiMapProposalCurve>(
      `select id, proposal_package_id, curve_code, control_points, closed, confidence
       from public.ai_map_proposal_curve where proposal_package_id = $1::uuid`,
      [proposalId],
    ),
    tx.query<AiMapProposalRegion>(
      `select id, proposal_package_id, region_code, boundary_points, closed, confidence
       from public.ai_map_proposal_region where proposal_package_id = $1::uuid`,
      [proposalId],
    ),
  ]);

  return {
    proposalPackage,
    landmarks: landmarksRes.rows,
    curves: curvesRes.rows,
    regions: regionsRes.rows,
  };
}

export async function beginAiMapProposalExecution(
  tx: TenantTransaction,
  input: {
    proposalId: string;
    clinicId: string;
    workerId: string;
    reconstructionJobId: string;
    reconstructionAttemptCount: number;
    adapterName: string;
    adapterVersion: string;
    modelName: string;
    modelVersion: string;
    pipelineVersion: string;
    artifactChecksum: string;
    idempotencyKey: string;
  },
): Promise<{ executionId: string; isNew: boolean }> {
  const { rows } = await tx.query<{ execution_id: string; is_new: boolean }>(
    `select execution_id, is_new from graftvision_private.begin_ai_map_proposal_execution($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::integer, $6::text, $7::text, $8::text, $9::text, $10::text, $11::text, $12::uuid)`,
    [
      input.proposalId,
      input.clinicId,
      input.workerId,
      input.reconstructionJobId,
      input.reconstructionAttemptCount,
      input.adapterName,
      input.adapterVersion,
      input.modelName,
      input.modelVersion,
      input.pipelineVersion,
      input.artifactChecksum,
      input.idempotencyKey,
    ],
  );
  if (!rows[0]) throw new DatabaseBoundaryError("Failed to bind AI inference execution.");
  return { executionId: rows[0].execution_id, isNew: rows[0].is_new };
}

export async function recordAiMapProposalOutput(
  tx: TenantTransaction,
  input: {
    executionId: string;
    landmarks: Record<string, unknown>[];
    curves: Record<string, unknown>[];
    regions: Record<string, unknown>[];
  },
): Promise<void> {
  await tx.query(
    `select graftvision_private.record_ai_map_proposal_output($1::uuid, $2::jsonb, $3::jsonb, $4::jsonb)`,
    [
      input.executionId,
      JSON.stringify(input.landmarks),
      JSON.stringify(input.curves),
      JSON.stringify(input.regions),
    ],
  );
}

export async function finalizeAiMapProposal(
  tx: TenantTransaction,
  input: {
    executionId: string;
    overallConfidence: number;
    qualityState: "high" | "medium" | "low" | "insufficient";
  },
): Promise<void> {
  await tx.query(
    `select graftvision_private.finalize_ai_map_proposal($1::uuid, $2::float8, $3::text)`,
    [input.executionId, input.overallConfidence, input.qualityState],
  );
}

export async function failAiMapProposal(
  tx: TenantTransaction,
  input: { executionId: string; failureCode: string },
): Promise<void> {
  await tx.query(`select graftvision_private.fail_ai_map_proposal($1::uuid, $2::text)`, [
    input.executionId,
    input.failureCode,
  ]);
}

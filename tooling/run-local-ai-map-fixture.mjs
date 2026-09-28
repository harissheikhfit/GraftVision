import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const requireFromDatabase = createRequire(path.join(root, "packages/database/package.json"));
const { Client } = requireFromDatabase("pg");
const databaseUrl =
  process.env.SUPABASE_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const outputDirectory = path.join(root, ".graftvision-tmp");
const contractPath = path.join(outputDirectory, "ai-map-002c-fixture.json");
const confirmationFlag = "--confirm-local-ai-map-fixture";
const steps = [
  "front",
  "left_profile",
  "right_profile",
  "crown",
  "donor_rear",
  "donor_left",
  "donor_right",
];

class FixtureError extends Error {}
const fail = (message) => {
  throw new FixtureError(message);
};
const ensure = (condition, message) => {
  if (!condition) fail(message);
};
const uuid = () => randomUUID();
const digest = (value) => createHash("sha256").update(value).digest("hex");
const fixtureValue = (row, key, label = key) => {
  const value = row?.[key];
  ensure(value !== undefined && value !== null, `AI-MAP fixture query did not return ${label}.`);
  return String(value);
};

function assertLocalEnvironment() {
  const appEnvironment = process.env.APP_ENV ?? "local";
  ensure(
    appEnvironment === "local" || appEnvironment === "test",
    "AI-MAP fixtures require APP_ENV=local or test.",
  );
  const parsed = new URL(databaseUrl);
  ensure(
    ["postgres:", "postgresql:"].includes(parsed.protocol),
    "AI-MAP fixtures require PostgreSQL.",
  );
  ensure(
    ["127.0.0.1", "localhost", "::1"].includes(parsed.hostname) &&
      parsed.port === "54322" &&
      parsed.pathname === "/postgres",
    "AI-MAP fixtures require the disposable loopback database.",
  );
}

async function query(client, text, values = []) {
  const result = await client.query(text, values);
  return result.rows[0];
}

async function setTenant(client, actorId, clinicId) {
  await query(client, "select graftvision_private.set_tenant_context($1::uuid,$2::uuid)", [
    actorId,
    clinicId,
  ]);
}

async function createApplicationSession(client, platformUserId, clinicId, label) {
  return fixtureValue(
    await query(
      client,
      `select graftvision_private.create_application_session(
    $1::uuid,'clinic',$2::uuid,null,$3::timestamptz,$4::text,null
  ) as id`,
      [platformUserId, clinicId, new Date(Date.now() + 60 * 60 * 1000), label],
    ),
    "id",
    "application session",
  );
}

function syntheticArtifact() {
  const json = Buffer.from(
    JSON.stringify({ asset: "graftvision-synthetic-scalp", version: "0.1.0" }),
    "utf8",
  );
  const padded = Buffer.alloc(20 + Math.ceil(json.length / 4) * 4, 0x20);
  padded.write("glTF", 0, "ascii");
  padded.writeUInt32LE(2, 4);
  padded.writeUInt32LE(padded.length, 8);
  padded.writeUInt32LE(padded.length - 20, 12);
  padded.write("JSON", 16, "ascii");
  json.copy(padded, 20);
  return padded;
}

async function createGraph(client) {
  const clinic = await query(
    client,
    "select id::text from public.clinic where clinic_code='clinic-alpha' and status='active'",
  );
  const owner = await query(
    client,
    "select id::text from public.platform_user where external_identity_id='owner.alpha@example.test' and status='active'",
  );
  const doctor = await query(
    client,
    "select id::text from public.platform_user where external_identity_id='staff.alpha@example.test' and status='active'",
  );
  const clinicId = fixtureValue(clinic, "id", "clinic id");
  const ownerId = fixtureValue(owner, "id", "owner id");
  const doctorId = fixtureValue(doctor, "id", "Doctor id");

  const ownerSessionId = await createApplicationSession(
    client,
    ownerId,
    clinicId,
    "AI-MAP synthetic fixture owner",
  );
  await setTenant(client, ownerId, clinicId);
  const verified = await query(
    client,
    "select status, expires_at from public.doctor_verification where clinic_id=$1::uuid and platform_user_id=$2::uuid",
    [clinicId, doctorId],
  );
  if (verified?.status !== "verified" || new Date(verified.expires_at) <= new Date()) {
    await query(
      client,
      `select graftvision_private.transition_doctor_verification(
      $1::uuid,$2::uuid,'pending','INITIAL_REVIEW',null,'other_reviewed','GraftVision local fixture','AI-MAP-002C','Local-only synthetic fixture'
    )`,
      [ownerSessionId, doctorId],
    );
    await query(
      client,
      `select graftvision_private.transition_doctor_verification(
      $1::uuid,$2::uuid,'verified','VERIFICATION_APPROVED',$3::timestamptz,'other_reviewed','GraftVision local fixture','AI-MAP-002C','Local-only synthetic fixture'
    )`,
      [ownerSessionId, doctorId, new Date(Date.now() + 24 * 60 * 60 * 1000)],
    );
  }

  const attestationExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
  for (const attestationCode of ["SECURITY_READY", "PROTOCOL_TEMPLATE_READY"]) {
    await query(
      client,
      `select graftvision_private.attest_clinic_onboarding(
      $1::uuid,$2::uuid,$3::text,'attested',$4::integer,$5::timestamptz
    ) as state`,
      [ownerSessionId, ownerId, attestationCode, 0, attestationExpiry],
    );
  }

  const sessionId = await createApplicationSession(
    client,
    doctorId,
    clinicId,
    "AI-MAP synthetic fixture Doctor",
  );
  await client.query("commit");
  await client.query("begin");
  await setTenant(client, doctorId, clinicId);

  const patient = await query(
    client,
    `select id::text from graftvision_private.create_patient_root(
    $1::uuid,$2::uuid,$3::uuid,'active','MANUAL_REGISTRATION'
  )`,
    [sessionId, doctorId, uuid()],
  );
  const patientId = fixtureValue(patient, "id", "patient id");
  const consultation = await query(
    client,
    `select id::text from graftvision_private.create_consultation($1::uuid,$2::uuid,$3::uuid,$4::uuid)`,
    [sessionId, doctorId, patientId, uuid()],
  );
  const consultationId = fixtureValue(consultation, "id", "consultation id");
  await query(
    client,
    `select * from graftvision_private.assign_consultation_doctor_with_concurrency(
    $1::uuid,$2::uuid,$3::uuid,$4::uuid,1,'INITIAL_ASSIGNMENT',$5::uuid
  )`,
    [ownerSessionId, ownerId, consultationId, doctorId, uuid()],
  );
  const assignedConsultation = await query(
    client,
    "select revision from public.consultation where id=$1::uuid",
    [consultationId],
  );
  await query(
    client,
    `select * from graftvision_private.transition_consultation_status(
      $1::uuid,$2::uuid,$3::uuid,$4::integer,'in_progress','PREPARATION_STARTED',$5::uuid
    )`,
    [sessionId, doctorId, consultationId, Number(assignedConsultation?.revision), uuid()],
  );

  const historyIds = {
    medical: uuid(),
    medicalVersion: uuid(),
    hairLoss: uuid(),
    hairLossVersion: uuid(),
    assessment: uuid(),
    assessmentVersion: uuid(),
  };
  await query(client, "select set_config('graftvision.patient_controlled','on',true)");
  await client.query(
    `insert into public.patient_medical_history
      (id, clinic_id, patient_id, revision, review_state, updated_by)
     values ($1::uuid,$2::uuid,$3::uuid,1,'doctor_reviewed',$4::uuid)`,
    [historyIds.medical, clinicId, patientId, doctorId],
  );
  await client.query(
    `insert into public.patient_medical_history_version
      (id, clinic_id, history_id, patient_id, version,
       medical_condition_status, allergy_status, medication_status, previous_operation_status,
       anaesthesia_issue_status, bleeding_concern_status, healing_concern_status,
       source_code, certainty_code, material_change, created_by)
     values ($1::uuid,$2::uuid,$3::uuid,$4::uuid,1,
       'no_known_significant_condition','none_reported','none_reported','none_reported',
       'none_reported','none_reported','none_reported',
       'patient_reported','reported',false,$5::uuid)`,
    [historyIds.medicalVersion, clinicId, historyIds.medical, patientId, doctorId],
  );
  await client.query(
    `update public.patient_medical_history set current_version_id=$1::uuid where id=$2::uuid`,
    [historyIds.medicalVersion, historyIds.medical],
  );
  await query(client, "select set_config('graftvision.patient_controlled','off',true)");

  await query(
    client,
    "select set_config('graftvision.consultation_clinical_history_controlled','on',true)",
  );
  await client.query(
    `insert into public.consultation_hair_loss_history
      (id, clinic_id, consultation_id, revision, review_state, updated_by)
     values ($1::uuid,$2::uuid,$3::uuid,1,'doctor_reviewed',$4::uuid)`,
    [historyIds.hairLoss, clinicId, consultationId, doctorId],
  );
  await client.query(
    `insert into public.consultation_hair_loss_history_version
      (id, clinic_id, history_id, consultation_id, version,
       primary_concern, onset_kind, progression, previous_hair_procedure_status,
       pattern_classification, scalp_symptom_status, source_code, certainty_code,
       material_change, created_by)
     values ($1::uuid,$2::uuid,$3::uuid,$4::uuid,1,
       'frontal_recession','uncertain','stable','none_reported',
       'unclassified','none_reported','patient_reported','reported',false,$5::uuid)`,
    [historyIds.hairLossVersion, clinicId, historyIds.hairLoss, consultationId, doctorId],
  );
  await client.query(
    `update public.consultation_hair_loss_history set current_version_id=$1::uuid where id=$2::uuid`,
    [historyIds.hairLossVersion, historyIds.hairLoss],
  );
  await query(
    client,
    "select set_config('graftvision.consultation_clinical_history_controlled','off',true)",
  );

  await query(
    client,
    "select set_config('graftvision.preliminary_assessment_controlled','on',true)",
  );
  await client.query(
    `insert into public.preliminary_assessment
      (id, clinic_id, consultation_id, revision, review_state, updated_by)
     values ($1::uuid,$2::uuid,$3::uuid,1,'doctor_reviewed',$4::uuid)`,
    [historyIds.assessment, clinicId, consultationId, doctorId],
  );
  await client.query(
    `insert into public.preliminary_assessment_version
      (id, clinic_id, assessment_id, consultation_id, version,
       patient_medical_history_version_id, consultation_hair_loss_history_version_id,
       consultation_revision, created_by, downstream_stale, review_state)
     values ($1::uuid,$2::uuid,$3::uuid,$4::uuid,1,$5::uuid,$6::uuid,2,$7::uuid,false,'doctor_reviewed')`,
    [
      historyIds.assessmentVersion,
      clinicId,
      historyIds.assessment,
      consultationId,
      historyIds.medicalVersion,
      historyIds.hairLossVersion,
      doctorId,
    ],
  );
  await client.query(
    `update public.preliminary_assessment set current_version_id=$1::uuid where id=$2::uuid`,
    [historyIds.assessmentVersion, historyIds.assessment],
  );
  await query(
    client,
    "select set_config('graftvision.preliminary_assessment_controlled','off',true)",
  );
  const consultationState = await query(
    client,
    "select revision from public.consultation where id=$1::uuid",
    [consultationId],
  );
  const completion = await query(
    client,
    `select * from graftvision_private.complete_consultation(
      $1::uuid,$2::uuid,$3::uuid,$4::integer,$5::uuid
    )`,
    [sessionId, doctorId, consultationId, Number(consultationState?.revision), uuid()],
  );
  ensure(
    completion?.outcome_code === "success",
    `AI-MAP fixture consultation completion returned ${completion?.outcome_code ?? "no outcome"}.`,
  );

  const scanSessionId = uuid();
  const tokenHash = digest(`ai-map-scan-token:${scanSessionId}`);
  await query(
    client,
    `select * from graftvision_private.create_scan_session(
    $1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::uuid,$6::text,$7::timestamptz,$8::text
  )`,
    [
      sessionId,
      doctorId,
      scanSessionId,
      patientId,
      consultationId,
      tokenHash,
      new Date(Date.now() + 60 * 60 * 1000),
      uuid(),
    ],
  );
  await query(
    client,
    `select * from graftvision_private.redeem_scan_session_token(
    $1::uuid,$2::uuid,$3::text,$4::text,$5::text
  )`,
    [sessionId, doctorId, tokenHash, `ai-map-pairing-${uuid()}-synthetic`, uuid()],
  );
  let captureRevision = 1;
  await query(
    client,
    `select * from graftvision_private.record_scan_capture_step($1::uuid,$2::uuid,$3::uuid,'preparation','complete',$4::integer,$5::text)`,
    [sessionId, doctorId, scanSessionId, captureRevision, uuid()],
  );
  const initialCaptureState = await query(
    client,
    `select ss.status, cs.current_step, cs.revision
       from public.scan_session ss
       join public.scan_capture_state cs on cs.scan_session_id = ss.id
      where ss.id = $1::uuid`,
    [scanSessionId],
  );
  ensure(
    initialCaptureState?.status === "paired" && initialCaptureState.current_step === "front",
    `AI-MAP fixture capture state is ${initialCaptureState?.status ?? "missing"}/${initialCaptureState?.current_step ?? "missing"}.`,
  );
  captureRevision = Number(initialCaptureState.revision);
  const assetIds = [];
  const assetRevisions = [];
  for (const step of steps) {
    const assetId = uuid();
    assetIds.push(assetId);
    assetRevisions.push(captureRevision);
    const checksum = digest(`ai-map-capture:${scanSessionId}:${step}`);
    const objectKey = `clinics/${clinicId}/patients/${patientId}/consultations/${consultationId}/clinical-image-original/${step}/${assetId}/v0001/original.jpeg`;
    await query(
      client,
      `select * from graftvision_private.register_scan_capture_asset(
      $1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::text,$6::integer,$7::text,'image/jpeg',1024,$8::text,$9::text
    )`,
      [
        sessionId,
        doctorId,
        assetId,
        scanSessionId,
        step,
        captureRevision,
        objectKey,
        checksum,
        uuid(),
      ],
    );
    await query(
      client,
      `select * from graftvision_private.record_scan_capture_step($1::uuid,$2::uuid,$3::uuid,$4::text,'complete',$5::integer,$6::text)`,
      [sessionId, doctorId, scanSessionId, step, captureRevision, uuid()],
    );
    captureRevision += 1;
  }
  await query(
    client,
    `select * from graftvision_private.record_scan_capture_step($1::uuid,$2::uuid,$3::uuid,'review','complete',$4::integer,$5::text)`,
    [sessionId, doctorId, scanSessionId, captureRevision, uuid()],
  );

  let qualityRevision = 1;
  for (const [index, step] of steps.entries()) {
    const assetId = assetIds[index];
    await query(
      client,
      `select * from graftvision_private.save_scan_quality_result(
      $1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::text,$6::integer,$7::text,'passed',null,$8::integer,$9::text
    )`,
      [
        sessionId,
        doctorId,
        scanSessionId,
        assetId,
        step,
        assetRevisions[index],
        `synthetic-quality-v1-${step}`,
        qualityRevision,
        uuid(),
      ],
    );
    qualityRevision += 1;
  }
  const handoff = await query(
    client,
    `select * from graftvision_private.create_scan_analyzer_handoff($1::uuid,$2::uuid,$3::uuid,$4::integer,$5::uuid)`,
    [sessionId, doctorId, scanSessionId, qualityRevision, uuid()],
  );
  const handoffId = fixtureValue(handoff, "handoff_id", "analyzer handoff id");
  const job = await query(
    client,
    `select * from graftvision_private.create_reconstruction_job($1::uuid,$2::uuid,$3::uuid,$4::integer,$5::uuid)`,
    [sessionId, doctorId, handoffId, qualityRevision, uuid()],
  );
  const reconstructionJobId = fixtureValue(job, "job_id", "reconstruction job id");
  const workerId = uuid();
  await query(client, "select set_config('graftvision.reconstruction_worker','on',true)");
  const claim = await query(
    client,
    `select * from graftvision_private.claim_reconstruction_job($1::uuid,$2::uuid,1)`,
    [reconstructionJobId, workerId],
  );
  const attempt = Number(fixtureValue(claim, "attempt_count", "reconstruction attempt"));
  let revision = Number(fixtureValue(claim, "revision", "reconstruction revision"));
  const inputs = await client.query(
    "select * from graftvision_private.read_reconstruction_worker_input($1::uuid,$2::uuid,$3::integer)",
    [reconstructionJobId, workerId, attempt],
  );
  const preparedIds = [];
  for (const input of inputs.rows) {
    const prepared = await query(
      client,
      `select * from graftvision_private.record_reconstruction_prepared_asset(
      $1::uuid,$2::uuid,$3::integer,$4::integer,$5::uuid,$6::text,$7::text,$8::text,512,512,$9::uuid
    )`,
      [
        reconstructionJobId,
        workerId,
        attempt,
        revision,
        input.asset_id,
        input.capture_step,
        input.source_checksum,
        digest(`prepared:${input.asset_id}`),
        uuid(),
      ],
    );
    preparedIds.push(fixtureValue(prepared, "prepared_asset_id", "prepared asset id"));
  }
  const prepared = await query(
    client,
    `select * from graftvision_private.finalize_reconstruction_prepared_manifest($1::uuid,$2::uuid,$3::integer,$4::integer,$5::uuid)`,
    [reconstructionJobId, workerId, attempt, revision, uuid()],
  );
  const preparedManifestId = fixtureValue(prepared, "prepared_manifest_id", "prepared manifest id");
  revision = Number(fixtureValue(prepared, "revision", "prepared manifest revision"));
  ensure(preparedIds.length === 7, "AI-MAP fixture did not prepare seven synthetic assets.");

  const artifact = syntheticArtifact();
  const artifactPath = path.join(outputDirectory, `ai-map-002c-${reconstructionJobId}.glb`);
  await writeFile(artifactPath, artifact);
  const artifactChecksum = createHash("sha256").update(artifact).digest("hex");
  const artifactId = uuid();
  const outputManifestId = uuid();
  await query(client, "select set_config('graftvision.scan_controlled','on',true)");
  await client.query(
    `insert into public.reconstruction_artifact(
    id,clinic_id,reconstruction_job_id,attempt_count,prepared_input_manifest_id,artifact_type,checksum,mime_type,byte_size,engine_name,engine_version,configuration_version
  ) values($1::uuid,$2::uuid,$3::uuid,$4::integer,$5::uuid,'mesh_glb',$6::text,'model/gltf-binary',$7::integer,'recon-engine-synthetic-v1','1.0.0','recon-config-synthetic-v1')`,
    [
      artifactId,
      clinicId,
      reconstructionJobId,
      attempt,
      preparedManifestId,
      artifactChecksum,
      artifact.length,
    ],
  );
  await client.query(
    `insert into public.reconstruction_output_manifest(
    id,clinic_id,patient_id,consultation_id,scan_session_id,analyzer_handoff_id,reconstruction_job_id,attempt_count,prepared_input_manifest_id,artifact_ids,
    engine_name,engine_version,configuration_version,vertex_count,face_count,point_count,bounding_box_mm,
    coordinate_system_code,unit_code,validation_status
  ) values($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::uuid,$6::uuid,$7::uuid,$8::integer,$9::uuid,array[$10::uuid],
    'recon-engine-synthetic-v1','1.0.0','recon-config-synthetic-v1',1,0,0,array[1,1,1],
    'RIGHT_HANDED_Y_UP','MILLIMETRE','valid')`,
    [
      outputManifestId,
      clinicId,
      patientId,
      consultationId,
      scanSessionId,
      handoffId,
      reconstructionJobId,
      attempt,
      preparedManifestId,
      artifactId,
    ],
  );
  await query(client, "select set_config('graftvision.scan_controlled','off',true)");
  const model = await query(
    client,
    `select * from graftvision_private.create_scalp_model_package($1::uuid,$2::uuid,$3::uuid,$4::uuid)`,
    [sessionId, doctorId, outputManifestId, uuid()],
  );
  const modelPackageId = fixtureValue(model, "model_package_id", "model package id");
  const annotation = await query(
    client,
    `select * from graftvision_private.create_model_annotation_package($1::uuid,$2::uuid,$3::uuid,1,$4::uuid)`,
    [sessionId, doctorId, modelPackageId, uuid()],
  );
  const annotationPackageId = fixtureValue(
    annotation,
    "annotation_package_id",
    "annotation package id",
  );
  ensure(
    (
      await query(client, "select state from public.reconstruction_job where id=$1::uuid", [
        reconstructionJobId,
      ])
    ).state === "running",
    "AI-MAP fixture lease was not retained.",
  );
  return {
    clinicId,
    doctorId,
    sessionId,
    scanSessionId,
    handoffId,
    annotationPackageId,
    workerId,
    reconstructionJobId,
    reconstructionAttempt: String(attempt),
    artifactPath,
    artifactChecksum,
    modelPackageId,
    patientId,
    consultationId,
    outputManifestId,
    artifactId,
  };
}

async function verifyContract(client, contract) {
  const row = await query(
    client,
    `select p.clinic_id::text as clinic_id,p.patient_id::text as patient_id,p.consultation_id::text as consultation_id,
    m.scan_session_id::text as scan_session_id,m.analyzer_handoff_id::text as handoff_id,p.package_state,
    j.state,j.worker_lease_owner::text as worker_id,j.attempt_count,a.checksum,o.validation_status,m.id::text as model_package_id
    from public.model_annotation_package p join public.scalp_model_package m on m.id=p.model_package_id
    join public.reconstruction_job j on j.id=m.reconstruction_job_id
    join public.reconstruction_artifact a on a.id=m.reconstruction_artifact_id
    join public.reconstruction_output_manifest o on o.id=m.reconstruction_output_manifest_id
    where p.id=$1::uuid`,
    [contract.annotationPackageId],
  );
  ensure(row, "AI-MAP fixture annotation package is missing.");
  for (const key of [
    "clinicId",
    "patientId",
    "consultationId",
    "scanSessionId",
    "handoffId",
    "workerId",
    "modelPackageId",
  ])
    ensure(
      String(
        row[
          {
            clinicId: "clinic_id",
            patientId: "patient_id",
            consultationId: "consultation_id",
            scanSessionId: "scan_session_id",
            handoffId: "handoff_id",
            workerId: "worker_id",
            modelPackageId: "model_package_id",
          }[key]
        ],
      ) === contract[key],
      `AI-MAP fixture ${key} binding is invalid.`,
    );
  ensure(
    row.package_state === "draft" &&
      row.state === "running" &&
      row.validation_status === "valid" &&
      Number(row.attempt_count) === Number(contract.reconstructionAttempt),
    "AI-MAP fixture state or lease is invalid.",
  );
  ensure(
    row.checksum === contract.artifactChecksum,
    "AI-MAP fixture artifact checksum is invalid.",
  );
  return contract;
}

async function main() {
  ensure(process.argv.includes(confirmationFlag), `Refusing to run without ${confirmationFlag}.`);
  const mode = process.argv.find((value) => value === "setup" || value === "verify") ?? "setup";
  assertLocalEnvironment();
  await mkdir(outputDirectory, { recursive: true });
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    ensure(
      (await query(client, "select current_database() as name")).name === "postgres",
      "AI-MAP fixture target is not the disposable postgres database.",
    );
    await client.query("begin");
    if (mode === "verify") {
      const contract = JSON.parse(await readFile(contractPath, "utf8"));
      await verifyContract(client, contract);
      await client.query("commit");
      console.log(`AI-MAP-002C local fixture verified: ${contractPath}`);
      return;
    }
    const contract = await createGraph(client);
    await verifyContract(client, contract);
    await writeFile(contractPath, `${JSON.stringify(contract, null, 2)}\n`, { mode: 0o600 });
    await client.query("commit");
    console.log(`AI-MAP-002C local fixture created and verified: ${contractPath}`);
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}

try {
  await main();
} catch (error) {
  console.error(
    `AI-MAP-002C fixture check failed: ${error instanceof Error ? error.message : "inspect the approved local stack"}`,
  );
  process.exitCode = 1;
}

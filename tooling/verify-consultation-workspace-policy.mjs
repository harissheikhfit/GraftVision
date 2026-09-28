import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => readFile(path.join(root, relativePath), "utf8");
const routeRoot = "apps/web/src/app/(clinic)/clinic/patients/[patientId]/consultations";

const [
  createPage,
  createForm,
  createAction,
  workspacePage,
  workspace,
  patientPage,
  foundation,
  manifest,
] = await Promise.all([
  read(`${routeRoot}/new/page.tsx`),
  read(`${routeRoot}/new/consultation-creation-form.tsx`),
  read(`${routeRoot}/new/actions.ts`),
  read(`${routeRoot}/[consultationId]/page.tsx`),
  read(`${routeRoot}/[consultationId]/consultation-workspace.tsx`),
  read("apps/web/src/app/(clinic)/clinic/patients/[patientId]/page.tsx"),
  read("packages/database/src/consultation-foundation.ts"),
  read("package.json").then(JSON.parse),
]);

assert.equal(
  (await readdir(path.join(root, "supabase/migrations"))).filter((name) => name.endsWith(".sql"))
    .length,
  74,
  "CONSULT-002 must not add a migration",
);

for (const fragment of [
  "createConsultationAction.bind",
  "randomUUID()",
  "readPatientProfile",
  "Masked patient context",
]) {
  assert(createPage.includes(fragment), `Missing safe creation boundary: ${fragment}`);
}
assert(createForm.includes("Create consultation draft"));
for (const fragment of [
  '"use server"',
  "requireVerifiedAuthSession",
  'authorityScope !== "clinic"',
  "createConsultation(pool",
  "providerIdentityId: user.platformUserId",
  "The consultation draft could not be created.",
]) {
  assert(createAction.includes(fragment), `Missing Server Action protection: ${fragment}`);
}
for (const fragment of [
  "readConsultation",
  "readPatientProfile",
  "consultation?.patientId !== route.patientId",
  "Consultation unavailable",
]) {
  assert(workspacePage.includes(fragment), `Missing workspace read protection: ${fragment}`);
}
for (const fragment of [
  "No Doctor assigned",
  "Current authorised viewer",
  "Persisted revision",
  "Last saved",
  "Consultation workflow",
  "rail is informational",
  "Assign Doctor",
  "Camera capture, uploads, LiDAR",
  "3D reconstruction",
  "Hairline planning and graft estimation",
  "Doctor approval",
  "Autosave and offline editing are not available",
]) {
  assert(workspace.includes(fragment), `Missing honest workspace state: ${fragment}`);
}
for (const prohibited of [
  "assignConsultationDoctor(",
  "transitionConsultationStatus(",
  "navigator.mediaDevices",
  "WebSocket",
  "EventSource",
]) {
  assert(!workspace.includes(prohibited), `Prohibited CONSULT-002 behaviour: ${prohibited}`);
  assert(!createAction.includes(prohibited), `Prohibited creation behaviour: ${prohibited}`);
}
assert(patientPage.includes("/consultations/new"));
assert(foundation.includes('CONSULTATION_DRAFT_PERMISSION = "CONSULT-PERM-001"'));
assert(foundation.includes('CONSULTATION_DOCTOR_ASSIGNMENT_PERMISSION = "CONSULT-PERM-003"'));
assert.equal(
  manifest.scripts["consultation:test:workspace"],
  "node tooling/run-local-consultation-workspace.mjs --confirm-local-consultation-workspace",
);
assert.equal(
  manifest.scripts["verify:consultation-workspace-policy"],
  "node tooling/verify-consultation-workspace-policy.mjs",
);
assert(manifest.scripts.check.includes("node tooling/verify-consultation-workspace-policy.mjs"));

console.log(
  "Consultation workspace policy passed: server-owned unassigned draft creation, masked context, protected reads, informational workflow, and disabled future modules are preserved.",
);

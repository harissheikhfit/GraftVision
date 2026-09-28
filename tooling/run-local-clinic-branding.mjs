import { execFile } from "node:child_process";
import { parseArgs, promisify } from "node:util";

const execFileAsync = promisify(execFile);
const { values } = parseArgs({
  options: { "confirm-local-clinic-branding": { type: "boolean" } },
});

async function verifyPrivateStorage() {
  const { stdout } = await execFileAsync("supabase", ["status", "-o", "json"], {
    cwd: process.cwd(),
  });
  const status = JSON.parse(stdout);
  const apiUrl = status.API_URL;
  const serviceRoleKey = status.SERVICE_ROLE_KEY;
  const publishableKey = status.PUBLISHABLE_KEY;
  if (!apiUrl || !serviceRoleKey || !publishableKey) {
    throw new Error("Local Supabase storage credentials are unavailable.");
  }
  const objectKey =
    "clinics/e2000000-0000-4000-8000-000000000001/clinic-assets/clinic-branding/clinic-logo/e5000000-0000-4000-8000-000000000099/v0001/original.png";
  const objectUrl = `${apiUrl}/storage/v1/object/clinic-branding-private/${objectKey}`;
  const upload = await globalThis.fetch(objectUrl, {
    body: new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "image/png",
      "x-upsert": "false",
    },
    method: "POST",
  });
  if (!upload.ok) throw new Error("Private clinic-branding upload failed.");
  let verificationError;
  try {
    const anonymousRead = await globalThis.fetch(objectUrl, {
      headers: { apikey: publishableKey, Authorization: `Bearer ${publishableKey}` },
    });
    if (anonymousRead.ok) {
      verificationError = new Error("Private clinic-branding object was publicly readable.");
    }
  } finally {
    const removal = await globalThis.fetch(objectUrl, {
      headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
      method: "DELETE",
    });
    if (!removal.ok && !verificationError) {
      verificationError = new Error("Private clinic-branding cleanup failed.");
    }
  }
  if (verificationError) throw verificationError;
}

async function run() {
  if (!values["confirm-local-clinic-branding"]) {
    throw new Error("Missing --confirm-local-clinic-branding flag.");
  }
  if (process.env.APP_ENV && !["local", "test"].includes(process.env.APP_ENV)) {
    throw new Error("Clinic branding integration is permitted only locally.");
  }
  const { stdout, stderr } = await execFileAsync(
    "supabase",
    ["test", "db", "supabase/tests/database/clinic_branding.test.sql"],
    { cwd: process.cwd() },
  );
  process.stdout.write(stdout);
  process.stderr.write(stderr);
  await verifyPrivateStorage();
  console.log("Clinic branding integration test passed.");
}

run().catch((error) => {
  console.error("Clinic branding integration failed:", error);
  process.exit(1);
});

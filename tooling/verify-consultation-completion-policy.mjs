import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationPath = path.join(
  __dirname,
  "../supabase/migrations/20260731000001_consultation_completion.sql",
);

async function verifyPolicy() {
  let content;
  try {
    content = await fs.readFile(migrationPath, "utf-8");
  } catch {
    console.error(`❌ Migration not found: ${migrationPath}`);
    process.exit(1);
  }

  const assertions = [
    {
      name: "Create consultation_lifecycle_event",
      check: /create table public\.consultation_lifecycle_event/i.test(content),
    },
    {
      name: "Check constraints for completed vs reopened",
      check: /check\s*\(\s*\(\s*event_type\s*=\s*'completed'/i.test(content),
    },
    {
      name: "RLS enabled and forced",
      check:
        /alter table public\.consultation_lifecycle_event enable row level security/i.test(
          content,
        ) &&
        /alter table public\.consultation_lifecycle_event force row level security/i.test(content),
    },
    {
      name: "Public access revoked on table",
      check:
        /revoke all on table public\.consultation_lifecycle_event from public, anon, authenticated/i.test(
          content,
        ),
    },
    {
      name: "Controlled mutation trigger",
      check: /create trigger consultation_lifecycle_event_controlled/i.test(content),
    },
    {
      name: "Immutable event trigger",
      check: /create trigger consultation_lifecycle_event_immutable/i.test(content),
    },
    {
      name: "Complete consultation function",
      check: /create function graftvision_private\.complete_consultation/i.test(content),
    },
    {
      name: "Reopen consultation function",
      check: /create function graftvision_private\.reopen_consultation/i.test(content),
    },
    {
      name: "Safe projections created",
      check:
        /create view public\.consultation_analyzer_readiness_projection/i.test(content) &&
        /create view public\.consultation_lifecycle_event_safe_projection/i.test(content) &&
        /create view public\.consultation_lifecycle_event_clinical_projection/i.test(content),
    },
    {
      name: "Public access revoked on projections",
      check:
        /revoke all on public\.consultation_analyzer_readiness_projection from public, anon, authenticated/i.test(
          content,
        ) &&
        /revoke all on public\.consultation_lifecycle_event_safe_projection from public, anon, authenticated/i.test(
          content,
        ) &&
        /revoke all on public\.consultation_lifecycle_event_clinical_projection from public, anon, authenticated/i.test(
          content,
        ),
    },
    {
      name: "No AI, 3D, LiDAR, or scanning",
      check: !/\b(LiDAR|3D|AI|scan|upload|graft calculation)\b/i.test(content),
    },
  ];

  let failed = false;
  for (const assertion of assertions) {
    if (assertion.check) {
      console.log(`✅ ${assertion.name}`);
    } else {
      console.error(`❌ ${assertion.name} FAILED`);
      failed = true;
    }
  }

  if (failed) {
    process.exit(1);
  }
  console.log("\n✅ Consultation Completion Policy Verification Passed");
}

verifyPolicy().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

import { Stack } from "@graftvision/ui";

import { RecoveryForm } from "./recovery-form";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Recover Password | GraftVision",
};

export default function RecoveryPage() {
  return (
    <Stack gap="8">
      <div>
        <h1 className="gv-text-heading-xl">Recover password</h1>
        <p className="gv-text-body-m gv-text-muted mt-2">
          Enter your email to receive a reset link.
        </p>
      </div>
      <RecoveryForm />
    </Stack>
  );
}

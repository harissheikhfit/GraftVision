import { Stack } from "@graftvision/ui";

import { UpdatePasswordForm } from "./update-password-form";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Update Password | GraftVision",
};

export default function UpdatePasswordPage() {
  return (
    <Stack gap="8">
      <div>
        <h1 className="gv-text-heading-xl">Update password</h1>
        <p className="gv-text-body-m gv-text-muted mt-2">Enter your new password below.</p>
      </div>
      <UpdatePasswordForm />
    </Stack>
  );
}

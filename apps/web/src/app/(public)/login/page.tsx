import { redirect } from "next/navigation";

import {
  createRequestAuthClient,
  getActiveApplicationSession,
  hasVerifiedAuthSession,
} from "@graftvision/auth/server";
import { PublicShell, Stack } from "@graftvision/ui";

import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const client = await createRequestAuthClient();

  if (await hasVerifiedAuthSession(client)) {
    const session = await getActiveApplicationSession();
    redirect(session?.authorityScope === "platform" ? "/platform" : "/clinic");
  }

  return (
    <PublicShell footer="Secure clinic access">
      <section aria-labelledby="login-title" className="gv-auth-panel">
        <Stack gap="6">
          <div>
            <p>Clinic workspace</p>
            <h1 id="login-title">Sign in to GraftVision</h1>
            <p>Use the account issued by your clinic administrator.</p>
          </div>
          <LoginForm />
        </Stack>
      </section>
    </PublicShell>
  );
}

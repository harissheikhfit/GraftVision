import { PrivacyContextBar, ScanShell, SessionContextBar } from "@graftvision/ui";

import { SessionContent } from "./session-content";

export default async function SessionShellPage({
  searchParams,
}: {
  readonly searchParams: Promise<{
    readonly session?: string | string[];
    readonly token?: string | string[];
  }>;
}) {
  const query = await searchParams;
  const token = typeof query.token === "string" && query.token.length <= 256 ? query.token : null;
  const scanSessionId =
    typeof query.session === "string" && /^[0-9a-f-]{36}$/iu.test(query.session)
      ? query.session
      : null;
  return (
    <ScanShell
      connectivity={<SessionContextBar state="offline" />}
      sessionContext={<PrivacyContextBar compact level="temporary-access" />}
      sessionMode
      stepTitle={<h1>Secure device pairing</h1>}
    >
      <SessionContent initialScanSessionId={scanSessionId} token={token} />
    </ScanShell>
  );
}

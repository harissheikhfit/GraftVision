import { ScanShell } from "@graftvision/ui";

import { APP_TITLE } from "@/tooling/app";

export default function HomePage() {
  return (
    <ScanShell stepTitle={<h1>{APP_TITLE}</h1>}>
      <p>Pairing and capture are not implemented.</p>
    </ScanShell>
  );
}

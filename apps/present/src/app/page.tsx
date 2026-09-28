import { PresentationShell, PresentationStage } from "@graftvision/ui";

import { APP_TITLE } from "@/tooling/app";

export default function HomePage() {
  return (
    <PresentationShell>
      <PresentationStage
        supporting="Presentation sessions are not implemented."
        title={APP_TITLE}
      />
    </PresentationShell>
  );
}

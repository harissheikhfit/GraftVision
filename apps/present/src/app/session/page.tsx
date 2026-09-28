import { PresentationShell, PresentationStage } from "@graftvision/ui";

export default function SessionShellPage() {
  return (
    <PresentationShell sessionMode>
      <PresentationStage
        supporting="No patient data is loaded."
        title="Temporary presentation shell"
      />
    </PresentationShell>
  );
}

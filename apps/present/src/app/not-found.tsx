import { PresentationShell, PresentationStage } from "@graftvision/ui";

export default function NotFound() {
  return (
    <PresentationShell>
      <PresentationStage
        supporting="The requested patient-safe shell route does not exist."
        title="Page not found"
      />
    </PresentationShell>
  );
}

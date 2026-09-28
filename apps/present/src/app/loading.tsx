import { LoadingBlock, PresentationShell } from "@graftvision/ui";

export default function Loading() {
  return (
    <PresentationShell>
      <LoadingBlock
        description="The requested patient-safe shell is being prepared."
        heading="Loading"
      />
    </PresentationShell>
  );
}

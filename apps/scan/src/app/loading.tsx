import { LoadingBlock, ScanShell } from "@graftvision/ui";

export default function Loading() {
  return (
    <ScanShell>
      <LoadingBlock
        description="The requested development shell is being prepared."
        heading="Loading"
      />
    </ScanShell>
  );
}

import { LoadingBlock, PublicShell } from "@graftvision/ui";

export default function Loading() {
  return (
    <PublicShell>
      <LoadingBlock
        description="The requested development shell is being prepared."
        heading="Loading"
      />
    </PublicShell>
  );
}

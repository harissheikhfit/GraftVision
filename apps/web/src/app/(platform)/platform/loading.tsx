import { LoadingBlock, Stack } from "@graftvision/ui";

export default function PlatformLoading() {
  return (
    <main className="gv-platform-route-state" id="main-content">
      <Stack gap="6">
        <LoadingBlock
          description="Secure platform metrics and readiness are being prepared."
          heading="Loading platform summary"
        />
        <LoadingBlock
          description="Clinic lifecycle and administration records are being prepared."
          heading="Loading clinics"
        />
      </Stack>
    </main>
  );
}

import { ScanShell } from "@graftvision/ui";

export default function NotFound() {
  return (
    <ScanShell stepTitle={<h1>Page not found</h1>}>
      <p>The requested scan shell route does not exist.</p>
    </ScanShell>
  );
}

import { PublicShell } from "@graftvision/ui";

export default function NotFound() {
  return (
    <PublicShell>
      <section aria-labelledby="not-found-title">
        <p>Development shell</p>
        <h1 id="not-found-title">Page not found</h1>
        <p>The requested shell route does not exist.</p>
      </section>
    </PublicShell>
  );
}

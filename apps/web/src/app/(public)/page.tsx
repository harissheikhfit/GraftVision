import { PublicShell } from "@graftvision/ui";

import { APP_TITLE } from "@/tooling/app";

export default function PublicHomePage() {
  return (
    <PublicShell footer="Development foundation">
      <section aria-labelledby="public-shell-title">
        <p>Development shell</p>
        <h1 id="public-shell-title">{APP_TITLE}</h1>
        <p>No product functionality implemented.</p>
      </section>
    </PublicShell>
  );
}

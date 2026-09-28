import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const rootDirectory = path.dirname(fileURLToPath(import.meta.url));
const currentWorkspace = path.relative(rootDirectory, process.cwd()).replaceAll("\\", "/");
const domWorkspaces = new Set(["apps/present", "apps/scan", "apps/web", "packages/ui"]);
const usesDomEnvironment = domWorkspaces.has(currentWorkspace);

export default defineConfig({
  oxc: {
    jsx: {
      runtime: "automatic",
    },
  },
  resolve: {
    alias: {
      "server-only": path.join(rootDirectory, "testing/server-only.ts"),
    },
  },
  test: {
    clearMocks: true,
    coverage: {
      clean: true,
      cleanOnRerun: true,
      exclude: [
        "**/*.d.ts",
        "**/*.{test,spec}.{ts,tsx}",
        "src/app/**/error.tsx",
        "src/app/**/global-error.tsx",
        "src/app/**/layout.tsx",
        "src/app/**/loading.tsx",
        "src/app/**/not-found.tsx",
        "src/app/**/page.tsx",
        "src/tooling/**",
      ],
      excludeAfterRemap: true,
      include: ["src/**/*.{ts,tsx}"],
      provider: "v8",
      reporter: ["text", "json-summary", "html", "lcov"],
      reportsDirectory: "coverage",
    },
    environment: usesDomEnvironment ? "jsdom" : "node",
    environmentOptions: {
      jsdom: {
        url: "https://graftvision.example.test",
      },
    },
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    passWithNoTests: true,
    restoreMocks: true,
    sequence: {
      concurrent: false,
    },
    setupFiles: [
      path.join(
        rootDirectory,
        usesDomEnvironment ? "testing/setup-dom.ts" : "testing/setup-node.ts",
      ),
    ],
    testTimeout: 5_000,
    unstubEnvs: true,
    unstubGlobals: true,
  },
});

import eslint from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";
import { createTypeScriptImportResolver } from "eslint-import-resolver-typescript";
import importX from "eslint-plugin-import-x";
import jsxA11y from "eslint-plugin-jsx-a11y";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import unusedImports from "eslint-plugin-unused-imports";
import tseslint from "typescript-eslint";

const rootDirectory = import.meta.dirname;
const currentDirectory = process.cwd().replaceAll("\\", "/");
const isRootContext = currentDirectory === rootDirectory.replaceAll("\\", "/");
const isNextApplicationContext = /\/apps\/(?:present|scan|web)$/.test(currentDirectory);
const isUiContext = currentDirectory.endsWith("/packages/ui");
const isAuthContext = currentDirectory.endsWith("/packages/auth");
const isConfigContext = currentDirectory.endsWith("/packages/config");
const isDatabaseContext = currentDirectory.endsWith("/packages/database");
const isTypesContext = currentDirectory.endsWith("/packages/types");

const typescriptFiles = ["**/*.{ts,tsx,mts,cts}"];
const javascriptFiles = ["**/*.{js,jsx,mjs,cjs}"];
const sourceFiles = [...typescriptFiles, ...javascriptFiles];
const testFiles = ["**/*.{test,spec}.{js,jsx,mjs,cjs,ts,tsx,mts,cts}"];
const noFiles = ["**/__graftvision_never__/**"];

const rootApplicationFiles = ["apps/{present,scan,web}/**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}"];
const applicationReactFiles = isRootContext
  ? rootApplicationFiles
  : isNextApplicationContext
    ? ["**/*.{jsx,tsx}"]
    : noFiles;
const uiReactFiles = isRootContext
  ? ["packages/ui/**/*.{jsx,tsx}"]
  : isUiContext
    ? ["**/*.{jsx,tsx}"]
    : noFiles;

const clientSafeFiles = isRootContext
  ? [
      "packages/ui/src/**/*.{ts,tsx}",
      "packages/auth/src/browser/**/*.{ts,tsx}",
      "packages/config/src/env/client.ts",
    ]
  : isUiContext
    ? ["src/**/*.{ts,tsx}"]
    : isAuthContext
      ? ["src/browser/**/*.{ts,tsx}"]
      : isConfigContext
        ? ["src/env/client.ts"]
        : noFiles;

const serverFiles = isRootContext
  ? [
      "packages/database/src/**/*.{ts,tsx}",
      "packages/auth/src/server.ts",
      "packages/auth/src/server/**/*.{ts,tsx}",
      "packages/config/src/env/auth.ts",
      "packages/config/src/env/database.ts",
      "packages/config/src/env/server.ts",
      "packages/config/src/env/session.ts",
    ]
  : isDatabaseContext
    ? ["src/**/*.{ts,tsx}"]
    : isAuthContext
      ? ["src/server.ts", "src/server/**/*.{ts,tsx}"]
      : isConfigContext
        ? ["src/env/auth.ts", "src/env/database.ts", "src/env/server.ts"]
        : noFiles;

const securitySensitiveFiles = isRootContext
  ? [
      "packages/auth/src/server.ts",
      "packages/auth/src/server/**/*.{ts,tsx}",
      "packages/database/src/**/*.{ts,tsx}",
    ]
  : isAuthContext
    ? ["src/server.ts", "src/server/**/*.{ts,tsx}"]
    : isDatabaseContext
      ? ["src/**/*.{ts,tsx}"]
      : noFiles;

const typesPackageFiles = isRootContext
  ? ["packages/types/src/**/*.{ts,tsx}"]
  : isTypesContext
    ? ["src/**/*.{ts,tsx}"]
    : noFiles;

const environmentConsumerFiles = isRootContext
  ? ["apps/{present,scan,web}/src/**/*.{ts,tsx}", "packages/*/src/**/*.{ts,tsx}"]
  : isNextApplicationContext ||
      isAuthContext ||
      isConfigContext ||
      isDatabaseContext ||
      isTypesContext ||
      isUiContext
    ? ["src/**/*.{ts,tsx}"]
    : noFiles;

const approvedRawEnvironmentFiles = isRootContext
  ? [
      "packages/config/src/env/admin.ts",
      "packages/config/src/env/auth.ts",
      "packages/config/src/env/client.ts",
      "packages/config/src/env/database.ts",
      "packages/config/src/env/server.ts",
      "packages/config/src/env/session.ts",
    ]
  : isConfigContext
    ? [
        "src/env/admin.ts",
        "src/env/auth.ts",
        "src/env/client.ts",
        "src/env/database.ts",
        "src/env/server.ts",
        "src/env/session.ts",
      ]
    : [];

const packageInternalImportPatterns = [
  {
    group: ["@graftvision/*/src", "@graftvision/*/src/**"],
    message: "Import a public @graftvision package export instead of package internals.",
  },
  {
    group: ["apps/*", "apps/*/**"],
    message: "Applications cannot import another application.",
  },
];

const serverOnlyImportPatterns = [
  {
    group: [
      "@graftvision/database",
      "@graftvision/database/**",
      "@graftvision/auth/server",
      "@graftvision/auth/server/**",
      "@graftvision/config/env/database",
      "@graftvision/config/env/database/**",
      "@graftvision/config/env/auth",
      "@graftvision/config/env/auth/**",
      "@graftvision/config/env/server",
      "@graftvision/config/env/server/**",
    ],
    message: "Client-safe code cannot import a server-only package or entry point.",
  },
];

const reactAndAccessibilityRules = {
  ...react.configs.flat.recommended.rules,
  ...react.configs.flat["jsx-runtime"].rules,
  ...reactHooks.configs.flat["recommended-latest"].rules,
  ...jsxA11y.flatConfigs.recommended.rules,
  "react/jsx-no-script-url": "error",
  "react/no-array-index-key": "error",
  "react/no-danger": "error",
  "react/no-find-dom-node": "error",
  "react/no-render-return-value": "error",
  "react/no-unstable-nested-components": ["error", { allowAsProps: false }],
};

function scopeTypeScriptConfigs(configs) {
  return configs.map((config) => ({
    ...config,
    files: typescriptFiles,
  }));
}

function scopeNextConfigs(configs) {
  if (isNextApplicationContext) {
    return configs;
  }

  if (!isRootContext) {
    return [];
  }

  return configs.flatMap((config) => {
    if (config.ignores) {
      return [];
    }

    const configFiles = config.files ?? ["**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}"];

    return [
      {
        ...config,
        files: configFiles.map((filePattern) => `apps/{present,scan,web}/${filePattern}`),
      },
    ];
  });
}

export default defineConfig(
  globalIgnores([
    "**/.next/**",
    "**/.turbo/**",
    "**/.husky/_/**",
    "**/build/**",
    "**/coverage/**",
    "**/dist/**",
    "**/node_modules/**",
    "**/out/**",
    "**/next-env.d.ts",
    "**/*.generated.*",
    "**/*.tsbuildinfo",
    "docs/**",
  ]),
  eslint.configs.recommended,
  ...scopeTypeScriptConfigs(tseslint.configs.recommendedTypeChecked),
  ...scopeNextConfigs(nextCoreWebVitals),
  ...scopeNextConfigs(nextTypeScript),
  {
    name: "graftvision/configuration-scripts",
    files: javascriptFiles,
    languageOptions: {
      ecmaVersion: "latest",
      globals: {
        Buffer: "readonly",
        URL: "readonly",
        URLSearchParams: "readonly",
        console: "readonly",
        process: "readonly",
      },
      sourceType: "module",
    },
  },
  {
    name: "graftvision/import-hygiene",
    files: sourceFiles,
    plugins: {
      "import-x": importX,
    },
    settings: {
      "import-x/resolver-next": [
        createTypeScriptImportResolver({
          alwaysTryTypes: true,
          noWarnOnMultipleProjects: true,
          project: [
            `${rootDirectory}/tsconfig.tooling.json`,
            `${rootDirectory}/apps/*/tsconfig.json`,
            `${rootDirectory}/packages/*/tsconfig.json`,
            `${rootDirectory}/packages/config/tsconfig.client.json`,
          ],
        }),
      ],
    },
    rules: {
      "import-x/no-cycle": ["error", { ignoreExternal: true, maxDepth: 10 }],
      "import-x/no-duplicates": "error",
      "import-x/no-unresolved": ["error", { commonjs: true }],
      "import-x/order": [
        "error",
        {
          alphabetize: {
            caseInsensitive: true,
            order: "asc",
          },
          groups: ["builtin", "external", "internal", "parent", "sibling", "index", "type"],
          "newlines-between": "always",
          pathGroups: [
            {
              group: "internal",
              pattern: "@graftvision/**",
              position: "before",
            },
            {
              group: "internal",
              pattern: "@/**",
              position: "after",
            },
          ],
          pathGroupsExcludedImportTypes: ["builtin"],
        },
      ],
      "no-restricted-imports": [
        "error",
        {
          patterns: packageInternalImportPatterns,
        },
      ],
    },
  },
  {
    name: "graftvision/typescript-quality",
    files: typescriptFiles,
    languageOptions: {
      parserOptions: {
        project: [
          `${rootDirectory}/tsconfig.tooling.json`,
          `${rootDirectory}/apps/*/tsconfig.json`,
          `${rootDirectory}/packages/*/tsconfig.json`,
          `${rootDirectory}/packages/config/tsconfig.client.json`,
        ],
        tsconfigRootDir: rootDirectory,
      },
    },
    plugins: {
      "unused-imports": unusedImports,
    },
    rules: {
      "no-unused-vars": "off",
      "@typescript-eslint/consistent-type-assertions": [
        "error",
        {
          assertionStyle: "as",
          objectLiteralTypeAssertions: "never",
        },
      ],
      "@typescript-eslint/consistent-type-imports": [
        "error",
        {
          fixStyle: "inline-type-imports",
          prefer: "type-imports",
        },
      ],
      "@typescript-eslint/no-confusing-void-expression": "error",
      "@typescript-eslint/no-explicit-any": [
        "error",
        {
          fixToUnknown: true,
          ignoreRestArgs: false,
        },
      ],
      "@typescript-eslint/no-floating-promises": [
        "error",
        {
          checkThenables: true,
          ignoreIIFE: false,
        },
      ],
      "@typescript-eslint/no-invalid-void-type": "error",
      "@typescript-eslint/no-misused-promises": [
        "error",
        {
          checksConditionals: true,
          checksSpreads: true,
          checksVoidReturn: true,
        },
      ],
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/no-unnecessary-type-assertion": "error",
      "@typescript-eslint/no-unsafe-argument": "error",
      "@typescript-eslint/no-unsafe-assignment": "error",
      "@typescript-eslint/no-unsafe-call": "error",
      "@typescript-eslint/no-unsafe-member-access": "error",
      "@typescript-eslint/no-unsafe-return": "error",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/switch-exhaustiveness-check": [
        "error",
        {
          allowDefaultCaseForExhaustiveSwitch: false,
          considerDefaultExhaustiveForUnions: false,
        },
      ],
      "@typescript-eslint/use-unknown-in-catch-callback-variable": "error",
      "unused-imports/no-unused-imports": "error",
      "unused-imports/no-unused-vars": [
        "error",
        {
          args: "after-used",
          argsIgnorePattern: "^_",
          caughtErrors: "all",
          caughtErrorsIgnorePattern: "^_",
          vars: "all",
          varsIgnorePattern: "^_",
        },
      ],
    },
  },
  {
    name: "graftvision/security-baseline",
    files: sourceFiles,
    rules: {
      "no-eval": "error",
      "no-extend-native": "error",
      "no-implied-eval": "error",
      "no-new-func": "error",
      "no-proto": "error",
      "no-script-url": "error",
    },
  },
  {
    name: "graftvision/validated-environment-access",
    files: environmentConsumerFiles,
    ignores: approvedRawEnvironmentFiles,
    rules: {
      "no-restricted-properties": [
        "error",
        {
          message:
            "Import a validated @graftvision/config environment entry instead of reading process.env directly.",
          object: "process",
          property: "env",
        },
      ],
    },
  },
  {
    name: "graftvision/application-react-and-accessibility",
    files: applicationReactFiles,
    rules: reactAndAccessibilityRules,
  },
  {
    name: "graftvision/ui-react-and-accessibility",
    files: uiReactFiles,
    languageOptions: {
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    plugins: {
      "jsx-a11y": jsxA11y,
      react,
      "react-hooks": reactHooks,
    },
    settings: {
      react: {
        version: "detect",
      },
    },
    rules: reactAndAccessibilityRules,
  },
  {
    name: "graftvision/test-files",
    files: testFiles,
    languageOptions: {
      globals: {
        afterAll: "readonly",
        afterEach: "readonly",
        beforeAll: "readonly",
        beforeEach: "readonly",
        describe: "readonly",
        expect: "readonly",
        it: "readonly",
        test: "readonly",
        vi: "readonly",
      },
    },
    rules: {
      "@typescript-eslint/no-non-null-assertion": "off",
    },
  },
  {
    name: "graftvision/server-only-files",
    files: serverFiles,
    rules: {
      "no-restricted-globals": [
        "error",
        {
          message: "Server-only code cannot access browser document state.",
          name: "document",
        },
        {
          message: "Server-only code cannot access browser storage.",
          name: "localStorage",
        },
        {
          message: "Server-only code cannot access browser navigation state.",
          name: "navigator",
        },
        {
          message: "Server-only code cannot access browser storage.",
          name: "sessionStorage",
        },
        {
          message: "Server-only code cannot access the browser window.",
          name: "window",
        },
      ],
    },
  },
  {
    name: "graftvision/security-sensitive-server-files",
    files: securitySensitiveFiles,
    rules: {
      "no-restricted-properties": [
        "error",
        {
          message: "Use a cryptographically secure source for security-sensitive randomness.",
          object: "Math",
          property: "random",
        },
      ],
    },
  },
  {
    name: "graftvision/client-safe-files",
    files: clientSafeFiles,
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [...packageInternalImportPatterns, ...serverOnlyImportPatterns],
        },
      ],
    },
  },
  {
    name: "graftvision/types-package",
    files: typesPackageFiles,
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            ...packageInternalImportPatterns,
            {
              group: ["@graftvision/**"],
              message: "The types package cannot import another runtime workspace package.",
            },
          ],
        },
      ],
    },
  },
);

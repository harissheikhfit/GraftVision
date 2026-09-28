import assert from "node:assert/strict";
import { unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { ESLint } from "eslint";
import * as prettier from "prettier";

import lintStagedConfig, {
  markdownFilePattern,
  sourceFilePattern,
  structuredFilePattern,
} from "../lint-staged.config.mjs";

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixturePath = path.join(rootDirectory, "packages/config/src/__quality_policy_fixture.ts");

await writeFile(fixturePath, "export {};\n", { flag: "wx" });

try {
  const eslint = new ESLint({
    cwd: rootDirectory,
    overrideConfigFile: path.join(rootDirectory, "eslint.config.mjs"),
  });
  const fixingEslint = new ESLint({
    cwd: rootDirectory,
    fix: true,
    overrideConfigFile: path.join(rootDirectory, "eslint.config.mjs"),
  });

  async function lintFixture(source, options = {}) {
    const runner = options.fix ? fixingEslint : eslint;
    const [result] = await runner.lintText(source, { filePath: fixturePath });

    assert(result, "ESLint did not return a fixture result.");
    return result;
  }

  const unusedImportResult = await lintFixture(
    'import { z } from "zod";\n\nexport const value = 1;\n',
  );
  assert(
    unusedImportResult.messages.some(
      (message) => message.ruleId === "unused-imports/no-unused-imports",
    ),
    "The unused-import rule did not reject the verification fixture.",
  );

  const typeImportResult = await lintFixture(
    'import { ZodType } from "zod";\n\nexport type StringSchema = ZodType<string>;\n',
  );
  assert(
    typeImportResult.messages.some(
      (message) => message.ruleId === "@typescript-eslint/consistent-type-imports",
    ),
    "The type-only import rule did not reject the verification fixture.",
  );

  const rawEnvironmentResult = await lintFixture(
    "export const unsafeEnvironment = process.env.APP_ENV;\n",
  );
  assert(
    rawEnvironmentResult.messages.some((message) => message.ruleId === "no-restricted-properties"),
    "The raw process.env restriction did not reject the verification fixture.",
  );

  const unorderedSource = [
    'import { validateEnvironment } from "./env/validation";',
    'import { z } from "zod";',
    "",
    'export const value = validateEnvironment(z.string(), "value", "quality fixture");',
    "",
  ].join("\n");
  const orderedImportResult = await lintFixture(unorderedSource, { fix: true });
  assert(orderedImportResult.output, "Import ordering did not produce an automatic fix.");
  assert.notEqual(
    orderedImportResult.output,
    unorderedSource,
    "Import ordering left the intentionally unordered fixture unchanged.",
  );
  assert(
    orderedImportResult.messages.every((message) => message.ruleId !== "import-x/order"),
    "Import ordering still reports an error after automatic fixing.",
  );

  const malformedFormatting = "const malformed={value:1}\n";
  assert.equal(
    await prettier.check(malformedFormatting, {
      filepath: path.join(rootDirectory, "fixture.ts"),
    }),
    false,
    "Prettier did not reject the malformed formatting fixture.",
  );

  assert.deepEqual(
    Object.keys(lintStagedConfig).sort(),
    [markdownFilePattern, sourceFilePattern, structuredFilePattern].sort(),
  );
  assert(Array.isArray(lintStagedConfig[sourceFilePattern]));
  assert.equal(lintStagedConfig[sourceFilePattern][0], "eslint --fix --max-warnings 0");
  assert.equal(lintStagedConfig[sourceFilePattern][1], "prettier --write --ignore-unknown");
  assert.equal(lintStagedConfig[structuredFilePattern], "prettier --write --ignore-unknown");
  assert.equal(lintStagedConfig[markdownFilePattern], "prettier --write --ignore-unknown");

  console.log(
    "Quality-policy fixtures passed: unused imports, type-only imports, validated environment access, import auto-fix, formatting detection, and staged-file selection.",
  );
} finally {
  await unlink(fixturePath);
}

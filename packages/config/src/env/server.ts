import "server-only";

import { z } from "zod";

import { optionalEnvironmentBoolean, optionalEnvironmentString } from "./parsers";
import { validateEnvironment } from "./validation";

const applicationEnvironmentSchema = z.enum(["local", "test", "staging", "production"]);

const serverEnvironmentInputSchema = z.object({
  APP_ENV: optionalEnvironmentString.pipe(applicationEnvironmentSchema.optional()),
  CI: optionalEnvironmentBoolean,
  ENABLE_REAL_RECONSTRUCTION: optionalEnvironmentBoolean,
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  RECONSTRUCTION_ENGINE_EXECUTABLE: optionalEnvironmentString,
  RECONSTRUCTION_ENGINE_REQUIRED_VERSION: optionalEnvironmentString,
  RECONSTRUCTION_ENGINE_TIMEOUT_MS: optionalEnvironmentString,
  RECONSTRUCTION_MAX_OUTPUT_BYTES: optionalEnvironmentString,
  RECONSTRUCTION_TEMP_DIRECTORY: optionalEnvironmentString,
});

type ApplicationEnvironment = z.infer<typeof applicationEnvironmentSchema>;
type NodeEnvironment = "development" | "production" | "test";

const compatibleApplicationEnvironments: Readonly<
  Record<NodeEnvironment, readonly ApplicationEnvironment[]>
> = {
  development: ["local"],
  production: ["staging", "production"],
  test: ["test"],
};

const serverEnvironmentSchema = serverEnvironmentInputSchema.transform((values, context) => {
  const applicationEnvironment =
    values.APP_ENV ??
    (values.NODE_ENV === "development" ? "local" : values.NODE_ENV === "test" ? "test" : undefined);

  if (applicationEnvironment === undefined) {
    context.addIssue({
      code: "custom",
      message: "is required when NODE_ENV is production; expected staging or production",
      path: ["APP_ENV"],
    });

    return z.NEVER;
  }

  if (!compatibleApplicationEnvironments[values.NODE_ENV].includes(applicationEnvironment)) {
    context.addIssue({
      code: "custom",
      message: `is incompatible with NODE_ENV=${values.NODE_ENV}`,
      path: ["APP_ENV"],
    });

    return z.NEVER;
  }

  return {
    ...values,
    APP_ENV: applicationEnvironment,
  };
});

export type ServerEnvironment = z.infer<typeof serverEnvironmentSchema>;

export function getServerEnvironment(values: NodeJS.ProcessEnv = process.env): ServerEnvironment {
  return validateEnvironment(serverEnvironmentSchema, values, "server");
}

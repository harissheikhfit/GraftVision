import "server-only";

import { z } from "zod";

import { getServerEnvironment } from "./server";
import { validateEnvironment } from "./validation";

const sessionEnvironmentSchema = z.object({
  SESSION_IDLE_WARNING_MINUTES: z.coerce.number().int().min(1).default(25),
  SESSION_IDLE_TIMEOUT_MINUTES: z.coerce.number().int().min(1).default(30),
  SESSION_ABSOLUTE_TIMEOUT_HOURS: z.coerce.number().int().min(1).default(12),
  SESSION_ACTIVITY_WRITE_INTERVAL_SECONDS: z.coerce.number().int().min(1).default(60),
  SESSION_CLOCK_SKEW_SECONDS: z.coerce.number().int().min(0).default(30),
  APPLICATION_SESSION_SIGNING_KEY: z.string().min(32, "must be at least 32 characters for HMAC"),
  APPLICATION_SESSION_PREVIOUS_SIGNING_KEY: z
    .string()
    .min(32, "must be at least 32 characters for HMAC")
    .optional(),
});

export interface SessionEnvironment {
  readonly APP_ENV: "local" | "production" | "staging" | "test";
  readonly SESSION_IDLE_TIMEOUT_MINUTES: number;
  readonly SESSION_IDLE_WARNING_MINUTES: number;
  readonly SESSION_ABSOLUTE_TIMEOUT_HOURS: number;
  readonly SESSION_ACTIVITY_WRITE_INTERVAL_SECONDS: number;
  readonly SESSION_CLOCK_SKEW_SECONDS: number;
  readonly APPLICATION_SESSION_SIGNING_KEY: string;
  readonly APPLICATION_SESSION_PREVIOUS_SIGNING_KEY?: string;
}

export function getSessionEnvironment(values: NodeJS.ProcessEnv = process.env): SessionEnvironment {
  const serverEnvironment = getServerEnvironment(values);
  const sessionEnvironment = validateEnvironment(sessionEnvironmentSchema, values, "session");

  const previousSigningKey = sessionEnvironment.APPLICATION_SESSION_PREVIOUS_SIGNING_KEY;

  return {
    APP_ENV: serverEnvironment.APP_ENV,
    SESSION_IDLE_TIMEOUT_MINUTES: sessionEnvironment.SESSION_IDLE_TIMEOUT_MINUTES,
    SESSION_IDLE_WARNING_MINUTES: sessionEnvironment.SESSION_IDLE_WARNING_MINUTES,
    SESSION_ABSOLUTE_TIMEOUT_HOURS: sessionEnvironment.SESSION_ABSOLUTE_TIMEOUT_HOURS,
    SESSION_ACTIVITY_WRITE_INTERVAL_SECONDS:
      sessionEnvironment.SESSION_ACTIVITY_WRITE_INTERVAL_SECONDS,
    SESSION_CLOCK_SKEW_SECONDS: sessionEnvironment.SESSION_CLOCK_SKEW_SECONDS,
    APPLICATION_SESSION_SIGNING_KEY: sessionEnvironment.APPLICATION_SESSION_SIGNING_KEY,
    ...(previousSigningKey === undefined
      ? {}
      : { APPLICATION_SESSION_PREVIOUS_SIGNING_KEY: previousSigningKey }),
  };
}

import { z } from "zod";

import { validateEnvironment } from "./validation";

declare const process: {
  readonly env: {
    readonly NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?: string;
    readonly NEXT_PUBLIC_SUPABASE_URL?: string;
  };
};

const publicSupabaseKey = z
  .string()
  .trim()
  .min(20)
  .max(4096)
  .refine((value) => !/\s/u.test(value), "must not contain whitespace");

const clientEnvironmentSchema = z
  .object({
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publicSupabaseKey,
    NEXT_PUBLIC_SUPABASE_URL: z.url(),
  })
  .strict();

export type ClientEnvironment = z.infer<typeof clientEnvironmentSchema>;

export function getClientEnvironment(
  values: Readonly<Record<string, string | undefined>> = {
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  },
): ClientEnvironment {
  return validateEnvironment(clientEnvironmentSchema, values, "client");
}

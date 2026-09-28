import { z } from "zod";

function normaliseEmptyString(value: unknown): unknown {
  return typeof value === "string" && value.trim() === "" ? undefined : value;
}

export const requiredEnvironmentString = z.preprocess(
  normaliseEmptyString,
  z.string().min(1, "must not be empty"),
);

export const optionalEnvironmentString = z.preprocess(
  normaliseEmptyString,
  z.string().min(1, "must not be empty").optional(),
);

export const environmentBoolean = z.preprocess(
  (value) => {
    if (value === "true") {
      return true;
    }

    if (value === "false") {
      return false;
    }

    return value;
  },
  z.boolean({ error: "must be either true or false" }),
);

export const optionalEnvironmentBoolean = z.preprocess(
  (value) => {
    const normalisedValue = normaliseEmptyString(value);

    if (normalisedValue === undefined) {
      return undefined;
    }

    if (normalisedValue === "true") {
      return true;
    }

    if (normalisedValue === "false") {
      return false;
    }

    return normalisedValue;
  },
  z.boolean({ error: "must be either true or false" }).optional(),
);

export const environmentInteger = z.preprocess(
  (value) => {
    if (typeof value === "string" && /^-?\d+$/u.test(value)) {
      return Number(value);
    }

    return value;
  },
  z.number({ error: "must be a base-10 integer" }).int().safe(),
);

export const environmentUrl = z.preprocess(
  normaliseEmptyString,
  z.url({ error: "must be a valid absolute URL" }),
);

import type { ZodType } from "zod";

export class EnvironmentValidationError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "EnvironmentValidationError";
  }
}

export function validateEnvironment<Output>(
  schema: ZodType<Output>,
  values: unknown,
  scope: string,
): Output {
  const result = schema.safeParse(values);

  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => {
        const location = issue.path.length > 0 ? issue.path.join(".") : "environment";
        return `${location}: ${issue.message}`;
      })
      .join("; ");

    throw new EnvironmentValidationError(`Invalid ${scope} environment: ${issues}`);
  }

  return result.data;
}

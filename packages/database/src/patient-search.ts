import "server-only";

import { DatabaseBoundaryError, type TenantTransaction } from "./server";

export const PATIENT_SEARCH_PERMISSION = "PATIENT-PERM-001" as const;
export const PATIENT_SEARCH_DEFAULT_PAGE_SIZE = 25;
export const PATIENT_SEARCH_MAX_PAGE_SIZE = 100;
export const PATIENT_SEARCH_STATUSES = ["active", "inactive", "archived"] as const;

export interface PatientSearchContext {
  readonly applicationSessionId: string;
  readonly providerIdentityId: string;
}

export interface MaskedPatientSearchResult {
  readonly createdAt: string;
  readonly hasEmail: boolean;
  readonly hasPhone: boolean;
  readonly id: string;
  readonly maskedName: string;
  readonly patientNumber: string;
  readonly revision: number;
  readonly lifecycleRevision: number;
  readonly lifecycleState: "current" | "archived";
  readonly status: "active" | "inactive";
}

export interface PatientSearchPage {
  readonly nextCursor: string | null;
  readonly patients: readonly MaskedPatientSearchResult[];
  readonly previousCursor: string | null;
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const datePattern = /^\d{4}-\d{2}-\d{2}$/u;

export function validatePatientSearch(input: {
  readonly createdFrom?: string;
  readonly createdTo?: string;
  readonly cursor?: string;
  readonly direction?: "next" | "previous";
  readonly pageSize?: number;
  readonly query?: string;
  readonly status?: "active" | "inactive" | "archived";
}): void {
  const pageSize = input.pageSize ?? PATIENT_SEARCH_DEFAULT_PAGE_SIZE;
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > PATIENT_SEARCH_MAX_PAGE_SIZE) {
    throw new DatabaseBoundaryError("pageSize is invalid.");
  }
  if (input.query && input.query.trim().length > 160) {
    throw new DatabaseBoundaryError("query is invalid.");
  }
  for (const date of [input.createdFrom, input.createdTo]) {
    if (date && !datePattern.test(date)) throw new DatabaseBoundaryError("date filter is invalid.");
  }
  if (input.createdFrom && input.createdTo && input.createdFrom > input.createdTo) {
    throw new DatabaseBoundaryError("date range is invalid.");
  }
  if (input.cursor && input.cursor.length > 512) {
    throw new DatabaseBoundaryError("cursor is invalid.");
  }
}

export async function searchPatients(
  transaction: TenantTransaction,
  input: PatientSearchContext & {
    readonly createdFrom?: string;
    readonly createdTo?: string;
    readonly cursor?: string;
    readonly direction?: "next" | "previous";
    readonly pageSize?: number;
    readonly query?: string;
    readonly status?: "active" | "inactive" | "archived";
  },
): Promise<PatientSearchPage> {
  if (
    !uuidPattern.test(input.applicationSessionId) ||
    !uuidPattern.test(input.providerIdentityId)
  ) {
    throw new DatabaseBoundaryError("Patient search context is invalid.");
  }
  validatePatientSearch(input);
  const result = await transaction.query<{ readonly result: PatientSearchPage }>(
    `select graftvision_private.search_patients_lifecycle(
      $1::uuid, $2::uuid, $3::text, $4::text, $5::date, $6::date,
      $7::text, $8::text, $9::integer
    ) as result`,
    [
      input.applicationSessionId,
      input.providerIdentityId,
      input.query ?? null,
      input.status ?? "active",
      input.createdFrom ?? null,
      input.createdTo ?? null,
      input.cursor ?? null,
      input.direction ?? "next",
      input.pageSize ?? PATIENT_SEARCH_DEFAULT_PAGE_SIZE,
    ],
  );
  const page = result.rows[0]?.result;
  if (!page || !Array.isArray(page.patients)) {
    throw new DatabaseBoundaryError("Patient search returned an invalid projection.");
  }
  return page;
}

import { describe, expect, it, vi } from "vitest";

import {
  PATIENT_SEARCH_DEFAULT_PAGE_SIZE,
  PATIENT_SEARCH_MAX_PAGE_SIZE,
  PATIENT_SEARCH_PERMISSION,
  PATIENT_SEARCH_STATUSES,
  searchPatients,
  validatePatientSearch,
} from "./patient-search";
import { DatabaseBoundaryError } from "./server";

const context = {
  applicationSessionId: "11111111-1111-4111-8111-111111111111",
  providerIdentityId: "22222222-2222-4222-8222-222222222222",
};

describe("patient search boundary", () => {
  it("preserves the approved permission and bounded pagination contract", () => {
    expect(PATIENT_SEARCH_PERMISSION).toBe("PATIENT-PERM-001");
    expect(PATIENT_SEARCH_STATUSES).toEqual(["active", "inactive", "archived"]);
    expect(PATIENT_SEARCH_DEFAULT_PAGE_SIZE).toBe(25);
    expect(PATIENT_SEARCH_MAX_PAGE_SIZE).toBe(100);
  });

  it("rejects malformed filters and cursors before querying", () => {
    expect(() => {
      validatePatientSearch({ pageSize: 101 });
    }).toThrow(DatabaseBoundaryError);
    expect(() => {
      validatePatientSearch({ createdFrom: "2026-08-01", createdTo: "2026-07-01" });
    }).toThrow(DatabaseBoundaryError);
    expect(() => {
      validatePatientSearch({ cursor: "x".repeat(513) });
    }).toThrow(DatabaseBoundaryError);
  });

  it("returns only the masked search projection", async () => {
    const page = {
      nextCursor: null,
      patients: [
        {
          createdAt: "2026-07-29T00:00:00Z",
          hasEmail: true,
          hasPhone: true,
          id: "33333333-3333-4333-8333-333333333333",
          maskedName: "S••••••••",
          patientNumber: "GV-000001",
          revision: 1,
          status: "active",
        },
      ],
      previousCursor: null,
    } as const;
    const query = vi.fn().mockResolvedValue({ rows: [{ result: page }] });
    await expect(searchPatients({ query }, context)).resolves.toEqual(page);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("graftvision_private.search_patients"),
      expect.arrayContaining(["active", "next", 25]),
    );
    expect(JSON.stringify(page)).not.toMatch(/phone@|fullName|emailAddress|dateOfBirth/iu);
  });

  it("rejects forged authority context", async () => {
    await expect(
      searchPatients({ query: vi.fn() }, { ...context, applicationSessionId: "forged-context" }),
    ).rejects.toBeInstanceOf(DatabaseBoundaryError);
  });
});

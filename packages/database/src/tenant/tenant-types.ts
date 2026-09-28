import "server-only";

export type { TenantContext, TenantTransaction } from "../server";

export interface TrustedTenantContextRecord {
  readonly clinicId: string;
  readonly platformUserId: string;
}

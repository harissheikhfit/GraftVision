import { afterEach, beforeEach, vi } from "vitest";

export const NETWORK_ACCESS_ERROR =
  "Network access is disabled in unit tests. Inject a deterministic boundary fake instead.";

const blockedFetch: typeof fetch = () => Promise.reject(new Error(NETWORK_ACCESS_ERROR));

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(blockedFetch));
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

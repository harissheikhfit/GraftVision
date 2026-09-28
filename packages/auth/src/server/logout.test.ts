import { describe, expect, it, vi } from "vitest";

import { signOutSafely } from "./logout";

import type { SupabaseClient } from "@supabase/supabase-js";

const registryMocks = vi.hoisted(() => ({
  terminateCurrentSession: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./registry", () => registryMocks);

describe("signOutSafely", () => {
  it("uses local provider sign-out and remains repeatable", async () => {
    const signOut = vi.fn().mockResolvedValue({ error: null });
    const client = { auth: { signOut } } as unknown as Pick<SupabaseClient, "auth">;

    await signOutSafely(client);
    await signOutSafely(client);

    expect(signOut).toHaveBeenCalledTimes(2);
    expect(signOut).toHaveBeenNthCalledWith(1, { scope: "local" });
    expect(registryMocks.terminateCurrentSession).toHaveBeenCalledTimes(2);
  });

  it("still terminates the application session when provider logout fails", async () => {
    const signOut = vi.fn().mockResolvedValue({ error: new Error("provider unavailable") });
    const client = { auth: { signOut } } as unknown as Pick<SupabaseClient, "auth">;

    await expect(signOutSafely(client)).rejects.toMatchObject({ code: "AUTH_LOGOUT_FAILED" });
    expect(registryMocks.terminateCurrentSession).toHaveBeenCalledOnce();
  });
});

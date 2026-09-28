import { describe, expect, it, vi } from "vitest";

import { inviteUserByEmail } from "./invite";

import type { SupabaseClient } from "@supabase/supabase-js";

describe("inviteUserByEmail", () => {
  it("invites a user using the admin client", async () => {
    const inviteUserByEmailMock = vi.fn().mockResolvedValue({ error: null });
    const adminClient = {
      auth: { admin: { inviteUserByEmail: inviteUserByEmailMock } },
    } as unknown as Pick<SupabaseClient, "auth">;

    await inviteUserByEmail(adminClient, "test@example.test", { role: "admin" });

    expect(inviteUserByEmailMock).toHaveBeenCalledWith("test@example.test", {
      data: { role: "admin" },
    });
  });

  it("throws AuthBoundaryError when invitation fails", async () => {
    const inviteUserByEmailMock = vi.fn().mockResolvedValue({ error: new Error("Failed") });
    const adminClient = {
      auth: { admin: { inviteUserByEmail: inviteUserByEmailMock } },
    } as unknown as Pick<SupabaseClient, "auth">;

    await expect(inviteUserByEmail(adminClient, "test@example.test")).rejects.toThrow(
      "Unable to send the invitation.",
    );
  });
});

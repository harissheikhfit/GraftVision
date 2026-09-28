import { describe, expect, it, vi } from "vitest";

import { sendPasswordRecoveryEmail } from "./recover";

import type { SupabaseClient } from "@supabase/supabase-js";

describe("sendPasswordRecoveryEmail", () => {
  it("sends a recovery email", async () => {
    const resetPasswordForEmailMock = vi.fn().mockResolvedValue({ error: null });
    const client = {
      auth: { resetPasswordForEmail: resetPasswordForEmailMock },
    } as unknown as Pick<SupabaseClient, "auth">;

    await sendPasswordRecoveryEmail(client, "test@example.test");

    expect(resetPasswordForEmailMock).toHaveBeenCalledWith("test@example.test");
  });

  it("throws AuthBoundaryError when recovery fails", async () => {
    const resetPasswordForEmailMock = vi.fn().mockResolvedValue({ error: new Error("Failed") });
    const client = {
      auth: { resetPasswordForEmail: resetPasswordForEmailMock },
    } as unknown as Pick<SupabaseClient, "auth">;

    await expect(sendPasswordRecoveryEmail(client, "test@example.test")).rejects.toThrow(
      "Unable to send the recovery email.",
    );
  });
});

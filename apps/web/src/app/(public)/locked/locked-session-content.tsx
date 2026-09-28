"use client";

import { useEffect, useRef } from "react";

import { Button, Field, PublicShell, ScreenLockState, Stack, TextInput } from "@graftvision/ui";

export interface LockedSessionContentProps {
  readonly logoutAction: () => void | Promise<void>;
  readonly unlockAction: (formData: FormData) => void | Promise<void>;
}

export function LockedSessionContent({ logoutAction, unlockAction }: LockedSessionContentProps) {
  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    passwordRef.current?.focus();
  }, []);

  return (
    <PublicShell footer="Protected content remains hidden while this device is locked">
      <ScreenLockState
        action={
          <Stack>
            <form action={unlockAction}>
              <Stack>
                <Field controlId="unlock-password" label="Password" required>
                  {(controlProps) => (
                    <TextInput
                      {...controlProps}
                      autoComplete="current-password"
                      name="password"
                      ref={passwordRef}
                      type="password"
                    />
                  )}
                </Field>
                <Button type="submit">Unlock</Button>
              </Stack>
            </form>
            <form action={logoutAction}>
              <Button type="submit" variant="secondary">
                Sign out instead
              </Button>
            </form>
          </Stack>
        }
        description="Enter your password to reauthenticate. If reauthentication fails, you will be signed out."
        variant="shared-device-lock"
      />
    </PublicShell>
  );
}

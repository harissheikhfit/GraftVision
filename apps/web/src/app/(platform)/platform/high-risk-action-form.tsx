"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import { Button, Field, Inline, Select, Stack } from "@graftvision/ui";

function SubmitButton({ label }: { readonly label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button disabled={pending} type="submit" variant="destructive">
      {pending ? "Applying…" : label}
    </Button>
  );
}

export function HighRiskActionForm({
  action,
  children,
  confirmation,
  label,
  target,
}: {
  readonly action: (formData: FormData) => void | Promise<void>;
  readonly children: React.ReactNode;
  readonly confirmation: string;
  readonly label: string;
  readonly target: string;
}) {
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) cancel.current?.focus();
  }, [open]);

  function close() {
    setOpen(false);
    window.requestAnimationFrame(() => opener.current?.focus());
  }

  return (
    <>
      <Button
        onClick={() => {
          setOpen(true);
        }}
        ref={opener}
        size="small"
        variant="quiet"
      >
        {label}
      </Button>
      {open ? (
        <dialog
          aria-label={`${label} confirmation`}
          className="gv-platform-dialog"
          onKeyDown={(event) => {
            if (event.key === "Escape") close();
          }}
          open
          role="alertdialog"
        >
          <button
            aria-label="Close confirmation"
            className="gv-platform-dialog__backdrop"
            onClick={close}
            type="button"
          />
          <div className="gv-platform-dialog__panel">
            <Stack gap="4">
              <div>
                <p className="gv-platform-eyebrow">Confirmation required</p>
                <h2>{label}</h2>
                <p>
                  {confirmation} Target: <strong>{target}</strong>.
                </p>
              </div>
              <form action={action} aria-label={`${label}: ${target}`}>
                <Stack gap="4">
                  {children}
                  <Field label="Controlled reason">
                    {(control) => (
                      <Select {...control} name="reasonCode" required>
                        <option value="">Select a reason</option>
                        <option value="ACCESS_REVIEW">Access review</option>
                        <option value="SECURITY_RESPONSE">Security response</option>
                        <option value="OPERATOR_REQUEST">Authorised operator request</option>
                        <option value="EMPLOYMENT_CHANGE">Employment change</option>
                      </Select>
                    )}
                  </Field>
                  <label className="gv-platform-confirmation">
                    <input name="confirmed" required type="checkbox" value="yes" />
                    <span>I confirm this specific high-risk action.</span>
                  </label>
                  <Inline justify="end">
                    <Button onClick={close} ref={cancel} type="button" variant="secondary">
                      Cancel
                    </Button>
                    <SubmitButton label={label} />
                  </Inline>
                </Stack>
              </form>
            </Stack>
          </div>
        </dialog>
      ) : null}
    </>
  );
}

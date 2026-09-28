"use client";

import Image from "next/image";
import { useActionState, useState, type CSSProperties } from "react";
import { useFormStatus } from "react-dom";

import {
  Button,
  Checkbox,
  Field,
  Grid,
  InlineMessage,
  Section,
  Stack,
  TextInput,
} from "@graftvision/ui";

import { updateClinicBrandingAction, type ClinicBrandingActionState } from "./actions";

const initialState: ClinicBrandingActionState = {};

export interface ClinicBrandingFormProps {
  readonly brandingRevision: number;
  readonly clinicName: string;
  readonly linkAccent: string;
  readonly logoHeight: number | null;
  readonly logoUrl: string | null;
  readonly logoWidth: number | null;
  readonly presentationTitleText: string;
  readonly primaryAccent: string;
  readonly reportHeaderText: string;
  readonly secondaryAccent: string;
  readonly selectedControlAccent: string;
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button disabled={pending} isLoading={pending} loadingLabel="Saving branding" type="submit">
      Save branding
    </Button>
  );
}

export function ClinicBrandingForm(props: ClinicBrandingFormProps) {
  const [state, action] = useActionState(updateClinicBrandingAction, initialState);
  const [preview, setPreview] = useState({
    clinicName: props.clinicName,
    linkAccent: props.linkAccent,
    presentationTitleText: props.presentationTitleText,
    primaryAccent: props.primaryAccent,
    reportHeaderText: props.reportHeaderText,
    secondaryAccent: props.secondaryAccent,
    selectedControlAccent: props.selectedControlAccent,
  });
  const brandStyle: CSSProperties & Record<`--${string}`, string> = {
    "--gv-brand-link": preview.linkAccent,
    "--gv-brand-primary": preview.primaryAccent,
    "--gv-brand-secondary": preview.secondaryAccent,
    "--gv-brand-selected-control": preview.selectedControlAccent,
  };

  return (
    <form action={action}>
      <Stack gap="8">
        {state.message ? (
          <InlineMessage
            announce
            title={state.status === "conflict" ? "Revision conflict" : "Clinic branding"}
            variant={state.status === "success" ? "success" : "error"}
          >
            {state.message}
          </InlineMessage>
        ) : null}
        <Section heading="Identity">
          <Stack gap="4">
            <Field error={state.fieldErrors?.clinicName} label="Clinic name" required>
              {(control) => (
                <TextInput
                  {...control}
                  maxLength={160}
                  name="clinicName"
                  onChange={(event) => {
                    setPreview((value) => ({ ...value, clinicName: event.target.value }));
                  }}
                  value={preview.clinicName}
                />
              )}
            </Field>
            <Field error={state.fieldErrors?.reportHeaderText} label="Report header text" required>
              {(control) => (
                <TextInput
                  {...control}
                  maxLength={120}
                  name="reportHeaderText"
                  onChange={(event) => {
                    setPreview((value) => ({ ...value, reportHeaderText: event.target.value }));
                  }}
                  value={preview.reportHeaderText}
                />
              )}
            </Field>
            <Field
              error={state.fieldErrors?.presentationTitleText}
              label="Presentation title text"
              required
            >
              {(control) => (
                <TextInput
                  {...control}
                  maxLength={80}
                  name="presentationTitleText"
                  onChange={(event) => {
                    setPreview((value) => ({
                      ...value,
                      presentationTitleText: event.target.value,
                    }));
                  }}
                  value={preview.presentationTitleText}
                />
              )}
            </Field>
            <Field
              description="PNG, JPEG, WebP, or sanitised SVG. 256–2048 px per side, up to 2 MB."
              error={state.fieldErrors?.logo}
              label="Clinic logo"
            >
              {(control) => (
                <input
                  {...control}
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  name="logo"
                  type="file"
                />
              )}
            </Field>
            {props.logoUrl && props.logoWidth && props.logoHeight ? (
              <Image
                alt={`${preview.clinicName} logo`}
                height={Math.min(props.logoHeight, 160)}
                src={props.logoUrl}
                unoptimized
                width={Math.min(props.logoWidth, 320)}
              />
            ) : (
              <p>Default GraftVision branding is currently used.</p>
            )}
            <Checkbox label="Remove current logo and use GraftVision default" name="removeLogo" />
          </Stack>
        </Section>
        <Section heading="Approved accents">
          <Grid columns={2}>
            {(
              [
                ["primaryAccent", "Primary accent"],
                ["secondaryAccent", "Secondary accent"],
                ["linkAccent", "Link accent"],
                ["selectedControlAccent", "Selected-control accent"],
              ] as const
            ).map(([name, label]) => (
              <Field error={state.fieldErrors?.[name]} key={name} label={label} required>
                {(control) => (
                  <TextInput
                    {...control}
                    maxLength={7}
                    name={name}
                    onChange={(event) => {
                      setPreview((value) => ({ ...value, [name]: event.target.value }));
                    }}
                    pattern="#[0-9a-f]{6}"
                    value={preview[name]}
                  />
                )}
              </Field>
            ))}
          </Grid>
        </Section>
        <Section heading="Visual previews">
          <div style={brandStyle}>
            <Stack gap="4">
              <section aria-label="Clinic shell preview">
                <strong>{preview.clinicName || "Clinic name"}</strong>
                <p style={{ color: "var(--gv-brand-link)" }}>Clinic shell link preview</p>
                <button
                  style={{
                    background: "var(--gv-brand-selected-control)",
                    color: "white",
                  }}
                  type="button"
                >
                  Selected control
                </button>
              </section>
              <section aria-label="Report header preview">
                <strong style={{ color: "var(--gv-brand-primary)" }}>
                  {preview.reportHeaderText || "Report header"}
                </strong>
                <p>Preview only — no report is generated.</p>
              </section>
              <section aria-label="Presentation title preview">
                <strong style={{ color: "var(--gv-brand-secondary)" }}>
                  {preview.presentationTitleText || "Presentation title"}
                </strong>
                <p>Preview only — no presentation session is created.</p>
              </section>
            </Stack>
          </div>
        </Section>
        <input name="brandingRevision" type="hidden" value={props.brandingRevision} />
        <SubmitButton />
      </Stack>
    </form>
  );
}

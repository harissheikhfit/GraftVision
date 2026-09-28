"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button, Checkbox, Field, InlineMessage, Select, Stack } from "@graftvision/ui";

import {
  acknowledgePrivacyNoticeAction,
  type PrivacyAcknowledgementActionState,
  withdrawPrivacyAcknowledgementAction,
} from "./actions";

interface PatientPrivacyAcknowledgementView {
  readonly current: {
    readonly id: string;
    readonly languagePresented: "en" | "ur";
    readonly noticeVersionId: string;
    readonly occurredAt: string;
    readonly purposeCode: "REGISTRATION_PRIVACY";
    readonly revision: number;
    readonly status: "pending" | "acknowledged" | "withdrawn" | "superseded";
    readonly withdrawalAt: string | null;
  } | null;
  readonly notices: readonly {
    readonly contentReference: string;
    readonly effectiveDate: string;
    readonly language: "en" | "ur";
    readonly noticePairId: string;
    readonly noticeVersionId: string;
    readonly purposeCode: "REGISTRATION_PRIVACY";
    readonly semanticVersion: string;
    readonly state: "approved" | "superseded";
  }[];
}

function SubmitButton({ label }: { readonly label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button disabled={pending} isLoading={pending} loadingLabel="Recording" type="submit">
      {label}
    </Button>
  );
}

export function PrivacyAcknowledgementForm({
  acknowledgementIdempotencyKey,
  patientId,
  view,
  withdrawalIdempotencyKey,
}: {
  readonly acknowledgementIdempotencyKey: string;
  readonly patientId: string;
  readonly view: PatientPrivacyAcknowledgementView;
  readonly withdrawalIdempotencyKey: string;
}) {
  const [acknowledgeState, acknowledgeAction] = useActionState<
    PrivacyAcknowledgementActionState,
    FormData
  >(acknowledgePrivacyNoticeAction, {});
  const [withdrawState, withdrawAction] = useActionState<
    PrivacyAcknowledgementActionState,
    FormData
  >(withdrawPrivacyAcknowledgementAction, {});
  const noticesByLanguage = new Map(
    view.notices.map((notice) => [notice.language, notice] as const),
  );
  const english = noticesByLanguage.get("en");
  const urdu = noticesByLanguage.get("ur");
  const paired =
    english &&
    urdu &&
    english.noticePairId === urdu.noticePairId &&
    english.semanticVersion === urdu.semanticVersion;
  if (!paired) {
    return (
      <InlineMessage announce title="Notice unavailable" variant="error">
        Matching approved English and Urdu privacy notices are required.
      </InlineMessage>
    );
  }
  return (
    <Stack gap="5">
      <InlineMessage title="Current privacy acknowledgement" variant="information">
        Status: {view.current?.status ?? "pending"}. This record is separate from treatment consent.
      </InlineMessage>
      <section aria-labelledby="privacy-notice-heading">
        <h2 id="privacy-notice-heading">Review approved privacy notice</h2>
        <p>
          Version {english.semanticVersion}. The approved notice must be presented in the selected
          language before acknowledgement.
        </p>
        <ul>
          <li lang="en">English reference: {english.contentReference}</li>
          <li dir="rtl" lang="ur">
            اردو حوالہ: {urdu.contentReference}
          </li>
        </ul>
      </section>
      <form action={acknowledgeAction}>
        <Stack gap="3">
          {acknowledgeState.message ? (
            <InlineMessage
              announce
              title="Privacy acknowledgement"
              variant={acknowledgeState.status === "success" ? "success" : "error"}
            >
              {acknowledgeState.message}
            </InlineMessage>
          ) : null}
          <Field label="Language presented" required>
            {(control) => (
              <Select {...control} name="language">
                <option value="en">English</option>
                <option value="ur">Urdu — اردو</option>
              </Select>
            )}
          </Field>
          <Checkbox
            label="The patient reviewed the selected privacy notice and explicitly acknowledged it."
            name="explicitAcknowledgement"
            required
            value="yes"
          />
          <input name="patientId" type="hidden" value={patientId} />
          <input name="noticeVersionIdEn" type="hidden" value={english.noticeVersionId} />
          <input name="noticeVersionIdUr" type="hidden" value={urdu.noticeVersionId} />
          <input name="revision" type="hidden" value={view.current?.revision ?? 0} />
          <input name="idempotencyKey" type="hidden" value={acknowledgementIdempotencyKey} />
          <SubmitButton label="Record acknowledgement" />
        </Stack>
      </form>
      {view.current?.status === "acknowledged" ? (
        <form action={withdrawAction}>
          <Stack gap="3">
            {withdrawState.message ? (
              <InlineMessage
                announce
                title="Privacy acknowledgement withdrawal"
                variant={withdrawState.status === "success" ? "success" : "error"}
              >
                {withdrawState.message}
              </InlineMessage>
            ) : null}
            <p>
              Withdrawal applies prospectively. It preserves immutable history and does not
              automatically invalidate past lawful processing.
            </p>
            <Checkbox
              label="I verified that the patient requested this withdrawal."
              name="confirmedRequest"
              required
              value="yes"
            />
            <input name="patientId" type="hidden" value={patientId} />
            <input name="revision" type="hidden" value={view.current.revision} />
            <input name="idempotencyKey" type="hidden" value={withdrawalIdempotencyKey} />
            <SubmitButton label="Withdraw acknowledgement" />
          </Stack>
        </form>
      ) : null}
    </Stack>
  );
}

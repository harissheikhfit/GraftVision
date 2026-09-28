import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PrivacyAcknowledgementForm } from "./privacy-acknowledgement-form";

vi.mock("./actions", () => ({
  acknowledgePrivacyNoticeAction: vi.fn(),
  withdrawPrivacyAcknowledgementAction: vi.fn(),
}));

const notices = [
  {
    contentReference: "notice://registration-privacy/synthetic/1.0/en",
    effectiveDate: "2026-07-01",
    language: "en" as const,
    noticePairId: "71000000-0000-4000-8000-000000000010",
    noticeVersionId: "71000000-0000-4000-8000-000000000011",
    purposeCode: "REGISTRATION_PRIVACY" as const,
    semanticVersion: "1.0",
    state: "approved" as const,
  },
  {
    contentReference: "notice://registration-privacy/synthetic/1.0/ur",
    effectiveDate: "2026-07-01",
    language: "ur" as const,
    noticePairId: "71000000-0000-4000-8000-000000000010",
    noticeVersionId: "71000000-0000-4000-8000-000000000012",
    purposeCode: "REGISTRATION_PRIVACY" as const,
    semanticVersion: "1.0",
    state: "approved" as const,
  },
];

describe("privacy acknowledgement flow", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows paired English and RTL Urdu notices with no preselected acknowledgement", () => {
    const { container } = render(
      <PrivacyAcknowledgementForm
        acknowledgementIdempotencyKey="71000000-0000-4000-8000-000000000020"
        patientId="71000000-0000-4000-8000-000000000001"
        view={{ current: null, notices }}
        withdrawalIdempotencyKey="71000000-0000-4000-8000-000000000021"
      />,
    );
    expect(screen.getByText(/English reference/)).toBeInTheDocument();
    expect(screen.getByText(/اردو حوالہ/)).toHaveAttribute("dir", "rtl");
    expect(screen.getByRole("checkbox")).not.toBeChecked();
    expect(container.querySelector("form")).toBeTruthy();
  });

  it("supports keyboard selection and explicit acknowledgement", async () => {
    const user = userEvent.setup();
    render(
      <PrivacyAcknowledgementForm
        acknowledgementIdempotencyKey="71000000-0000-4000-8000-000000000020"
        patientId="71000000-0000-4000-8000-000000000001"
        view={{ current: null, notices }}
        withdrawalIdempotencyKey="71000000-0000-4000-8000-000000000021"
      />,
    );
    await user.selectOptions(screen.getByRole("combobox"), "ur");
    await user.click(screen.getByRole("checkbox"));
    expect(screen.getByRole("combobox")).toHaveValue("ur");
    expect(screen.getByRole("checkbox")).toBeChecked();
  });

  it("shows prospective withdrawal only for an active acknowledgement", () => {
    render(
      <PrivacyAcknowledgementForm
        acknowledgementIdempotencyKey="71000000-0000-4000-8000-000000000020"
        patientId="71000000-0000-4000-8000-000000000001"
        view={{
          current: {
            id: "71000000-0000-4000-8000-000000000030",
            languagePresented: "en",
            noticeVersionId: notices[0]!.noticeVersionId,
            occurredAt: "2026-07-01T00:00:00Z",
            purposeCode: "REGISTRATION_PRIVACY",
            revision: 1,
            status: "acknowledged",
            withdrawalAt: null,
          },
          notices,
        }}
        withdrawalIdempotencyKey="71000000-0000-4000-8000-000000000021"
      />,
    );
    expect(screen.getByText(/Withdrawal applies prospectively/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Withdraw acknowledgement" })).toBeInTheDocument();
  });

  it("fails closed when bilingual parity is missing", () => {
    render(
      <PrivacyAcknowledgementForm
        acknowledgementIdempotencyKey="71000000-0000-4000-8000-000000000020"
        patientId="71000000-0000-4000-8000-000000000001"
        view={{ current: null, notices: [notices[0]!] }}
        withdrawalIdempotencyKey="71000000-0000-4000-8000-000000000021"
      />,
    );
    expect(screen.getByText(/Matching approved English and Urdu/)).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

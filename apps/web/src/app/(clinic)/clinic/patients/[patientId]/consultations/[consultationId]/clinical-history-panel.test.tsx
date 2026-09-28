import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ClinicalHistoryPanel } from "./clinical-history-panel";

describe("clinical history workspace", () => {
  it("renders semantic clinical sections and truthful readiness", () => {
    const action = vi.fn().mockResolvedValue({ status: "success" });
    render(
      <ClinicalHistoryPanel
        createPrivateNoteAction={action}
        hair={null}
        medical={null}
        privateNotes={[]}
        saveHairAction={action}
        saveMedicalAction={action}
        summary={null}
        transitionReviewAction={action}
      />,
    );
    expect(screen.getByRole("group", { name: "Essential safety history" })).toBeVisible();
    expect(screen.getByRole("group", { name: "Consultation-specific history" })).toBeVisible();
    expect(screen.getByText(/Preliminary assessment readiness:/u)).toHaveTextContent("Not ready");
    expect(screen.getByText(/Reviewer access is disabled/u)).toBeVisible();
    expect(screen.getByText(/Autosave is not enabled/u)).toBeVisible();
  });
});

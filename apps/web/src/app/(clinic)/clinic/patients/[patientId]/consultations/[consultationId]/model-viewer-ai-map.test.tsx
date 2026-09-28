import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AiMapProposalToolbar } from "./model-viewer-ai-map";

describe("AiMapProposalToolbar", () => {
  it("displays synthetic AI warning and load buttons", () => {
    const loadProposal = vi.fn();
    const queueProposal = vi.fn();

    render(
      <AiMapProposalToolbar
        proposalPackage={null}
        isLoading={false}
        isPending={false}
        error={null}
        loadProposal={loadProposal}
        queueProposal={queueProposal}
        showAiLayer={true}
        setShowAiLayer={() => {}}
        showDoctorDraft={true}
        setShowDoctorDraft={() => {}}
        showFinalized={true}
        setShowFinalized={() => {}}
        selectedSuggestionId={null}
        landmarks={[]}
        curves={[]}
        regions={[]}
        decisions={{}}
        recordDecision={vi.fn()}
        importSuggestion={vi.fn()}
      />,
    );

    expect(
      screen.getByText("Development synthetic AI proposal — Doctor review required."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Load Proposal" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Request AI Generation" })).toBeEnabled();
    expect(screen.getByText("Not generated")).toBeInTheDocument();
  });

  it("shows controls when package is completed and handles suggestion decisions", () => {
    const recordDecision = vi.fn();
    const importSuggestion = vi.fn().mockResolvedValue(true);

    render(
      <AiMapProposalToolbar
        proposalPackage={{
          id: "123",
          clinic_id: "clinic1",
          scan_session_id: "scan1",
          analyzer_handoff_id: "handoff1",
          package_state: "completed",
          overall_confidence: 0.95,
          quality_state: "high",
          created_at: new Date().toISOString(),
        }}
        isLoading={false}
        isPending={false}
        error={null}
        loadProposal={vi.fn()}
        queueProposal={vi.fn()}
        showAiLayer={true}
        setShowAiLayer={() => {}}
        showDoctorDraft={true}
        setShowDoctorDraft={() => {}}
        showFinalized={true}
        setShowFinalized={() => {}}
        selectedSuggestionId="lmk1"
        landmarks={[
          {
            id: "lmk1",
            proposal_package_id: "123",
            landmark_code: "glabella_reference",
            normalized_coordinate: [0, 0, 0],
            confidence: 0.9,
          },
        ]}
        curves={[]}
        regions={[]}
        decisions={{ lmk1: "pending" }}
        recordDecision={recordDecision}
        importSuggestion={importSuggestion}
      />,
    );

    expect(screen.getByText("95.0%")).toBeInTheDocument();
    expect(screen.getByLabelText("AI Proposal")).toBeChecked();

    expect(screen.getByText("Selected AI Suggestion")).toBeInTheDocument();
    expect(screen.getByText("Status: pending")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Accept" }));
    expect(recordDecision).toHaveBeenCalledWith("lmk1", "landmark", "accepted");

    fireEvent.click(screen.getByRole("button", { name: "Import to Draft" }));
    expect(importSuggestion).toHaveBeenCalledWith("lmk1", "landmark");
  });
});

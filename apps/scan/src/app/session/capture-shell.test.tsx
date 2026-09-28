import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CaptureShell } from "./capture-shell";

const baseState = {
  capture: {
    captureStatus: "capturing" as const,
    completedSteps: [],
    currentStep: "front" as const,
    lastActivityAt: "2026-08-02T00:00:00.000Z",
    revision: 1,
  },
  quality: [
    {
      assetId: "11111111-1111-4111-8111-111111111111",
      captureStep: "front",
      qualityRevision: 2,
      qualityState: "retake_required" as const,
      reasonCode: "IMAGE_TOO_BLURRY",
      stale: false,
    },
  ],
  readiness: { blockerCodes: ["RETAKE_REQUIRED"], isReady: false, qualityReviewRevision: 2 },
  status: "paired" as const,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("CaptureShell quality states", () => {
  it("renders a bounded retake state with an accessible retry action", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ json: () => Promise.resolve(baseState), ok: true }),
    );

    render(<CaptureShell scanSessionId="11111111-1111-4111-8111-111111111111" />);

    await waitFor(() => {
      expect(screen.getByText("Retake required")).not.toBeNull();
    });
    expect(screen.getByText("IMAGE_TOO_BLURRY")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Retake this angle" })).not.toBeNull();
  });

  it("shows scan readiness only from the trusted status response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: () =>
          Promise.resolve({
            ...baseState,
            capture: {
              ...baseState.capture,
              captureStatus: "capture_complete",
              currentStep: "capture_complete",
            },
            readiness: { blockerCodes: [], isReady: true, qualityReviewRevision: 8 },
            status: "completed",
          }),
        ok: true,
      }),
    );

    render(<CaptureShell scanSessionId="11111111-1111-4111-8111-111111111111" />);

    await waitFor(() => {
      expect(
        screen.getByText("All required angles have passed trusted technical validation."),
      ).not.toBeNull();
    });
  });
});

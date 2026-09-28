import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LoadingBlock } from "./loading-block";
import { LoadingIndicator } from "./loading-indicator";
import { ProcessingState } from "./processing-state";
import { ProgressIndicator } from "./progress-indicator";
import { Skeleton } from "./skeleton";

describe("loading and progress states", () => {
  it("exposes a stable loading label and size without exposing its shape", () => {
    const { container } = render(<LoadingIndicator label="Preparing view" size="large" />);

    expect(screen.getByRole("status", { name: "Preparing view" })).toHaveClass(
      "gv-loading-indicator--large",
    );
    expect(container.querySelector(".gv-loading-indicator__shape")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });

  it("uses a polite busy region for a loading block", () => {
    render(
      <LoadingBlock
        description="The requested view is being prepared."
        heading="Loading"
        progressText="Please wait."
      />,
    );

    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-busy", "true");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(screen.getByRole("heading", { level: 1, name: "Loading" })).toBeVisible();
  });

  it("uses native determinate progress and clamps invalid values", () => {
    const { rerender } = render(
      <ProgressIndicator label="Preparing" max={80} min={20} showValue value={140} />,
    );

    const progress = screen.getByRole("progressbar", { name: "Preparing" });
    expect(progress).toHaveAttribute("aria-valuemin", "20");
    expect(progress).toHaveAttribute("aria-valuemax", "80");
    expect(progress).toHaveAttribute("aria-valuenow", "80");
    expect(progress).toHaveAttribute("max", "60");
    expect(progress).toHaveAttribute("value", "60");
    expect(screen.getByText("100%")).toBeVisible();

    rerender(<ProgressIndicator label="Waiting" />);
    expect(screen.getByRole("progressbar", { name: "Waiting" })).not.toHaveAttribute("value");
  });

  it("rejects invalid ranges and impossible step counts", () => {
    expect(() =>
      render(<ProgressIndicator label="Invalid range" max={10} min={10} value={10} />),
    ).toThrow(/max greater than min/);
    expect(() =>
      render(<ProgressIndicator label="Invalid step" step={{ current: 3, total: 2 }} value={50} />),
    ).toThrow(/step values/);
  });

  it("distinguishes processing stages and never exposes retry before failure", () => {
    const { rerender } = render(
      <ProcessingState
        description="Waiting for confirmed processing."
        retryAction={<button type="button">Retry</button>}
        stageLabel="Queued"
        status="queued"
      />,
    );

    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();

    rerender(
      <ProcessingState
        description="The operation did not complete."
        retryAction={<button type="button">Retry</button>}
        stageLabel="Failed"
        status="failed"
      />,
    );
    expect(screen.getByRole("button", { name: "Retry" })).toBeVisible();
  });

  it("hides bare skeletons and labels explicit loading containers", () => {
    const { rerender } = render(<Skeleton lines={3} shape="text" />);
    expect(document.querySelector(".gv-skeleton")).toHaveAttribute("aria-hidden", "true");

    rerender(<Skeleton loadingLabel="Loading placeholder" shape="circle" />);
    expect(screen.getByRole("status", { name: "Loading placeholder" })).toBeVisible();
  });
});

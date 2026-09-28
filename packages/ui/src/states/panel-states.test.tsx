import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Button } from "../primitives/button";
import { Link } from "../primitives/link";

import { EmptyState } from "./empty-state";
import { ErrorState } from "./error-state";
import { PermissionDeniedState } from "./permission-denied-state";
import { ScreenLockState } from "./screen-lock-state";
import { SessionExpiredState } from "./session-expired-state";
import { SuccessState } from "./success-state";
import { WarningState } from "./warning-state";

describe("state panels", () => {
  it("renders generic empty state hierarchy and accessible action slots", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn();

    render(
      <EmptyState
        description="Create an item to begin."
        heading="No items yet"
        headingLevel={1}
        primaryAction={<Button onClick={onCreate}>Create item</Button>}
        secondaryAction={<Link href="/example">Learn more</Link>}
        variant="full-page"
      />,
    );

    expect(screen.getByRole("heading", { level: 1, name: "No items yet" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Create item" }));
    expect(onCreate).toHaveBeenCalledOnce();
    expect(screen.getByRole("link", { name: "Learn more" })).toHaveAttribute("href", "/example");
  });

  it("renders safe error recovery text and an opaque reference only", () => {
    render(
      <ErrorState
        description="The action could not be completed. Review the information and try again."
        errorReference="SYNTHETIC-42"
        heading="Unable to continue"
        retryAction={<Button>Try again</Button>}
      />,
    );

    expect(screen.getByText("Reference: SYNTHETIC-42")).toBeVisible();
    expect(screen.queryByText(/stack|secret|saved successfully/i)).not.toBeInTheDocument();
  });

  it("announces warning and success only when requested", () => {
    render(
      <>
        <WarningState description="Review before continuing." heading="Check this item" />
        <SuccessState announce description="The action completed." heading="Complete" />
      </>,
    );

    expect(screen.getByText("Check this item").closest("section")).not.toHaveAttribute("aria-live");
    expect(screen.getByText("Complete").closest("section")).toHaveAttribute("aria-live", "polite");
  });

  it("keeps permission-denied copy consumer supplied and resource neutral", () => {
    render(
      <PermissionDeniedState
        backAction={<Link href="/">Return</Link>}
        description="You do not have access to this area."
        requiredPermission="Approved viewer"
      />,
    );

    expect(screen.getByRole("heading", { name: "Access restricted" })).toBeVisible();
    expect(screen.getByText("Required permission: Approved viewer")).toBeVisible();
    expect(screen.queryByText(/record|tenant|identity/i)).not.toBeInTheDocument();
  });

  it("renders expired and locked screens without retaining sensitive content", () => {
    render(
      <>
        <SessionExpiredState
          action={<Button>Return safely</Button>}
          description="Return to the start to open a new session."
        />
        <ScreenLockState
          description="Return to an authorised entry point."
          variant="shared-device-lock"
        />
      </>,
    );

    expect(screen.getByRole("heading", { name: "Session expired" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Shared device locked" })).toBeVisible();
    expect(screen.queryByText(/patient|clinic|record/i)).not.toBeInTheDocument();
  });
});

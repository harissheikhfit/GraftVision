import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Container } from "./container";
import { Divider } from "./divider";
import { Grid } from "./grid";
import { Inline } from "./inline";
import { Section } from "./section";
import { Stack } from "./stack";

describe("layout primitives", () => {
  it("provides semantic sections and separators", () => {
    render(
      <Section actions={<button type="button">Section action</button>} heading="Generic section">
        <Divider label="Related information" />
        <Divider decorative />
        <span>Section content</span>
      </Section>,
    );

    expect(screen.getByRole("region", { name: "Generic section" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Generic section" })).toBeInTheDocument();
    expect(screen.getByRole("separator", { name: "Related information" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Section action" })).toBeInTheDocument();
    expect(document.querySelector("hr[aria-hidden='true']")).toBeInTheDocument();
  });

  it("maps constrained layout choices to responsive classes", () => {
    render(
      <Container data-testid="container" size="wide">
        <Stack data-testid="stack" density="presentation">
          <Inline data-testid="inline" gap="3" justify="between" wrap>
            <span>Inline item</span>
          </Inline>
          <Grid columns={4} data-testid="grid" gap="6" minimumItemWidth="wide">
            <span>Grid item</span>
          </Grid>
        </Stack>
      </Container>,
    );

    expect(screen.getByTestId("container")).toHaveClass(
      "gv-container--wide",
      "gv-container--centered",
      "gv-container--padded",
    );
    expect(screen.getByTestId("stack")).toHaveClass(
      "gv-stack--density-presentation",
      "gv-layout-gap--6",
    );
    expect(screen.getByTestId("inline")).toHaveClass(
      "gv-inline--wrap",
      "gv-inline--justify-between",
      "gv-layout-gap--3",
    );
    expect(screen.getByTestId("grid")).toHaveClass(
      "gv-grid--columns-4",
      "gv-grid--minimum-wide",
      "gv-layout-gap--6",
    );
    expect(screen.getByTestId("grid")).not.toHaveAttribute("style");
  });
});

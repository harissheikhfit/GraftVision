import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DataValue } from "./data-value";
import { DefinitionList } from "./definition-list";
import { DescriptionBlock } from "./description-block";
import { InformationPanel } from "./information-panel";
import { KeyValueList } from "./key-value-list";
import { MetadataList } from "./metadata-list";
import { ReferenceValue } from "./reference-value";
import { Stat } from "./stat";

describe("information lists", () => {
  it("uses definition-list semantics for multiple and empty values", () => {
    const { container } = render(
      <DefinitionList
        items={[
          { id: "one", term: "Multiple", values: ["Alpha", "Beta"] },
          { id: "two", term: "Empty", values: [] },
        ]}
        layout="two-column"
      />,
    );

    const list = container.querySelector("dl");
    expect(list).toHaveClass("gv-definition-list--two-column");
    expect(list?.querySelectorAll("dt")).toHaveLength(2);
    expect(list?.querySelectorAll("dd")).toHaveLength(3);
    expect(within(list as HTMLElement).getByText("Alpha")).toBeInTheDocument();
    expect(within(list as HTMLElement).getByText("Beta")).toBeInTheDocument();
    expect(within(list as HTMLElement).getByText("Not provided")).toBeInTheDocument();
  });

  it("keeps key/value and metadata content generic and semantically paired", () => {
    const { container } = render(
      <>
        <KeyValueList
          items={[
            {
              description: "Secondary explanation",
              id: "key",
              label: "Example label",
              state: "Pending",
            },
          ]}
        />
        <MetadataList
          items={[{ id: "version", label: "Version", status: "Current", value: "2" }]}
        />
      </>,
    );

    const lists = container.querySelectorAll("dl");
    expect(lists).toHaveLength(2);
    expect(lists[0]?.querySelectorAll("dt")).toHaveLength(1);
    expect(lists[0]?.querySelectorAll("dd")).toHaveLength(1);
    expect(lists[0]).toHaveTextContent("Not provided");
    expect(lists[0]).toHaveTextContent("Secondary explanation");
    expect(lists[0]).toHaveTextContent("Pending");
    expect(lists[1]).toHaveTextContent("Version2Current");
  });
});

describe("display values and static panels", () => {
  it("renders consumer-controlled strings, units, states, and safe empty values unchanged", () => {
    render(
      <>
        <DataValue
          label="Data example"
          preliminaryMarker={<span>Preliminary</span>}
          status={<span>Review</span>}
          supportingText="Consumer supplied"
          unit="units"
          value="0012.3400"
        />
        <Stat label="Stat example" supportingText="No automatic formatting" />
      </>,
    );

    expect(screen.getByText("0012.3400")).toBeInTheDocument();
    expect(screen.getByText("units")).toBeInTheDocument();
    expect(screen.getByText("Preliminary")).toBeInTheDocument();
    expect(screen.getByText("Review")).toBeInTheDocument();
    expect(screen.getByText("Consumer supplied")).toBeInTheDocument();
    expect(screen.getByText("Not provided")).toBeInTheDocument();
    expect(screen.getByText("No automatic formatting")).toBeInTheDocument();
  });

  it("supports explicit heading levels, metadata, actions, and restrained panel variants", () => {
    render(
      <>
        <DescriptionBlock
          action={<button type="button">Generic action</button>}
          body="Static body."
          heading="Description heading"
          headingLevel={2}
          metadata="Version 2"
        />
        <InformationPanel
          action={<a href="/generic">Learn more</a>}
          description="Static information."
          heading="Information heading"
          headingLevel={4}
          status="Restricted"
          variant="restricted"
        />
      </>,
    );

    expect(screen.getByRole("heading", { level: 2, name: "Description heading" })).toBeVisible();
    expect(screen.getByText("Version 2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Generic action" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 4, name: "Information heading" })).toBeVisible();
    expect(screen.getByRole("region", { name: "Information heading" })).toHaveClass(
      "gv-information-panel--restricted",
    );
    expect(screen.getByRole("link", { name: "Learn more" })).toBeInTheDocument();
  });

  it("renders opaque references with safe labels, wrapping, and optional actions", () => {
    render(
      <ReferenceValue
        accessibleLabel="Example reference"
        copyAction={<button type="button">Copy reference</button>}
        reference="opaque-example-reference-0001"
        truncate
      />,
    );

    const reference = screen.getByLabelText("Example reference: opaque-example-reference-0001");
    expect(reference).toHaveTextContent("opaque-example-reference-0001");
    expect(reference).toHaveClass("gv-reference-value__code--truncate");
    expect(reference).toHaveClass("gv-reference-value__code");
    expect(screen.getByRole("button", { name: "Copy reference" })).toBeInTheDocument();
  });
});

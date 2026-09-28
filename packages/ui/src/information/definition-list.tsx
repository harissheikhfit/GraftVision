import { classNames } from "../internal/class-names";

import type { ReactNode } from "react";

export interface DefinitionListItem {
  readonly id: string;
  readonly term: ReactNode;
  readonly value?: ReactNode;
  readonly values?: readonly ReactNode[];
}

export interface DefinitionListProps {
  readonly className?: string;
  readonly density?: "comfortable" | "compact";
  readonly emptyValue?: string;
  readonly items: readonly DefinitionListItem[];
  readonly layout?: "two-column" | "vertical";
}

export function DefinitionList({
  className,
  density = "comfortable",
  emptyValue = "Not provided",
  items,
  layout = "vertical",
}: DefinitionListProps) {
  return (
    <dl
      className={classNames(
        "gv-definition-list",
        `gv-definition-list--${layout}`,
        `gv-definition-list--${density}`,
        className,
      )}
    >
      {items.map((item) => {
        const values = item.values ?? [item.value];
        const displayValues = values.length > 0 ? values : [undefined];

        return (
          <div className="gv-definition-list__item" key={item.id}>
            <dt>{item.term}</dt>
            {displayValues.map((value, index) => (
              <dd key={`${item.id}-value-${index + 1}`}>
                {value === undefined || value === null ? emptyValue : value}
              </dd>
            ))}
          </div>
        );
      })}
    </dl>
  );
}

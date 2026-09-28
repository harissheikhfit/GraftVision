import { classNames } from "../internal/class-names";

import type { ReactNode } from "react";

export interface KeyValueListItem {
  readonly description?: ReactNode;
  readonly id: string;
  readonly label: ReactNode;
  readonly state?: ReactNode;
  readonly value?: ReactNode;
}

export interface KeyValueListProps {
  readonly className?: string;
  readonly density?: "comfortable" | "compact";
  readonly emptyValue?: string;
  readonly items: readonly KeyValueListItem[];
}

export function KeyValueList({
  className,
  density = "comfortable",
  emptyValue = "Not provided",
  items,
}: KeyValueListProps) {
  return (
    <dl className={classNames("gv-key-value-list", `gv-key-value-list--${density}`, className)}>
      {items.map((item) => (
        <div className="gv-key-value-list__item" key={item.id}>
          <dt>
            <span>{item.label}</span>
            {item.description ? (
              <span className="gv-key-value-list__description">{item.description}</span>
            ) : null}
          </dt>
          <dd>
            <span>{item.value === undefined || item.value === null ? emptyValue : item.value}</span>
            {item.state ? <span className="gv-key-value-list__state">{item.state}</span> : null}
          </dd>
        </div>
      ))}
    </dl>
  );
}

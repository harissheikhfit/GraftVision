import { classNames } from "../internal/class-names";

import type { ReactNode } from "react";

export interface MetadataListItem {
  readonly id: string;
  readonly label: ReactNode;
  readonly status?: ReactNode;
  readonly value?: ReactNode;
}

export interface MetadataListProps {
  readonly className?: string;
  readonly emptyValue?: string;
  readonly items: readonly MetadataListItem[];
}

export function MetadataList({ className, emptyValue = "Not provided", items }: MetadataListProps) {
  return (
    <dl className={classNames("gv-metadata-list", className)}>
      {items.map((item) => (
        <div className="gv-metadata-list__item" key={item.id}>
          <dt>{item.label}</dt>
          <dd>
            {item.value === undefined || item.value === null ? emptyValue : item.value}
            {item.status ? <span className="gv-metadata-list__status">{item.status}</span> : null}
          </dd>
        </div>
      ))}
    </dl>
  );
}

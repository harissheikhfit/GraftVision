import { classNames } from "../internal/class-names";

import { VisuallyHidden } from "./visually-hidden";

import type { ComponentPropsWithRef } from "react";

export interface LinkProps extends ComponentPropsWithRef<"a"> {
  readonly external?: boolean;
  readonly externalLabel?: string;
}

export function Link({
  children,
  className,
  external = false,
  externalLabel = "opens in a new tab",
  rel,
  target,
  ...props
}: LinkProps) {
  const resolvedTarget = external ? (target ?? "_blank") : target;
  const resolvedRel = external ? [rel, "noopener", "noreferrer"].filter(Boolean).join(" ") : rel;

  return (
    <a
      {...props}
      className={classNames("gv-link", className)}
      rel={resolvedRel}
      target={resolvedTarget}
    >
      <span>{children}</span>
      {external ? (
        <>
          <span aria-hidden="true" className="gv-link__external-marker">
            ↗
          </span>
          <VisuallyHidden> ({externalLabel})</VisuallyHidden>
        </>
      ) : null}
    </a>
  );
}

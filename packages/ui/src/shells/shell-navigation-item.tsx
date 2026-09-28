import { classNames } from "../internal/class-names";
import { VisuallyHidden } from "../primitives/visually-hidden";

import type { ReactNode } from "react";

export interface ShellNavigationItemProps {
  readonly active?: boolean;
  readonly badge?: ReactNode;
  readonly className?: string;
  readonly external?: boolean;
  readonly externalLabel?: string;
  readonly href: string;
  readonly icon?: ReactNode;
  readonly label: string;
  readonly unavailable?: boolean;
}

export function ShellNavigationItem({
  active = false,
  badge,
  className,
  external = false,
  externalLabel = "opens in a new tab",
  href,
  icon,
  label,
  unavailable = false,
}: ShellNavigationItemProps) {
  const content = (
    <>
      {icon ? (
        <span aria-hidden="true" className="gv-shell-navigation-item__icon">
          {icon}
        </span>
      ) : null}
      <span className="gv-shell-navigation-item__label">{label}</span>
      {badge ? <span className="gv-shell-navigation-item__badge">{badge}</span> : null}
      {external ? <VisuallyHidden> ({externalLabel})</VisuallyHidden> : null}
    </>
  );

  return (
    <li className={classNames("gv-shell-navigation-item", className)}>
      {unavailable ? (
        <span aria-disabled="true" className="gv-shell-navigation-item__link">
          {content}
        </span>
      ) : (
        <a
          aria-current={active ? "page" : undefined}
          className="gv-shell-navigation-item__link"
          href={href}
          rel={external ? "noopener noreferrer" : undefined}
          target={external ? "_blank" : undefined}
        >
          {content}
        </a>
      )}
    </li>
  );
}

"use client";

import { useState } from "react";

import { classNames } from "../internal/class-names";
import { IconButton } from "../primitives/icon-button";

export interface CopyableValueProps {
  readonly className?: string;
  readonly copyLabel?: string;
  readonly copyValue?: string;
  readonly displayValue: string;
  readonly masked?: boolean;
  readonly monospace?: boolean;
}

type CopyFeedback = "error" | "idle" | "success";

export function CopyableValue({
  className,
  copyLabel = "Copy value",
  copyValue,
  displayValue,
  masked = false,
  monospace = false,
}: CopyableValueProps) {
  const [feedback, setFeedback] = useState<CopyFeedback>("idle");
  const resolvedCopyValue = copyValue ?? displayValue;

  async function copyToClipboard() {
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("Clipboard unavailable");
      }

      await navigator.clipboard.writeText(resolvedCopyValue);
      setFeedback("success");
    } catch {
      setFeedback("error");
    }
  }

  function handleCopy() {
    void copyToClipboard();
  }

  return (
    <span
      className={classNames(
        "gv-copyable-value",
        monospace && "gv-copyable-value--monospace",
        masked && "gv-copyable-value--masked",
        className,
      )}
      data-masked={masked || undefined}
    >
      <span className="gv-copyable-value__display">{displayValue}</span>
      <IconButton icon="□" label={copyLabel} onClick={handleCopy} size="small" />
      <span aria-live="polite" className="gv-copyable-value__feedback">
        {feedback === "success"
          ? "Value copied."
          : feedback === "error"
            ? "Value could not be copied."
            : null}
      </span>
    </span>
  );
}

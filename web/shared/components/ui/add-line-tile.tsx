"use client";

import * as React from "react";
import { Plus, X } from "lucide-react";
import { cn } from "@/shared/lib/utils";

/**
 * Dashed "+" tile that sits after the last line card in a grid. Clicking it
 * swaps in the picker; the picker calls `close` once a line was added.
 */
export function AddLineTile({
  label,
  disabled,
  className,
  children,
}: {
  label: string;
  disabled?: boolean;
  className?: string;
  children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const close = () => setOpen(false);

  if (!open)
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className={cn(
          "group flex min-h-48 w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-input p-4 text-sm font-medium text-muted-foreground transition-colors",
          "hover:border-primary hover:bg-primary/5 hover:text-primary",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
          "disabled:pointer-events-none disabled:opacity-50",
          className,
        )}
      >
        <span className="flex size-10 items-center justify-center rounded-full border-2 border-dashed border-current transition-transform group-hover:scale-110 motion-reduce:transition-none">
          <Plus className="size-5" aria-hidden="true" />
        </span>
        {label}
      </button>
    );

  return (
    <div
      className={cn(
        "min-h-48 space-y-3 rounded-lg border-2 border-dashed border-primary bg-primary/5 p-4",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">{label}</p>
        <button
          type="button"
          onClick={close}
          aria-label="Đóng"
          className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
      {children(close)}
    </div>
  );
}

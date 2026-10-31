"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { matchesSearch } from "@/shared/lib/search";
import { BeeLoader } from "./bee-loader";

export interface ComboboxOption {
  value: string;
  label: string;
  /** Secondary text shown at the right of the row, e.g. stock on hand. */
  hint?: string;
}

// Rendering thousands of rows makes typing laggy; users narrow by typing instead.
const MAX_RESULTS = 50;

export interface ComboboxProps {
  options: ComboboxOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  emptyText?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  /** Server-side search: called with the typed text; options are shown unfiltered. */
  onSearchChange?: (query: string) => void;
  loading?: boolean;
  /** Label for a value that is not in the current (server) page of options. */
  selectedLabel?: string;
  /** Total server matches, to hint that typing narrows the list. */
  total?: number;
  autoFocus?: boolean;
  "aria-label"?: string;
}

export function Combobox({
  options,
  value,
  onChange,
  placeholder,
  emptyText = "Không tìm thấy kết quả.",
  disabled,
  required,
  className,
  onSearchChange,
  loading,
  selectedLabel,
  total,
  autoFocus,
  "aria-label": ariaLabel,
}: ComboboxProps) {
  const listId = React.useId();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [active, setActive] = React.useState(0);
  const selectedText =
    options.find((option) => option.value === value)?.label ??
    (value ? selectedLabel : undefined);

  const matches = !open
    ? []
    : onSearchChange
      ? options
      : options.filter((option) => matchesSearch(option.label, query));
  const matchCount = Math.max(matches.length, total ?? 0);
  const visible = matches.slice(0, MAX_RESULTS);

  function openList() {
    setOpen(true);
    setQuery("");
    setActive(0);
    onSearchChange?.("");
  }

  function choose(option: ComboboxOption) {
    onChange(option.value);
    setOpen(false);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) {
      if (event.key === "ArrowDown" || event.key === "Enter") {
        event.preventDefault();
        openList();
      }
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((index) =>
        Math.min(Math.max(index + step, 0), visible.length - 1),
      );
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (visible[active]) choose(visible[active]);
    } else if (event.key === "Escape") {
      // Close the list only; stop the native <dialog> from closing too.
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
    }
  }

  return (
    <div className="relative w-full">
      <input
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-label={ariaLabel}
        aria-busy={loading || undefined}
        aria-activedescendant={
          open && visible[active] ? `${listId}-${active}` : undefined
        }
        autoComplete="off"
        autoFocus={autoFocus}
        required={required}
        disabled={disabled}
        placeholder={selectedText ?? placeholder}
        value={open ? query : (selectedText ?? "")}
        onFocus={openList}
        onClick={() => !open && openList()}
        onBlur={() => setOpen(false)}
        onChange={(event) => {
          setQuery(event.target.value);
          onSearchChange?.(event.target.value);
          setActive(0);
          setOpen(true);
        }}
        onKeyDown={handleKeyDown}
        className={cn(
          "flex h-10 w-full truncate rounded-md border border-input bg-card px-3 py-1.5 pr-8 text-sm font-normal text-foreground shadow-2xs transition-colors",
          "placeholder:text-muted-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-primary",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
      />
      <ChevronDown
        className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      {open && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-md border bg-popover py-1 text-sm font-normal shadow-lg"
        >
          {visible.map((option, index) => (
            <li
              key={option.value}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={option.value === value}
              // mousedown, not click: keep focus in the input so onBlur doesn't close first.
              onMouseDown={(event) => {
                event.preventDefault();
                choose(option);
              }}
              onMouseEnter={() => setActive(index)}
              ref={(node) => {
                if (index === active) node?.scrollIntoView({ block: "nearest" });
              }}
              className={cn(
                "flex cursor-pointer items-baseline justify-between gap-3 px-3 py-2",
                index === active && "bg-muted",
                option.value === value && "font-semibold",
              )}
            >
              <span className="min-w-0 truncate">{option.label}</span>
              {option.hint && (
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {option.hint}
                </span>
              )}
            </li>
          ))}
          {visible.length === 0 &&
            (loading ? (
              <li>
                <BeeLoader size="sm" />
              </li>
            ) : (
              <li className="px-3 py-2 text-muted-foreground">{emptyText}</li>
            ))}
          {matchCount > visible.length && (
            <li className="px-3 py-2 text-xs text-muted-foreground">
              Hiển thị {visible.length}/{matchCount} kết quả. Gõ thêm để thu
              hẹp.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

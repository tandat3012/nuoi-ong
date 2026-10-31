"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { useAuthenticatedRequest } from "@/features/auth";
import type { PaginatedResponse } from "@/shared/api/contracts";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Pagination } from "@/shared/components/ui/pagination";
import { ErrorAlert } from "@/shared/components/ui/error-alert";
import { getAssetChoices } from "../api/assets.api";
import { assetError } from "../asset.logic";
import type { AssetChoice, AssetLookupKind } from "../types/asset";
import styles from "./asset-lookup.module.css";
import { BeeLoader } from "@/shared/components/ui/bee-loader";

export function AssetLookup({
  farmId,
  kind,
  selected,
  warehouseId,
  activeOnly = false,
  disabled = false,
  onSelect,
}: {
  farmId: string;
  kind: AssetLookupKind;
  selected: AssetChoice | null;
  warehouseId?: string;
  activeOnly?: boolean;
  disabled?: boolean;
  onSelect: (choice: AssetChoice | null) => void;
}) {
  const request = useAuthenticatedRequest();
  const popupId = useId();
  const popup = useRef<HTMLElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState({ search: "", page: 1 });
  const scope = `${farmId}:${kind}:${warehouseId ?? ""}:${activeOnly}`;
  const [result, setResult] = useState<{
    scope: string;
    query: typeof query;
    response?: PaginatedResponse<AssetChoice>;
    error?: string;
  } | null>(null);
  const label =
    kind === "item"
      ? "Vật tư"
      : kind === "warehouse"
        ? "Kho"
        : kind === "member"
          ? "Người nhận"
          : "Vị trí";

  useEffect(() => {
    if (!open || disabled) return;
    let cancelled = false;
    void getAssetChoices(request, farmId, kind, {
      ...query,
      warehouseId,
      activeOnly,
    })
      .then((response) => {
        if (cancelled) return;
        const lastPage = Math.max(1, response.page.totalPages);
        if (query.page > lastPage) {
          setQuery({ ...query, page: lastPage });
          return;
        }
        setResult({ scope, query, response });
      })
      .catch((error) => {
        if (!cancelled)
          setResult({ scope, query, error: assetError(error).message });
      });
    return () => {
      cancelled = true;
    };
  }, [
    request,
    farmId,
    kind,
    query,
    scope,
    warehouseId,
    activeOnly,
    open,
    disabled,
  ]);

  const current =
    result?.scope === scope && result.query === query ? result : null;
  return (
    <div className="min-w-0">
      <span className="mb-2 block text-sm font-medium">
        {label}
        {activeOnly && (kind === "warehouse" || kind === "location")
          ? " nhận"
          : ""}
      </span>
      <div className="flex min-w-0 gap-1">
        <Button
          ref={trigger}
          type="button"
          variant="outline"
          className="h-10 min-w-0 flex-1 justify-between gap-2 font-normal"
          disabled={disabled}
          aria-label={`Chọn ${label.toLowerCase()}${activeOnly && (kind === "warehouse" || kind === "location") ? " nhận" : ""}`}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={popupId}
          aria-describedby={selected ? `${popupId}-value` : undefined}
          popoverTarget={popupId}
          onClick={() => trigger.current?.focus()}
        >
          <span id={`${popupId}-value`} className="truncate">
            {selected?.label ?? `Chọn ${label.toLowerCase()}`}
          </span>
          <ChevronDown
            className="size-4 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
        </Button>
        {selected && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-10 shrink-0"
            disabled={disabled}
            aria-label={`Bỏ chọn ${label.toLowerCase()}`}
            onClick={() => onSelect(null)}
          >
            <X className="size-4" aria-hidden="true" />
          </Button>
        )}
      </div>
      <section
        ref={popup}
        id={popupId}
        popover="auto"
        role="dialog"
        aria-label={`Danh sách ${label.toLowerCase()}`}
        className={`${styles.popover} rounded-xl border border-border bg-popover text-popover-foreground shadow-xl`}
        onBlur={(event) => {
          if (
            event.relatedTarget instanceof Node &&
            !event.currentTarget.contains(event.relatedTarget) &&
            event.relatedTarget !== trigger.current
          )
            popup.current?.hidePopover();
        }}
        onToggle={(event) => {
          const shown = event.newState === "open";
          setOpen(shown);
          if (shown) {
            setQuery({ search: "", page: 1 });
            searchInput.current?.focus();
          }
        }}
      >
        <div className="relative border-b p-3">
          <Search
            className="pointer-events-none absolute left-6 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            ref={searchInput}
            className="h-10 pl-9"
            aria-label={`Tìm ${label.toLowerCase()}`}
            placeholder="Tìm mã hoặc tên…"
            maxLength={100}
            value={query.search}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.preventDefault();
            }}
            onChange={(event) =>
              setQuery({ search: event.target.value, page: 1 })
            }
          />
        </div>
        {open &&
          (!current ? (
            <BeeLoader label="Đang tải lựa chọn…" size="sm" />
          ) : current.error ? (
            <ErrorAlert
              className="m-3"
              message={current.error}
              onRetry={() => setQuery({ ...query })}
            />
          ) : (
            <>
              {current.response?.data.length === 0 && (
                <p role="status" className="p-4 text-sm text-muted-foreground">
                  {kind === "location" &&
                  activeOnly &&
                  warehouseId &&
                  !query.search
                    ? "Kho này chưa có vị trí nhận đang hoạt động. Chọn kho khác hoặc bổ sung vị trí trước khi xác nhận."
                    : "Không có lựa chọn phù hợp."}
                </p>
              )}
              <ul className="max-h-64 space-y-1 overflow-y-auto overscroll-contain p-1.5">
                {current.response?.data.map((choice) => (
                  <li key={choice.id}>
                    <button
                      type="button"
                      aria-current={
                        selected?.id === choice.id ? "true" : undefined
                      }
                      className={`flex min-h-10 w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary ${selected?.id === choice.id ? "bg-secondary text-secondary-foreground" : ""}`}
                      onClick={() => {
                        onSelect(choice);
                        popup.current?.hidePopover();
                        trigger.current?.focus();
                      }}
                    >
                      <span className="min-w-0 break-words">
                        {choice.label}
                      </span>
                      {selected?.id === choice.id && (
                        <Check className="size-4 shrink-0" aria-hidden="true" />
                      )}
                    </button>
                  </li>
                ))}
              </ul>
              {current.response && (
                <Pagination
                  className="rounded-b-xl px-3 py-2 sm:flex-col sm:items-stretch sm:px-3 [&>p]:text-center [&>div]:justify-center"
                  pageInfo={current.response.page}
                  itemLabel="lựa chọn"
                  onPageChange={(page) => setQuery({ ...query, page })}
                />
              )}
            </>
          ))}
      </section>
    </div>
  );
}

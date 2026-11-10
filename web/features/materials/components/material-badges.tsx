"use client";

import {
  MATERIAL_KIND_LABELS,
  MATERIAL_TRACKING_MODE_LABELS,
  RECORD_STATUS_LABELS,
  type MaterialKind,
  type MaterialTrackingMode,
  type RecordStatus,
} from "../types/material";
import { CalendarClock, Hash } from "lucide-react";

export function MaterialStatusBadge({ status }: { status: RecordStatus }) {
  const isActive = status === "ACTIVE";

  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium ${
        isActive
          ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
          : "border-zinc-500/20 bg-zinc-500/10 text-zinc-600 dark:text-zinc-400"
      }`}
    >
      <span
        className={`size-1.5 shrink-0 rounded-full ${
          isActive ? "bg-emerald-500" : "bg-zinc-400"
        }`}
        aria-hidden="true"
      />
      {RECORD_STATUS_LABELS[status] ?? status}
    </span>
  );
}

const KIND_CONFIG: Record<MaterialKind, { badgeClass: string; dotClass: string }> = {
  FEED: {
    badgeClass: "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-400",
    dotClass: "bg-amber-500",
  },
  TREATMENT: {
    badgeClass: "border-purple-500/20 bg-purple-500/10 text-purple-700 dark:text-purple-400",
    dotClass: "bg-purple-500",
  },
  PACKAGING: {
    badgeClass: "border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-400",
    dotClass: "bg-blue-500",
  },
  MAINTENANCE_SUPPLY: {
    badgeClass: "border-cyan-500/20 bg-cyan-500/10 text-cyan-700 dark:text-cyan-400",
    dotClass: "bg-cyan-500",
  },
  CONSUMABLE: {
    badgeClass: "border-orange-500/20 bg-orange-500/10 text-orange-700 dark:text-orange-400",
    dotClass: "bg-orange-500",
  },
  OTHER: {
    badgeClass: "border-border bg-muted/60 text-muted-foreground",
    dotClass: "bg-zinc-400",
  },
};

export function MaterialKindBadge({ kind }: { kind?: MaterialKind | null }) {
  if (!kind) {
    return <span className="text-muted-foreground text-xs">—</span>;
  }

  const cfg = KIND_CONFIG[kind] ?? KIND_CONFIG.OTHER;
  const label = MATERIAL_KIND_LABELS[kind] ?? kind;

  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border px-2 py-0.5 text-[0.6875rem] font-medium ${cfg.badgeClass}`}
    >
      <span className={`size-1.5 shrink-0 rounded-full ${cfg.dotClass}`} aria-hidden="true" />
      {label}
    </span>
  );
}

export function MaterialTrackingBadge({ mode }: { mode: MaterialTrackingMode }) {
  const isLot = mode === "LOT";

  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-medium ${
        isLot
          ? "border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-400"
          : "border-border bg-muted/40 text-muted-foreground"
      }`}
    >
      {isLot ? (
        <CalendarClock className="size-3 shrink-0 text-sky-600 dark:text-sky-400" aria-hidden="true" />
      ) : (
        <Hash className="size-3 shrink-0 text-muted-foreground" aria-hidden="true" />
      )}
      <span>{MATERIAL_TRACKING_MODE_LABELS[mode] ?? mode}</span>
    </span>
  );
}


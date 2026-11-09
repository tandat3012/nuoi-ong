import { ASSET_STATUS_LABELS, type AssetStatus } from "../types/asset";

const STATUS_CONFIG: Record<
  AssetStatus,
  { label: string; dotClass: string; badgeClass: string }
> = {
  AVAILABLE: {
    label: "Sẵn sàng",
    dotClass: "bg-emerald-500",
    badgeClass: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
  },
  ASSIGNED: {
    label: "Đã cấp phát",
    dotClass: "bg-blue-500",
    badgeClass: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
  },
  IN_USE: {
    label: "Đang sử dụng",
    dotClass: "bg-sky-500",
    badgeClass: "bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/20",
  },
  MAINTENANCE: {
    label: "Bảo trì",
    dotClass: "bg-amber-500",
    badgeClass: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
  },
  TRANSFER_PENDING: {
    label: "Chờ chuyển kho",
    dotClass: "bg-amber-500",
    badgeClass: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
  },
  DAMAGED: {
    label: "Hư hỏng",
    dotClass: "bg-rose-500",
    badgeClass: "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20",
  },
  LOST: {
    label: "Thất lạc",
    dotClass: "bg-rose-500",
    badgeClass: "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20",
  },
  RETIRED: {
    label: "Thanh lý",
    dotClass: "bg-zinc-400",
    badgeClass: "bg-muted text-muted-foreground border-border",
  },
};

export function AssetStatusBadge({ status }: { status: AssetStatus }) {
  const cfg = STATUS_CONFIG[status] ?? {
    label: ASSET_STATUS_LABELS[status] ?? status,
    dotClass: "bg-zinc-400",
    badgeClass: "bg-muted text-muted-foreground border-border",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium ${cfg.badgeClass}`}
    >
      <span className={`size-1.5 shrink-0 rounded-full ${cfg.dotClass}`} aria-hidden="true" />
      {cfg.label}
    </span>
  );
}

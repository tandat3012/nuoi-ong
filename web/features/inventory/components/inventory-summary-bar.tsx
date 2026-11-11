'use client';

import { Package, Layers, Wrench, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { InventorySummary } from '../types/inventory';

interface InventorySummaryBarProps {
  totalItems?: number;
  summary?: InventorySummary;
  isLoading?: boolean;
}

export function InventorySummaryBar({ totalItems, summary, isLoading }: InventorySummaryBarProps) {
  if (isLoading || totalItems === undefined || totalItems === 0) return null;

  const hasExpiryIssues = Boolean(
    summary &&
      (summary.expiredLots > 0 ||
        summary.expiringLots > 0 ||
        summary.lotRowsWithoutLot > 0 ||
        summary.lotsWithoutExpiry > 0),
  );
  const hasExpiryData = Boolean(summary && summary.lotBalanceRows > 0);
  const expiryToneClass = hasExpiryIssues
    ? 'text-amber-700 dark:text-amber-300'
    : hasExpiryData
      ? 'text-emerald-600 dark:text-emerald-400'
      : 'text-muted-foreground';
  const expiryIconClass = hasExpiryIssues
    ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
    : hasExpiryData
      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
      : 'bg-muted/60 text-muted-foreground';
  const expiryParts = summary
    ? [
        summary.expiredLots > 0 ? `${summary.expiredLots} lô hết hạn` : null,
        summary.expiringLots > 0 ? `${summary.expiringLots} lô cận HSD` : null,
        summary.lotRowsWithoutLot > 0
          ? `${summary.lotRowsWithoutLot} dòng thiếu hồ sơ lô`
          : null,
        summary.lotsWithoutExpiry > 0
          ? `${summary.lotsWithoutExpiry} lô thiếu HSD`
          : null,
        summary.healthyLots > 0 ? `${summary.healthyLots} lô còn hạn` : null,
      ].filter((part): part is string => Boolean(part))
    : [];
  const expiryMessage = summary
    ? expiryParts.length
      ? expiryParts.join(' · ')
      : summary.lotBalanceRows === 0
        ? 'Chưa có dòng tồn theo lô'
        : 'Không có lô cận hoặc hết hạn'
    : '—';

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {/* Total inventory lines */}
      <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-2xs">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
          <Package className="size-4.5" />
        </span>
        <div className="min-w-0">
          <p className="text-[0.7rem] font-medium text-muted-foreground uppercase tracking-wider">
            Dòng tồn kho
          </p>
          <p className="text-lg font-bold tabular-nums text-foreground">
            {totalItems ?? '—'}
          </p>
        </div>
      </div>

      {/* Lot-tracked items */}
      <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-2xs">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
          <Layers className="size-4.5" />
        </span>
        <div className="min-w-0">
          <p className="text-[0.7rem] font-medium text-muted-foreground uppercase tracking-wider">
            Dòng tồn theo lô
          </p>
          <p className="text-lg font-bold tabular-nums text-foreground">
            {summary?.lotBalanceRows ?? '—'}
          </p>
        </div>
      </div>

      {/* Asset-tracked items */}
      <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-2xs">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
          <Wrench className="size-4.5" />
        </span>
        <div className="min-w-0">
          <p className="text-[0.7rem] font-medium text-muted-foreground uppercase tracking-wider">
            Dòng tồn tài sản
          </p>
          <p className="text-lg font-bold tabular-nums text-foreground">
            {summary?.assetBalanceRows ?? '—'}
          </p>
        </div>
      </div>

      {/* Expiry alerts */}
      <div className={`flex items-center gap-3 rounded-xl border p-3 shadow-2xs ${
        hasExpiryIssues
          ? 'border-amber-500/30 bg-amber-500/5 text-amber-800 dark:text-amber-300'
          : 'border-border bg-card'
      }`}>
        <span className={`grid size-9 shrink-0 place-items-center rounded-lg ${expiryIconClass}`}>
          {hasExpiryIssues ? (
            <AlertTriangle className="size-4.5" />
          ) : (
            <CheckCircle2 className="size-4.5" />
          )}
        </span>
        <div className="min-w-0">
          <p className="text-[0.7rem] font-medium text-muted-foreground uppercase tracking-wider">
            Tình trạng HSD
          </p>
          <p className="text-xs font-semibold leading-4">
            <span className={expiryToneClass}>{expiryMessage}</span>
          </p>
        </div>
      </div>
    </div>
  );
}


'use client';

import * as React from 'react';
import { Package, Layers, Wrench, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { InventoryBalance } from '../types/inventory';
import { getExpiryStatus } from '../inventory.logic';

interface InventorySummaryBarProps {
  balances: InventoryBalance[];
  totalItems?: number;
  isLoading?: boolean;
}

export function InventorySummaryBar({ balances, totalItems, isLoading }: InventorySummaryBarProps) {
  if (isLoading || balances.length === 0) return null;

  const lotCount = balances.filter((b) => b.item.trackingMode === 'LOT').length;
  const assetCount = balances.filter((b) => b.item.trackingMode === 'ASSET').length;

  let expiredCount = 0;
  let expiringSoonCount = 0;

  for (const b of balances) {
    if (b.lot?.expiryDate) {
      const { status } = getExpiryStatus(b.lot.expiryDate);
      if (status === 'EXPIRED') expiredCount++;
      else if (status === 'WARNING' || status === 'CRITICAL') expiringSoonCount++;
    }
  }

  const hasAlerts = expiredCount > 0 || expiringSoonCount > 0;

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
            {totalItems ?? balances.length}
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
            Theo dõi theo lô
          </p>
          <p className="text-lg font-bold tabular-nums text-foreground">
            {lotCount}
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
            Theo dõi tài sản
          </p>
          <p className="text-lg font-bold tabular-nums text-foreground">
            {assetCount}
          </p>
        </div>
      </div>

      {/* Expiry alerts */}
      <div className={`flex items-center gap-3 rounded-xl border p-3 shadow-2xs ${
        hasAlerts
          ? 'border-amber-500/30 bg-amber-500/5 text-amber-800 dark:text-amber-300'
          : 'border-border bg-card'
      }`}>
        <span className={`grid size-9 shrink-0 place-items-center rounded-lg ${
          hasAlerts
            ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
            : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
        }`}>
          {hasAlerts ? <AlertTriangle className="size-4.5" /> : <CheckCircle2 className="size-4.5" />}
        </span>
        <div className="min-w-0">
          <p className="text-[0.7rem] font-medium text-muted-foreground uppercase tracking-wider">
            Tình trạng HSD
          </p>
          <p className="text-sm font-semibold truncate">
            {expiredCount > 0 ? (
              <span className="text-destructive font-bold">{expiredCount} lô hết hạn</span>
            ) : expiringSoonCount > 0 ? (
              <span className="text-amber-600 dark:text-amber-400 font-bold">{expiringSoonCount} lô cận date</span>
            ) : (
              <span className="text-emerald-600 dark:text-emerald-400">100% an toàn</span>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}


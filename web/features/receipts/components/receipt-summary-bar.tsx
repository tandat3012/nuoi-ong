'use client';

import * as React from 'react';
import { ArrowDownToLine, FileEdit, CheckCircle2, Building2 } from 'lucide-react';
import type { Receipt } from '../types/receipt';

interface ReceiptSummaryBarProps {
  receipts: Receipt[];
  totalItems?: number;
  isLoading?: boolean;
}

export function ReceiptSummaryBar({
  receipts,
  totalItems,
  isLoading,
}: ReceiptSummaryBarProps) {
  if (isLoading || receipts.length === 0) return null;

  const draftCount = receipts.filter((r) => r.status === 'DRAFT').length;
  const confirmedCount = receipts.filter((r) => r.status === 'CONFIRMED').length;

  const suppliers = new Set(
    receipts.map((r) => r.supplierName).filter(Boolean)
  );

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {/* Total Receipts */}
      <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-2xs">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
          <ArrowDownToLine className="size-4.5" />
        </span>
        <div className="min-w-0">
          <p className="text-[0.7rem] font-medium text-muted-foreground uppercase tracking-wider">
            Tổng phiếu nhập
          </p>
          <p className="text-lg font-bold tabular-nums text-foreground">
            {totalItems ?? receipts.length}
          </p>
        </div>
      </div>

      {/* Draft Receipts */}
      <div className={`flex items-center gap-3 rounded-xl border p-3 shadow-2xs ${
        draftCount > 0
          ? 'border-amber-500/30 bg-amber-500/5'
          : 'border-border bg-card'
      }`}>
        <span className={`grid size-9 shrink-0 place-items-center rounded-lg ${
          draftCount > 0
            ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
            : 'bg-muted text-muted-foreground'
        }`}>
          <FileEdit className="size-4.5" />
        </span>
        <div className="min-w-0">
          <p className="text-[0.7rem] font-medium text-muted-foreground uppercase tracking-wider">
            Phiếu nháp chờ duyệt
          </p>
          <p className="text-lg font-bold tabular-nums text-foreground">
            {draftCount > 0 ? (
              <span className="text-amber-700 dark:text-amber-400">{draftCount}</span>
            ) : (
              '0'
            )}
          </p>
        </div>
      </div>

      {/* Confirmed Receipts */}
      <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-2xs">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="size-4.5" />
        </span>
        <div className="min-w-0">
          <p className="text-[0.7rem] font-medium text-muted-foreground uppercase tracking-wider">
            Đã nhập kho
          </p>
          <p className="text-lg font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
            {confirmedCount}
          </p>
        </div>
      </div>

      {/* Unique Suppliers */}
      <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-2xs">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
          <Building2 className="size-4.5" />
        </span>
        <div className="min-w-0">
          <p className="text-[0.7rem] font-medium text-muted-foreground uppercase tracking-wider">
            Nhà cung cấp
          </p>
          <p className="text-lg font-bold tabular-nums text-foreground">
            {suppliers.size}
          </p>
        </div>
      </div>
    </div>
  );
}


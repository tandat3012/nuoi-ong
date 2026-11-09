'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowRightLeft,
  FileSpreadsheet,
  Layers,
  Wrench,
  User,
  Clock,
} from 'lucide-react';
import type { InventoryTransaction } from '../types/inventory';
import {
  formatInventoryDateTime,
  formatInventoryExpiry,
  formatInventoryQuantity,
  inventorySourceLabel,
  inventoryTransactionLabel,
  inventoryUnitLabel,
} from '../inventory.logic';
import { Badge } from '@/shared/components/ui/badge';

function formatLedgerDate(dateString: string) {
  try {
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return { date: dateString, time: '' };

    const dateFormatted = new Intl.DateTimeFormat('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(date);

    const timeFormatted = new Intl.DateTimeFormat('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);

    return { date: dateFormatted, time: timeFormatted };
  } catch {
    return { date: dateString, time: '' };
  }
}

export function InventoryLedgerTable({
  rows,
}: {
  rows: InventoryTransaction[];
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-2xs">
      <table className="w-full min-w-[1100px] text-left text-sm">
        <thead className="border-b border-border bg-muted/60 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-4 py-3.5">Thời gian</th>
            <th className="px-4 py-3.5">Vật tư</th>
            <th className="px-4 py-3.5">Kho lưu trữ</th>
            <th className="px-4 py-3.5">Lô / Tài sản</th>
            <th className="px-4 py-3.5">Loại giao dịch</th>
            <th className="px-4 py-3.5 text-right">Biến động</th>
            <th className="px-4 py-3.5">Chứng từ nguồn</th>
            <th className="px-4 py-3.5">Người thực hiện</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/50">
          {rows.map((row) => {
            const { date, time } = formatLedgerDate(row.createdAt);
            const isPositive = !row.quantityChange.startsWith('-') && row.quantityChange !== '0';
            const formattedQty = formatInventoryQuantity(row.quantityChange.replace(/^[+-]/, ''));
            const unit = inventoryUnitLabel(row.item.unit.symbol, row.item.unit.name);
            const sourceCode = row.source.code;
            const sourceLabel = inventorySourceLabel(row.source.type, sourceCode);

            // Determine transaction badge style
            const isIncrease = [
              'RECEIPT',
              'TRANSFER_IN',
              'ADJUSTMENT_IN',
              'RETURN_IN',
            ].includes(row.transactionType);

            return (
              <tr key={row.id} className="group hover:bg-muted/40 transition-colors">
                {/* Date & Time */}
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="flex items-center gap-1.5 font-medium text-xs text-foreground">
                    <Clock className="size-3 text-muted-foreground shrink-0" />
                    <span>{time}</span>
                  </div>
                  <div className="text-[0.7rem] text-muted-foreground pl-4.5">{date}</div>
                </td>

                {/* Item Details */}
                <td className="px-4 py-3">
                  <span className="font-mono text-xs font-medium px-2 py-0.5 rounded-md bg-muted text-foreground border border-border/60">
                    {row.item.code}
                  </span>
                  <div className="mt-1 font-semibold text-foreground text-xs group-hover:text-primary transition-colors">
                    {row.item.name}
                  </div>
                </td>

                {/* Warehouse */}
                <td className="px-4 py-3">
                  <div className="font-medium text-xs text-foreground">{row.warehouse.name}</div>
                  <div className="text-[0.7rem] text-muted-foreground font-mono">{row.warehouse.code}</div>
                </td>

                {/* Lot / Asset */}
                <td className="px-4 py-3">
                  {row.lot ? (
                    <div className="space-y-0.5">
                      <span className="inline-flex items-center gap-1 text-xs font-mono font-semibold text-purple-700 dark:text-purple-300">
                        <Layers className="size-3" />
                        {row.lot.lotCode}
                      </span>
                      {row.lot.expiryDate && (
                        <div className="text-[0.7rem] text-muted-foreground">
                          HSD: {formatInventoryExpiry(row.lot.expiryDate)}
                        </div>
                      )}
                    </div>
                  ) : row.asset ? (
                    <div className="space-y-0.5">
                      <span className="inline-flex items-center gap-1 text-xs font-mono font-semibold text-blue-700 dark:text-blue-300">
                        <Wrench className="size-3" />
                        {row.asset.assetCode}
                      </span>
                      {row.asset.serialNumber && (
                        <div className="text-[0.7rem] text-muted-foreground">
                          S/N: {row.asset.serialNumber}
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground/60">—</span>
                  )}
                </td>

                {/* Transaction Type Badge */}
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium border ${
                      isIncrease
                        ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200/50'
                        : 'bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-200/50'
                    }`}
                  >
                    {isIncrease ? (
                      <ArrowDownToLine className="size-3 shrink-0" />
                    ) : (
                      <ArrowUpFromLine className="size-3 shrink-0" />
                    )}
                    <span>{inventoryTransactionLabel(row.transactionType)}</span>
                  </span>
                  {row.reason && (
                    <p
                      className="mt-1 text-[0.7rem] text-muted-foreground line-clamp-2 max-w-[200px]"
                      title={row.reason}
                    >
                      {row.reason}
                    </p>
                  )}
                </td>

                {/* Movement Quantity with Color Coding */}
                <td className="px-4 py-3 text-right">
                  <div className="flex items-baseline justify-end gap-1 font-mono">
                    <span
                      className={`text-sm font-bold tabular-nums ${
                        isPositive
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : row.quantityChange.startsWith('-')
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-foreground'
                      }`}
                    >
                      {isPositive ? `+${formattedQty}` : `-${formattedQty}`}
                    </span>
                    <span className="text-xs font-medium text-muted-foreground">{unit}</span>
                  </div>
                </td>

                {/* Source Document */}
                <td className="px-4 py-3">
                  {sourceCode ? (
                    <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-md bg-secondary text-secondary-foreground border border-border">
                      {sourceCode}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <FileSpreadsheet className="size-3 text-muted-foreground/70" />
                      {sourceLabel}
                    </span>
                  )}
                </td>

                {/* Performer */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-secondary text-primary text-[0.65rem] font-semibold">
                      <User className="size-3" />
                    </span>
                    <span className="truncate max-w-[120px]">{row.performer?.displayName || 'Nhân viên'}</span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

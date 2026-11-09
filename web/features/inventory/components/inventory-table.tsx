'use client';

import * as React from 'react';
import Link from 'next/link';
import { Layers, Wrench, Boxes, History, QrCode } from 'lucide-react';
import type { InventoryBalance } from '../types/inventory';
import {
  formatInventoryQuantity,
  inventoryUnitLabel,
  getExpiryStatus,
} from '../inventory.logic';
import { Badge } from '@/shared/components/ui/badge';

interface InventoryTableProps {
  rows: InventoryBalance[];
  onOpenLedgerItem?: (itemId: string) => void;
}

export function InventoryTable({ rows, onOpenLedgerItem }: InventoryTableProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-2xs">
      <table className="w-full min-w-[950px] text-left text-sm">
        <thead className="border-b border-border bg-muted/60 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-4 py-3.5">Mã vật tư</th>
            <th className="px-4 py-3.5">Tên vật tư</th>
            <th className="px-4 py-3.5">Kho lưu trữ</th>
            <th className="px-4 py-3.5">Theo dõi</th>
            <th className="px-4 py-3.5">Lô hàng</th>
            <th className="px-4 py-3.5">Hạn sử dụng</th>
            <th className="px-4 py-3.5 text-right">Tồn hiện tại</th>
            <th className="px-4 py-3.5 text-center w-20">Thao tác</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/50">
          {rows.map((row) => {
            const expiry = getExpiryStatus(row.lot?.expiryDate ?? null);

            return (
              <tr key={row.id} className="group hover:bg-muted/40 transition-colors">
                {/* Item Code */}
                <td className="px-4 py-3">
                  <span className="font-mono text-xs font-medium px-2 py-0.5 rounded-md bg-muted text-foreground border border-border/60">
                    {row.item.code}
                  </span>
                </td>

                {/* Item Name */}
                <td className="px-4 py-3">
                  <span className="font-semibold text-foreground group-hover:text-primary transition-colors">
                    {row.item.name}
                  </span>
                </td>

                {/* Warehouse */}
                <td className="px-4 py-3">
                  <div className="font-medium text-foreground">{row.warehouse.name}</div>
                  <div className="text-xs text-muted-foreground">{row.warehouse.code}</div>
                </td>

                {/* Tracking Mode Badge */}
                <td className="px-4 py-3">
                  {row.item.trackingMode === 'LOT' ? (
                    <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-200/50">
                      <Layers className="size-3" />
                      Theo lô
                    </span>
                  ) : row.item.trackingMode === 'ASSET' ? (
                    <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-200/50">
                      <Wrench className="size-3" />
                      Theo tài sản
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium bg-muted text-muted-foreground border border-border">
                      <Boxes className="size-3" />
                      Số lượng
                    </span>
                  )}
                </td>

                {/* Lot Details */}
                <td className="px-4 py-3">
                  {row.lot?.lotCode ? (
                    <div>
                      <span className="font-semibold text-foreground text-xs font-mono">
                        {row.lot.lotCode}
                      </span>
                      {row.lot.supplierLotNumber && (
                        <div className="text-[0.7rem] text-muted-foreground">
                          Số lô NCC: {row.lot.supplierLotNumber}
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground/60">—</span>
                  )}
                </td>

                {/* Expiry Date with Semantic Alert Badges */}
                <td className="px-4 py-3">
                  {expiry.status === 'EXPIRED' ? (
                    <Badge variant="destructive" className="font-semibold text-xs">
                      {expiry.formatted} (Hết hạn)
                    </Badge>
                  ) : expiry.status === 'CRITICAL' ? (
                    <Badge variant="warning" className="bg-red-500/15 text-red-700 dark:text-red-400 border-red-300 font-semibold text-xs">
                      {expiry.formatted} (Còn {expiry.daysRemaining} ngày)
                    </Badge>
                  ) : expiry.status === 'WARNING' ? (
                    <Badge variant="warning" className="font-medium text-xs">
                      {expiry.formatted} (Còn {expiry.daysRemaining} ngày)
                    </Badge>
                  ) : expiry.status === 'HEALTHY' ? (
                    <span className="tabular-nums text-foreground text-xs">{expiry.formatted}</span>
                  ) : (
                    <span className="text-muted-foreground/60">—</span>
                  )}
                </td>

                {/* Quantity and Unit */}
                <td className="px-4 py-3 text-right">
                  <div className="flex items-baseline justify-end gap-1.5">
                    <span className="text-base font-bold tabular-nums text-foreground">
                      {formatInventoryQuantity(row.quantityOnHand)}
                    </span>
                    <span className="text-xs font-medium text-muted-foreground">
                      {inventoryUnitLabel(row.item.unit.symbol, row.item.unit.name)}
                    </span>
                  </div>
                </td>

                {/* Action Shortcuts */}
                <td className="px-4 py-3 text-center">
                  <div className="flex items-center justify-center gap-1">
                    {onOpenLedgerItem ? (
                      <button
                        type="button"
                        onClick={() => onOpenLedgerItem(row.item.id)}
                        className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-primary transition-colors cursor-pointer"
                        title="Xem lịch sử biến động của vật tư này"
                      >
                        <History className="size-4" />
                      </button>
                    ) : (
                      <Link
                        href={`/inventory?view=ledger&itemId=${row.item.id}`}
                        className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-primary transition-colors"
                        title="Xem lịch sử biến động của vật tư này"
                      >
                        <History className="size-4" />
                      </Link>
                    )}
                    <Link
                      href={`/scan/item/${row.item.id}`}
                      className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-primary transition-colors"
                      title="Xem thông tin và mã QR"
                    >
                      <QrCode className="size-4" />
                    </Link>
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

"use client";

import type { InventoryBalance } from "../types/inventory";
import {
  formatInventoryExpiry,
  formatInventoryQuantity,
  inventoryUnitLabel,
} from "../inventory.logic";

const trackingLabels = {
  QUANTITY: "Số lượng",
  LOT: "Theo lô",
  ASSET: "Theo tài sản",
} as const;

export function InventoryTable({ rows }: { rows: InventoryBalance[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <table className="w-full min-w-[900px] text-left text-sm">
        <thead className="border-b bg-muted/50 text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-medium">Mã vật tư</th>
            <th className="px-4 py-3 font-medium">Vật tư</th>
            <th className="px-4 py-3 font-medium">Kho</th>
            <th className="px-4 py-3 font-medium">Theo dõi</th>
            <th className="px-4 py-3 font-medium">Lô</th>
            <th className="px-4 py-3 font-medium">Hạn sử dụng</th>
            <th className="px-4 py-3 text-right font-medium">Tồn hiện tại</th>
            <th className="px-4 py-3 font-medium">Đơn vị</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row) => (
            <tr key={row.id} className="hover:bg-muted/30">
              <td className="px-4 py-3 font-mono text-xs">{row.item.code}</td>
              <td className="px-4 py-3 font-medium">{row.item.name}</td>
              <td className="px-4 py-3">
                <div className="font-medium">{row.warehouse.name}</div>
                <div className="text-xs text-muted-foreground">
                  {row.warehouse.code}
                </div>
              </td>
              <td className="px-4 py-3">
                {trackingLabels[row.item.trackingMode]}
              </td>
              <td className="px-4 py-3">{row.lot?.lotNumber ?? "—"}</td>
              <td className="px-4 py-3">
                {formatInventoryExpiry(row.lot?.expiryDate ?? null)}
              </td>
              <td className="px-4 py-3 text-right font-medium tabular-nums">
                {formatInventoryQuantity(row.quantityOnHand)}
              </td>
              <td className="px-4 py-3">
                {inventoryUnitLabel(row.item.unit.symbol, row.item.unit.name)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

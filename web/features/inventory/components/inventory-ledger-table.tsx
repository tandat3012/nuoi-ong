"use client";

import type { InventoryTransaction } from "../types/inventory";
import {
  formatInventoryDateTime,
  formatInventoryExpiry,
  formatInventoryMovement,
  inventorySourceLabel,
  inventoryTransactionLabel,
  inventoryUnitLabel,
} from "../inventory.logic";

export function InventoryLedgerTable({
  rows,
}: {
  rows: InventoryTransaction[];
}) {
  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <table className="w-full min-w-[1120px] text-left text-sm">
        <thead className="border-b bg-muted/50 text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-medium">Thời gian</th>
            <th className="px-4 py-3 font-medium">Vật tư</th>
            <th className="px-4 py-3 font-medium">Kho</th>
            <th className="px-4 py-3 font-medium">Lô / Tài sản</th>
            <th className="px-4 py-3 font-medium">Loại giao dịch</th>
            <th className="px-4 py-3 text-right font-medium">Biến động</th>
            <th className="px-4 py-3 font-medium">Nguồn</th>
            <th className="px-4 py-3 font-medium">Người thực hiện</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row) => (
            <tr key={row.id} className="align-top">
              <td className="px-4 py-3 whitespace-nowrap">
                {formatInventoryDateTime(row.createdAt)}
              </td>
              <td className="px-4 py-3">
                <div className="font-medium">{row.item.code}</div>
                <div className="text-muted-foreground">{row.item.name}</div>
              </td>
              <td className="px-4 py-3">
                <div className="font-medium">{row.warehouse.code}</div>
                <div className="text-muted-foreground">
                  {row.warehouse.name}
                </div>
              </td>
              <td className="px-4 py-3">
                {row.lot ? (
                  <>
                    <div>{row.lot.lotNumber}</div>
                    <div className="text-muted-foreground">
                      HSD {formatInventoryExpiry(row.lot.expiryDate)}
                    </div>
                  </>
                ) : row.asset ? (
                  <>
                    <div>{row.asset.assetCode}</div>
                    {row.asset.serialNumber && (
                      <div className="text-muted-foreground">
                        S/N {row.asset.serialNumber}
                      </div>
                    )}
                  </>
                ) : (
                  "—"
                )}
              </td>
              <td className="px-4 py-3">
                {inventoryTransactionLabel(row.transactionType)}
                {row.reason && (
                  <div
                    className="mt-1 max-w-xs whitespace-pre-wrap break-words text-xs text-muted-foreground"
                    style={{ overflowWrap: "anywhere" }}
                  >
                    {row.reason}
                  </div>
                )}
              </td>
              <td className="px-4 py-3 text-right tabular-nums">
                {formatInventoryMovement(row.quantityChange)}{" "}
                {inventoryUnitLabel(row.item.unit.symbol, row.item.unit.name)}
              </td>
              <td className="px-4 py-3">
                {inventorySourceLabel(row.source.type, row.source.code)}
              </td>
              <td className="px-4 py-3">{row.performer?.displayName ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

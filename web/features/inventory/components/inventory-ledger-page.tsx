"use client";

import type { Warehouse } from "@/features/warehouses/types/warehouse";
import { useInventoryLedger } from "../hooks/use-inventory-ledger";
import { useInventoryReferences } from "../hooks/use-inventory-references";
import type {
  InventoryLedgerFilters,
  InventoryTransactionType,
} from "../types/inventory";
import { InventoryLedgerTable } from "./inventory-ledger-table";

const TRANSACTION_TYPES: {
  value: InventoryTransactionType;
  label: string;
}[] = [
  { value: "RECEIPT", label: "Nhập kho" },
  { value: "ISSUE", label: "Xuất kho" },
  { value: "MAINTENANCE_ISSUE", label: "Xuất bảo trì" },
  { value: "TRANSFER_OUT", label: "Chuyển kho đi" },
  { value: "TRANSFER_IN", label: "Chuyển kho đến" },
  { value: "ADJUSTMENT_IN", label: "Điều chỉnh tăng" },
  { value: "ADJUSTMENT_OUT", label: "Điều chỉnh giảm" },
  { value: "RETURN_IN", label: "Trả tài sản" },
  { value: "ASSIGNMENT_OUT", label: "Bàn giao tài sản" },
];

export function InventoryLedgerPage({
  farmId,
  initialFilters,
  refreshToken,
}: {
  farmId: string;
  initialFilters: Pick<InventoryLedgerFilters, "warehouseId" | "itemId">;
  refreshToken: number;
}) {
  const ledger = useInventoryLedger(farmId, initialFilters, refreshToken);
  const references = useInventoryReferences(farmId);
  const { filters, pageInfo } = ledger;
  const itemKnown = references.items.some(
    ({ item }) => item.id === filters.itemId,
  );
  const warehouseKnown = references.warehouses.some(
    ({ id }) => id === filters.warehouseId,
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Lịch sử biến động kho</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Theo dõi các lần nhập, xuất, chuyển và điều chỉnh tồn kho.
          </p>
        </div>
        <button
          type="button"
          onClick={ledger.reload}
          disabled={ledger.isLoading}
          className="rounded-lg border px-4 py-2 text-sm hover:bg-muted disabled:opacity-50"
        >
          Tải lại
        </button>
      </header>

      <section
        aria-label="Lọc lịch sử biến động"
        className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-3"
      >
        <label className="grid gap-1.5 text-sm font-medium">
          Kho
          <select
            value={filters.warehouseId ?? ""}
            onChange={(event) =>
              ledger.changeWarehouse(event.target.value || undefined)
            }
            disabled={references.isLoading || Boolean(references.error)}
            className="rounded-lg border bg-background p-2 font-normal"
          >
            <option value="">Tất cả kho</option>
            {filters.warehouseId && !warehouseKnown && (
              <option value={filters.warehouseId}>
                Kho đã chọn không có trong trang trại này
              </option>
            )}
            {references.warehouses.map((warehouse) => (
              <WarehouseOption key={warehouse.id} warehouse={warehouse} />
            ))}
          </select>
        </label>

        <label className="grid gap-1.5 text-sm font-medium">
          Vật tư
          <select
            value={filters.itemId ?? ""}
            onChange={(event) =>
              ledger.changeItem(event.target.value || undefined)
            }
            disabled={references.isLoading || Boolean(references.error)}
            className="rounded-lg border bg-background p-2 font-normal"
          >
            <option value="">Tất cả vật tư</option>
            {filters.itemId && !itemKnown && (
              <option value={filters.itemId}>
                Vật tư đã chọn không có trong trang trại này
              </option>
            )}
            {references.items.map(({ item }) => (
              <option key={item.id} value={item.id}>
                {item.code} · {item.name}
                {item.status === "INACTIVE" ? " (Ngừng hoạt động)" : ""}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1.5 text-sm font-medium">
          Loại biến động
          <select
            value={filters.transactionType ?? ""}
            onChange={(event) =>
              ledger.changeType(
                (event.target.value || undefined) as
                  InventoryTransactionType | undefined,
              )
            }
            className="rounded-lg border bg-background p-2 font-normal"
          >
            <option value="">Tất cả loại biến động</option>
            {TRANSACTION_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </label>
      </section>

      {references.error && (
        <div
          role="alert"
          className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800"
        >
          <p>{references.error}</p>
          <button
            type="button"
            onClick={references.reload}
            className="mt-2 underline"
          >
            Thử tải danh sách vật tư và kho lại
          </button>
        </div>
      )}

      {ledger.isLoading ? (
        <p role="status">Đang tải lịch sử biến động...</p>
      ) : ledger.error ? (
        <div
          role="alert"
          className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800"
        >
          <p>{ledger.error}</p>
          <button
            type="button"
            onClick={ledger.reload}
            className="mt-2 underline"
          >
            Thử lại
          </button>
        </div>
      ) : ledger.transactions.length === 0 ? (
        <p role="status">
          {filters.itemId || filters.warehouseId || filters.transactionType
            ? "Không có biến động phù hợp với bộ lọc."
            : "Chưa có lịch sử biến động trong trang trại."}
        </p>
      ) : (
        <InventoryLedgerTable rows={ledger.transactions} />
      )}

      {pageInfo && (
        <nav
          aria-label="Phân trang lịch sử biến động"
          className="flex flex-wrap items-center justify-between gap-3"
        >
          <p className="text-sm text-muted-foreground">
            {pageInfo.totalItems === 0
              ? "0 dòng biến động"
              : `Trang ${pageInfo.number} / ${pageInfo.totalPages} (${pageInfo.totalItems} dòng biến động)`}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pageInfo.number <= 1}
              onClick={() => ledger.changePage(pageInfo.number - 1)}
              className="rounded-lg border px-4 py-2 text-sm hover:bg-muted disabled:opacity-50"
            >
              Trang trước
            </button>
            <button
              type="button"
              disabled={
                pageInfo.totalPages === 0 ||
                pageInfo.number >= pageInfo.totalPages
              }
              onClick={() => ledger.changePage(pageInfo.number + 1)}
              className="rounded-lg border px-4 py-2 text-sm hover:bg-muted disabled:opacity-50"
            >
              Trang sau
            </button>
          </div>
        </nav>
      )}
    </div>
  );
}

function WarehouseOption({ warehouse }: { warehouse: Warehouse }) {
  return (
    <option value={warehouse.id}>
      {warehouse.code} · {warehouse.name}
      {warehouse.status === "INACTIVE" ? " (Ngừng hoạt động)" : ""}
    </option>
  );
}

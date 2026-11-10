"use client";

import { useState, useMemo } from "react";
import type { Warehouse } from "@/features/warehouses/types/warehouse";
import { useInventoryLedger } from "../hooks/use-inventory-ledger";
import { useInventoryReferences } from "../hooks/use-inventory-references";
import type {
  InventoryLedgerFilters,
  InventoryTransactionType,
} from "../types/inventory";
import { InventoryLedgerTable } from "./inventory-ledger-table";
import { PageHeader } from "@/shared/components/ui/page-header";
import { Button } from "@/shared/components/ui/button";
import { Select } from "@/shared/components/ui/select";
import { DateRangeFilter } from "@/shared/components/ui/date-range-filter";
import { BeeLoader } from "@/shared/components/ui/bee-loader";
import { Search, RotateCcw, RefreshCw, X } from "lucide-react";

const TRANSACTION_TYPES: {
  value: InventoryTransactionType;
  label: string;
}[] = [
  { value: "RECEIPT", label: "Nhập kho (+)" },
  { value: "ISSUE", label: "Xuất kho (-)" },
  { value: "MAINTENANCE_ISSUE", label: "Xuất bảo trì (-)" },
  { value: "TRANSFER_OUT", label: "Chuyển kho đi (-)" },
  { value: "TRANSFER_IN", label: "Chuyển kho đến (+)" },
  { value: "ADJUSTMENT_IN", label: "Điều chỉnh tăng (+)" },
  { value: "ADJUSTMENT_OUT", label: "Điều chỉnh giảm (-)" },
  { value: "RETURN_IN", label: "Trả tài sản (+)" },
  { value: "ASSIGNMENT_OUT", label: "Bàn giao tài sản (-)" },
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
  const [searchQuery, setSearchQuery] = useState("");

  const itemKnown = references.items.some(
    ({ item }) => item.id === filters.itemId,
  );
  const warehouseKnown = references.warehouses.some(
    ({ id }) => id === filters.warehouseId,
  );

  const hasActiveFilters = Boolean(
    filters.warehouseId ||
    filters.itemId ||
    filters.transactionType ||
    filters.dateFrom ||
    filters.dateTo ||
    searchQuery.trim()
  );

  const resetAllFilters = () => {
    ledger.changeWarehouse(undefined);
    ledger.changeItem(undefined);
    ledger.changeType(undefined);
    ledger.changeDateRange({ dateFrom: "", dateTo: "" });
    setSearchQuery("");
  };

  const displayedTransactions = useMemo(() => {
    if (!searchQuery.trim()) return ledger.transactions;
    const query = searchQuery.trim().toLowerCase();
    return ledger.transactions.filter(
      (t) =>
        t.item.name.toLowerCase().includes(query) ||
        t.item.code.toLowerCase().includes(query) ||
        t.warehouse.name.toLowerCase().includes(query) ||
        (t.lot?.lotCode && t.lot.lotCode.toLowerCase().includes(query)) ||
        (t.asset?.assetCode && t.asset.assetCode.toLowerCase().includes(query)) ||
        (t.source.code && t.source.code.toLowerCase().includes(query)) ||
        (t.performer?.displayName && t.performer.displayName.toLowerCase().includes(query))
    );
  }, [ledger.transactions, searchQuery]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Lịch sử biến động kho"
        description="Theo dõi các lần nhập, xuất, chuyển và điều chỉnh tồn kho theo thời gian thực."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={ledger.reload}
            disabled={ledger.isLoading}
            className="h-9 gap-1.5 text-xs font-medium"
          >
            <RefreshCw className={`size-3.5 ${ledger.isLoading ? "animate-spin" : ""}`} />
            <span>Tải lại</span>
          </Button>
        }
      />

      {/* Filter Section */}
      <section
        aria-label="Lọc lịch sử biến động"
        className="rounded-xl border border-border bg-card p-4 shadow-2xs space-y-3.5"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-border/50">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Bộ lọc & Tìm kiếm biến động
          </span>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetAllFilters}
              className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline cursor-pointer"
            >
              <RotateCcw className="size-3" />
              <span>Xóa bộ lọc</span>
            </button>
          )}
        </div>

        {/* Quick Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm nhanh theo tên, mã vật tư, mã chứng từ (PX-, NK-), lô hoặc người thực hiện..."
            className="w-full h-9.5 rounded-lg border border-border bg-background pl-9 pr-8 text-xs font-medium text-foreground placeholder:text-muted-foreground focus:outline-2 focus:outline-primary transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <label className="grid gap-1.5 text-xs font-medium text-foreground">
            Kho lưu trữ
            <Select
              value={filters.warehouseId ?? ""}
              onChange={(event) =>
                ledger.changeWarehouse(event.target.value || undefined)
              }
              disabled={references.isLoading || Boolean(references.error)}
              className="font-normal text-xs h-9"
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
            </Select>
          </label>

          <label className="grid gap-1.5 text-xs font-medium text-foreground">
            Vật tư
            <Select
              value={filters.itemId ?? ""}
              onChange={(event) =>
                ledger.changeItem(event.target.value || undefined)
              }
              disabled={references.isLoading || Boolean(references.error)}
              className="font-normal text-xs h-9"
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
            </Select>
          </label>

          <label className="grid gap-1.5 text-xs font-medium text-foreground">
            Loại biến động
            <Select
              value={filters.transactionType ?? ""}
              onChange={(event) =>
                ledger.changeType(
                  (event.target.value || undefined) as
                    InventoryTransactionType | undefined,
                )
              }
              className="font-normal text-xs h-9"
            >
              <option value="">Tất cả loại biến động</option>
              {TRANSACTION_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </Select>
          </label>
        </div>

        <div className="pt-2 border-t border-border/40">
          <DateRangeFilter onApply={ledger.changeDateRange} />
        </div>
      </section>

      {references.error && (
        <div
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
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
        <BeeLoader label="Đang tải lịch sử biến động..." />
      ) : ledger.error ? (
        <div
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
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
      ) : displayedTransactions.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <p className="text-sm font-medium text-foreground">
            {hasActiveFilters
              ? "Không có biến động nào phù hợp với bộ lọc hoặc từ khóa tìm kiếm."
              : "Chưa có lịch sử biến động trong trang trại."}
          </p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetAllFilters}
              className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline cursor-pointer"
            >
              <RotateCcw className="size-3" />
              <span>Xóa bộ lọc để xem toàn bộ</span>
            </button>
          )}
        </div>
      ) : (
        <InventoryLedgerTable rows={displayedTransactions} />
      )}

      {pageInfo && (
        <nav
          aria-label="Phân trang lịch sử biến động"
          className="flex flex-wrap items-center justify-between gap-3 pt-2"
        >
          <p className="text-xs text-muted-foreground font-medium">
            {pageInfo.totalItems === 0
              ? "0 dòng biến động"
              : `Trang ${pageInfo.number} / ${pageInfo.totalPages} (Tổng cộng ${pageInfo.totalItems} biến động)`}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pageInfo.number <= 1}
              onClick={() => ledger.changePage(pageInfo.number - 1)}
              className="text-xs font-medium"
            >
              Trang trước
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={
                pageInfo.totalPages === 0 ||
                pageInfo.number >= pageInfo.totalPages
              }
              onClick={() => ledger.changePage(pageInfo.number + 1)}
              className="text-xs font-medium"
            >
              Trang sau
            </Button>
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

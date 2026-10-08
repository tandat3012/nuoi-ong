"use client";

import { useFarmPermissions } from "@/features/materials/hooks/use-farm-permissions";
import { useState } from "react";
import type { InventoryFilters } from "../types/inventory";
import { useInventoryList } from "../hooks/use-inventory-list";
import { useInventoryReferences } from "../hooks/use-inventory-references";
import type { Warehouse } from "@/features/warehouses/types/warehouse";
import { InventoryTable } from "./inventory-table";
import { InventoryLedgerPage } from "./inventory-ledger-page";
import { InventoryAdjustmentDialog } from "./inventory-adjustment-dialog";

export function InventoryPage({
  initialFilters,
}: {
  initialFilters: Pick<InventoryFilters, "warehouseId" | "itemId">;
}) {
  const { selectedFarmId, canWrite } = useFarmPermissions();
  const [view, setView] = useState<"balances" | "ledger">("balances");
  if (!selectedFarmId)
    return <p role="status">Vui lòng chọn trang trại để xem tồn kho.</p>;
  return (
    <FarmInventoryPage
      key={`${selectedFarmId}:${initialFilters.warehouseId ?? ""}:${initialFilters.itemId ?? ""}`}
      farmId={selectedFarmId}
      initialFilters={initialFilters}
      canWrite={canWrite}
      view={view}
      onChangeView={setView}
    />
  );
}

function FarmInventoryPage({
  farmId,
  initialFilters,
  canWrite,
  view,
  onChangeView,
}: {
  farmId: string;
  initialFilters: Pick<InventoryFilters, "warehouseId" | "itemId">;
  canWrite: boolean;
  view: "balances" | "ledger";
  onChangeView: (view: "balances" | "ledger") => void;
}) {
  const [refreshToken, setRefreshToken] = useState(0);
  const [adjustmentOpen, setAdjustmentOpen] = useState(false);
  const [hasAmbiguousOutcome, setHasAmbiguousOutcome] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Chế độ xem kho" className="flex gap-2">
          <button
            type="button"
            aria-pressed={view === "balances"}
            onClick={() => onChangeView("balances")}
            className="rounded-lg border px-4 py-2 text-sm aria-pressed:bg-primary aria-pressed:text-primary-foreground"
          >
            Tồn hiện tại
          </button>
          <button
            type="button"
            aria-pressed={view === "ledger"}
            onClick={() => onChangeView("ledger")}
            className="rounded-lg border px-4 py-2 text-sm aria-pressed:bg-primary aria-pressed:text-primary-foreground"
          >
            Lịch sử biến động
          </button>
        </nav>
        {canWrite && (
          <button
            type="button"
            onClick={() => setAdjustmentOpen(true)}
            className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground"
          >
            Điều chỉnh tồn kho
          </button>
        )}
      </div>
      {hasAmbiguousOutcome && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900"
        >
          <p>
            Chưa xác nhận được lần điều chỉnh gần nhất. Hãy kiểm tra Lịch sử
            biến động trước khi gửi lại.
          </p>
          <button
            type="button"
            onClick={() => onChangeView("ledger")}
            className="underline"
          >
            Mở lịch sử biến động
          </button>
        </div>
      )}
      {view === "balances" ? (
        <CurrentBalancesView
          farmId={farmId}
          initialFilters={initialFilters}
          refreshToken={refreshToken}
        />
      ) : (
        <InventoryLedgerPage
          farmId={farmId}
          initialFilters={initialFilters}
          refreshToken={refreshToken}
        />
      )}
      {canWrite && adjustmentOpen && (
        <InventoryAdjustmentDialog
          farmId={farmId}
          hasAmbiguousOutcome={hasAmbiguousOutcome}
          onAmbiguousOutcome={() => {
            setHasAmbiguousOutcome(true);
            setRefreshToken((previous) => previous + 1);
          }}
          onClose={() => setAdjustmentOpen(false)}
          onSuccess={() => {
            setAdjustmentOpen(false);
            setHasAmbiguousOutcome(false);
            setRefreshToken((previous) => previous + 1);
          }}
        />
      )}
    </div>
  );
}

function CurrentBalancesView({
  farmId,
  initialFilters,
  refreshToken,
}: {
  farmId: string;
  initialFilters: Pick<InventoryFilters, "warehouseId" | "itemId">;
  refreshToken: number;
}) {
  const inventory = useInventoryList(farmId, initialFilters, refreshToken);
  const references = useInventoryReferences(farmId, inventory.filters.itemId);
  const { filters, pageInfo, isLoading, error, reload } = inventory;
  const itemKnown = references.items.some(
    ({ item }) => item.id === filters.itemId,
  );
  const warehouseKnown = references.warehouses.some(
    ({ id }) => id === filters.warehouseId,
  );
  const selectedLotItem = references.selectedItem?.item.trackingMode === "LOT";

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Tồn kho hiện tại</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Xem số lượng hiện có theo vật tư, kho và lô.
          </p>
        </div>
        <button
          type="button"
          onClick={reload}
          disabled={isLoading}
          className="rounded-lg border px-4 py-2 text-sm hover:bg-muted disabled:opacity-50"
        >
          Tải lại
        </button>
      </header>

      <section
        aria-label="Lọc tồn kho"
        className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-3"
      >
        <label className="grid gap-1.5 text-sm font-medium">
          Kho
          <select
            value={filters.warehouseId ?? ""}
            onChange={(event) =>
              inventory.changeWarehouse(event.target.value || undefined)
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
              inventory.changeItem(event.target.value || undefined)
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
          Lô
          <select
            value={filters.lotId ?? ""}
            onChange={(event) =>
              inventory.changeLot(event.target.value || undefined)
            }
            disabled={
              !selectedLotItem ||
              references.lotsLoading ||
              Boolean(references.lotsError)
            }
            className="rounded-lg border bg-background p-2 font-normal disabled:opacity-60"
          >
            <option value="">
              {!filters.itemId
                ? "Chọn vật tư theo lô trước"
                : selectedLotItem
                  ? references.lotsLoading
                    ? "Đang tải lô..."
                    : "Tất cả lô"
                  : "Vật tư này không theo dõi lô"}
            </option>
            {references.lots.map((lot) => (
              <option key={lot.id} value={lot.id}>
                {lot.lotNumber} · HSD {lot.expiryDate ?? "không có"}
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
      {references.lotsError && (
        <div
          role="alert"
          className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800"
        >
          <p>{references.lotsError}</p>
          <button
            type="button"
            onClick={references.reloadLots}
            className="mt-2 underline"
          >
            Thử tải danh sách lô lại
          </button>
        </div>
      )}

      {isLoading ? (
        <p role="status">Đang tải tồn kho...</p>
      ) : error ? (
        <div
          role="alert"
          className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800"
        >
          <p>{error}</p>
          <button type="button" onClick={reload} className="mt-2 underline">
            Thử lại
          </button>
        </div>
      ) : inventory.balances.length === 0 ? (
        <p role="status">
          {filters.itemId || filters.warehouseId || filters.lotId
            ? "Không có tồn kho phù hợp với bộ lọc."
            : "Chưa có tồn kho hiện tại trong trang trại."}
        </p>
      ) : (
        <InventoryTable rows={inventory.balances} />
      )}

      {pageInfo && (
        <nav
          aria-label="Phân trang tồn kho"
          className="flex flex-wrap items-center justify-between gap-3"
        >
          <p className="text-sm text-muted-foreground">
            {pageInfo.totalItems === 0
              ? "0 dòng tồn kho"
              : `Trang ${pageInfo.number} / ${pageInfo.totalPages} (${pageInfo.totalItems} dòng tồn kho)`}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pageInfo.number <= 1}
              onClick={() => inventory.changePage(pageInfo.number - 1)}
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
              onClick={() => inventory.changePage(pageInfo.number + 1)}
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

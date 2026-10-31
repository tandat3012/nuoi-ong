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
import { InventoryAdjustmentsView } from "./inventory-adjustments-view";
import { usePendingAdjustmentCount } from "../hooks/use-pending-adjustment-count";
import { Badge } from "@/shared/components/ui/badge";
import { Combobox } from "@/shared/components/ui/combobox";
import { useFarmMembership } from "@/features/auth/hooks/use-farm-membership";
import { PageHeader } from "@/shared/components/ui/page-header";
import { Button } from "@/shared/components/ui/button";
import { BeeLoader } from "@/shared/components/ui/bee-loader";

export function InventoryPage({
  initialFilters,
}: {
  initialFilters: Pick<InventoryFilters, "warehouseId" | "itemId">;
}) {
  const { selectedFarmId, canWrite } = useFarmPermissions();
  const { membership } = useFarmMembership();
  const [view, setView] = useState<InventoryView>("balances");
  if (!selectedFarmId)
    return <p role="status">Vui lòng chọn trang trại để xem tồn kho.</p>;
  return (
    <FarmInventoryPage
      key={`${selectedFarmId}:${initialFilters.warehouseId ?? ""}:${initialFilters.itemId ?? ""}`}
      farmId={selectedFarmId}
      initialFilters={initialFilters}
      canWrite={canWrite}
      canRequest={canWrite || (membership?.roles.includes("EMPLOYEE") ?? false)}
      view={view}
      onChangeView={setView}
    />
  );
}

type InventoryView = "balances" | "ledger" | "adjustments";

function FarmInventoryPage({
  farmId,
  initialFilters,
  canWrite,
  canRequest,
  view,
  onChangeView,
}: {
  farmId: string;
  initialFilters: Pick<InventoryFilters, "warehouseId" | "itemId">;
  /** ADMIN / FARM_OWNER: adjust directly and approve requests. */
  canWrite: boolean;
  /** Also true for EMPLOYEE, whose adjustments wait for approval. */
  canRequest: boolean;
  view: InventoryView;
  onChangeView: (view: InventoryView) => void;
}) {
  const [refreshToken, setRefreshToken] = useState(0);
  const [adjustmentOpen, setAdjustmentOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  // Only approvers act on the count, so only they get the badge.
  const pendingCount = usePendingAdjustmentCount(
    farmId,
    refreshToken,
    canWrite,
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Chế độ xem kho" className="flex gap-2">
          <Button variant="outline"
            aria-pressed={view === "balances"}
            onClick={() => onChangeView("balances")}
            className="aria-pressed:bg-primary aria-pressed:text-primary-foreground"
          >
            Tồn hiện tại
          </Button>
          <Button variant="outline"
            aria-pressed={view === "ledger"}
            onClick={() => onChangeView("ledger")}
            className="aria-pressed:bg-primary aria-pressed:text-primary-foreground"
          >
            Lịch sử biến động
          </Button>
          {canRequest && (
            <Button variant="outline"
              aria-pressed={view === "adjustments"}
              onClick={() => onChangeView("adjustments")}
              className="aria-pressed:bg-primary aria-pressed:text-primary-foreground"
            >
              Đề xuất điều chỉnh
              {pendingCount ? (
                <Badge variant="warning" className="ml-1.5 tabular-nums">
                  {pendingCount}
                  <span className="sr-only"> đang chờ duyệt</span>
                </Badge>
              ) : null}
            </Button>
          )}
        </nav>
        {canRequest && (
          <Button
            onClick={() => {
              setNotice(null);
              setAdjustmentOpen(true);
            }}
          >
            {canWrite ? "Điều chỉnh tồn kho" : "Đề xuất điều chỉnh"}
          </Button>
        )}
      </div>
      {notice && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-success/30 bg-success/10 p-4 text-sm text-success"
        >
          <p>{notice}</p>
          <button
            type="button"
            onClick={() => onChangeView("adjustments")}
            className="underline"
          >
            Xem đề xuất
          </button>
        </div>
      )}
      {view === "balances" ? (
        <CurrentBalancesView
          farmId={farmId}
          initialFilters={initialFilters}
          refreshToken={refreshToken}
        />
      ) : view === "ledger" ? (
        <InventoryLedgerPage
          farmId={farmId}
          initialFilters={initialFilters}
          refreshToken={refreshToken}
        />
      ) : (
        <InventoryAdjustmentsView
          farmId={farmId}
          canApprove={canWrite}
          refreshToken={refreshToken}
          onReviewed={() => setRefreshToken((previous) => previous + 1)}
        />
      )}
      {canRequest && adjustmentOpen && (
        <InventoryAdjustmentDialog
          farmId={farmId}
          requiresApproval={!canWrite}
          onClose={() => setAdjustmentOpen(false)}
          onSuccess={(pending) => {
            setAdjustmentOpen(false);
            if (pending)
              setNotice(
                "Đã gửi đề xuất điều chỉnh. Tồn kho sẽ cập nhật sau khi chủ trại duyệt.",
              );
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
      <PageHeader
        title="Tồn kho hiện tại"
        description="Xem số lượng hiện có theo vật tư, kho và lô."
        actions={
          <>
            <Button variant="outline" onClick={reload} disabled={isLoading}>
              Tải lại
            </Button>
          </>
        }
      />

      <section
        aria-label="Lọc tồn kho"
        className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-3"
      >
        <label className="grid gap-1.5 text-sm font-medium">
          Kho
          <Combobox
            value={filters.warehouseId ?? ""}
            onChange={(warehouseId) =>
              inventory.changeWarehouse(warehouseId || undefined)
            }
            disabled={references.isLoading || Boolean(references.error)}
            placeholder="Tìm theo mã hoặc tên kho"
            emptyText="Không có kho khớp từ khóa."
            options={[
              { value: "", label: "Tất cả kho" },
              ...(filters.warehouseId && !warehouseKnown
                ? [
                    {
                      value: filters.warehouseId,
                      label: "Kho đã chọn không có trong trang trại này",
                    },
                  ]
                : []),
              ...references.warehouses.map(warehouseOption),
            ]}
          />
        </label>

        <label className="grid gap-1.5 text-sm font-medium">
          Vật tư
          <Combobox
            value={filters.itemId ?? ""}
            onChange={(itemId) => inventory.changeItem(itemId || undefined)}
            disabled={references.isLoading || Boolean(references.error)}
            placeholder="Tìm theo mã hoặc tên vật tư"
            emptyText="Không có vật tư khớp từ khóa."
            options={[
              { value: "", label: "Tất cả vật tư" },
              ...(filters.itemId && !itemKnown
                ? [
                    {
                      value: filters.itemId,
                      label: "Vật tư đã chọn không có trong trang trại này",
                    },
                  ]
                : []),
              ...references.items.map(({ item }) => ({
                value: item.id,
                label: `${item.code} · ${item.name}${
                  item.status === "INACTIVE" ? " (Ngừng hoạt động)" : ""
                }`,
              })),
            ]}
          />
        </label>

        <label className="grid gap-1.5 text-sm font-medium">
          Lô
          <Combobox
            value={filters.lotId ?? ""}
            onChange={(lotId) => inventory.changeLot(lotId || undefined)}
            disabled={
              !selectedLotItem ||
              references.lotsLoading ||
              Boolean(references.lotsError)
            }
            placeholder={
              !filters.itemId
                ? "Chọn vật tư theo lô trước"
                : selectedLotItem
                  ? references.lotsLoading
                    ? "Đang tải lô..."
                    : "Tìm theo số lô"
                  : "Vật tư này không theo dõi lô"
            }
            emptyText="Không có lô khớp từ khóa."
            options={[
              // Without a lot item, keep the placeholder explaining why it's disabled.
              ...(selectedLotItem ? [{ value: "", label: "Tất cả lô" }] : []),
              ...references.lots.map((lot) => ({
                value: lot.id,
                label: lot.lotNumber,
                hint: `HSD ${lot.expiryDate ?? "không có"}`,
              })),
            ]}
          />
        </label>
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
      {references.lotsError && (
        <div
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
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
        <BeeLoader label="Đang tải tồn kho..." />
      ) : error ? (
        <div
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
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
            <Button variant="outline"
              disabled={pageInfo.number <= 1}
              onClick={() => inventory.changePage(pageInfo.number - 1)}
            >
              Trang trước
            </Button>
            <Button variant="outline"
              disabled={
                pageInfo.totalPages === 0 ||
                pageInfo.number >= pageInfo.totalPages
              }
              onClick={() => inventory.changePage(pageInfo.number + 1)}
            >
              Trang sau
            </Button>
          </div>
        </nav>
      )}
    </div>
  );
}

function warehouseOption(warehouse: Warehouse) {
  return {
    value: warehouse.id,
    label: `${warehouse.code} · ${warehouse.name}${
      warehouse.status === "INACTIVE" ? " (Ngừng hoạt động)" : ""
    }`,
  };
}

"use client";

import { useFarmPermissions } from "@/features/materials/hooks/use-farm-permissions";
import { useState, useMemo } from "react";
import type { InventoryFilters } from "../types/inventory";
import { useInventoryList } from "../hooks/use-inventory-list";
import { useInventoryReferences } from "../hooks/use-inventory-references";
import type { Warehouse } from "@/features/warehouses/types/warehouse";
import { InventoryTable } from "./inventory-table";
import { InventorySummaryBar } from "./inventory-summary-bar";
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
import { canCreateStockDocuments } from "@/features/stock-documents/stock-document.logic";
import { InventoryAssetFilter } from "./inventory-asset-filter";
import { AssetStatusBadge } from "@/features/assets/components/asset-status-badge";
import Link from "next/link";
import { cn } from "@/shared/lib/utils";
import { Search, RotateCcw, Plus, RefreshCw, X } from "lucide-react";

export function InventoryPage({
  initialFilters,
}: {
  initialFilters: Pick<InventoryFilters, "warehouseId" | "itemId">;
}) {
  const { selectedFarmId, canWrite } = useFarmPermissions();
  const { membership } = useFarmMembership();
  const [view, setView] = useState<InventoryView>("balances");
  const [ledgerItemId, setLedgerItemId] = useState<string | undefined>(undefined);

  if (!selectedFarmId)
    return <p role="status">Vui lòng chọn trang trại để xem tồn kho.</p>;

  return (
    <FarmInventoryPage
      key={`${selectedFarmId}:${initialFilters.warehouseId ?? ""}:${initialFilters.itemId ?? ""}`}
      farmId={selectedFarmId}
      initialFilters={{
        warehouseId: initialFilters.warehouseId,
        itemId: ledgerItemId ?? initialFilters.itemId,
      }}
      canWrite={canWrite}
      canRequest={canCreateStockDocuments(membership?.roles ?? [])}
      view={view}
      onChangeView={setView}
      onOpenLedgerItem={(itemId) => {
        setLedgerItemId(itemId);
        setView("ledger");
      }}
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
  onOpenLedgerItem,
}: {
  farmId: string;
  initialFilters: Pick<InventoryFilters, "warehouseId" | "itemId">;
  /** Warehouse managers and owners may review other members' reports. */
  canWrite: boolean;
  /** Also true for EMPLOYEE, whose adjustments wait for approval. */
  canRequest: boolean;
  view: InventoryView;
  onChangeView: (view: InventoryView) => void;
  onOpenLedgerItem?: (itemId: string) => void;
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
    <div className="space-y-5">
      {/* Top action & Segmented Control */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-border/60">
        <nav
          aria-label="Chế độ xem kho"
          className="inline-flex items-center gap-1 p-1 rounded-xl bg-muted/80 border border-border"
        >
          <button
            type="button"
            aria-pressed={view === "balances"}
            onClick={() => onChangeView("balances")}
            className={cn(
              "px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer",
              view === "balances"
                ? "bg-card text-foreground shadow-xs font-bold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Tồn hiện tại
          </button>
          <button
            type="button"
            aria-pressed={view === "ledger"}
            onClick={() => onChangeView("ledger")}
            className={cn(
              "px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer",
              view === "ledger"
                ? "bg-card text-foreground shadow-xs font-bold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Lịch sử biến động
          </button>
          {canRequest && (
            <button
              type="button"
              aria-pressed={view === "adjustments"}
              onClick={() => onChangeView("adjustments")}
              className={cn(
                "px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer",
                view === "adjustments"
                  ? "bg-card text-foreground shadow-xs font-bold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span>Báo cáo chênh lệch</span>
              {pendingCount ? (
                <Badge variant="warning" className="px-1.5 py-0 text-[0.65rem] tabular-nums font-bold">
                  {pendingCount}
                </Badge>
              ) : null}
            </button>
          )}
        </nav>

        {canRequest && (
          <Button
            size="sm"
            className="h-9 gap-1.5 shadow-xs font-semibold"
            onClick={() => {
              setNotice(null);
              setAdjustmentOpen(true);
            }}
          >
            <Plus className="size-4" />
            <span>Báo chênh lệch tồn</span>
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
            className="underline font-medium"
          >
            Xem báo cáo
          </button>
        </div>
      )}

      {view === "balances" ? (
        <CurrentBalancesView
          farmId={farmId}
          initialFilters={initialFilters}
          refreshToken={refreshToken}
          onOpenLedgerItem={onOpenLedgerItem}
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
                "Đã gửi báo cáo chênh lệch. Tồn kho chỉ cập nhật sau khi quản lý kho, chủ trại hoặc quản trị viên duyệt.",
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
  onOpenLedgerItem,
}: {
  farmId: string;
  initialFilters: Pick<InventoryFilters, "warehouseId" | "itemId">;
  refreshToken: number;
  onOpenLedgerItem?: (itemId: string) => void;
}) {
  const inventory = useInventoryList(farmId, initialFilters, refreshToken);
  const references = useInventoryReferences(farmId, inventory.filters.itemId);
  const { filters, pageInfo, isLoading, error, reload } = inventory;
  const [searchQuery, setSearchQuery] = useState("");

  const itemKnown = references.items.some(
    ({ item }) => item.id === filters.itemId,
  );
  const warehouseKnown = references.warehouses.some(
    ({ id }) => id === filters.warehouseId,
  );
  const selectedLotItem = references.selectedItem?.item.trackingMode === "LOT";

  const hasActiveFilters = Boolean(
    filters.warehouseId || filters.itemId || filters.lotId || filters.assetId || searchQuery.trim()
  );

  const resetAllFilters = () => {
    inventory.changeWarehouse(undefined);
    inventory.changeItem(undefined);
    inventory.changeLot(undefined);
    inventory.changeAsset(undefined);
    setSearchQuery("");
  };

  // Client-side instant filter on current page items
  const displayedBalances = useMemo(() => {
    if (!searchQuery.trim()) return inventory.balances;
    const query = searchQuery.trim().toLowerCase();
    return inventory.balances.filter(
      (b) =>
        b.item.name.toLowerCase().includes(query) ||
        b.item.code.toLowerCase().includes(query) ||
        b.warehouse.name.toLowerCase().includes(query) ||
        (b.lot?.lotCode && b.lot.lotCode.toLowerCase().includes(query))
    );
  }, [inventory.balances, searchQuery]);

  return (
    <div className="space-y-5">
      {/* Page Header with Refresh */}
      <PageHeader
        title="Tồn kho hiện tại"
        description="Xem số lượng hiện có theo vật tư, kho và lô."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={reload}
            disabled={isLoading}
            className="h-9 gap-1.5 text-xs font-medium"
          >
            <RefreshCw className={`size-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span>Tải lại</span>
          </Button>
        }
      />

      {/* Tầng 1: Summary Bar */}
      <InventorySummaryBar
        balances={inventory.balances}
        totalItems={pageInfo?.totalItems}
        isLoading={isLoading}
      />

      {/* Tầng 2: Search & Smart Filter Bar */}
      <section
        aria-label="Lọc tồn kho"
        className="rounded-xl border border-border bg-card p-4 shadow-2xs space-y-3"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-border/50">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Bộ lọc & Tìm kiếm
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

        {/* Search query input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm nhanh theo tên, mã vật tư hoặc mã lô..."
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

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <label className="grid gap-1.5 text-xs font-medium text-foreground">
            Kho lưu trữ
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

          <label className="grid gap-1.5 text-xs font-medium text-foreground">
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

          <label className="grid gap-1.5 text-xs font-medium text-foreground">
            Lô hàng
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
                      : "Tìm theo mã lô"
                    : "Vật tư này không theo dõi lô"
              }
              emptyText="Không có lô khớp từ khóa."
              options={[
                ...(selectedLotItem ? [{ value: "", label: "Tất cả lô" }] : []),
                ...references.lots.map((lot) => ({
                  value: lot.id,
                  label: lot.lotCode,
                  hint: [
                    lot.supplierLotNumber && `Số lô ${lot.supplierLotNumber}`,
                    `HSD ${lot.expiryDate ?? "không có"}`,
                  ]
                    .filter(Boolean)
                    .join(" · "),
                })),
              ]}
            />
          </label>

          <InventoryAssetFilter
            key={`${farmId}:${filters.warehouseId ?? ""}:${filters.itemId ?? ""}`}
            farmId={farmId}
            warehouseId={filters.warehouseId}
            itemId={filters.itemId}
            value={filters.assetId}
            selectedLabel={inventory.selectedAsset?.assetCode}
            disabled={
              references.isLoading ||
              Boolean(references.error) ||
              Boolean(
                filters.itemId &&
                references.selectedItem?.item.trackingMode !== "ASSET",
              )
            }
            onChange={inventory.changeAsset}
          />
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

      {inventory.selectedAsset && (
        <div className="space-y-2 rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <Link
              className="font-semibold underline text-primary"
              href={`/assets/${inventory.selectedAsset.id}`}
            >
              {inventory.selectedAsset.assetCode}
            </Link>
            <AssetStatusBadge status={inventory.selectedAsset.status} />
          </div>
          <p className="text-xs text-muted-foreground">
            Serial: {inventory.selectedAsset.serialNumber || "—"} · Vị trí:{" "}
            {inventory.selectedAsset.locationName || "Chưa có vị trí trong kho"}
          </p>
          <p className="text-xs">
            {inventory.balances.length
              ? inventory.selectedAsset.status === "MAINTENANCE"
                ? "Tài sản đã nhập lại kho nhưng đang cách ly, chưa được phép cấp phát hoặc sử dụng."
                : inventory.selectedAsset.status === "DAMAGED"
                  ? "Tài sản trả về bị hỏng: vẫn tính tồn trong kho nhưng không được cấp phát hay bán; chờ bảo trì hoặc thanh lý."
                : inventory.selectedAsset.status === "TRANSFER_PENDING"
                  ? "Tài sản vẫn ở kho nhưng đang chờ duyệt điều chuyển, chưa sẵn sàng sử dụng."
                  : "Kết quả tồn bên dưới chỉ tính một tài sản đã chọn, không phải tổng số thiết bị cùng loại."
              : "Tài sản không nằm trong tồn kho phù hợp với bộ lọc hiện tại. Không tính thiết bị đang cấp phát hoặc gửi bảo trì là tồn sẵn sàng."}
          </p>
        </div>
      )}

      {/* Tầng 3: Data Table */}
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
      ) : displayedBalances.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <p className="text-sm font-medium text-foreground">
            {hasActiveFilters
              ? "Không có tồn kho phù hợp với bộ lọc hoặc từ khóa tìm kiếm."
              : "Chưa có tồn kho hiện tại trong trang trại."}
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
        <InventoryTable
          rows={displayedBalances}
          onOpenLedgerItem={onOpenLedgerItem}
        />
      )}

      {/* Pagination */}
      {pageInfo && (
        <nav
          aria-label="Phân trang tồn kho"
          className="flex flex-wrap items-center justify-between gap-3 pt-2"
        >
          <p className="text-xs text-muted-foreground font-medium">
            {pageInfo.totalItems === 0
              ? "0 dòng tồn kho"
              : `Trang ${pageInfo.number} / ${pageInfo.totalPages} (Tổng cộng ${pageInfo.totalItems} dòng tồn kho)`}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pageInfo.number <= 1}
              onClick={() => inventory.changePage(pageInfo.number - 1)}
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
              onClick={() => inventory.changePage(pageInfo.number + 1)}
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

function warehouseOption(warehouse: Warehouse) {
  return {
    value: warehouse.id,
    label: `${warehouse.code} · ${warehouse.name}${
      warehouse.status === "INACTIVE" ? " (Ngừng hoạt động)" : ""
    }`,
  };
}

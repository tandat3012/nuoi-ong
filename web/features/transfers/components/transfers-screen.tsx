"use client";

import Link from "next/link";
import { startTransition, useEffect, useState, useMemo } from "react";

import {
  useAuthenticatedRequest,
  useAuthContext,
  useFarmMembership,
} from "@/features/auth";
import { ApiError } from "@/shared/api/client";
import { PageHeader } from "@/shared/components/ui/page-header";
import type { PaginatedResponse } from "@/shared/api/contracts";
import { Select } from "@/shared/components/ui/select";
import { Input } from "@/shared/components/ui/input";
import { Button } from "@/shared/components/ui/button";
import { WarehouseLotSelect } from "@/features/inventory";
import {
  canCreateStockDocuments,
  StockDocumentLines,
  StockDocumentReview,
  stockDocumentActions,
  useStockDocumentLock,
  useStockDocumentQuery,
  DOCUMENT_CODE_HINT,
  documentCodeLabel,
  isFarmOwner,
  numberingDraft,
  numberingOptionsError,
  numberingOptionsPayload,
  NumberingOptionsFields,
} from "@/features/stock-documents";
import { shouldReloadAfterFailure } from "@/features/stock-documents/stock-document.logic";
import { useNotificationRefresh } from "@/features/notifications";
import { BeeLoader } from "@/shared/components/ui/bee-loader";
import { canReceiveTransfer, canResolveTransfer } from "../transfer-receive.logic";
import { TransferReceivePanel } from "./transfer-receive-panel";
import { TransferResolvePanel } from "./transfer-resolve-panel";
import { TransferSummaryBar } from "./transfer-summary-bar";
import {
  Plus,
  X,
  Search,
  RotateCcw,
  ArrowRight,
  Truck,
  Eye,
  Check,
  PackageCheck,
  AlertTriangle,
  Info,
} from "lucide-react";

type Warehouse = { id: string; code: string; name: string };
type Item = {
  id: string;
  code: string;
  name: string;
  trackingMode: "QUANTITY" | "LOT" | "ASSET";
};
type Transfer = {
  id: string;
  transferCode: string | null;
  externalReference?: string | null;
  requestedCode?: string | null;
  fromWarehouseId: string;
  toWarehouseId: string;
  transferDate: string;
  status:
    | "DRAFT"
    | "PENDING_APPROVAL"
    | "IN_TRANSIT"
    | "DISCREPANCY"
    | "CONFIRMED"
    | "REJECTED"
    | "CANCELLED";
  note: string | null;
  createdByMemberId: string | null;
  rejectionReason?: string | null;
};
type TransferResponse = {
  transfer: Transfer;
  items: Array<{ id: string; itemId: string; quantity: string }>;
};

const STATUS_LABELS: Record<Transfer["status"], string> = {
  DRAFT: "Nháp",
  PENDING_APPROVAL: "Chờ duyệt",
  IN_TRANSIT: "Đang chuyển",
  DISCREPANCY: "Nhận thiếu, chờ xử lý",
  CONFIRMED: "Đã nhận hàng",
  REJECTED: "Đã từ chối",
  CANCELLED: "Đã hủy",
};

const STATUS_CONFIG: Record<
  Transfer["status"],
  { label: string; dotClass: string; badgeClass: string }
> = {
  CONFIRMED: {
    label: "Đã nhận hàng",
    dotClass: "bg-emerald-500",
    badgeClass: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
  },
  IN_TRANSIT: {
    label: "Đang chuyển",
    dotClass: "bg-sky-500",
    badgeClass: "bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/20",
  },
  DISCREPANCY: {
    label: "Nhận thiếu, chờ xử lý",
    dotClass: "bg-amber-500",
    badgeClass: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
  },
  DRAFT: {
    label: "Nháp",
    dotClass: "bg-amber-500",
    badgeClass: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
  },
  PENDING_APPROVAL: {
    label: "Chờ duyệt",
    dotClass: "bg-sky-500",
    badgeClass: "bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/20",
  },
  REJECTED: {
    label: "Đã từ chối",
    dotClass: "bg-rose-500",
    badgeClass: "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20",
  },
  CANCELLED: {
    label: "Đã hủy",
    dotClass: "bg-zinc-400",
    badgeClass: "bg-muted text-muted-foreground border-border",
  },
};

const warehouseName = (warehouses: Warehouse[], id: string) =>
  warehouses.find((warehouse) => warehouse.id === id)?.name ?? id;

function errorMessage(error: unknown) {
  if (!(error instanceof ApiError)) return "Có lỗi xảy ra, vui lòng thử lại.";
  const details = error.details as { message?: string | string[] } | undefined;
  return Array.isArray(details?.message)
    ? details.message.join(", ")
    : (details?.message ?? error.message);
}

export function TransfersScreen() {
  const { selectedFarmId } = useAuthContext();
  const notificationRevision = useNotificationRefresh();
  return (
    <FarmTransfersScreen key={`${selectedFarmId}:${notificationRevision}`} />
  );
}

function FarmTransfersScreen() {
  const request = useAuthenticatedRequest();
  const {
    selectedFarmId,
    isLoading: authLoading,
    error: authError,
  } = useAuthContext();
  const { membership } = useFarmMembership();
  const viewer = {
    roles: membership?.roles ?? [],
    memberId: membership?.memberId,
  };
  const canWrite = canCreateStockDocuments(viewer.roles);
  const isOwner = isFarmOwner(viewer.roles);
  const lock = useStockDocumentLock();
  const reloadList = () => {
    setLoadedFarmId(null);
    setRevision((value) => value + 1);
  };
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  // Sources are the caller's warehouses; destinations (and labels) every warehouse of the farm.
  const [warehouseLists, setWarehouseLists] = useState<{
    sources: Warehouse[];
    destinations: Warehouse[];
  }>({ sources: [], destinations: [] });
  const { sources: warehouses, destinations } = warehouseLists;
  const [items, setItems] = useState<Item[]>([]);
  const [status, setStatus] = useState<
    | "ALL"
    | "DRAFT"
    | "PENDING_APPROVAL"
    | "IN_TRANSIT"
    | "DISCREPANCY"
    | "CONFIRMED"
    | "REJECTED"
    | "CANCELLED"
  >("ALL");
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [loadedFarmId, setLoadedFarmId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Action failures live apart from `error`, which every list reload clears.
  const [actionError, setActionError] = useState<string | null>(null);
  const [openId, setOpenId] = useStockDocumentQuery();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    fromWarehouseId: "",
    toWarehouseId: "",
    itemId: "",
    lotId: "",
    quantity: "1",
    note: "",
  });

  useEffect(() => {
    if (!selectedFarmId) return;
    startTransition(() => {
      setPage(1);
      setLoadedFarmId(null);
      setTransfers([]);
      setError(null);
    });
    let cancelled = false;
    const warehouseList = (destination: boolean) =>
      request<{ data: Warehouse[] }>("/warehouses", {
        params: {
          farmId: selectedFarmId,
          page: 1,
          pageSize: 100,
          status: "ACTIVE",
          destination: destination || undefined,
        },
      });
    void Promise.all([
      warehouseList(false),
      request<PaginatedResponse<{ item: Item }>>("/items", {
        params: {
          farmId: selectedFarmId,
          page: 1,
          pageSize: 100,
          status: "ACTIVE",
        },
      }),
      warehouseList(true),
    ])
      .then(([warehouseResponse, itemResponse, destinationResponse]) => {
        if (cancelled) return;
        setWarehouseLists({
          sources: warehouseResponse.data,
          destinations: destinationResponse.data,
        });
        setItems(
          itemResponse.data
            .map(({ item }) => item)
            .filter((item) => item.trackingMode !== "ASSET"),
        );
        setForm((current) => ({
          ...current,
          fromWarehouseId: "",
          toWarehouseId: "",
          itemId: "",
          lotId: "",
        }));
      })
      .catch((requestError: unknown) => {
        if (!cancelled) setError(errorMessage(requestError));
      });
    return () => {
      cancelled = true;
    };
  }, [request, selectedFarmId]);

  useEffect(() => {
    if (!selectedFarmId) return;
    let cancelled = false;
    startTransition(() => {
      setLoading(true);
      setError(null);
    });
    void request<PaginatedResponse<Transfer>>("/stock-transfers", {
      params: {
        farmId: selectedFarmId,
        page,
        pageSize: 20,
        status: status === "ALL" ? undefined : status,
      },
    })
      .then((response) => {
        if (!cancelled) {
          setTransfers(response.data);
          setLoadedFarmId(selectedFarmId);
          setTotalPages(response.page.totalPages);
          setTotalItems(response.page.totalItems);
        }
      })
      .catch((requestError: unknown) => {
        if (!cancelled) {
          setTransfers([]);
          setError(errorMessage(requestError));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page, request, selectedFarmId, status, revision]);

  // Keep after the other state hooks: stock-document-interaction.test.mjs seeds state by call order.
  const [numbering, setNumbering] = useState(numberingDraft);
  const [receiving, setReceiving] = useState<Transfer | null>(null);
  const [resolving, setResolving] = useState<Transfer | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const selectedItem = items.find((item) => item.id === form.itemId);

  async function createTransfer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const numberingOptions = isOwner ? numberingOptionsPayload(numbering) : {};
    const numberingError = numberingOptionsError(numberingOptions);
    if (numberingError) {
      setError(numberingError);
      return;
    }
    if (!selectedFarmId || !canWrite || !lock.acquire()) return;
    setSaving(true);
    setError(null);
    try {
      await request<TransferResponse>("/stock-transfers", {
        method: "POST",
        params: { farmId: selectedFarmId },
        data: {
          ...numberingOptions,
          fromWarehouseId: form.fromWarehouseId,
          toWarehouseId: form.toWarehouseId,
          note: form.note.trim() || undefined,
          items: [
            {
              itemId: form.itemId,
              lotId:
                selectedItem?.trackingMode === "LOT" ? form.lotId : undefined,
              quantity: form.quantity.trim(),
            },
          ],
        },
      });
      setShowForm(false);
      setNumbering(numberingDraft());
      setForm((current) => ({ ...current, quantity: "1", note: "" }));
      setPage(1);
      setLoadedFarmId(null);
      setRevision((value) => value + 1);
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setSaving(false);
      lock.release();
    }
  }

  async function changeTransfer(id: string, action: "confirm" | "cancel") {
    if (!selectedFarmId || !lock.acquire()) return;
    setActionError(null);
    try {
      await request<TransferResponse>(`/stock-transfers/${id}/${action}`, {
        method: "POST",
        params: { farmId: selectedFarmId },
      });
      setLoadedFarmId(null);
      setRevision((value) => value + 1);
      setPage(1);
    } catch (requestError) {
      setActionError(errorMessage(requestError));
      if (
        shouldReloadAfterFailure(
          requestError instanceof ApiError ? requestError.status : null,
        )
      )
        reloadList();
    } finally {
      lock.release();
    }
  }

  const visibleTransfers = loadedFarmId === selectedFarmId ? transfers : [];

  const displayedTransfers = useMemo(() => {
    if (!searchQuery.trim()) return visibleTransfers;
    const query = searchQuery.trim().toLowerCase();
    return visibleTransfers.filter((t) => {
      const code = (t.transferCode ?? "").toLowerCase();
      const fromName = warehouseName(destinations, t.fromWarehouseId).toLowerCase();
      const toName = warehouseName(destinations, t.toWarehouseId).toLowerCase();
      const note = (t.note ?? "").toLowerCase();
      const ref = (t.externalReference ?? "").toLowerCase();
      return (
        code.includes(query) ||
        fromName.includes(query) ||
        toName.includes(query) ||
        note.includes(query) ||
        ref.includes(query)
      );
    });
  }, [visibleTransfers, destinations, searchQuery]);

  if (authLoading) return <BeeLoader label="Đang tải trang trại..." />;
  if (authError) return <p role="alert">{authError.message}</p>;
  if (!selectedFarmId)
    return <p>Vui lòng chọn trang trại để xem điều chuyển kho.</p>;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Điều chuyển kho"
        description="Kho nguồn xác nhận xuất (trừ tồn nguồn, hàng sang Đang chuyển); kho đích nhập số thực nhận mới được cộng tồn."
      />

      {/* Summary KPI Bar */}
      <TransferSummaryBar transfers={visibleTransfers} totalItems={totalItems} />

      {/* Collapsible Transfer Creation Card */}
      {canWrite && (
        <section className="rounded-xl border border-border bg-card shadow-2xs transition-colors">
          <div className="flex items-center justify-between p-4 sm:p-5">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Tạo phiếu điều chuyển</h2>
              <p className="text-xs text-muted-foreground">
                Lập phiếu điều chuyển vật tư nội bộ giữa các kho
              </p>
            </div>
            <Button
              variant={showForm ? "outline" : "default"}
              size="sm"
              onClick={() => setShowForm((value) => !value)}
              className="h-8 gap-1.5 text-xs font-semibold shadow-xs"
            >
              {showForm ? (
                <>
                  <X className="size-3.5" aria-hidden="true" />
                  <span>Đóng form</span>
                </>
              ) : (
                <>
                  <Plus className="size-3.5" aria-hidden="true" />
                  <span>Tạo phiếu mới</span>
                </>
              )}
            </Button>
          </div>

          {showForm && (
            <form
              onSubmit={createTransfer}
              className="space-y-4 border-t border-border p-4 sm:p-5"
            >
              <p className="font-mono text-xs text-muted-foreground">
                {DOCUMENT_CODE_HINT}
              </p>

              {isOwner && (
                <NumberingOptionsFields
                  value={numbering}
                  onChange={setNumbering}
                />
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-foreground">
                    Kho nguồn *
                  </label>
                  <Select
                    aria-label="Kho nguồn"
                    required
                    value={form.fromWarehouseId}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        fromWarehouseId: event.target.value,
                        lotId: "",
                      })
                    }
                    className="h-9 text-xs"
                  >
                    <option value="">Chọn kho xuất</option>
                    {warehouses.map((warehouse) => (
                      <option key={warehouse.id} value={warehouse.id}>
                        {warehouse.code} — {warehouse.name}
                      </option>
                    ))}
                  </Select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-foreground">
                    Kho đích *
                  </label>
                  <Select
                    aria-label="Kho đích"
                    required
                    value={form.toWarehouseId}
                    onChange={(event) =>
                      setForm({ ...form, toWarehouseId: event.target.value })
                    }
                    className="h-9 text-xs"
                  >
                    <option value="">Chọn kho nhập</option>
                    {destinations.map((warehouse) => (
                      <option key={warehouse.id} value={warehouse.id}>
                        {warehouse.code} — {warehouse.name}
                      </option>
                    ))}
                  </Select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-foreground">
                    Vật tư chuyển *
                  </label>
                  <Select
                    aria-label="Mặt hàng"
                    required
                    value={form.itemId}
                    onChange={(event) =>
                      setForm({ ...form, itemId: event.target.value, lotId: "" })
                    }
                    className="h-9 text-xs"
                  >
                    <option value="">Chọn vật tư</option>
                    {items.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.code} — {item.name} ({item.trackingMode === "LOT" ? "Theo lô" : "Số lượng"})
                      </option>
                    ))}
                  </Select>
                </div>

                {selectedItem?.trackingMode === "LOT" ? (
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-foreground">
                      Lô hàng xuất *
                    </label>
                    <WarehouseLotSelect
                      farmId={selectedFarmId}
                      warehouseId={form.fromWarehouseId}
                      itemId={form.itemId}
                      value={form.lotId}
                      onChange={(lotId) => setForm({ ...form, lotId })}
                      inStockOnly
                    />
                  </div>
                ) : (
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-foreground">
                      Số lượng chuyển *
                    </label>
                    <Input
                      required
                      pattern="^(0|[1-9][0-9]{0,14})([.][0-9]{1,3})?$"
                      value={form.quantity}
                      onChange={(event) =>
                        setForm({ ...form, quantity: event.target.value })
                      }
                      aria-label="Số lượng"
                      placeholder="Số lượng"
                      className="h-9 text-xs tabular-nums font-medium"
                    />
                  </div>
                )}

                {selectedItem?.trackingMode === "LOT" && (
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-foreground">
                      Số lượng chuyển *
                    </label>
                    <Input
                      required
                      pattern="^(0|[1-9][0-9]{0,14})([.][0-9]{1,3})?$"
                      value={form.quantity}
                      onChange={(event) =>
                        setForm({ ...form, quantity: event.target.value })
                      }
                      aria-label="Số lượng"
                      placeholder="Số lượng"
                      className="h-9 text-xs tabular-nums font-medium"
                    />
                  </div>
                )}

                <div className={selectedItem?.trackingMode === "LOT" ? "sm:col-span-2" : "sm:col-span-2"}>
                  <label className="mb-1 block text-xs font-semibold text-foreground">
                    Ghi chú
                  </label>
                  <Input
                    value={form.note}
                    onChange={(event) =>
                      setForm({ ...form, note: event.target.value })
                    }
                    aria-label="Ghi chú"
                    placeholder="Lý do điều chuyển, ghi chú tài xế..."
                    className="h-9 text-xs"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-border pt-3">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Info className="size-4 shrink-0 text-primary" aria-hidden="true" />
                  <span>
                    Tài sản (ASSET) được chuyển kho từ hồ sơ từng tài sản để giữ đúng vị trí.{" "}
                    <Link href="/assets" className="text-primary underline">
                      Mở hồ sơ tài sản
                    </Link>.
                  </span>
                </div>

                <Button
                  disabled={
                    saving ||
                    lock.locked ||
                    !form.fromWarehouseId ||
                    !form.toWarehouseId ||
                    !form.itemId ||
                    (selectedItem?.trackingMode === "LOT" && !form.lotId)
                  }
                  type="submit"
                  className="h-9 self-end px-5 text-xs font-semibold shadow-xs"
                >
                  {saving ? "Đang tạo..." : "Tạo phiếu nháp"}
                </Button>
              </div>
            </form>
          )}
        </section>
      )}

      {error && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-xs font-medium text-destructive"
        >
          <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {actionError && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-xs font-medium text-destructive"
        >
          <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
          <span>{actionError}</span>
        </div>
      )}

      {receiving && (
        <TransferReceivePanel
          key={`receive-${receiving.id}`}
          farmId={selectedFarmId}
          id={receiving.id}
          code={documentCodeLabel(receiving.transferCode, receiving.id, "CK")}
          lock={lock}
          onReceived={() => {
            setReceiving(null);
            reloadList();
          }}
          onClose={() => setReceiving(null)}
        />
      )}

      {resolving && (
        <TransferResolvePanel
          key={resolving.id}
          farmId={selectedFarmId}
          id={resolving.id}
          code={documentCodeLabel(resolving.transferCode, resolving.id, "CK")}
          lock={lock}
          onResolved={() => {
            setResolving(null);
            reloadList();
          }}
          onClose={() => setResolving(null)}
        />
      )}

      {openId && (
        <StockDocumentLines
          key={`lines-${openId}`}
          revision={revision}
          kind="stock-transfers"
          farmId={selectedFarmId}
          id={openId}
          viewer={viewer}
          items={items}
          lock={lock}
          onChanged={reloadList}
          onError={setActionError}
          onClose={() => setOpenId(null)}
        />
      )}

      {/* Transfers List Section */}
      <section className="overflow-hidden rounded-xl border border-border bg-card shadow-2xs">
        {/* Header & Filter Controls */}
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Danh sách phiếu điều chuyển</h2>
            <p className="text-xs text-muted-foreground">{totalItems} phiếu trong hệ thống</p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Quick Search */}
            <div className="relative min-w-[14rem]">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <input
                type="text"
                placeholder="Tìm mã, kho nguồn, đích..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8.5 w-full rounded-lg border border-input bg-card pl-8.5 pr-8 text-xs font-normal text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  aria-label="Xóa tìm kiếm"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3" aria-hidden="true" />
                </button>
              )}
            </div>

            {/* Status Selector */}
            <div className="w-40">
              <Select
                aria-label="Trạng thái phiếu"
                value={status}
                onChange={(event) => {
                  setPage(1);
                  setStatus(event.target.value as typeof status);
                }}
                className="h-8.5 text-xs font-medium"
              >
                <option value="ALL">Tất cả trạng thái</option>
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>

            {(status !== "ALL" || searchQuery) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setStatus("ALL");
                  setSearchQuery("");
                }}
                className="h-8.5 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
              >
                <RotateCcw className="size-3" aria-hidden="true" />
                <span>Đặt lại</span>
              </Button>
            )}
          </div>
        </div>

        {loading || (!error && loadedFarmId !== selectedFarmId) ? (
          <BeeLoader label="Đang tải danh sách phiếu điều chuyển..." />
        ) : displayedTransfers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Truck className="size-10 text-muted-foreground/40" aria-hidden="true" />
            <p className="mt-3 text-xs font-medium text-muted-foreground">
              {searchQuery || status !== "ALL"
                ? "Không tìm thấy phiếu điều chuyển phù hợp với bộ lọc."
                : "Chưa có phiếu điều chuyển nào trong trang trại."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {displayedTransfers.map((transfer) => {
              const actions = stockDocumentActions(viewer, transfer);
              const statusCfg = STATUS_CONFIG[transfer.status] ?? {
                label: STATUS_LABELS[transfer.status] ?? transfer.status,
                dotClass: "bg-zinc-400",
                badgeClass: "bg-muted text-muted-foreground border-border",
              };
              const code = documentCodeLabel(transfer.transferCode, transfer.id, "CK");

              return (
                <article
                  key={transfer.id}
                  className="flex flex-col gap-3 p-4 transition-colors hover:bg-muted/20 sm:p-5 lg:flex-row lg:items-center lg:justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold text-foreground">
                        {code}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[0.6875rem] font-medium ${statusCfg.badgeClass}`}
                      >
                        <span
                          className={`size-1.5 shrink-0 rounded-full ${statusCfg.dotClass}`}
                          aria-hidden="true"
                        />
                        {statusCfg.label}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-foreground">
                      <span className="font-medium text-foreground">
                        {warehouseName(destinations, transfer.fromWarehouseId)}
                      </span>
                      <ArrowRight className="size-3 text-muted-foreground" aria-hidden="true" />
                      <span className="font-medium text-foreground">
                        {warehouseName(destinations, transfer.toWarehouseId)}
                      </span>
                      <span className="text-muted-foreground">·</span>
                      <span className="tabular-nums text-muted-foreground">
                        {transfer.transferDate ? transfer.transferDate.split("-").reverse().join("/") : "—"}
                      </span>
                    </div>

                    {transfer.externalReference && (
                      <p className="text-[0.6875rem] text-muted-foreground">
                        Chứng từ giấy: <span className="font-mono">{transfer.externalReference}</span>
                      </p>
                    )}
                    {transfer.requestedCode && !transfer.transferCode && (
                      <p className="text-[0.6875rem] text-muted-foreground">
                        Mã yêu cầu: <span className="font-mono">{transfer.requestedCode}</span>
                      </p>
                    )}
                    {transfer.note && (
                      <p className="text-xs text-muted-foreground italic">
                        &quot;{transfer.note}&quot;
                      </p>
                    )}
                    {transfer.status === "REJECTED" && transfer.rejectionReason && (
                      <p className="text-xs font-medium text-destructive">
                        Lý do từ chối: {transfer.rejectionReason}
                      </p>
                    )}
                  </div>

                  {/* Actions Group */}
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={lock.locked}
                      onClick={() => {
                        if (!lock.locked) {
                          setReceiving(null);
                          setOpenId(transfer.id);
                        }
                      }}
                      className="h-8 gap-1 text-xs font-medium"
                    >
                      <Eye className="size-3.5" aria-hidden="true" />
                      <span>Xem dòng hàng</span>
                    </Button>

                    {actions.confirm && (
                      <Button
                        size="sm"
                        disabled={lock.locked}
                        onClick={() => void changeTransfer(transfer.id, "confirm")}
                        className="h-8 gap-1 text-xs font-medium shadow-xs"
                      >
                        <Check className="size-3.5" aria-hidden="true" />
                        <span>Xác nhận xuất</span>
                      </Button>
                    )}

                    {canReceiveTransfer(viewer.roles, transfer) && (
                      <Button
                        size="sm"
                        disabled={lock.locked}
                        onClick={() => {
                          setOpenId(null);
                          setReceiving(transfer);
                        }}
                        className="h-8 gap-1 bg-sky-600 text-xs font-medium text-white shadow-xs hover:bg-sky-700 dark:bg-sky-500"
                      >
                        <PackageCheck className="size-3.5" aria-hidden="true" />
                        <span>Nhận hàng</span>
                      </Button>
                    )}

                    {canResolveTransfer(viewer.roles, transfer) && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={lock.locked}
                        onClick={() => setResolving(transfer)}
                        className="h-8 gap-1 border-amber-500/40 text-xs font-medium text-amber-700 hover:bg-amber-500/10 dark:text-amber-400"
                      >
                        <AlertTriangle className="size-3.5" aria-hidden="true" />
                        <span>Xử lý chênh lệch</span>
                      </Button>
                    )}

                    {actions.cancel && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={lock.locked}
                        onClick={() => void changeTransfer(transfer.id, "cancel")}
                        className="h-8 text-xs font-medium text-muted-foreground hover:text-destructive"
                      >
                        Hủy
                      </Button>
                    )}

                    <StockDocumentReview
                      kind="stock-transfers"
                      farmId={selectedFarmId}
                      id={transfer.id}
                      code={code}
                      canSubmit={actions.submit}
                      canReject={actions.reject}
                      lock={lock}
                      onChanged={reloadList}
                      onError={setActionError}
                    />
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {/* Pagination Navigation */}
        <div className="flex items-center justify-between border-t border-border p-4 text-xs font-medium sm:p-5">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1 || loading}
            onClick={() => setPage((value) => value - 1)}
            className="h-8 text-xs"
          >
            Trang trước
          </Button>
          <span className="text-muted-foreground">
            Trang {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages || loading}
            onClick={() => setPage((value) => value + 1)}
            className="h-8 text-xs"
          >
            Trang sau
          </Button>
        </div>
      </section>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useAuthContext, useAuthenticatedRequest } from "@/features/auth";
import { formatInventoryQuantity } from "@/features/inventory/inventory.logic";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { BeeLoader } from "@/shared/components/ui/bee-loader";
import { ErrorAlert } from "@/shared/components/ui/error-alert";
import { Input } from "@/shared/components/ui/input";
import { cn } from "@/shared/lib/utils";
import { Search, Warehouse } from "lucide-react";
import { PageHeader } from "@/shared/components/ui/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { getStoreSalesStock } from "../api/store-admin.api";
import {
  salesStockState,
  storeAdminError,
  storeRegionLabels,
  summarizeSalesStock,
  type SalesStockState,
} from "../store-admin.logic";
import type { StoreSalesStock } from "../types/store-admin";
import { receiptPresetHref } from "@/features/receipts/components/receipt-draft.logic";
import { useRouter } from "next/navigation";

/** Staff-only view of the sales warehouse; customers only ever see labels. */
export function StoreSalesStockScreen() {
  const { selectedFarmId } = useAuthContext();
  const request = useAuthenticatedRequest();
  const [stock, setStock] = useState<{
    farmId: string;
    data: StoreSalesStock;
  }>();
  // Keyed by farm, so another farm's failure never hides this one's data.
  const [error, setError] = useState<{ farmId: string; message: string }>();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"ALL" | SalesStockState>("ALL");
  const router = useRouter();

  useEffect(() => {
    if (!selectedFarmId) return;
    let cancelled = false;
    getStoreSalesStock(request, selectedFarmId)
      .then((response) => {
        if (cancelled) return;
        setError((old) => (old?.farmId === selectedFarmId ? undefined : old));
        setStock({ farmId: selectedFarmId, data: response.data });
      })
      .catch(
        (failure) =>
          !cancelled &&
          setError({
            farmId: selectedFarmId,
            message: storeAdminError(failure),
          }),
      );
    return () => {
      cancelled = true;
    };
  }, [request, selectedFarmId]);

  if (error?.farmId === selectedFarmId)
    return <ErrorAlert message={error.message} />;
  if (!stock || stock.farmId !== selectedFarmId)
    return <BeeLoader label="Đang tải tồn bán hàng…" />;

  const { salesWarehouse, salesEnabled, regions, rows } = stock.data;
  const keyword = query.trim().toLowerCase();
  const summary = summarizeSalesStock(rows);
  const visible = rows.filter(
    (row) =>
      (filter === "ALL" || salesStockState(row) === filter) &&
      [row.productName, row.variantName, row.itemCode, row.itemName].some(
        (text) => text.toLowerCase().includes(keyword),
      ),
  );
  const tabs: { key: "ALL" | SalesStockState; label: string; count: number }[] = [
    { key: "ALL", label: "Tất cả", count: summary.total },
    { key: "ON", label: "Đang bán", count: summary.ON },
    { key: "OUT", label: "Hết hàng", count: summary.OUT },
    { key: "OFF", label: "Không bán", count: summary.OFF },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Tồn bán hàng"
        description="Tồn của kho bán hàng theo từng quy cách sản phẩm."
      />
      {!salesWarehouse ? (
        <ErrorAlert message="Chưa cấu hình kho bán hàng. Vào Sản phẩm cửa hàng để chọn kho bán." />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
              <Warehouse className="size-4 text-muted-foreground" aria-hidden="true" />
              {salesWarehouse.code} – {salesWarehouse.name}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span
                className={cn(
                  "size-2 rounded-full",
                  salesEnabled ? "bg-success" : "bg-muted-foreground",
                )}
                aria-hidden="true"
              />
              {salesEnabled
                ? `Đang bán tới ${regions.map((r) => storeRegionLabels[r]).join(", ")}`
                : "Đang tắt bán online"}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Quy cách bán", value: summary.total, tone: "" },
              { label: "Đang bán", value: summary.ON, tone: "text-success" },
              {
                label: "Hết hàng",
                value: summary.OUT,
                tone: summary.OUT > 0 ? "text-destructive" : "",
              },
              {
                label: "Đang giữ chỗ",
                value: summary.held,
                tone: summary.held > 0 ? "text-warning" : "",
              },
            ].map((card) => (
              <div
                key={card.label}
                className="rounded-xl border border-border bg-card px-4 py-3 shadow-2xs"
              >
                <p className="text-xs font-medium text-muted-foreground">{card.label}</p>
                <p className={cn("mt-1 text-2xl font-semibold tabular-nums", card.tone)}>
                  {card.value}
                </p>
              </div>
            ))}
          </div>

          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-2xs">
            <div className="flex flex-col gap-3 border-b border-border p-3 sm:flex-row sm:items-center sm:justify-between">
              <div
                role="tablist"
                aria-label="Lọc theo trạng thái bán"
                className="flex flex-wrap gap-1"
              >
                {tabs.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    role="tab"
                    aria-selected={filter === tab.key}
                    onClick={() => setFilter(tab.key)}
                    className={cn(
                      "inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors",
                      filter === tab.key
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    {tab.label}
                    <span className="tabular-nums opacity-80">{tab.count}</span>
                  </button>
                ))}
              </div>
              <div className="relative w-full sm:w-72">
                <Search
                  className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Tìm sản phẩm, quy cách, mã vật tư"
                  aria-label="Tìm trong tồn bán hàng"
                  className="h-8 pl-8 text-sm"
                />
              </div>
            </div>

            <Table className="min-w-[860px]">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  {["Sản phẩm / quy cách", "Vật tư"].map((label) => (
                    <TableHead key={label} className={headClass}>
                      {label}
                    </TableHead>
                  ))}
                  {["Tồn vật lý", "Đang giữ", "Khả dụng"].map((label) => (
                    <TableHead key={label} className={cn(headClass, "text-right")}>
                      {label}
                    </TableHead>
                  ))}
                  <TableHead className={headClass}>Trạng thái bán</TableHead>
                  <TableHead className={cn(headClass, "text-right")}>Nhập hàng</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                      {rows.length === 0
                        ? "Trại chưa gắn vật tư nào vào quy cách bán."
                        : "Không có dòng phù hợp."}
                    </TableCell>
                  </TableRow>
                ) : (
                  visible.map((row) => {
                    const state = salesStockState(row);
                    return (
                      <TableRow key={row.variantId}>
                        <TableCell className="py-3">
                          <p className="font-medium text-foreground">{row.productName}</p>
                          <p className="text-xs text-muted-foreground">{row.variantName}</p>
                        </TableCell>
                        <TableCell className="py-3">
                          <p className="font-mono text-xs text-foreground">{row.itemCode}</p>
                          {row.itemName !== row.productName && (
                            <p className="text-xs text-muted-foreground">{row.itemName}</p>
                          )}
                        </TableCell>
                        <Quantity value={row.onHand} unit={row.unitSymbol} />
                        <Quantity value={row.held} unit={row.unitSymbol} tone="held" />
                        <Quantity
                          value={row.available}
                          unit={row.unitSymbol}
                          tone={state === "OUT" ? "out" : "strong"}
                        />
                        <TableCell className="py-3">
                          <Badge
                            variant={
                              state === "ON"
                                ? "success"
                                : state === "OUT"
                                  ? "destructive"
                                  : "secondary"
                            }
                          >
                            {state === "ON" ? "Đang bán" : state === "OUT" ? "Hết hàng" : "Không bán"}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-3 text-right">
                          <Button
                            size="sm"
                            variant={state === "OUT" ? "default" : "outline"}
                            onClick={() =>
                              router.push(
                                receiptPresetHref({
                                  warehouse: {
                                    id: salesWarehouse.id,
                                    label: `${salesWarehouse.code} – ${salesWarehouse.name}`,
                                  },
                                  ...(row.trackingMode !== "ASSET" && {
                                    item: {
                                      id: row.itemId,
                                      label: `${row.itemCode} — ${row.itemName} (${row.unitSymbol})`,
                                      trackingMode: row.trackingMode,
                                    },
                                  }),
                                }),
                              )
                            }
                          >
                            Nhập thêm
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
            <p className="border-t border-border bg-muted/30 px-4 py-2.5 text-xs text-muted-foreground">
              Khả dụng = Tồn vật lý − Đang giữ (phiếu xuất chưa duyệt). Kho nguồn được
              chuyển vào kho bán khi xác nhận đơn thiếu hàng. Nhập thêm mở phiếu nhập
              cho kho bán; tồn tăng sau khi kho duyệt.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

const headClass =
  "h-10 text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground";

function Quantity({
  value,
  unit,
  tone,
}: {
  value: string;
  unit: string;
  tone?: "held" | "strong" | "out";
}) {
  const zero = !(Number(value) > 0);
  return (
    <TableCell
      className={cn(
        "py-3 text-right tabular-nums",
        zero && tone !== "out" ? "text-muted-foreground" : "text-foreground",
        tone === "strong" && !zero && "font-semibold",
        tone === "out" && "font-semibold text-destructive",
        tone === "held" && !zero && "font-medium text-warning",
      )}
    >
      {formatInventoryQuantity(value)}
      <span className="ml-1 text-xs font-normal text-muted-foreground">{unit}</span>
    </TableCell>
  );
}

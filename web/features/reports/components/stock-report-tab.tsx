"use client";

import { Download } from "lucide-react";
import { Fragment, useEffect, useMemo, useState } from "react";
import { useAuthenticatedRequest } from "@/features/auth";
import { Badge } from "@/shared/components/ui/badge";
import { BeeLoader } from "@/shared/components/ui/bee-loader";
import { Button } from "@/shared/components/ui/button";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { ErrorAlert } from "@/shared/components/ui/error-alert";
import { Input } from "@/shared/components/ui/input";
import { Select } from "@/shared/components/ui/select";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/shared/components/ui/table";
import { getStockReport } from "../api/reports.api";
import { formatVnd, reportErrorMessage } from "../reports.logic";
import {
  ITEM_TYPE_LABELS,
  STOCK_COLUMNS,
  STOCK_COLUMN_LABELS,
  formatQuantity,
  formatSignedQuantity,
  stockReportCsv,
  stockReportView,
  type StockColumn,
  type StockReportFilters,
} from "../stock-report.logic";
import type { ItemType, StockReport } from "../types/reports";

type Query = { dateFrom: string; dateTo: string; warehouseId: string };
const SIGNED = new Set<StockColumn>(["transfer", "asset"]);
const MOVEMENTS = new Set<StockColumn>(["inbound", "outbound", "transfer", "asset"]);

export function StockReportTab({
  farmId,
  farmName,
  warehouseName,
  query,
}: {
  farmId: string;
  farmName: string;
  warehouseName: string;
  query: Query;
}) {
  const request = useAuthenticatedRequest();
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ query: Query; data?: StockReport; error?: string } | null>(null);
  const [filters, setFilters] = useState<StockReportFilters>({ search: "", itemType: "" });

  useEffect(() => {
    let cancelled = false;
    void getStockReport(request, { farmId, ...query })
      .then(({ data }) => !cancelled && setResult({ query, data }))
      .catch((error: unknown) => !cancelled && setResult({ query, error: reportErrorMessage(error) }));
    return () => {
      cancelled = true;
    };
  }, [request, farmId, query, attempt]);

  const current = result?.query === query ? result : null;
  const view = useMemo(() => (current?.data ? stockReportView(current.data.rows, filters) : null), [current, filters]);

  function download() {
    if (!view) return;
    const applied = [
      filters.itemType && `Loại: ${ITEM_TYPE_LABELS[filters.itemType]}`,
      filters.search.trim() && `Tìm: ${filters.search.trim()}`,
    ].filter(Boolean);
    const csv = stockReportCsv(view, {
      farmName,
      warehouseName,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      filters: applied.length ? applied.join(", ") : null,
    });
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `nhap-xuat-ton_${query.dateFrom}_${query.dateTo}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  if (!current) return <BeeLoader label="Đang tải báo cáo…" />;
  if (current.error) return <ErrorAlert message={current.error} onRetry={() => setAttempt((value) => value + 1)} />;
  if (!view) return null;
  const lineCount = view.groups.reduce((sum, group) => sum + group.lines.length, 0);

  return (
    <section className="space-y-4 rounded-xl border bg-card p-5">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-56 flex-1 flex-col gap-1 text-sm font-medium">
          Tìm vật tư
          <Input
            type="search"
            value={filters.search}
            placeholder="Tên hoặc mã"
            onChange={(event) => setFilters((value) => ({ ...value, search: event.target.value }))}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Loại
          <Select
            value={filters.itemType}
            className="w-44"
            onChange={(event) => setFilters((value) => ({ ...value, itemType: event.target.value as ItemType | "" }))}
          >
            <option value="">Tất cả loại</option>
            {(Object.keys(ITEM_TYPE_LABELS) as ItemType[]).map((type) => (
              <option key={type} value={type}>
                {ITEM_TYPE_LABELS[type]}
              </option>
            ))}
          </Select>
        </label>
        <Button type="button" variant="outline" onClick={download} disabled={lineCount === 0}>
          <Download className="size-4" aria-hidden="true" />
          Tải CSV
        </Button>
      </div>

      {lineCount === 0 ? (
        <EmptyState
          title="Không có dòng nào"
          description={
            current.data?.rows.length
              ? "Không có vật tư khớp bộ lọc."
              : "Không có vật tư nào có tồn hoặc phát sinh trong kỳ."
          }
        />
      ) : (
        <Table className="min-w-[960px]">
          <TableHeader>
            <TableRow>
              <TableHead className="px-3">Vật tư</TableHead>
              <TableHead className="px-3">ĐVT</TableHead>
              {STOCK_COLUMNS.map((column) => (
                <TableHead key={column} className="px-3 text-right">
                  {STOCK_COLUMN_LABELS[column]}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {view.groups.map((group) => (
              <Fragment key={group.warehouseId}>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableCell colSpan={2 + STOCK_COLUMNS.length} className="px-3 py-2 font-semibold">
                    {group.warehouseName}
                  </TableCell>
                </TableRow>
                {group.lines.map((line) => (
                  <TableRow key={line.row.itemId}>
                    <TableCell className="px-3 py-2">
                      <p className="font-medium">{line.row.itemName}</p>
                      <p className="text-xs text-muted-foreground">
                        {line.row.itemCode} · {ITEM_TYPE_LABELS[line.row.itemType]}
                        {line.row.unpriced && (
                          <Badge variant="warning" className="ml-2">
                            chưa có giá
                          </Badge>
                        )}
                      </p>
                    </TableCell>
                    <TableCell className="px-3 py-2 text-muted-foreground">{line.row.unit}</TableCell>
                    {STOCK_COLUMNS.map((column) => (
                      <AmountCell
                        key={column}
                        quantity={line[column].quantity}
                        value={line[column].value}
                        signed={SIGNED.has(column)}
                        dashWhenZero={MOVEMENTS.has(column)}
                      />
                    ))}
                  </TableRow>
                ))}
                {view.groups.length > 1 && (
                  <TotalRow label={`Cộng ${group.warehouseName}`} values={group.subtotal} />
                )}
              </Fragment>
            ))}
          </TableBody>
          <TableFooter>
            <TotalRow label="Tổng cộng (VND)" values={view.total} />
          </TableFooter>
        </Table>
      )}

      <p className="text-xs text-muted-foreground">
        Nhập gồm phiếu nhập và điều chỉnh tăng; xuất gồm phiếu xuất (kể cả vật tư cho bảo trì) và điều chỉnh giảm (kể cả
        tài sản mất, thanh lý). Chuyển kho ± = chuyển đến − chuyển đi. Cấp phát/thu hồi ± = thu hồi và nhận lại sau bảo
        trì − cấp phát và mang đi bảo trì. Giá trị theo giá bình quân gia quyền di động của từng kho; dòng tổng chỉ cộng
        tiền vì các vật tư khác đơn vị.
        {view.unpriced > 0 && ` ${view.unpriced} dòng có hàng chưa có giá: giá trị của các dòng này (và dòng tổng) chỉ gồm phần đã định giá, chưa đầy đủ.`}
      </p>
    </section>
  );
}

function AmountCell({
  quantity,
  value,
  signed,
  dashWhenZero,
}: {
  quantity: number;
  value: number;
  signed: boolean;
  dashWhenZero: boolean;
}) {
  return (
    <TableCell className="px-3 py-2 text-right tabular-nums">
      {dashWhenZero && quantity === 0 && value === 0 ? (
        <span className="text-muted-foreground">—</span>
      ) : (
        <>
          <p>{signed ? formatSignedQuantity(quantity) : formatQuantity(quantity)}</p>
          <p className="text-xs text-muted-foreground">{formatVnd(value)}</p>
        </>
      )}
    </TableCell>
  );
}

function TotalRow({ label, values }: { label: string; values: Record<StockColumn, number> }) {
  return (
    <TableRow className="font-medium">
      <TableCell colSpan={2} className="px-3 py-2">
        {label}
      </TableCell>
      {STOCK_COLUMNS.map((column) => (
        <TableCell key={column} className="px-3 py-2 text-right tabular-nums">
          {formatVnd(values[column])}
        </TableCell>
      ))}
    </TableRow>
  );
}

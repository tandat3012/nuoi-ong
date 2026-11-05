"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuthenticatedRequest, useFarmMembership } from "@/features/auth";
import { getWarehouses, type Warehouse } from "@/features/warehouses";
import { BeeLoader } from "@/shared/components/ui/bee-loader";
import { Button } from "@/shared/components/ui/button";
import { DateRangeFilter } from "@/shared/components/ui/date-range-filter";
import { ErrorAlert } from "@/shared/components/ui/error-alert";
import { PageHeader } from "@/shared/components/ui/page-header";
import { Select } from "@/shared/components/ui/select";
import { getStockTimeseries } from "../api/reports.api";
import {
  GRANULARITY_LABELS,
  REPORT_PRESETS,
  costSeries,
  formatCompactVnd,
  formatVnd,
  periodLabel,
  presetRange,
  rangeError,
  reportErrorMessage,
  reportTotals,
  stockSeries,
  vietnamToday,
  type ReportPreset,
  type StockMode,
} from "../reports.logic";
import type { StockTimeseries } from "../types/reports";
import { ReportBarChart } from "./report-bar-chart";

const COLORS = {
  inbound: "#d97706",
  outbound: "#0284c7",
  purchase: "#d97706",
  labor: "#0891b2",
  material: "#7c3aed",
  other: "#64748b",
};

export function ReportsScreen() {
  const { membership, canManageWarehouse } = useFarmMembership();
  if (!membership || !canManageWarehouse)
    return <ErrorAlert message="Chỉ quản trị viên, chủ trại hoặc quản lý kho mới xem được thống kê." />;
  return (
    <div className="space-y-6">
      <PageHeader title="Thống kê" description={`Nhập – xuất kho và chi phí theo thời gian · ${membership.farm.name}`} />
      <StockReports key={membership.farm.id} farmId={membership.farm.id} />
    </div>
  );
}

type Range = { dateFrom: string; dateTo: string };

function StockReports({ farmId }: { farmId: string }) {
  const request = useAuthenticatedRequest();
  const [preset, setPreset] = useState<ReportPreset | null>("3m");
  const [custom, setCustom] = useState<Range | null>(null);
  const [customError, setCustomError] = useState<string | null>(null);
  const [warehouseId, setWarehouseId] = useState("");
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [mode, setMode] = useState<StockMode>("value");
  const [attempt, setAttempt] = useState(0);
  const range = useMemo(
    () => custom ?? presetRange(preset ?? "3m", vietnamToday()),
    [custom, preset],
  );
  const query = useMemo(() => ({ ...range, warehouseId }), [range, warehouseId]);
  const [result, setResult] = useState<{ query: typeof query; data?: StockTimeseries; error?: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getWarehouses(request, { farmId, page: 1, pageSize: 100 })
      .then(({ data }) => !cancelled && setWarehouses(data))
      .catch(() => !cancelled && setWarehouses([]));
    return () => {
      cancelled = true;
    };
  }, [request, farmId]);

  useEffect(() => {
    let cancelled = false;
    void getStockTimeseries(request, { farmId, ...query })
      .then(({ data }) => !cancelled && setResult({ query, data }))
      .catch((error: unknown) => !cancelled && setResult({ query, error: reportErrorMessage(error) }));
    return () => {
      cancelled = true;
    };
  }, [request, farmId, query, attempt]);

  const current = result?.query === query ? result : null;
  const data = current?.data;
  const labels = data?.periods.map((p) => periodLabel(p.period, data.granularity)) ?? [];
  const totals = data ? reportTotals(data.periods) : null;
  const stock = data ? stockSeries(data.periods, mode) : null;
  const cost = data ? costSeries(data.periods) : null;
  const formatStock = mode === "value" ? formatVnd : (value: number) => `${value} phiếu`;

  return (
    <div className="space-y-6">
      <section aria-label="Bộ lọc" className="space-y-4 rounded-xl border bg-card p-4">
        <div className="flex flex-wrap items-center gap-2">
          {REPORT_PRESETS.map(({ key, label }) => (
            <Button
              key={key}
              type="button"
              variant={!custom && preset === key ? "default" : "outline"}
              aria-pressed={!custom && preset === key}
              onClick={() => {
                setPreset(key);
                setCustom(null);
                setCustomError(null);
              }}
            >
              {label}
            </Button>
          ))}
          <label className="ml-auto flex items-center gap-2 text-sm font-medium">
            Kho
            <Select value={warehouseId} onChange={(event) => setWarehouseId(event.target.value)} className="w-56">
              <option value="">Tất cả kho</option>
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </option>
              ))}
            </Select>
          </label>
        </div>
        <DateRangeFilter
          onApply={({ dateFrom, dateTo }) => {
            if (!dateFrom && !dateTo) {
              setCustom(null);
              setCustomError(null);
              return;
            }
            const error = rangeError(dateFrom, dateTo);
            setCustomError(error);
            if (!error) setCustom({ dateFrom, dateTo });
          }}
        />
        {customError && (
          <p role="alert" className="text-sm text-destructive">
            {customError}
          </p>
        )}
        <p className="text-sm text-muted-foreground">
          {formatDay(range.dateFrom)} – {formatDay(range.dateTo)}
          {data && `, ${GRANULARITY_LABELS[data.granularity]}`} · giờ Việt Nam
        </p>
      </section>

      {!current && <BeeLoader label="Đang tải thống kê…" />}
      {current?.error && <ErrorAlert message={current.error} onRetry={() => setAttempt((value) => value + 1)} />}
      {data && totals && stock && cost && (
        <>
          <section aria-label="Tổng trong kỳ" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric label="Giá trị nhập" value={formatVnd(totals.inboundValue)} note={`${totals.inboundDocuments} phiếu`} />
            <Metric label="Giá trị xuất" value={formatVnd(totals.outboundValue)} note={`${totals.outboundDocuments} phiếu`} />
            <Metric label="Chi phí mua hàng" value={formatVnd(totals.purchaseCost)} />
            <Metric label="Chi phí bảo trì" value={formatVnd(totals.maintenanceCost)} note={`Tổng chi phí ${formatVnd(totals.totalCost)}`} />
          </section>

          <section className="space-y-3 rounded-xl border bg-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-semibold">Nhập – xuất kho</h2>
              <div role="group" aria-label="Đơn vị" className="flex gap-1">
                <Button type="button" variant={mode === "value" ? "default" : "outline"} aria-pressed={mode === "value"} onClick={() => setMode("value")}>
                  Giá trị (VND)
                </Button>
                <Button type="button" variant={mode === "documents" ? "default" : "outline"} aria-pressed={mode === "documents"} onClick={() => setMode("documents")}>
                  Số phiếu
                </Button>
              </div>
            </div>
            <ReportBarChart
              labels={labels}
              series={[
                { label: "Nhập", data: stock.inbound, color: COLORS.inbound },
                { label: "Xuất", data: stock.outbound, color: COLORS.outbound },
              ]}
              formatValue={formatStock}
              formatTick={mode === "value" ? formatCompactVnd : String}
              ariaLabel={`Biểu đồ nhập xuất kho: nhập ${formatStock(mode === "value" ? totals.inboundValue : totals.inboundDocuments)}, xuất ${formatStock(mode === "value" ? totals.outboundValue : totals.outboundDocuments)}`}
            />
            <p className="text-xs text-muted-foreground">
              Nhập gồm phiếu nhập và điều chỉnh tăng; xuất gồm phiếu xuất và điều chỉnh giảm.{" "}
              {warehouseId ? "Đang xem một kho nên tính cả điều chuyển đến/đi." : "Toàn trang trại nên không tính điều chuyển giữa các kho."}{" "}
              Không tính cấp phát, hoàn trả thiết bị. Giá trị theo giá nhập gần nhất tại thời điểm phát sinh.
              {data.unpricedMovements > 0 && ` ${data.unpricedMovements} biến động chưa có giá nhập nên không tính vào giá trị.`}
            </p>
          </section>

          <section className="space-y-3 rounded-xl border bg-card p-5">
            <h2 className="font-semibold">Chi phí theo thời gian</h2>
            <ReportBarChart
              stacked
              labels={labels}
              series={[
                { label: "Mua hàng (phiếu nhập)", data: cost.purchase, color: COLORS.purchase },
                { label: "Bảo trì – nhân công", data: cost.labor, color: COLORS.labor },
                { label: "Bảo trì – vật tư", data: cost.material, color: COLORS.material },
                { label: "Bảo trì – khác", data: cost.other, color: COLORS.other },
              ]}
              formatValue={formatVnd}
              formatTick={formatCompactVnd}
              ariaLabel={`Biểu đồ chi phí: tổng ${formatVnd(totals.totalCost)}`}
            />
            <p className="text-xs text-muted-foreground">
              Mua hàng tính theo ngày duyệt phiếu nhập{warehouseId ? " của kho đã chọn" : ""}. Bảo trì tính theo ngày hoàn thành, luôn cho toàn trang trại.
            </p>
          </section>
        </>
      )}
    </div>
  );
}

function formatDay(date: string) {
  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year}`;
}

function Metric({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
      {note && <p className="mt-1 text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}

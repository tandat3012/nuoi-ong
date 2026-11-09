"use client";

import Link from "next/link";
import { useEffect, useState, useMemo } from "react";
import { useAuthenticatedRequest } from "@/features/auth";
import { Button } from "@/shared/components/ui/button";
import { ErrorAlert } from "@/shared/components/ui/error-alert";
import { DateInput } from "@/shared/components/ui/date-input";
import {
  ORDER_STATUS_LABELS,
  type OrderStatus,
  type StoreOrderStats,
} from "@/features/commerce/orders/types/order";
import { getStoreOrderStats } from "../store-orders.api";
import {
  formatOrderMoney,
  orderErrorMessage,
} from "@/features/commerce/orders/order.logic";
import { BeeLoader } from "@/shared/components/ui/bee-loader";
import {
  TrendingUp,
  ShoppingBag,
  Truck,
  Receipt,
  Calendar,
  RefreshCw,
  Info,
  Award,
  Users,
  PackageOpen,
  ArrowUpRight,
  CalendarDays,
} from "lucide-react";

function hcmDate(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(date);
}

function defaultRange() {
  const today = hcmDate(new Date());
  return { from: `${today.slice(0, 7)}-01`, to: today };
}

function getPresetRange(preset: "today" | "7d" | "30d" | "thisMonth" | "lastMonth") {
  const now = new Date();
  const todayStr = hcmDate(now);
  const [yearStr, monthStr] = todayStr.split("-");
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);

  if (preset === "today") {
    return { from: todayStr, to: todayStr };
  }
  if (preset === "7d") {
    const d = new Date(now);
    d.setDate(d.getDate() - 6);
    return { from: hcmDate(d), to: todayStr };
  }
  if (preset === "30d") {
    const d = new Date(now);
    d.setDate(d.getDate() - 29);
    return { from: hcmDate(d), to: todayStr };
  }
  if (preset === "thisMonth") {
    return { from: `${todayStr.slice(0, 7)}-01`, to: todayStr };
  }
  if (preset === "lastMonth") {
    const lastMonthDate = new Date(year, month - 2, 1);
    const lastMonthStr = hcmDate(lastMonthDate);
    const lastDayLastMonth = new Date(year, month - 1, 0);
    return {
      from: `${lastMonthStr.slice(0, 7)}-01`,
      to: hcmDate(lastDayLastMonth),
    };
  }
  return { from: `${todayStr.slice(0, 7)}-01`, to: todayStr };
}

const STATUS_CONFIG: Record<
  OrderStatus,
  { label: string; dotClass: string; borderClass: string }
> = {
  PENDING: {
    label: "Chờ xác nhận",
    dotClass: "bg-amber-500",
    borderClass: "hover:border-amber-500/40",
  },
  PREPARING: {
    label: "Đang chuẩn bị hàng",
    dotClass: "bg-sky-500",
    borderClass: "hover:border-sky-500/40",
  },
  CONFIRMED: {
    label: "Đã xác nhận",
    dotClass: "bg-blue-500",
    borderClass: "hover:border-blue-500/40",
  },
  SHIPPING: {
    label: "Đang giao hàng",
    dotClass: "bg-purple-500",
    borderClass: "hover:border-purple-500/40",
  },
  COMPLETED: {
    label: "Đã hoàn tất",
    dotClass: "bg-emerald-500",
    borderClass: "hover:border-emerald-500/40",
  },
  CANCELLED: {
    label: "Đã hủy đơn",
    dotClass: "bg-rose-500",
    borderClass: "hover:border-rose-500/40",
  },
  RETURNING: {
    label: "Đang trả về kho",
    dotClass: "bg-orange-500",
    borderClass: "hover:border-orange-500/40",
  },
  RETURNED: {
    label: "Đã trả về kho",
    dotClass: "bg-zinc-400",
    borderClass: "hover:border-zinc-400/40",
  },
};

const ORDERED_STATUSES: OrderStatus[] = [
  "PENDING",
  "CONFIRMED",
  "PREPARING",
  "SHIPPING",
  "COMPLETED",
  "RETURNING",
  "RETURNED",
  "CANCELLED",
];

export function StoreOrderReports({ farmId }: { farmId: string }) {
  const request = useAuthenticatedRequest();
  const [range, setRange] = useState(defaultRange);
  const [attempt, setAttempt] = useState(0);
  const [activePreset, setActivePreset] = useState<string>("thisMonth");
  const [result, setResult] = useState<{
    range: typeof range;
    stats?: StoreOrderStats;
    error?: string;
  } | null>(null);

  const rangeValid = range.from <= range.to;

  useEffect(() => {
    if (!rangeValid) return;
    let cancelled = false;
    void getStoreOrderStats(request, farmId, range.from, range.to)
      .then(({ data }) => {
        if (!cancelled) setResult({ range, stats: data });
      })
      .catch((error: unknown) => {
        if (!cancelled) setResult({ range, error: orderErrorMessage(error) });
      });
    return () => {
      cancelled = true;
    };
  }, [request, farmId, range, rangeValid, attempt]);

  const current = result?.range === range ? result : null;

  const handleApplyPreset = (preset: "today" | "7d" | "30d" | "thisMonth" | "lastMonth") => {
    setActivePreset(preset);
    setRange(getPresetRange(preset));
  };

  const handleCustomDateChange = (from: string, to: string) => {
    setActivePreset("custom");
    setRange({ from, to });
  };

  // Calculations for daily revenue chart
  const { dailyMax, peakDay, totalPeriodRevenue } = useMemo(() => {
    if (!current?.stats?.daily) return { dailyMax: 1, peakDay: null, totalPeriodRevenue: 0 };
    let max = 0;
    let peak: { date: string; revenue: string } | null = null;
    let sum = 0;

    for (const d of current.stats.daily) {
      const val = Number(d.revenue) || 0;
      sum += val;
      if (val > max) {
        max = val;
        peak = d;
      }
    }
    return { dailyMax: Math.max(1, max), peakDay: peak, totalPeriodRevenue: sum };
  }, [current?.stats?.daily]);

  // Total orders count across all statuses
  const totalOrdersCount = useMemo(() => {
    if (!current?.stats?.counts) return 0;
    return Object.values(current.stats.counts).reduce((acc, v) => acc + (v || 0), 0);
  }, [current?.stats?.counts]);

  return (
    <div className="space-y-6">
      {/* Smart Date Range & Preset Filter Card */}
      <section
        aria-label="Khoảng thời gian báo cáo"
        className="min-w-0 rounded-xl border border-border bg-card p-4 sm:p-5 shadow-2xs"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          {/* Quick presets */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-xs font-semibold text-muted-foreground">
              Khoảng thời gian:
            </span>
            {[
              { id: "today", label: "Hôm nay" },
              { id: "7d", label: "7 ngày qua" },
              { id: "30d", label: "30 ngày qua" },
              { id: "thisMonth", label: "Tháng này" },
              { id: "lastMonth", label: "Tháng trước" },
            ].map((p) => (
              <Button
                key={p.id}
                type="button"
                variant={activePreset === p.id ? "default" : "outline"}
                size="sm"
                onClick={() => handleApplyPreset(p.id as any)}
                className={`h-8 px-2.5 text-xs font-medium ${
                  activePreset === p.id
                    ? "shadow-2xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {p.label}
              </Button>
            ))}
          </div>

          {/* Date picker inputs + Reload */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">Từ:</span>
              <DateInput
                value={range.from}
                onValueChange={(value) => handleCustomDateChange(value, range.to)}
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">Đến:</span>
              <DateInput
                value={range.to}
                onValueChange={(value) => handleCustomDateChange(range.from, value)}
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={!rangeValid || !current}
              onClick={() => setAttempt((value) => value + 1)}
              className="h-9 gap-1.5 text-xs font-medium"
            >
              <RefreshCw
                className={`size-3.5 ${!current && rangeValid ? "motion-safe:animate-spin" : ""}`}
                aria-hidden="true"
              />
              <span>Tải lại</span>
            </Button>
          </div>
        </div>

        {!rangeValid && (
          <p role="alert" className="mt-3 text-xs font-medium text-destructive">
            Ngày bắt đầu phải trước hoặc bằng ngày kết thúc. Vui lòng chọn lại khoảng ngày.
          </p>
        )}
      </section>

      {/* Operational Note Banner */}
      <div className="flex items-start gap-2.5 rounded-xl border border-border bg-muted/30 p-3.5 text-xs text-muted-foreground">
        <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
        <p className="leading-relaxed">
          <strong className="font-semibold text-foreground">Quy tắc ghi nhận:</strong> Số lượng đơn được tổng hợp theo ngày khách đặt; doanh thu thực tế, số đơn hoàn tất và các bảng xếp hạng bán chạy được tính chính xác theo ngày hoàn tất giao hàng (giờ Việt Nam UTC+7).
        </p>
      </div>

      {/* Loading & Error States */}
      {!current && rangeValid && <BeeLoader label="Đang tổng hợp số liệu báo cáo bán hàng…" />}

      {current?.error && (
        <ErrorAlert
          message={current.error}
          onRetry={() => setAttempt((value) => value + 1)}
        />
      )}

      {current?.stats && (
        <>
          {/* Executive KPI Summary Grid */}
          <section
            aria-label="Chỉ số bán hàng trọng yếu"
            className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4"
          >
            {/* Revenue */}
            <div className="flex flex-col justify-between rounded-xl border border-border bg-card p-4 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">
                  Doanh thu hoàn tất
                </span>
                <div className="flex size-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <TrendingUp className="size-4" aria-hidden="true" />
                </div>
              </div>
              <div className="mt-3">
                <span className="font-mono text-xl font-bold tabular-nums text-foreground sm:text-2xl">
                  {formatOrderMoney(current.stats.revenue)}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-[0.6875rem] text-muted-foreground">
                <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
                <span>Thực thu từ đơn thành công</span>
              </div>
            </div>

            {/* Completed Orders */}
            <div className="flex flex-col justify-between rounded-xl border border-border bg-card p-4 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">
                  Đơn hàng hoàn tất
                </span>
                <div className="flex size-7 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  <ShoppingBag className="size-4" aria-hidden="true" />
                </div>
              </div>
              <div className="mt-3">
                <span className="font-mono text-xl font-bold tabular-nums text-foreground sm:text-2xl">
                  {current.stats.completedOrders}
                </span>
                <span className="ml-1 text-xs font-normal text-muted-foreground">đơn</span>
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-[0.6875rem] text-muted-foreground">
                <span className="size-1.5 rounded-full bg-blue-500" aria-hidden="true" />
                <span>Giao hàng & thanh toán xong</span>
              </div>
            </div>

            {/* Average Order Value (AOV) */}
            <div className="flex flex-col justify-between rounded-xl border border-border bg-card p-4 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">
                  Giá trị trung bình / đơn
                </span>
                <div className="flex size-7 items-center justify-center rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
                  <Receipt className="size-4" aria-hidden="true" />
                </div>
              </div>
              <div className="mt-3">
                <span className="font-mono text-xl font-bold tabular-nums text-foreground sm:text-2xl">
                  {formatOrderMoney(current.stats.averageOrderValue)}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-[0.6875rem] text-muted-foreground">
                <span className="size-1.5 rounded-full bg-purple-500" aria-hidden="true" />
                <span>AOV đơn hàng hoàn tất</span>
              </div>
            </div>

            {/* Shipping Fees */}
            <div className="flex flex-col justify-between rounded-xl border border-border bg-card p-4 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">
                  Phí giao hàng hoàn tất
                </span>
                <div className="flex size-7 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400">
                  <Truck className="size-4" aria-hidden="true" />
                </div>
              </div>
              <div className="mt-3">
                <span className="font-mono text-xl font-bold tabular-nums text-foreground sm:text-2xl">
                  {formatOrderMoney(current.stats.shippingFees)}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-[0.6875rem] text-muted-foreground">
                <span className="size-1.5 rounded-full bg-sky-500" aria-hidden="true" />
                <span>Tổng cước vận chuyển ghi nhận</span>
              </div>
            </div>
          </section>

          {/* Order Status Breakdown Section */}
          <section
            aria-label="Cơ cấu đơn hàng theo trạng thái"
            className="rounded-xl border border-border bg-card shadow-2xs"
          >
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-foreground">
                  Cơ cấu đơn hàng theo trạng thái
                </h2>
                <span className="rounded-md border border-border bg-muted/60 px-2 py-0.5 text-xs font-semibold tabular-nums text-muted-foreground">
                  Tổng {totalOrdersCount} đơn đặt
                </span>
              </div>
              <Link
                href="/store-orders"
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                <span>Xem danh sách đơn</span>
                <ArrowUpRight className="size-3.5" aria-hidden="true" />
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-4 xl:grid-cols-8">
              {ORDERED_STATUSES.map((status) => {
                const cfg = STATUS_CONFIG[status];
                const count = current.stats!.counts[status] ?? 0;
                const percent = totalOrdersCount > 0
                  ? Math.round((count / totalOrdersCount) * 100)
                  : 0;

                return (
                  <div
                    key={status}
                    className={`flex flex-col justify-between rounded-xl border border-border bg-muted/20 p-3.5 transition-colors ${cfg.borderClass}`}
                  >
                    <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <span className={`size-1.5 shrink-0 rounded-full ${cfg.dotClass}`} aria-hidden="true" />
                      <span className="truncate">{cfg.label}</span>
                    </div>

                    <div className="mt-3 flex items-baseline justify-between">
                      <span className="font-mono text-xl font-bold tabular-nums text-foreground">
                        {count}
                      </span>
                      {count > 0 && (
                        <span className="font-mono text-[0.6875rem] font-medium text-muted-foreground">
                          {percent}%
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Daily Revenue Timeline Breakdown */}
          <section
            aria-label="Doanh thu theo ngày"
            className="rounded-xl border border-border bg-card shadow-2xs"
          >
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div className="flex items-center gap-2">
                <CalendarDays className="size-4 text-primary" aria-hidden="true" />
                <h2 className="text-sm font-semibold text-foreground">
                  Doanh thu theo ngày
                </h2>
              </div>
              {peakDay && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span>Ngày cao nhất:</span>
                  <span className="font-semibold text-foreground">
                    {new Date(`${peakDay.date}T12:00:00+07:00`).toLocaleDateString("vi-VN", {
                      day: "2-digit",
                      month: "2-digit",
                    })}
                  </span>
                  <span className="font-mono font-bold text-primary">
                    ({formatOrderMoney(peakDay.revenue)})
                  </span>
                </div>
              )}
            </div>

            <div className="p-5">
              {current.stats.daily.length > 0 ? (
                <div className="space-y-3">
                  {current.stats.daily.map((row) => {
                    const rowRev = Number(row.revenue) || 0;
                    const percent = Math.max(1, (rowRev / dailyMax) * 100);
                    const isPeak = peakDay && row.date === peakDay.date && rowRev > 0;

                    return (
                      <div
                        key={row.date}
                        className="group grid grid-cols-[4.5rem_1fr_auto] items-center gap-3 text-xs sm:grid-cols-[5.5rem_1fr_auto]"
                      >
                        <span className="font-mono font-medium text-muted-foreground group-hover:text-foreground">
                          {new Date(`${row.date}T12:00:00+07:00`).toLocaleDateString("vi-VN", {
                            day: "2-digit",
                            month: "2-digit",
                          })}
                        </span>

                        <div
                          aria-hidden="true"
                          className="h-3 overflow-hidden rounded-full bg-muted/60 p-0.5"
                        >
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              isPeak ? "bg-amber-500" : "bg-primary"
                            }`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>

                        <div className="flex items-center gap-2 text-right">
                          {isPeak && (
                            <span className="hidden rounded-sm bg-amber-500/10 px-1.5 py-0.5 text-[0.625rem] font-bold text-amber-700 dark:text-amber-400 sm:inline-block">
                              Đỉnh
                            </span>
                          )}
                          <span className="min-w-[5.5rem] font-mono font-semibold tabular-nums text-foreground">
                            {formatOrderMoney(row.revenue)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  Không có doanh thu hoàn tất trong khoảng thời gian đã chọn.
                </div>
              )}
            </div>
          </section>

          {/* Top Rankings: Products & Customers */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Top Products */}
            <section
              aria-label="Sản phẩm bán chạy"
              className="overflow-hidden rounded-xl border border-border bg-card shadow-2xs"
            >
              <div className="flex items-center justify-between border-b border-border px-5 py-4">
                <div className="flex items-center gap-2">
                  <Award className="size-4 text-primary" aria-hidden="true" />
                  <h2 className="text-sm font-semibold text-foreground">
                    Sản phẩm bán chạy
                  </h2>
                </div>
                <span className="text-xs text-muted-foreground">Theo doanh thu hoàn tất</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[380px] text-left text-xs">
                  <thead className="border-b border-border bg-muted/40 uppercase tracking-wider text-[0.6875rem] font-semibold text-muted-foreground">
                    <tr>
                      <th className="w-12 px-4 py-3 text-center">Hạng</th>
                      <th className="px-4 py-3">Sản phẩm</th>
                      <th className="w-24 px-4 py-3 text-right">Số lượng</th>
                      <th className="w-32 px-4 py-3 text-right">Doanh thu</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {current.stats.topProducts.map((item, idx) => (
                      <tr
                        key={item.productId}
                        className="transition-colors hover:bg-muted/30"
                      >
                        <td className="px-4 py-3 text-center">
                          {renderRankBadge(idx + 1)}
                        </td>
                        <td className="px-4 py-3 font-medium text-foreground">
                          {item.name}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-semibold tabular-nums text-foreground">
                          {item.quantity}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold tabular-nums text-foreground">
                          {formatOrderMoney(item.revenue)}
                        </td>
                      </tr>
                    ))}

                    {!current.stats.topProducts.length && (
                      <tr>
                        <td colSpan={4} className="py-12 text-center text-muted-foreground">
                          <PackageOpen className="mx-auto size-7 text-muted-foreground/40 mb-1.5" />
                          <span>Chưa có dữ liệu sản phẩm trong khoảng này.</span>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Top Customers */}
            <section
              aria-label="Khách hàng mua nhiều"
              className="overflow-hidden rounded-xl border border-border bg-card shadow-2xs"
            >
              <div className="flex items-center justify-between border-b border-border px-5 py-4">
                <div className="flex items-center gap-2">
                  <Users className="size-4 text-primary" aria-hidden="true" />
                  <h2 className="text-sm font-semibold text-foreground">
                    Khách hàng mua nhiều
                  </h2>
                </div>
                <span className="text-xs text-muted-foreground">Khách hàng chi tiêu cao nhất</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[380px] text-left text-xs">
                  <thead className="border-b border-border bg-muted/40 uppercase tracking-wider text-[0.6875rem] font-semibold text-muted-foreground">
                    <tr>
                      <th className="w-12 px-4 py-3 text-center">Hạng</th>
                      <th className="px-4 py-3">Khách hàng</th>
                      <th className="w-20 px-4 py-3 text-right">Đơn</th>
                      <th className="w-32 px-4 py-3 text-right">Tổng chi tiêu</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {current.stats.topCustomers.map((customer, idx) => (
                      <tr
                        key={customer.userId}
                        className="transition-colors hover:bg-muted/30"
                      >
                        <td className="px-4 py-3 text-center">
                          {renderRankBadge(idx + 1)}
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            className="font-medium text-foreground transition-colors hover:text-primary hover:underline"
                            href={`/store-orders/customers/${encodeURIComponent(customer.userId)}`}
                          >
                            {customer.name || customer.email}
                          </Link>
                          {customer.name && (
                            <p className="break-all font-mono text-[0.6875rem] text-muted-foreground mt-0.5">
                              {customer.email}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-semibold tabular-nums text-foreground">
                          {customer.orderCount}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold tabular-nums text-foreground">
                          {formatOrderMoney(customer.revenue)}
                        </td>
                      </tr>
                    ))}

                    {!current.stats.topCustomers.length && (
                      <tr>
                        <td colSpan={4} className="py-12 text-center text-muted-foreground">
                          <Users className="mx-auto size-7 text-muted-foreground/40 mb-1.5" />
                          <span>Chưa có dữ liệu khách hàng trong khoảng này.</span>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}

function renderRankBadge(rank: number) {
  if (rank === 1) {
    return (
      <span className="inline-flex size-5.5 items-center justify-center rounded-full border border-amber-500/30 bg-amber-500/15 font-mono text-[0.6875rem] font-bold text-amber-700 dark:text-amber-400">
        1
      </span>
    );
  }
  if (rank === 2) {
    return (
      <span className="inline-flex size-5.5 items-center justify-center rounded-full border border-slate-400/30 bg-slate-400/15 font-mono text-[0.6875rem] font-bold text-slate-700 dark:text-slate-300">
        2
      </span>
    );
  }
  if (rank === 3) {
    return (
      <span className="inline-flex size-5.5 items-center justify-center rounded-full border border-amber-700/30 bg-amber-700/15 font-mono text-[0.6875rem] font-bold text-amber-800 dark:text-amber-600">
        3
      </span>
    );
  }
  return (
    <span className="inline-flex size-5.5 items-center justify-center rounded-full border border-border bg-muted/60 font-mono text-[0.6875rem] font-medium text-muted-foreground">
      {rank}
    </span>
  );
}

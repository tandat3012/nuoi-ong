"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuthenticatedRequest } from "@/features/auth";
import { Button } from "@/shared/components/ui/button";
import { ErrorAlert } from "@/shared/components/ui/error-alert";
import { Input } from "@/shared/components/ui/input";
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

function hcmDate(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(date);
}

function defaultRange() {
  const today = hcmDate(new Date());
  return { from: `${today.slice(0, 7)}-01`, to: today };
}

export function StoreOrderReports({ farmId }: { farmId: string }) {
  const request = useAuthenticatedRequest();
  const [range, setRange] = useState(defaultRange);
  const [attempt, setAttempt] = useState(0);
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
  const dailyMax = Math.max(
    1,
    ...(current?.stats?.daily.map((row) => Number(row.revenue)) ?? []),
  );
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4">
        <label className="space-y-1 text-sm">
          <span>Từ ngày</span>
          <Input
            type="date"
            value={range.from}
            onChange={(event) =>
              setRange((value) => ({ ...value, from: event.target.value }))
            }
          />
        </label>
        <label className="space-y-1 text-sm">
          <span>Đến ngày</span>
          <Input
            type="date"
            value={range.to}
            onChange={(event) =>
              setRange((value) => ({ ...value, to: event.target.value }))
            }
          />
        </label>
        <Button
          variant="outline"
          disabled={!rangeValid}
          onClick={() => setAttempt((value) => value + 1)}
        >
          Tải lại
        </Button>
        {!rangeValid && (
          <p role="alert" className="text-sm text-destructive">
            Ngày bắt đầu phải trước ngày kết thúc.
          </p>
        )}
      </div>
      {!current && rangeValid && <p role="status">Đang tải báo cáo…</p>}
      {current?.error && (
        <ErrorAlert
          message={current.error}
          onRetry={() => setAttempt((value) => value + 1)}
        />
      )}
      {current?.stats && (
        <>
          <p className="text-sm text-muted-foreground">
            Số lượng đơn được lọc theo ngày đặt; doanh thu, đơn hoàn tất và bảng
            xếp hạng tính theo ngày hoàn tất (giờ Việt Nam).
          </p>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric
              label="Doanh thu đơn hoàn tất"
              value={formatOrderMoney(current.stats.revenue)}
            />
            <Metric
              label="Phí giao hàng đơn hoàn tất"
              value={formatOrderMoney(current.stats.shippingFees)}
            />
            <Metric
              label="Đơn hoàn tất"
              value={String(current.stats.completedOrders)}
            />
            <Metric
              label="Giá trị trung bình"
              value={formatOrderMoney(current.stats.averageOrderValue)}
            />
          </section>
          <section className="rounded-xl border bg-card p-5">
            <h2 className="font-semibold">Số đơn theo trạng thái</h2>
            <dl className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              {(Object.keys(ORDER_STATUS_LABELS) as OrderStatus[]).map(
                (status) => (
                  <div key={status} className="rounded-lg bg-muted/50 p-3">
                    <dt className="text-sm text-muted-foreground">
                      {ORDER_STATUS_LABELS[status]}
                    </dt>
                    <dd className="mt-1 text-xl font-semibold">
                      {current.stats!.counts[status] ?? 0}
                    </dd>
                  </div>
                ),
              )}
            </dl>
          </section>
          <section className="space-y-3 rounded-xl border bg-card p-5">
            <h2 className="font-semibold">Doanh thu theo ngày</h2>
            {current.stats.daily.length ? (
              <div className="space-y-2">
                {current.stats.daily.map((row) => (
                  <div
                    key={row.date}
                    className="grid grid-cols-[5rem_1fr_auto] items-center gap-3 text-sm"
                  >
                    <span>
                      {new Date(
                        `${row.date}T12:00:00+07:00`,
                      ).toLocaleDateString("vi-VN", {
                        day: "2-digit",
                        month: "2-digit",
                      })}
                    </span>
                    <div
                      aria-hidden="true"
                      className="h-3 overflow-hidden rounded-full bg-muted"
                    >
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{
                          width: `${Math.max(1, (Number(row.revenue) / dailyMax) * 100)}%`,
                        }}
                      />
                    </div>
                    <span className="text-right tabular-nums">
                      {formatOrderMoney(row.revenue)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Không có doanh thu hoàn tất trong khoảng này.
              </p>
            )}
          </section>
          <div className="grid gap-5 xl:grid-cols-2">
            <Ranking
              title="Sản phẩm bán chạy"
              headers={["Sản phẩm", "Số lượng", "Doanh thu"]}
              rows={current.stats.topProducts.map((item) => [
                item.name,
                String(item.quantity),
                formatOrderMoney(item.revenue),
              ])}
            />
            <section className="overflow-hidden rounded-xl border bg-card">
              <h2 className="p-5 font-semibold">Khách hàng mua nhiều</h2>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] text-left text-sm">
                  <thead className="border-y bg-muted/50">
                    <tr>
                      {["Khách hàng", "Đơn", "Doanh thu"].map((heading) => (
                        <th key={heading} className="px-4 py-3 font-medium">
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {current.stats.topCustomers.map((customer) => (
                      <tr key={customer.userId}>
                        <td className="px-4 py-3">
                          <Link
                            className="font-medium text-primary underline"
                            href={`/store-orders/customers/${encodeURIComponent(customer.userId)}`}
                          >
                            {customer.name || customer.email}
                          </Link>
                          <p className="break-all text-xs text-muted-foreground">
                            {customer.email}
                          </p>
                        </td>
                        <td className="px-4 py-3">{customer.orderCount}</td>
                        <td className="px-4 py-3">
                          {formatOrderMoney(customer.revenue)}
                        </td>
                      </tr>
                    ))}
                    {!current.stats.topCustomers.length && (
                      <tr>
                        <td
                          colSpan={3}
                          className="px-4 py-6 text-center text-muted-foreground"
                        >
                          Chưa có dữ liệu.
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

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
    </div>
  );
}

function Ranking({
  title,
  headers,
  rows,
}: {
  title: string;
  headers: string[];
  rows: string[][];
}) {
  return (
    <section className="overflow-hidden rounded-xl border bg-card">
      <h2 className="p-5 font-semibold">{title}</h2>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] text-left text-sm">
          <thead className="border-y bg-muted/50">
            <tr>
              {headers.map((heading) => (
                <th key={heading} className="px-4 py-3 font-medium">
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((row, index) => (
              <tr key={`${row[0]}:${index}`}>
                {row.map((value, cell) => (
                  <td key={cell} className="px-4 py-3">
                    {value}
                  </td>
                ))}
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td
                  colSpan={headers.length}
                  className="px-4 py-6 text-center text-muted-foreground"
                >
                  Chưa có dữ liệu.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

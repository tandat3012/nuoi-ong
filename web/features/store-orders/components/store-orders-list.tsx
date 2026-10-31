"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuthenticatedRequest } from "@/features/auth";
import type { PaginatedResponse } from "@/shared/api/contracts";
import { Button } from "@/shared/components/ui/button";
import { ErrorAlert } from "@/shared/components/ui/error-alert";
import { Input } from "@/shared/components/ui/input";
import { DateInput } from "@/shared/components/ui/date-input";
import { Pagination } from "@/shared/components/ui/pagination";
import { Select } from "@/shared/components/ui/select";
import { getStoreOrders } from "../store-orders.api";
import {
  formatOrderMoney,
  orderErrorMessage,
} from "@/features/commerce/orders/order.logic";
import {
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  type Order,
  type OrderStatus,
  type PaymentStatus,
  type StoreOrderFilters,
} from "@/features/commerce/orders/types/order";
import {
  OrderStatusBadge,
  PaymentStatusBadge,
} from "@/features/commerce/orders/components/order-presentation";
import { BeeLoader } from "@/shared/components/ui/bee-loader";

export function StoreOrdersList({
  farmId,
  customerId,
  customerName,
}: {
  farmId: string;
  customerId?: string;
  customerName?: string;
}) {
  const request = useAuthenticatedRequest();
  const [filters, setFilters] = useState<StoreOrderFilters>({
    page: 1,
    pageSize: 20,
    customerId,
  });
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{
    filters: StoreOrderFilters;
    response?: PaginatedResponse<Order>;
    error?: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getStoreOrders(request, farmId, filters)
      .then((response) => {
        if (cancelled) return;
        if (filters.page > Math.max(1, response.page.totalPages)) {
          setFilters((current) => ({
            ...current,
            page: Math.max(1, response.page.totalPages),
          }));
          return;
        }
        setResult({ filters, response });
      })
      .catch((error: unknown) => {
        if (!cancelled) setResult({ filters, error: orderErrorMessage(error) });
      });
    return () => {
      cancelled = true;
    };
  }, [request, farmId, filters, attempt]);

  const current = result?.filters === filters ? result : null;
  const change = (patch: Partial<StoreOrderFilters>) =>
    setFilters((previous) => ({ ...previous, ...patch, page: 1 }));

  return (
    <div className="space-y-5">
      <div className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="space-y-1 text-sm">
          <span>Tìm đơn, người nhận hoặc điện thoại</span>
          <Input
            type="search"
            value={filters.q ?? ""}
            onChange={(event) => change({ q: event.target.value })}
          />
        </label>
        <label className="space-y-1 text-sm">
          <span>Trạng thái đơn</span>
          <Select
            value={filters.status ?? ""}
            onChange={(event) =>
              change({
                status: (event.target.value || undefined) as
                  OrderStatus | undefined,
              })
            }
          >
            <option value="">Tất cả</option>
            {Object.entries(ORDER_STATUS_LABELS).map(([status, label]) => (
              <option key={status} value={status}>
                {label}
              </option>
            ))}
          </Select>
        </label>
        <label className="space-y-1 text-sm">
          <span>Thanh toán</span>
          <Select
            value={filters.paymentStatus ?? ""}
            onChange={(event) =>
              change({
                paymentStatus: (event.target.value || undefined) as
                  PaymentStatus | undefined,
              })
            }
          >
            <option value="">Tất cả</option>
            {Object.entries(PAYMENT_STATUS_LABELS).map(([status, label]) => (
              <option key={status} value={status}>
                {label}
              </option>
            ))}
          </Select>
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1 text-sm">
            <span>Từ ngày</span>
            <DateInput
              value={filters.from ?? ""}
              onValueChange={(value) =>
                change({ from: value || undefined })
              }
            />
          </label>
          <label className="space-y-1 text-sm">
            <span>Đến ngày</span>
            <DateInput
              value={filters.to ?? ""}
              onValueChange={(value) =>
                change({ to: value || undefined })
              }
            />
          </label>
        </div>
        <Button
          variant="outline"
          onClick={() => setAttempt((value) => value + 1)}
          className="sm:col-span-2 lg:col-span-4"
        >
          Tải lại
        </Button>
      </div>
      {!current && <BeeLoader label="Đang tải đơn hàng…" />}
      {current?.error && (
        <ErrorAlert
          message={current.error}
          onRetry={() => setAttempt((value) => value + 1)}
        />
      )}
      {current?.response && (
        <section className="overflow-hidden rounded-xl border bg-card">
          {customerName && (
            <h2 className="border-b p-4 font-semibold">
              Đơn hàng của {customerName}
            </h2>
          )}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] text-left text-sm">
              <caption className="sr-only">Danh sách đơn hàng cửa hàng</caption>
              <thead className="border-b bg-muted/50">
                <tr>
                  {[
                    "Mã đơn",
                    "Người nhận",
                    "Ngày đặt",
                    "Trạng thái",
                    "Thanh toán",
                    "Tổng",
                  ].map((heading) => (
                    <th
                      key={heading}
                      scope="col"
                      className="px-4 py-3 font-medium"
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {current.response.data.map((order) => (
                  <tr key={order.id}>
                    <td className="px-4 py-3">
                      <Link
                        className="font-semibold text-primary underline"
                        href={`/store-orders/${encodeURIComponent(order.id)}`}
                      >
                        {order.code}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{order.recipientName}</p>
                      <p className="text-xs text-muted-foreground">
                        {order.phone}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      {new Date(order.createdAt).toLocaleString("vi-VN")}
                    </td>
                    <td className="px-4 py-3">
                      <OrderStatusBadge status={order.status} />
                    </td>
                    <td className="px-4 py-3">
                      <PaymentStatusBadge order={order} />
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {formatOrderMoney(order.total)}
                    </td>
                  </tr>
                ))}
                {!current.response.data.length && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-8 text-center text-muted-foreground"
                    >
                      Không có đơn hàng phù hợp.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination
            pageInfo={current.response.page}
            itemLabel="đơn hàng"
            onPageChange={(page) =>
              setFilters((previous) => ({ ...previous, page }))
            }
          />
        </section>
      )}
    </div>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuthenticatedRequest } from "@/features/auth";
import type { PaginatedResponse } from "@/shared/api/contracts";
import { Button } from "@/shared/components/ui/button";
import { ErrorAlert } from "@/shared/components/ui/error-alert";
import { Pagination } from "@/shared/components/ui/pagination";
import { getCustomerOrders } from "../orders.api";
import { formatOrderMoney, orderErrorMessage } from "../order.logic";
import type { CustomerOrder } from "../types/order";
import { OrderStatusBadge, PaymentStatusBadge } from "./order-presentation";
import { BeeLoader } from "@/shared/components/ui/bee-loader";

export function CustomerOrders() {
  const request = useAuthenticatedRequest();
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<{
    page: number;
    response?: PaginatedResponse<CustomerOrder>;
    error?: string;
  } | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void getCustomerOrders(request, page)
      .then((response) => {
        if (cancelled) return;
        if (page > Math.max(1, response.page.totalPages)) {
          setPage(Math.max(1, response.page.totalPages));
          return;
        }
        setResult({ page, response });
      })
      .catch((error: unknown) => {
        if (!cancelled) setResult({ page, error: orderErrorMessage(error) });
      });
    return () => {
      cancelled = true;
    };
  }, [request, page, attempt]);

  const current = result?.page === page ? result : null;
  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Đơn hàng của tôi</h1>
          <p className="text-sm text-muted-foreground">
            Theo dõi trạng thái, thanh toán và giao hàng.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => setAttempt((value) => value + 1)}
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
        <>
          <div className="space-y-3">
            {current.response.data.map((order) => (
              <Link
                key={order.id}
                href={`/orders/${encodeURIComponent(order.id)}`}
                className="block rounded-xl border bg-card p-4 transition-colors hover:bg-muted/30 focus-visible:outline-2 focus-visible:outline-primary"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{order.code}</p>
                    <p className="text-xs text-muted-foreground">
                      Đặt lúc{" "}
                      {new Date(order.createdAt).toLocaleString("vi-VN")}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <OrderStatusBadge status={order.status} />
                    <PaymentStatusBadge order={order} />
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap justify-between gap-2 text-sm">
                  <span>
                    {order.paymentMethod === "COD" ? "COD" : "Chuyển khoản"}
                  </span>
                  <span className="font-semibold">
                    {formatOrderMoney(order.total)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
          {!current.response.data.length && (
            <p className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">
              Bạn chưa có đơn hàng nào.
            </p>
          )}
          <Pagination
            pageInfo={current.response.page}
            itemLabel="đơn hàng"
            onPageChange={setPage}
          />
        </>
      )}
    </main>
  );
}

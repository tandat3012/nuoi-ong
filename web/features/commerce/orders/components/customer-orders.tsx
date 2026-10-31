"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Package,
  ShoppingBag,
  ChevronRight,
  RefreshCw,
  Clock,
} from "lucide-react";
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
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Đơn hàng của tôi
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Theo dõi trạng thái, thanh toán và hành trình giao nhận của bạn.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setAttempt((value) => value + 1)}
          className="gap-1.5 cursor-pointer"
        >
          <RefreshCw className="size-3.5 text-muted-foreground" />
          <span>Tải lại</span>
        </Button>
      </div>

      {!current && <BeeLoader label="Đang tải danh sách đơn hàng…" />}

      {current?.error && (
        <ErrorAlert
          message={current.error}
          onRetry={() => setAttempt((value) => value + 1)}
        />
      )}

      {current?.response && (
        <>
          <div className="space-y-3.5">
            {current.response.data.map((order) => (
              <Link
                key={order.id}
                href={`/orders/${encodeURIComponent(order.id)}`}
                className="group block rounded-xl border bg-card p-5 transition-all duration-150 hover:border-primary/40 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-primary"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                      <Package className="size-4.5" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-base text-foreground group-hover:text-primary transition-colors">
                          #{order.code}
                        </span>
                      </div>
                      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock className="size-3" />
                        <span>
                          {new Date(order.createdAt).toLocaleString("vi-VN", {
                            hour: "2-digit",
                            minute: "2-digit",
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                          })}
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <OrderStatusBadge status={order.status} />
                    <PaymentStatusBadge order={order} />
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-sm">
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>
                      Hình thức:{" "}
                      <strong className="text-foreground">
                        {order.paymentMethod === "COD" ? "COD" : "VietQR"}
                      </strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Tổng tiền:</span>
                    <span className="font-bold text-base text-primary font-mono">
                      {formatOrderMoney(order.total)}
                    </span>
                    <ChevronRight className="size-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {!current.response.data.length && (
            <div className="rounded-xl border bg-card p-12 text-center shadow-xs">
              <div className="mx-auto grid size-14 place-items-center rounded-full bg-primary/10 text-primary mb-3">
                <ShoppingBag className="size-7" />
              </div>
              <h3 className="font-semibold text-lg text-foreground">
                Bạn chưa có đơn hàng nào
              </h3>
              <p className="mt-1 text-sm text-muted-foreground max-w-sm mx-auto">
                Hãy khám phá các sản phẩm mật ong nguyên chất và dụng cụ nuôi ong chất lượng cao của Mộc Ong.
              </p>
              <Link
                href="/products"
                className="mt-5 inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-xs hover:bg-primary/90 transition-colors cursor-pointer"
              >
                Khám phá sản phẩm ngay
              </Link>
            </div>
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

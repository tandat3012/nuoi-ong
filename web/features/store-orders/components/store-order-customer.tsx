"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuthenticatedRequest } from "@/features/auth";
import { ErrorAlert } from "@/shared/components/ui/error-alert";
import { getStoreOrderCustomer } from "../store-orders.api";
import {
  formatOrderMoney,
  orderErrorMessage,
} from "@/features/commerce/orders/order.logic";
import type { StoreOrderCustomerProfile } from "@/features/commerce/orders/types/order";
import { StoreOrdersList } from "./store-orders-list";

export function StoreOrderCustomer({
  farmId,
  userId,
}: {
  farmId: string;
  userId: string;
}) {
  const request = useAuthenticatedRequest();
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{
    attempt: number;
    profile?: StoreOrderCustomerProfile;
    error?: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getStoreOrderCustomer(request, farmId, userId)
      .then(({ data }) => {
        if (!cancelled) setResult({ attempt, profile: data });
      })
      .catch((error: unknown) => {
        if (!cancelled) setResult({ attempt, error: orderErrorMessage(error) });
      });
    return () => {
      cancelled = true;
    };
  }, [request, farmId, userId, attempt]);

  const current = result?.attempt === attempt ? result : null;
  return (
    <div className="space-y-6">
      <Link href="/store-orders" className="text-sm text-primary underline">
        ← Danh sách đơn hàng
      </Link>
      {!current && <p role="status">Đang tải hồ sơ khách hàng…</p>}
      {current?.error && (
        <ErrorAlert
          message={current.error}
          onRetry={() => setAttempt((value) => value + 1)}
        />
      )}
      {current?.profile && (
        <>
          <div>
            <h1 className="text-2xl font-bold">
              {current.profile.customer.fullName ||
                current.profile.customer.email}
            </h1>
            <p className="break-all text-sm text-muted-foreground">
              {current.profile.customer.email}
            </p>
          </div>
          <section className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border bg-card p-4">
              <p className="text-sm text-muted-foreground">Tổng đơn</p>
              <p className="mt-1 text-2xl font-bold">
                {current.profile.orderCount}
              </p>
            </div>
            <div className="rounded-xl border bg-card p-4">
              <p className="text-sm text-muted-foreground">Đơn hoàn tất</p>
              <p className="mt-1 text-2xl font-bold">
                {current.profile.completedCount}
              </p>
            </div>
            <div className="rounded-xl border bg-card p-4">
              <p className="text-sm text-muted-foreground">
                Doanh thu hoàn tất
              </p>
              <p className="mt-1 text-2xl font-bold">
                {formatOrderMoney(current.profile.totalSpent)}
              </p>
            </div>
          </section>
          <section className="space-y-3 rounded-xl border bg-card p-5">
            <h2 className="font-semibold">Sản phẩm đã mua</h2>
            {current.profile.products.length ? (
              <ul className="divide-y">
                {current.profile.products.map((product) => (
                  <li
                    key={product.variantId}
                    className="flex flex-wrap justify-between gap-2 py-3 text-sm"
                  >
                    <span className="font-medium">
                      {product.productName} · {product.variantName}
                    </span>
                    <span>
                      {product.quantity} bước bán ·{" "}
                      {formatOrderMoney(product.total)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                Chưa có sản phẩm trong đơn hoàn tất.
              </p>
            )}
          </section>
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Lịch sử đơn hàng</h2>
            <StoreOrdersList
              farmId={farmId}
              customerId={userId}
              customerName={
                current.profile.customer.fullName ||
                current.profile.customer.email
              }
            />
          </section>
        </>
      )}
    </div>
  );
}

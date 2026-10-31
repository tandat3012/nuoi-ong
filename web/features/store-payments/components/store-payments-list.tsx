"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuthenticatedRequest } from "@/features/auth";
import type { PaginatedResponse } from "@/shared/api/contracts";
import { Button } from "@/shared/components/ui/button";
import { ErrorAlert } from "@/shared/components/ui/error-alert";
import { Pagination } from "@/shared/components/ui/pagination";
import { Select } from "@/shared/components/ui/select";
import { BeeLoader } from "@/shared/components/ui/bee-loader";
import {
  formatOrderMoney,
  orderErrorMessage,
} from "@/features/commerce/orders/order.logic";
import {
  PAYMENT_PROVIDER_LABELS,
  PAYMENT_RESULT_LABELS,
  type PaymentResult,
  type PaymentTransaction,
} from "@/features/commerce/orders/types/order";
import { PaymentResultBadge } from "@/features/commerce/orders/components/order-presentation";
import { getStorePayments, type StorePaymentFilters } from "../store-payments.api";

export function StorePaymentsList({
  farmId,
  refresh,
}: {
  farmId: string;
  refresh: number;
}) {
  const request = useAuthenticatedRequest();
  const [filters, setFilters] = useState<StorePaymentFilters>({
    page: 1,
    pageSize: 20,
  });
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{
    key: string;
    response?: PaginatedResponse<PaymentTransaction>;
    error?: string;
  } | null>(null);
  const key = `${JSON.stringify(filters)}:${attempt}:${refresh}`;

  useEffect(() => {
    let cancelled = false;
    void getStorePayments(request, farmId, filters)
      .then((response) => {
        if (!cancelled) setResult({ key, response });
      })
      .catch((error: unknown) => {
        if (!cancelled) setResult({ key, error: orderErrorMessage(error) });
      });
    return () => {
      cancelled = true;
    };
  }, [request, farmId, filters, key]);

  // Keep the previous page on screen while a refresh after a simulation loads.
  const current = result?.key === key ? result : result?.response ? result : null;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4">
        <label className="space-y-1 text-sm">
          <span>Kết quả đối soát</span>
          <Select
            value={filters.result ?? ""}
            onChange={(event) =>
              setFilters((previous) => ({
                ...previous,
                page: 1,
                result: (event.target.value || undefined) as
                  PaymentResult | undefined,
              }))
            }
          >
            <option value="">Tất cả</option>
            {Object.entries(PAYMENT_RESULT_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </label>
        <Button variant="outline" onClick={() => setAttempt((v) => v + 1)}>
          Tải lại
        </Button>
      </div>
      {!current && <BeeLoader label="Đang tải giao dịch…" />}
      {current?.error && (
        <ErrorAlert
          message={current.error}
          onRetry={() => setAttempt((value) => value + 1)}
        />
      )}
      {current?.response && (
        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <caption className="sr-only">Lịch sử giao dịch chuyển khoản</caption>
              <thead className="border-b bg-muted/50">
                <tr>
                  {[
                    "Thời gian",
                    "Nguồn",
                    "Số tiền",
                    "Nội dung",
                    "Tài khoản nhận",
                    "Đơn hàng",
                    "Kết quả",
                  ].map((heading) => (
                    <th key={heading} scope="col" className="px-4 py-3 font-medium">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {current.response.data.map((payment) => (
                  <tr key={payment.id}>
                    <td className="px-4 py-3">
                      {new Date(payment.transactionAt).toLocaleString("vi-VN")}
                    </td>
                    <td className="px-4 py-3">
                      {PAYMENT_PROVIDER_LABELS[payment.provider]}
                      <p className="font-mono text-xs text-muted-foreground">
                        {payment.providerTxId}
                      </p>
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {formatOrderMoney(payment.amount)}
                    </td>
                    <td className="max-w-56 break-words px-4 py-3 font-mono text-xs">
                      {payment.content || "—"}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {payment.accountNumber}
                    </td>
                    <td className="px-4 py-3">
                      {payment.orderId && payment.orderCode ? (
                        <Link
                          className="font-semibold text-primary underline"
                          href={`/store-orders/${encodeURIComponent(payment.orderId)}`}
                        >
                          {payment.orderCode}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <PaymentResultBadge result={payment.result} />
                    </td>
                  </tr>
                ))}
                {!current.response.data.length && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-8 text-center text-muted-foreground"
                    >
                      Chưa có giao dịch nào.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination
            pageInfo={current.response.page}
            itemLabel="giao dịch"
            onPageChange={(page) =>
              setFilters((previous) => ({ ...previous, page }))
            }
          />
        </div>
      )}
    </section>
  );
}

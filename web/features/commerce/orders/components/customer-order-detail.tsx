"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuthenticatedRequest } from "@/features/auth";
import { ApiError } from "@/shared/api/client";
import { Button } from "@/shared/components/ui/button";
import { ErrorAlert } from "@/shared/components/ui/error-alert";
import { Textarea } from "@/shared/components/ui/textarea";
import { cancelCustomerOrder, getCustomerOrder } from "../orders.api";
import {
  canCustomerCancel,
  formatOrderMoney,
  orderErrorMessage,
} from "../order.logic";
import type { CustomerOrderDetail } from "../types/order";
import {
  hasStoreBankTransferInstructions,
  storeBankTransfer,
} from "../store-bank-transfer";
import {
  OrderAmounts,
  OrderItems,
  OrderStatusBadge,
  PaymentStatusBadge,
  paymentMethodLabel,
} from "./order-presentation";

export function CustomerOrderDetail({ id }: { id: string }) {
  const request = useAuthenticatedRequest();
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{
    id: string;
    attempt: number;
    detail?: CustomerOrderDetail;
    error?: string;
  } | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  const current =
    result?.id === id && result.attempt === attempt ? result : null;
  const detail = current?.detail ?? null;
  const loaded = Boolean(current);
  const loadError = current?.error;

  useEffect(() => {
    let cancelled = false;
    void getCustomerOrder(request, id)
      .then(({ data }) => {
        if (!cancelled) setResult({ id, attempt, detail: data });
      })
      .catch((error: unknown) => {
        if (!cancelled)
          setResult({ id, attempt, error: orderErrorMessage(error) });
      });
    return () => {
      cancelled = true;
    };
  }, [request, id, attempt]);

  async function cancelOrder() {
    if (!detail || !canCustomerCancel(detail.order) || isCancelling) return;
    if (!cancelReason.trim()) {
      setActionError("Vui lòng nhập lý do hủy.");
      return;
    }
    setIsCancelling(true);
    setActionError(null);
    try {
      const result = await cancelCustomerOrder(
        request,
        id,
        cancelReason.trim(),
      );
      setResult((currentResult) =>
        currentResult?.id === id && currentResult.attempt === attempt
          ? { ...currentResult, detail: result.data, error: undefined }
          : currentResult,
      );
      setCancelReason("");
    } catch (error: unknown) {
      setActionError(
        error instanceof ApiError && error.status === 409
          ? "Đơn hàng đã chuyển trạng thái hoặc đã thanh toán, nên không thể hủy. Tải lại để kiểm tra."
          : orderErrorMessage(error),
      );
    } finally {
      setIsCancelling(false);
    }
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <Link href="/orders" className="text-sm text-primary underline">
        ← Đơn hàng của tôi
      </Link>
      {!loaded && <p role="status">Đang tải chi tiết đơn hàng…</p>}
      {loadError && (
        <ErrorAlert
          message={loadError}
          onRetry={() => setAttempt((value) => value + 1)}
        />
      )}
      {detail && (
        <>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">
                Đơn hàng {detail.order.code}
              </h1>
              <p className="text-sm text-muted-foreground">
                Đặt lúc{" "}
                {new Date(detail.order.createdAt).toLocaleString("vi-VN")}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <OrderStatusBadge status={detail.order.status} />
              <PaymentStatusBadge order={detail.order} />
            </div>
          </div>
          <section className="grid gap-6 lg:grid-cols-[1fr_20rem]">
            <div className="space-y-5">
              <OrderItems items={detail.items} />
              <div className="grid gap-5 rounded-xl border bg-card p-5 sm:grid-cols-2">
                <div className="space-y-2 text-sm">
                  <h2 className="font-semibold">Người nhận</h2>
                  <p>{detail.order.recipientName}</p>
                  <p>{detail.order.phone}</p>
                  <p className="whitespace-pre-wrap">{detail.order.address}</p>
                  {detail.order.note && (
                    <p className="text-muted-foreground">
                      Ghi chú: {detail.order.note}
                    </p>
                  )}
                </div>
                <div className="space-y-2 text-sm">
                  <h2 className="font-semibold">Thanh toán</h2>
                  <p>{paymentMethodLabel(detail.order.paymentMethod)}</p>
                  {detail.order.paidAt && (
                    <p>
                      Đã ghi nhận lúc{" "}
                      {new Date(detail.order.paidAt).toLocaleString("vi-VN")}
                    </p>
                  )}
                  {detail.order.paymentMethod === "BANK_TRANSFER" &&
                    (hasStoreBankTransferInstructions() ? (
                      <dl className="space-y-1 rounded-lg bg-muted/50 p-3">
                        <div>
                          <dt className="text-muted-foreground">Ngân hàng</dt>
                          <dd>{storeBankTransfer.bankName}</dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground">
                            Số tài khoản
                          </dt>
                          <dd className="font-mono">
                            {storeBankTransfer.accountNumber}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground">
                            Chủ tài khoản
                          </dt>
                          <dd>{storeBankTransfer.accountName}</dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground">
                            Nội dung chuyển khoản
                          </dt>
                          <dd className="font-mono">{detail.order.code}</dd>
                        </div>
                        {storeBankTransfer.branch && (
                          <div>
                            <dt className="text-muted-foreground">Chi nhánh</dt>
                            <dd>{storeBankTransfer.branch}</dd>
                          </div>
                        )}
                      </dl>
                    ) : (
                      <p
                        role="status"
                        className="rounded-lg bg-muted/50 p-3 text-muted-foreground"
                      >
                        Đơn hàng chưa có hướng dẫn chuyển khoản hiển thị. Vui
                        lòng liên hệ cửa hàng trước khi chuyển khoản.
                      </p>
                    ))}
                </div>
              </div>
            </div>
            <aside className="h-fit space-y-5 rounded-xl border bg-card p-5">
              <h2 className="text-lg font-semibold">Tóm tắt đơn</h2>
              <OrderAmounts order={detail.order} />
              {detail.order.cancelReason && (
                <p className="text-sm">
                  <span className="font-medium">Lý do hủy:</span>{" "}
                  {detail.order.cancelReason}
                </p>
              )}
              {canCustomerCancel(detail.order) && (
                <div className="space-y-3 border-t pt-4">
                  <label className="block space-y-1 text-sm">
                    <span>Lý do hủy *</span>
                    <Textarea
                      required
                      value={cancelReason}
                      maxLength={1000}
                      rows={2}
                      onChange={(event) => setCancelReason(event.target.value)}
                    />
                  </label>
                  {actionError && (
                    <p role="alert" className="text-sm text-destructive">
                      {actionError}
                    </p>
                  )}
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={isCancelling}
                    isLoading={isCancelling}
                    onClick={() => void cancelOrder()}
                    className="w-full"
                  >
                    Hủy đơn hàng
                  </Button>
                </div>
              )}
              {detail.order.paymentStatus === "PAID" &&
                detail.order.status !== "CANCELLED" && (
                  <p className="text-xs text-muted-foreground">
                    Đơn đã thanh toán nên không thể hủy trong phiên bản này.
                  </p>
                )}
              <p className="text-xs text-muted-foreground">
                Phí giao hàng được cửa hàng xác nhận trong quá trình xử lý đơn.
              </p>
              <p className="text-xs text-muted-foreground">
                Tạm tính: {formatOrderMoney(detail.order.subtotal)}
              </p>
            </aside>
          </section>
        </>
      )}
    </main>
  );
}

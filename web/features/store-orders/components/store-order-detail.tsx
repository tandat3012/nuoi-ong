"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuthenticatedRequest } from "@/features/auth";
import { ApiError } from "@/shared/api/client";
import { Button } from "@/shared/components/ui/button";
import { ErrorAlert } from "@/shared/components/ui/error-alert";
import { Input } from "@/shared/components/ui/input";
import { Textarea } from "@/shared/components/ui/textarea";
import {
  getStoreOrder,
  runStoreOrderAction,
  setStoreOrderShippingFee,
} from "../store-orders.api";
import {
  canCompleteOrder,
  canEditShippingFee,
  canShipOrder,
  canStaffCancelDetail,
  orderErrorMessage,
} from "@/features/commerce/orders/order.logic";
import type { OrderDetail } from "@/features/commerce/orders/types/order";
import {
  OrderAmounts,
  OrderItems,
  OrderStatusBadge,
  PaymentStatusBadge,
  paymentMethodLabel,
} from "@/features/commerce/orders/components/order-presentation";

export function StoreOrderDetail({
  farmId,
  id,
  canWrite,
}: {
  farmId: string;
  id: string;
  canWrite: boolean;
}) {
  const request = useAuthenticatedRequest();
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{
    farmId: string;
    id: string;
    attempt: number;
    detail?: OrderDetail;
    error?: string;
  } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [shippingFee, setShippingFee] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const current =
    result?.farmId === farmId && result.id === id && result.attempt === attempt
      ? result
      : null;
  const detail = current?.detail;
  const loaded = Boolean(current);
  const loadError = current?.error;

  useEffect(() => {
    let cancelled = false;
    void getStoreOrder(request, farmId, id)
      .then(({ data }) => {
        if (cancelled) return;
        setResult({ farmId, id, attempt, detail: data });
        setShippingFee(data.order.shippingFee);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setResult({ farmId, id, attempt, error: orderErrorMessage(error) });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [request, farmId, id, attempt]);

  function applyDetail(result: OrderDetail) {
    setResult({ farmId, id, attempt, detail: result });
    setShippingFee(result.order.shippingFee);
    setActionError(null);
  }

  async function runAction(
    action: "confirm" | "ship" | "complete" | "mark-paid" | "cancel",
  ) {
    if (!detail || isSaving || !canWrite) return;
    if (action === "cancel" && !cancelReason.trim()) {
      setActionError("Vui lòng nhập lý do hủy.");
      return;
    }
    if (
      action !== "cancel" &&
      !window.confirm(actionConfirmation(action, detail))
    )
      return;
    setIsSaving(true);
    setActionError(null);
    try {
      const { data } = await runStoreOrderAction(
        request,
        farmId,
        id,
        action,
        cancelReason.trim(),
      );
      applyDetail(data);
      setCancelReason("");
    } catch (error: unknown) {
      setActionError(orderErrorMessage(error));
      if (error instanceof ApiError && error.status === 409)
        setAttempt((value) => value + 1);
    } finally {
      setIsSaving(false);
    }
  }

  async function saveShippingFee() {
    if (!detail || isSaving || !canWrite || !canEditShippingFee(detail.order))
      return;
    const amount = shippingFee.trim();
    if (
      !/^(?:0|[1-9]\d*)$/.test(amount) ||
      amount.length > 16 ||
      !Number.isSafeInteger(Number(amount))
    ) {
      setActionError(
        "Phí giao hàng phải là số nguyên VND không âm trong giới hạn hỗ trợ.",
      );
      return;
    }
    setIsSaving(true);
    setActionError(null);
    try {
      const { data } = await setStoreOrderShippingFee(
        request,
        farmId,
        id,
        amount,
      );
      applyDetail(data);
    } catch (error: unknown) {
      setActionError(orderErrorMessage(error));
      if (error instanceof ApiError && error.status === 409)
        setAttempt((value) => value + 1);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <Link href="/store-orders" className="text-sm text-primary underline">
        ← Danh sách đơn hàng
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
          {actionError && (
            <ErrorAlert
              message={actionError}
              onRetry={() => setAttempt((value) => value + 1)}
            />
          )}
          <section className="space-y-5">
            <OrderItems items={detail.items} showStock />
            <div className="grid gap-5 rounded-xl border bg-card p-5 sm:grid-cols-3">
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
                <h2 className="font-semibold">Khách hàng</h2>
                <p>{detail.customer.fullName || detail.customer.email}</p>
                <p className="break-all text-muted-foreground">
                  {detail.customer.email}
                </p>
                <Link
                  className="text-primary underline"
                  href={`/store-orders/customers/${encodeURIComponent(detail.customer.id)}`}
                >
                  Xem lịch sử mua hàng
                </Link>
              </div>
              <div className="space-y-2 text-sm">
                <h2 className="font-semibold">Thanh toán và kho</h2>
                <p>{paymentMethodLabel(detail.order.paymentMethod)}</p>
                <p>
                  {detail.order.paidAt
                    ? `Đã thanh toán ${new Date(detail.order.paidAt).toLocaleString("vi-VN")}`
                    : "Chưa ghi nhận thanh toán"}
                </p>
                {detail.stockIssue ? (
                  <p>
                    Phiếu xuất:{" "}
                    <Link
                      className="text-primary underline"
                      href={`/issues/${encodeURIComponent(detail.stockIssue.id)}`}
                    >
                      {detail.stockIssue.issueCode} · {detail.stockIssue.status}
                    </Link>
                  </p>
                ) : (
                  <p className="text-muted-foreground">
                    Chưa có phiếu xuất liên kết.
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Xác nhận đơn không giữ chỗ tồn kho; tồn kho chỉ giảm khi phiếu
                  xuất liên kết được xác nhận.
                </p>
              </div>
            </div>
            <div className="grid gap-5 lg:grid-cols-[1fr_22rem]">
              <section className="space-y-4 rounded-xl border bg-card p-5">
                <h2 className="font-semibold">Thao tác đơn hàng</h2>
                {!canWrite && (
                  <p className="text-sm text-destructive">
                    Bạn không có quyền xử lý đơn hàng.
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  {detail.order.status === "PENDING" && (
                    <Button
                      disabled={!canWrite || isSaving}
                      isLoading={isSaving}
                      onClick={() => void runAction("confirm")}
                    >
                      Xác nhận đơn
                    </Button>
                  )}
                  {detail.order.status === "CONFIRMED" && (
                    <Button
                      disabled={!canWrite || isSaving || !canShipOrder(detail)}
                      isLoading={isSaving}
                      onClick={() => void runAction("ship")}
                    >
                      Bắt đầu giao
                    </Button>
                  )}
                  {detail.order.status === "SHIPPING" && (
                    <Button
                      disabled={
                        !canWrite || isSaving || !canCompleteOrder(detail)
                      }
                      isLoading={isSaving}
                      onClick={() => void runAction("complete")}
                    >
                      Hoàn tất giao hàng
                    </Button>
                  )}
                  {detail.order.paymentStatus === "UNPAID" &&
                    detail.order.status !== "CANCELLED" && (
                      <Button
                        variant="outline"
                        disabled={!canWrite || isSaving}
                        isLoading={isSaving}
                        onClick={() => void runAction("mark-paid")}
                      >
                        Ghi nhận đã thanh toán
                      </Button>
                    )}
                </div>
                {detail.order.status === "CONFIRMED" &&
                  detail.stockIssue?.status !== "CONFIRMED" && (
                    <p className="text-xs text-muted-foreground">
                      {detail.stockIssue
                        ? "Cần xác nhận phiếu xuất liên kết trước khi chuyển đơn sang đang giao."
                        : "Chưa có phiếu xuất liên kết; chưa thể chuyển đơn sang đang giao."}
                    </p>
                  )}
                {detail.order.status === "SHIPPING" &&
                  detail.order.paymentMethod === "BANK_TRANSFER" &&
                  detail.order.paymentStatus === "UNPAID" && (
                    <p className="text-xs text-muted-foreground">
                      Đơn chuyển khoản cần được ghi nhận thanh toán trước khi
                      hoàn tất.
                    </p>
                  )}
                {detail.order.status === "CONFIRMED" &&
                  detail.order.paymentStatus === "UNPAID" &&
                  detail.stockIssue &&
                  detail.stockIssue.status !== "DRAFT" && (
                    <p className="text-xs text-muted-foreground">
                      Phiếu xuất không còn ở trạng thái nháp nên không thể hủy
                      đơn từ màn hình này.
                    </p>
                  )}
                {canStaffCancelDetail(detail) && (
                  <div className="space-y-3 border-t pt-4">
                    <label className="block space-y-1 text-sm">
                      <span>Lý do hủy *</span>
                      <Textarea
                        required
                        value={cancelReason}
                        maxLength={1000}
                        rows={2}
                        onChange={(event) =>
                          setCancelReason(event.target.value)
                        }
                        disabled={isSaving || !canWrite}
                      />
                    </label>
                    <Button
                      type="button"
                      variant="destructive"
                      disabled={!canWrite || isSaving}
                      isLoading={isSaving}
                      onClick={() => void runAction("cancel")}
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
                {detail.order.cancelReason && (
                  <p className="text-sm">
                    <span className="font-medium">Lý do hủy:</span>{" "}
                    {detail.order.cancelReason}
                  </p>
                )}
              </section>
              <aside className="space-y-4 rounded-xl border bg-card p-5">
                <h2 className="font-semibold">Phí và tổng tiền</h2>
                <OrderAmounts order={detail.order} />
                {canEditShippingFee(detail.order) && (
                  <div className="space-y-2 border-t pt-4">
                    <label className="block space-y-1 text-sm">
                      <span>Phí giao hàng (₫)</span>
                      <Input
                        inputMode="decimal"
                        value={shippingFee}
                        onChange={(event) => setShippingFee(event.target.value)}
                        disabled={!canWrite || isSaving}
                      />
                    </label>
                    <Button
                      variant="outline"
                      disabled={
                        !canWrite ||
                        isSaving ||
                        shippingFee.trim() === detail.order.shippingFee
                      }
                      onClick={() => void saveShippingFee()}
                    >
                      Cập nhật phí giao hàng
                    </Button>
                  </div>
                )}
              </aside>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function actionConfirmation(
  action: "confirm" | "ship" | "complete" | "mark-paid",
  detail: OrderDetail,
) {
  if (action === "confirm")
    return `Xác nhận đơn ${detail.order.code}? Thao tác này chưa giữ chỗ tồn kho.`;
  if (action === "ship")
    return `Chuyển đơn ${detail.order.code} sang đang giao?`;
  if (action === "complete")
    return `Hoàn tất giao đơn ${detail.order.code}? COD sẽ được ghi nhận đã thanh toán.`;
  return `Ghi nhận đơn ${detail.order.code} đã thanh toán?`;
}

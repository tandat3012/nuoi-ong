"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuthenticatedRequest } from "@/features/auth";
import { ApiError } from "@/shared/api/client";
import { Button } from "@/shared/components/ui/button";
import { ErrorAlert } from "@/shared/components/ui/error-alert";
import { Textarea } from "@/shared/components/ui/textarea";
import {
  getStoreOrder,
  runStoreOrderAction,
  type StoreOrderAction,
} from "../store-orders.api";
import { Input } from "@/shared/components/ui/input";
import {
  canCompleteOrder,
  canConfirmOrder,
  canShipOrder,
  pendingReplenishments,
  canStaffCancelDetail,
  canMarkPaid,
  canRemitCod,
  needsRefund,
  formatOrderMoney,
  confirmErrorMessage,
  orderErrorMessage,
} from "@/features/commerce/orders/order.logic";
import {
  PAYMENT_PROVIDER_LABELS,
  type OrderDetail,
} from "@/features/commerce/orders/types/order";
import {
  OrderAmounts,
  OrderItems,
  OrderStatusBadge,
  PaymentResultBadge,
  PaymentStatusBadge,
  paymentMethodLabel,
} from "@/features/commerce/orders/components/order-presentation";
import { documentCodeLabel } from "@/features/stock-documents";
import { BeeLoader } from "@/shared/components/ui/bee-loader";
import { useConfirm } from "@/shared/components/ui/confirm-dialog";
import {
  ReturnDeliveryDialog,
  deliveryActionLabels,
} from "@/features/deliveries";

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
  const [ask, confirmDialog] = useConfirm();
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{
    farmId: string;
    id: string;
    attempt: number;
    detail?: OrderDetail;
    error?: string;
  } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [paidReference, setPaidReference] = useState("");
  const [paidNote, setPaidNote] = useState("");
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReference, setRefundReference] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [returning, setReturning] = useState(false);
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
    setActionError(null);
  }

  async function runAction(action: StoreOrderAction) {
    if (!detail || isSaving || !canWrite) return;
    const refund =
      (action === "cancel" || action === "refund") && needsRefund(detail.order);
    if (action === "cancel" && !cancelReason.trim()) {
      setActionError("Vui lòng nhập lý do hủy.");
      return;
    }
    if (refund && !refundReference.trim()) {
      setActionError("Đơn đã thanh toán: nhập mã giao dịch hoàn tiền.");
      return;
    }
    if (action === "mark-paid" && !paidReference.trim()) {
      setActionError("Vui lòng nhập mã giao dịch ngân hàng đã đối chiếu.");
      return;
    }
    const body =
      action === "cancel"
        ? {
            reason: cancelReason.trim(),
            ...(refund && {
              refundAmount: refundAmount.trim() || detail.order.total,
              refundReference: refundReference.trim(),
            }),
          }
        : action === "refund"
          ? {
              refundAmount: refundAmount.trim() || detail.order.total,
              refundReference: refundReference.trim(),
            }
          : action === "mark-paid"
          ? {
              reference: paidReference.trim(),
              ...(paidNote.trim() && { note: paidNote.trim() }),
            }
          : undefined;
    if (
      action !== "cancel" &&
      !(await ask({
        title: "Xác nhận thao tác đơn hàng",
        description: actionConfirmation(action, detail),
      }))
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
        body,
      );
      applyDetail(data);
      setCancelReason("");
      setPaidReference("");
      setPaidNote("");
      setRefundReference("");
    } catch (error: unknown) {
      setActionError(
        action === "confirm"
          ? confirmErrorMessage(error)
          : orderErrorMessage(error),
      );
      if (error instanceof ApiError && error.status === 409)
        setAttempt((value) => value + 1);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {confirmDialog}
      {returning && detail && (
        <ReturnDeliveryDialog
          farmId={farmId}
          order={detail.order}
          onReturned={() => setAttempt((value) => value + 1)}
          onClose={() => setReturning(false)}
        />
      )}
      <Link href="/store-orders" className="text-sm text-primary underline">
        ← Danh sách đơn hàng
      </Link>
      {!loaded && <BeeLoader label="Đang tải chi tiết đơn hàng…" />}
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
                {detail.order.status === "COMPLETED" && (
                  <p>
                    <Link
                      className="text-primary underline"
                      href={`/store-warranties?orderId=${detail.order.id}`}
                    >
                      Tiếp nhận bảo hành / sửa chữa
                    </Link>
                  </p>
                )}
                {detail.order.paymentMethod === "COD" &&
                  detail.order.status === "COMPLETED" && (
                    <p>
                      {detail.order.codRemittedAt
                        ? `Cửa hàng đã nhận tiền COD ${new Date(detail.order.codRemittedAt).toLocaleString("vi-VN")}`
                        : "Người giao chưa nộp tiền COD"}
                    </p>
                  )}
                {detail.order.refundedAt && (
                  <p>
                    Đã hoàn {formatOrderMoney(detail.order.refundAmount ?? "0")}{" "}
                    · {detail.order.refundReference} ·{" "}
                    {new Date(detail.order.refundedAt).toLocaleString("vi-VN")}
                  </p>
                )}
                {detail.stockIssue ? (
                  <p>
                    Phiếu xuất:{" "}
                    <Link
                      className="text-primary underline"
                      href={`/issues/${encodeURIComponent(detail.stockIssue.id)}`}
                    >
                      {documentCodeLabel(detail.stockIssue.issueCode, detail.stockIssue.id, "PX")} · {detail.stockIssue.status}
                    </Link>
                  </p>
                ) : (
                  <p className="text-muted-foreground">
                    Chưa có phiếu xuất liên kết.
                  </p>
                )}
                {detail.replenishments.length > 0 && (
                  <div>
                    <p>
                      Đang điều chuyển:{" "}
                      {
                        detail.replenishments.filter(
                          (row) => row.status === "CONFIRMED",
                        ).length
                      }
                      /{detail.replenishments.length} phiếu đã về kho bán
                    </p>
                    <ul className="mt-1 space-y-1">
                      {detail.replenishments.map((transfer) => (
                        <li key={transfer.id}>
                          <Link
                            className="text-primary underline"
                            href={`/transfers?id=${encodeURIComponent(transfer.id)}`}
                          >
                            {documentCodeLabel(
                              transfer.transferCode,
                              transfer.id,
                              "CK",
                            )}
                          </Link>{" "}
                          · từ {transfer.fromWarehouseName} · {transfer.status}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Xác nhận đơn không giữ chỗ tồn kho; tồn kho chỉ giảm khi phiếu
                  xuất liên kết được xác nhận.
                </p>
              </div>
            </div>
            {detail.order.paymentMethod === "BANK_TRANSFER" && (
              <section className="rounded-xl border bg-card p-5 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-semibold">Giao dịch chuyển khoản</h2>
                  <Link className="text-primary underline" href="/store-payments">
                    Lịch sử thanh toán
                  </Link>
                </div>
                {detail.payments.length ? (
                  <ul className="mt-3 divide-y">
                    {detail.payments.map((payment) => (
                      <li
                        key={payment.id}
                        className="flex flex-wrap items-center justify-between gap-2 py-2"
                      >
                        <span>
                          <span className="font-medium">
                            {formatOrderMoney(payment.amount)}
                          </span>{" "}
                          <span className="text-muted-foreground">
                            · {PAYMENT_PROVIDER_LABELS[payment.provider]} ·{" "}
                            {new Date(payment.transactionAt).toLocaleString("vi-VN")}
                          </span>
                        </span>
                        <PaymentResultBadge result={payment.result} />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-muted-foreground">
                    Chưa nhận được giao dịch nào cho đơn này.
                  </p>
                )}
              </section>
            )}
            <div className="grid gap-5 lg:grid-cols-[1fr_22rem]">
              <section className="space-y-4 rounded-xl border bg-card p-5">
                <h2 className="font-semibold">Thao tác đơn hàng</h2>
                {!canWrite && (
                  <p className="text-sm text-destructive">
                    Bạn không có quyền xử lý đơn hàng.
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  {canConfirmOrder(detail) && (
                    <Button
                      disabled={!canWrite || isSaving}
                      isLoading={isSaving}
                      onClick={() => void runAction("confirm")}
                    >
                      {detail.order.status === "PREPARING"
                        ? "Xác nhận lại"
                        : "Xác nhận đơn"}
                    </Button>
                  )}
                  {detail.order.status === "CONFIRMED" && (
                    <Button
                      disabled={!canWrite || isSaving || !canShipOrder(detail)}
                      isLoading={isSaving}
                      onClick={() => void runAction("ship")}
                    >
                      Nhận giao
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
                      Đã giao xong
                    </Button>
                  )}
                  {detail.order.status === "SHIPPING" && (
                    <Button
                      variant="outline"
                      disabled={!canWrite || isSaving}
                      onClick={() => setReturning(true)}
                    >
                      Không giao được
                    </Button>
                  )}
                  {canRemitCod(detail.order) && (
                    <Button
                      variant="outline"
                      disabled={!canWrite || isSaving}
                      isLoading={isSaving}
                      onClick={() => void runAction("cod-remit")}
                    >
                      Đã nhận tiền COD
                    </Button>
                  )}
                </div>
                {canMarkPaid(detail.order) && (
                  <div className="space-y-3 border-t pt-4">
                    <p className="text-sm font-medium">
                      Đối soát chuyển khoản thủ công
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Chỉ ghi khi đã thấy tiền về trong sao kê ngân hàng. Mỗi mã
                      giao dịch chỉ dùng được cho một đơn.
                    </p>
                    <label className="block space-y-1 text-sm">
                      <span>Mã giao dịch ngân hàng *</span>
                      <Input
                        value={paidReference}
                        maxLength={100}
                        onChange={(event) =>
                          setPaidReference(event.target.value)
                        }
                        disabled={isSaving || !canWrite}
                      />
                    </label>
                    <label className="block space-y-1 text-sm">
                      <span>Ghi chú đối soát</span>
                      <Input
                        value={paidNote}
                        maxLength={1000}
                        onChange={(event) => setPaidNote(event.target.value)}
                        disabled={isSaving || !canWrite}
                      />
                    </label>
                    <Button
                      variant="outline"
                      disabled={!canWrite || isSaving}
                      isLoading={isSaving}
                      onClick={() => void runAction("mark-paid")}
                    >
                      Ghi nhận đã nhận chuyển khoản
                    </Button>
                  </div>
                )}
                {detail.order.status === "PREPARING" &&
                  (pendingReplenishments(detail).length > 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Kho bán đang thiếu hàng. Đơn sẽ tự chuyển sang “Đã xác
                      nhận” khi kho duyệt xong các phiếu chuyển.
                    </p>
                  ) : (
                    <p className="text-xs text-destructive">
                      Kho bán vẫn thiếu hàng. Chuyển kho thêm hàng sang kho bán
                      rồi bấm “Xác nhận lại”, hoặc hủy đơn.
                    </p>
                  ))}
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
                    {needsRefund(detail.order) && (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="block space-y-1 text-sm">
                          <span>Số tiền đã hoàn (VND) *</span>
                          <Input
                            inputMode="numeric"
                            value={refundAmount}
                            placeholder={detail.order.total}
                            onChange={(event) =>
                              setRefundAmount(event.target.value.replace(/\D/g, ""))
                            }
                            disabled={isSaving || !canWrite}
                          />
                        </label>
                        <label className="block space-y-1 text-sm">
                          <span>Mã giao dịch hoàn tiền / chứng cứ *</span>
                          <Input
                            value={refundReference}
                            maxLength={1000}
                            onChange={(event) =>
                              setRefundReference(event.target.value)
                            }
                            disabled={isSaving || !canWrite}
                          />
                        </label>
                      </div>
                    )}
                    <Button
                      type="button"
                      variant="destructive"
                      disabled={!canWrite || isSaving}
                      isLoading={isSaving}
                      onClick={() => void runAction("cancel")}
                    >
                      {needsRefund(detail.order)
                        ? "Hủy đơn và ghi hoàn tiền"
                        : "Hủy đơn hàng"}
                    </Button>
                  </div>
                )}
                {["RETURNING", "RETURNED"].includes(detail.order.status) &&
                  detail.order.returnReceiptId && (
                    <p className="text-sm">
                      {detail.order.status === "RETURNING"
                        ? "Hàng đang trả về kho bán; tồn chỉ tăng khi kho kiểm nhận và xác nhận "
                        : "Kho đã nhận lại hàng qua "}
                      <Link
                        className="text-primary underline"
                        href={`/receipts?id=${encodeURIComponent(detail.order.returnReceiptId)}`}
                      >
                        phiếu nhập hàng trả
                      </Link>
                      .
                    </p>
                  )}
                {detail.order.status === "RETURNED" &&
                  needsRefund(detail.order) && (
                    <div className="space-y-3 border-t pt-4">
                      <p className="text-sm font-medium">
                        Đơn đã thanh toán: ghi hoàn tiền thủ công
                      </p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="block space-y-1 text-sm">
                          <span>Số tiền đã hoàn (VND) *</span>
                          <Input
                            inputMode="numeric"
                            value={refundAmount}
                            placeholder={detail.order.total}
                            onChange={(event) =>
                              setRefundAmount(event.target.value.replace(/\D/g, ""))
                            }
                            disabled={isSaving || !canWrite}
                          />
                        </label>
                        <label className="block space-y-1 text-sm">
                          <span>Mã giao dịch hoàn tiền / chứng cứ *</span>
                          <Input
                            value={refundReference}
                            maxLength={1000}
                            onChange={(event) =>
                              setRefundReference(event.target.value)
                            }
                            disabled={isSaving || !canWrite}
                          />
                        </label>
                      </div>
                      <Button
                        variant="outline"
                        disabled={!canWrite || isSaving}
                        isLoading={isSaving}
                        onClick={() => void runAction("refund")}
                      >
                        Ghi hoàn tiền
                      </Button>
                    </div>
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
                <div className="space-y-2 border-t pt-4 text-sm">
                  <h2 className="font-semibold">Giao hàng</h2>
                  <p>
                    Người giao:{" "}
                    {detail.shipper?.fullName ??
                      (detail.order.status === "COMPLETED"
                        ? "Không ghi nhận"
                        : "Chưa có")}
                  </p>
                  {detail.deliveryLog.length > 0 && (
                    <ol className="space-y-1 text-muted-foreground">
                      {detail.deliveryLog.map((entry, index) => (
                        <li key={index}>
                          {new Date(entry.createdAt).toLocaleString("vi-VN")} ·{" "}
                          {deliveryActionLabels[entry.action] ?? entry.action}
                          {entry.actorName ? ` · ${entry.actorName}` : ""}
                          {entry.data?.reason ? ` · ${entry.data.reason}` : ""}
                          {entry.data?.reference
                            ? ` · ${entry.data.reference}`
                            : ""}
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              </aside>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function actionConfirmation(action: StoreOrderAction, detail: OrderDetail) {
  if (action === "confirm")
    return `Xác nhận đơn ${detail.order.code}? Hệ thống giữ hàng ở kho bán; nếu kho bán thiếu, đơn không được xác nhận.`;
  if (action === "ship")
    return `Nhận giao đơn ${detail.order.code}? Bạn sẽ được ghi nhận là người giao.`;
  if (action === "complete")
    return `Đơn ${detail.order.code} đã giao xong? COD sẽ được ghi nhận đã thu tiền.`;
  if (action === "refund")
    return `Ghi hoàn tiền thủ công cho đơn ${detail.order.code}? Hệ thống không chuyển tiền, chỉ lưu số tiền và chứng cứ.`;
  if (action === "cod-remit")
    return `Xác nhận đã nhận ${formatOrderMoney(detail.order.total)} tiền COD của đơn ${detail.order.code} từ người giao?`;
  return `Ghi nhận đơn ${detail.order.code} đã nhận chuyển khoản với mã đã nhập?`;
}

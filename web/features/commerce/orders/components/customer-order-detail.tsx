"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Copy,
  Check,
  QrCode,
  Truck,
  Clock,
  CheckCircle2,
  MapPin,
  Phone,
  User,
  FileText,
  Download,
  RefreshCw,
  Printer,
  XCircle,
  Package,
  HelpCircle,
  AlertTriangle,
  Building2,
  CreditCard,
  ShieldCheck,
} from "lucide-react";
import { useAuthenticatedRequest } from "@/features/auth";
import { ApiError } from "@/shared/api/client";
import { Button } from "@/shared/components/ui/button";
import { ErrorAlert } from "@/shared/components/ui/error-alert";
import { Textarea } from "@/shared/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { BeeLoader } from "@/shared/components/ui/bee-loader";
import { Badge } from "@/shared/components/ui/badge";
import { cn } from "@/shared/lib/utils";
import { cancelCustomerOrder, getCustomerOrder } from "../orders.api";
import {
  canCustomerCancel,
  formatOrderMoney,
  orderErrorMessage,
} from "../order.logic";
import type { CustomerOrder, CustomerOrderDetail as CustomerOrderDetailType } from "../types/order";
import {
  OrderStatusBadge,
  PaymentStatusBadge,
  paymentMethodLabel,
} from "./order-presentation";

// Interactive Copy Button with clear visual feedback
function CopyButton({
  text,
  label = "Sao chép",
  successLabel = "Đã sao chép",
  className,
}: {
  text: string;
  label?: string;
  successLabel?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleCopy}
      className={cn(
        "h-8 px-2.5 text-xs font-medium transition-all duration-150 cursor-pointer",
        copied
          ? "border-success/40 bg-success/10 text-success hover:bg-success/15 hover:text-success"
          : "hover:border-primary/40 hover:bg-primary/5",
        className,
      )}
      title={`Sao chép ${text}`}
    >
      {copied ? (
        <>
          <Check className="mr-1.5 size-3.5 text-success" />
          <span>{successLabel}</span>
        </>
      ) : (
        <>
          <Copy className="mr-1.5 size-3.5 text-muted-foreground" />
          <span>{label}</span>
        </>
      )}
    </Button>
  );
}

// 4-step Visual Timeline Tracker for Order Status
function OrderProgressTracker({ order }: { order: CustomerOrder }) {
  if (order.status === "CANCELLED") {
    return (
      <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 sm:p-5 text-sm">
        <div className="flex items-start gap-3.5">
          <div className="grid size-10 shrink-0 place-items-center rounded-full bg-destructive/10 text-destructive">
            <XCircle className="size-5" />
          </div>
          <div className="space-y-1">
            <h3 className="font-semibold text-destructive">
              Đơn hàng này đã được hủy
            </h3>
            <p className="text-xs text-muted-foreground">
              Đã ghi nhận hủy lúc{" "}
              {new Date(order.cancelledAt || order.updatedAt).toLocaleString("vi-VN")}
            </p>
            {order.cancelReason && (
              <p className="text-sm pt-1">
                <span className="font-medium text-foreground">Lý do hủy:</span>{" "}
                <span className="text-muted-foreground">{order.cancelReason}</span>
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  const isPaid = order.paymentStatus === "PAID";
  const isConfirmed = ["CONFIRMED", "SHIPPING", "COMPLETED"].includes(order.status);
  const isShipping = ["SHIPPING", "COMPLETED"].includes(order.status);
  const isCompleted = order.status === "COMPLETED";

  const steps = [
    {
      title: "Đặt hàng",
      desc: new Date(order.createdAt).toLocaleDateString("vi-VN"),
      done: true,
      current: false,
      icon: CheckCircle2,
    },
    {
      title: "Xác nhận & Thanh toán",
      desc: isPaid ? "Đã thanh toán" : isConfirmed ? "Đã duyệt đơn" : "Đang chờ xử lý",
      done: isPaid || isConfirmed,
      current: !isPaid && !isConfirmed,
      icon: CreditCard,
    },
    {
      title: "Vận chuyển",
      desc: isShipping ? (isCompleted ? "Đã giao" : "Đang giao hàng") : "Chờ giao bưu tá",
      done: isCompleted,
      current: order.status === "SHIPPING",
      icon: Truck,
    },
    {
      title: "Hoàn tất",
      desc: isCompleted ? "Thành công" : "Chờ nhận hàng",
      done: isCompleted,
      current: false,
      icon: ShieldCheck,
    },
  ];

  return (
    <div className="rounded-xl border bg-card p-4 sm:p-6 shadow-xs">
      <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Tiến trình đơn hàng
      </h2>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {steps.map((step, idx) => {
          const Icon = step.icon;
          return (
            <div
              key={step.title}
              className={cn(
                "relative flex flex-col items-center rounded-lg p-3 text-center transition-colors sm:items-start sm:text-left",
                step.current && "bg-primary/5 ring-1 ring-primary/20",
              )}
            >
              <div className="flex items-center gap-2 mb-2">
                <div
                  className={cn(
                    "grid size-8 shrink-0 place-items-center rounded-full text-xs font-semibold transition-all",
                    step.done
                      ? "bg-success text-success-foreground shadow-xs"
                      : step.current
                        ? "bg-primary text-primary-foreground animate-pulse"
                        : "bg-muted text-muted-foreground",
                  )}
                >
                  {step.done ? <Check className="size-4" /> : <Icon className="size-4" />}
                </div>
                <span className="hidden text-xs font-mono text-muted-foreground sm:inline">
                  0{idx + 1}
                </span>
              </div>
              <p
                className={cn(
                  "text-xs sm:text-sm font-semibold",
                  step.done
                    ? "text-foreground"
                    : step.current
                      ? "text-primary"
                      : "text-muted-foreground",
                )}
              >
                {step.title}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground line-clamp-1">
                {step.desc}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function CustomerOrderDetail({ id }: { id: string }) {
  const request = useAuthenticatedRequest();
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{
    id: string;
    attempt: number;
    detail?: CustomerOrderDetailType;
    error?: string;
  } | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);

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

  // Refresh quietly while awaiting bank transfer so payment confirmation appears without reload
  const awaitingTransfer = Boolean(
    detail?.payment &&
      detail.order.paymentStatus === "UNPAID" &&
      detail.order.status !== "CANCELLED",
  );

  useEffect(() => {
    if (!awaitingTransfer) return;
    const timer = setInterval(() => {
      void getCustomerOrder(request, id)
        .then(({ data }) =>
          setResult((currentResult) =>
            currentResult?.id === id && currentResult.attempt === attempt
              ? { ...currentResult, detail: data }
              : currentResult,
          ),
        )
        .catch(() => undefined);
  }, 5000);
    return () => clearInterval(timer);
  }, [awaitingTransfer, request, id, attempt]);

  async function handleCancelOrder() {
    if (!detail || !canCustomerCancel(detail.order) || isCancelling) return;
    if (!cancelReason.trim()) {
      setActionError("Vui lòng nhập lý do hủy đơn hàng.");
      return;
    }
    setIsCancelling(true);
    setActionError(null);
    try {
      const res = await cancelCustomerOrder(
        request,
        id,
        cancelReason.trim(),
      );
      setResult((currentResult) =>
        currentResult?.id === id && currentResult.attempt === attempt
          ? { ...currentResult, detail: res.data, error: undefined }
          : currentResult,
      );
      setCancelReason("");
      setIsCancelDialogOpen(false);
    } catch (error: unknown) {
      setActionError(
        error instanceof ApiError && error.status === 409
          ? "Đơn hàng đã chuyển trạng thái hoặc đã thanh toán, nên không thể hủy. Hãy làm mới trang."
          : orderErrorMessage(error),
      );
    } finally {
      setIsCancelling(false);
    }
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      {/* Top Navigation Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          href="/orders"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
        >
          <ArrowLeft className="size-4" />
          <span>Danh sách đơn hàng của tôi</span>
        </Link>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setAttempt((v) => v + 1)}
            className="h-8 gap-1.5 text-xs cursor-pointer"
          >
            <RefreshCw className="size-3.5 text-muted-foreground" />
            <span>Làm mới</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            className="h-8 gap-1.5 text-xs cursor-pointer"
          >
            <Printer className="size-3.5 text-muted-foreground" />
            <span>In đơn hàng</span>
          </Button>
        </div>
      </div>

      {!loaded && <BeeLoader label="Đang tải chi tiết đơn hàng…" />}

      {loadError && (
        <ErrorAlert
          message={loadError}
          onRetry={() => setAttempt((value) => value + 1)}
        />
      )}

      {detail && (
        <>
          {/* Order Header Banner */}
          <div className="flex flex-col gap-4 rounded-xl border bg-card p-5 sm:flex-row sm:items-center sm:justify-between shadow-xs">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                  Đơn hàng #{detail.order.code}
                </h1>
                <CopyButton
                  text={detail.order.code}
                  label="Sao chép mã"
                  className="h-7 text-[11px]"
                />
              </div>
              <p className="flex items-center gap-1.5 text-xs sm:text-sm text-muted-foreground">
                <Clock className="size-3.5" />
                <span>
                  Đặt lúc{" "}
                  {new Date(detail.order.createdAt).toLocaleString("vi-VN", {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                  })}
                </span>
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <OrderStatusBadge status={detail.order.status} />
              <PaymentStatusBadge order={detail.order} />
            </div>
          </div>

          {/* Stepper Progress */}
          <OrderProgressTracker order={detail.order} />

          {/* Main Content Grid: Left Details & Right Summary */}
          <section className="grid gap-6 lg:grid-cols-[1fr_22rem]">
            <div className="space-y-6">
              {/* Payment Hub */}
              {detail.order.paymentMethod === "BANK_TRANSFER" && (
                <div className="overflow-hidden rounded-xl border bg-card shadow-xs">
                  {/* Payment Header */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/40 px-5 py-4">
                    <div className="flex items-center gap-2.5">
                      <div className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary">
                        <QrCode className="size-4" />
                      </div>
                      <div>
                        <h2 className="font-semibold text-sm sm:text-base text-foreground">
                          Thanh toán chuyển khoản VietQR
                        </h2>
                        <p className="text-xs text-muted-foreground">
                          Quét mã QR hoặc chuyển khoản thủ công
                        </p>
                      </div>
                    </div>

                    {detail.order.paymentStatus === "UNPAID" &&
                      detail.order.status !== "CANCELLED" && (
                        <div className="flex items-center gap-2 rounded-full border border-warning/30 bg-warning/10 px-3 py-1 text-xs font-medium text-warning">
                          <span className="relative flex size-2">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-warning opacity-75"></span>
                            <span className="relative inline-flex size-2 rounded-full bg-warning"></span>
                          </span>
                          <span>Đang chờ chuyển khoản</span>
                        </div>
                      )}

                    {detail.order.paymentStatus === "PAID" && (
                      <Badge variant="success" className="gap-1.5 py-1">
                        <CheckCircle2 className="size-3.5" />
                        Đã thanh toán
                      </Badge>
                    )}
                  </div>

                  {/* Payment Content */}
                  <div className="p-5">
                    {detail.order.paymentStatus === "PAID" ? (
                      <div className="rounded-xl border border-success/30 bg-success/5 p-5 text-sm">
                        <div className="flex items-start gap-3.5">
                          <div className="grid size-11 shrink-0 place-items-center rounded-full bg-success/15 text-success">
                            <CheckCircle2 className="size-6" />
                          </div>
                          <div className="space-y-1">
                            <h3 className="text-base font-semibold text-foreground">
                              Thanh toán thành công!
                            </h3>
                            <p className="text-xs text-muted-foreground">
                              Hệ thống đã tự động ghi nhận chuyển khoản lúc{" "}
                              {detail.order.paidAt
                                ? new Date(detail.order.paidAt).toLocaleString("vi-VN")
                                : "vừa xong"}
                              .
                            </p>
                            <p className="mt-2 text-xs text-muted-foreground border-t border-success/20 pt-2">
                              Đơn hàng của quý khách đã hoàn tất thủ tục thanh toán và đang được chuẩn bị để đóng gói gửi đi.
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : detail.payment ? (
                      <div className="grid gap-6 sm:grid-cols-[14rem_1fr] items-start">
                        {/* QR Code Container */}
                        <div className="flex flex-col items-center justify-center rounded-xl border border-border/80 bg-muted/20 p-4 text-center">
                          <div className="relative rounded-lg border border-border/60 bg-white p-2.5 shadow-xs">
                            {/* eslint-disable-next-line @next/next/no-img-element -- server-rendered SVG data URL */}
                            <img
                              src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(detail.payment.qrSvg)}`}
                              alt={`Mã VietQR thanh toán đơn ${detail.order.code}`}
                              className="size-48 sm:size-52 rounded-md object-contain"
                            />
                          </div>
                          <a
                            href={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(detail.payment.qrSvg)}`}
                            download={`VietQR-${detail.order.code}.svg`}
                            className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline cursor-pointer"
                          >
                            <Download className="size-3.5" />
                            <span>Tải ảnh mã QR</span>
                          </a>
                          <p className="mt-2 text-[11px] text-muted-foreground leading-snug">
                            Quét bằng app ngân hàng bất kỳ để tự động điền số tiền và nội dung.
                          </p>
                        </div>

                        {/* Bank Details Table */}
                        <div className="space-y-3">
                          <div className="divide-y rounded-xl border bg-card text-sm">
                            <div className="flex items-center justify-between p-3">
                              <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                                <Building2 className="size-3.5" /> Ngân hàng
                              </span>
                              <span className="font-semibold text-foreground">
                                {detail.payment.bankName}
                              </span>
                            </div>
                            <div className="flex items-center justify-between p-3">
                              <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                                <User className="size-3.5" /> Chủ tài khoản
                              </span>
                              <span className="font-medium text-foreground uppercase">
                                {detail.payment.accountName}
                              </span>
                            </div>
                            <div className="flex items-center justify-between p-3 gap-2">
                              <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                                <CreditCard className="size-3.5" /> Số tài khoản
                              </span>
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-foreground text-sm tracking-wide">
                                  {detail.payment.accountNumber}
                                </span>
                                <CopyButton
                                  text={detail.payment.accountNumber}
                                  label="Sao chép"
                                />
                              </div>
                            </div>
                            <div className="flex items-center justify-between p-3 gap-2">
                              <span className="text-xs text-muted-foreground">
                                Số tiền thanh toán
                              </span>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-base text-primary">
                                  {formatOrderMoney(detail.payment.amount)}
                                </span>
                                <CopyButton
                                  text={detail.payment.amount}
                                  label="Sao chép"
                                />
                              </div>
                            </div>
                          </div>

                          {/* Crucial Transfer Content Box */}
                          <div className="rounded-xl border-2 border-primary/40 bg-accent/30 p-3.5 space-y-1.5">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <p className="text-xs font-semibold text-primary">
                                  Nội dung chuyển khoản (Bắt buộc chính xác):
                                </p>
                                <p className="mt-1 font-mono text-lg font-bold tracking-wider text-foreground">
                                  {detail.payment.content}
                                </p>
                              </div>
                              <CopyButton
                                text={detail.payment.content}
                                label="Sao chép nội dung"
                                className="bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground border-primary"
                              />
                            </div>
                            <p className="text-[11px] text-muted-foreground pt-1">
                              💡 Đơn hàng sẽ được kích hoạt tự động ngay sau khi tiền vào tài khoản nhờ nội dung chuyển khoản trên.
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      detail.order.status !== "CANCELLED" && (
                        <p
                          role="status"
                          className="rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground text-center"
                        >
                          Đơn hàng chưa có thông tin chuyển khoản hiển thị. Vui lòng liên hệ cửa hàng để được hỗ trợ.
                        </p>
                      )
                    )}
                  </div>
                </div>
              )}

              {/* COD Notice */}
              {detail.order.paymentMethod === "COD" && (
                <div className="rounded-xl border bg-card p-5 shadow-xs space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary">
                      <Truck className="size-5" />
                    </div>
                    <div>
                      <h2 className="font-semibold text-foreground">
                        Thanh toán khi nhận hàng (COD)
                      </h2>
                      <p className="text-xs text-muted-foreground">
                        Quý khách sẽ thanh toán tiền mặt trực tiếp cho nhân viên giao nhận
                      </p>
                    </div>
                  </div>
                  <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
                    Số tiền cần thanh toán khi nhận:{" "}
                    <span className="font-semibold text-foreground">
                      {formatOrderMoney(detail.order.total)}
                    </span>
                    . Quý khách vui lòng chuẩn bị số tiền tương ứng trước khi nhân viên liên hệ giao hàng.
                  </div>
                </div>
              )}

              {/* Ordered Items List */}
              <div className="overflow-hidden rounded-xl border bg-card shadow-xs">
                <div className="flex items-center justify-between border-b bg-muted/40 px-5 py-3.5">
                  <div className="flex items-center gap-2">
                    <Package className="size-4 text-primary" />
                    <h2 className="font-semibold text-sm sm:text-base text-foreground">
                      Sản phẩm trong đơn hàng
                    </h2>
                  </div>
                  <Badge variant="outline" className="text-xs font-normal">
                    {detail.items.length} món
                  </Badge>
                </div>

                {/* Table for Tablet/Desktop */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <caption className="sr-only">Sản phẩm trong đơn hàng</caption>
                    <thead className="border-b bg-muted/20 text-xs font-medium text-muted-foreground">
                      <tr>
                        <th scope="col" className="px-5 py-3">Sản phẩm</th>
                        <th scope="col" className="px-4 py-3 text-right">Đơn giá</th>
                        <th scope="col" className="px-4 py-3 text-center">Số lượng</th>
                        <th scope="col" className="px-5 py-3 text-right">Thành tiền</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {detail.items.map((item) => (
                        <tr key={item.id} className="hover:bg-muted/15 transition-colors">
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 font-semibold text-xs border border-amber-200/50">
                                <Package className="size-5" />
                              </div>
                              <div>
                                <p className="font-semibold text-foreground">
                                  {item.productName}
                                </p>
                                {item.variantName && (
                                  <span className="inline-block mt-0.5 rounded-sm bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                                    {item.variantName}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-right text-muted-foreground font-mono">
                            {formatOrderMoney(item.unitPrice)}
                          </td>
                          <td className="px-4 py-4 text-center">
                            <span className="inline-flex items-center justify-center rounded-md bg-muted px-2.5 py-0.5 text-xs font-medium">
                              {item.quantity}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-right font-semibold text-foreground font-mono">
                            {formatOrderMoney(item.lineTotal)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Stacked Cards for Mobile */}
                <div className="divide-y sm:hidden">
                  {detail.items.map((item) => (
                    <div key={item.id} className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-0.5">
                          <p className="font-semibold text-sm text-foreground">
                            {item.productName}
                          </p>
                          {item.variantName && (
                            <span className="inline-block rounded-sm bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                              {item.variantName}
                            </span>
                          )}
                        </div>
                        <span className="font-semibold text-sm text-foreground font-mono">
                          {formatOrderMoney(item.lineTotal)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Đơn giá: {formatOrderMoney(item.unitPrice)}</span>
                        <span>Số lượng: x{item.quantity}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recipient & Shipping Details Card */}
              <div className="rounded-xl border bg-card p-5 shadow-xs space-y-4">
                <div className="flex items-center gap-2 border-b pb-3">
                  <MapPin className="size-4 text-primary" />
                  <h2 className="font-semibold text-sm sm:text-base text-foreground">
                    Thông tin giao nhận
                  </h2>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 text-sm">
                  <div className="space-y-1">
                    <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                      <User className="size-3.5" /> Người nhận
                    </span>
                    <p className="font-medium text-foreground">
                      {detail.order.recipientName}
                    </p>
                    <a
                      href={`tel:${detail.order.phone}`}
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      <Phone className="size-3" />
                      {detail.order.phone}
                    </a>
                  </div>

                  <div className="space-y-1">
                    <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                      <MapPin className="size-3.5" /> Địa chỉ giao hàng
                    </span>
                    <p className="whitespace-pre-wrap text-muted-foreground text-xs leading-relaxed">
                      {detail.order.address}
                    </p>
                  </div>

                  {detail.order.note && (
                    <div className="col-span-full rounded-lg bg-muted/30 p-3 space-y-1 text-xs">
                      <span className="font-medium text-muted-foreground flex items-center gap-1.5">
                        <FileText className="size-3.5" /> Ghi chú đơn hàng:
                      </span>
                      <p className="text-foreground italic">
                        &ldquo;{detail.order.note}&rdquo;
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Sticky Sidebar: Summary & Actions */}
            <aside className="space-y-5 lg:sticky lg:top-24 h-fit">
              {/* Summary Card */}
              <div className="rounded-xl border bg-card p-5 shadow-xs space-y-4">
                <h2 className="font-semibold text-base text-foreground border-b pb-3">
                  Tóm tắt đơn hàng
                </h2>

                <dl className="space-y-2.5 text-sm">
                  <div className="flex justify-between items-center text-muted-foreground">
                    <dt>Tiền hàng ({detail.items.length} món)</dt>
                    <dd className="font-mono text-foreground font-medium">
                      {formatOrderMoney(detail.order.subtotal)}
                    </dd>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-muted-foreground">
                      <dt>Phí giao hàng</dt>
                      <dd className="font-mono text-foreground font-medium">
                        {detail.order.status === "PENDING" &&
                        detail.order.shippingFee === "0"
                          ? "0 ₫ (Chờ xác nhận)"
                          : formatOrderMoney(detail.order.shippingFee)}
                      </dd>
                    </div>
                    {detail.order.status === "PENDING" &&
                      detail.order.shippingFee === "0" && (
                        <p className="text-[11px] text-muted-foreground bg-muted/40 p-2 rounded-md leading-normal">
                          Cửa hàng sẽ liên hệ xác nhận phí giao hàng theo địa chỉ của bạn trước khi gửi hàng.
                        </p>
                      )}
                  </div>

                  <div className="flex justify-between items-center text-muted-foreground text-xs pt-1">
                    <dt>Phương thức</dt>
                    <dd className="font-medium text-foreground text-right">
                      {paymentMethodLabel(detail.order.paymentMethod)}
                    </dd>
                  </div>

                  <div className="border-t pt-3 flex justify-between items-baseline">
                    <dt className="font-semibold text-foreground">Tổng thanh toán</dt>
                    <dd className="text-xl font-bold text-primary font-mono">
                      {formatOrderMoney(detail.order.total)}
                    </dd>
                  </div>
                </dl>

                {/* Support Box */}
                <div className="rounded-lg bg-muted/40 p-3 space-y-1 text-xs">
                  <div className="flex items-center gap-1.5 font-medium text-foreground">
                    <HelpCircle className="size-3.5 text-primary" />
                    <span>Cần trợ giúp đơn hàng?</span>
                  </div>
                  <p className="text-muted-foreground">
                    Liên hệ hotline{" "}
                    <a
                      href="tel:0767611908"
                      className="font-semibold text-primary hover:underline"
                    >
                      0767 611 908
                    </a>{" "}
                    để được nhân viên hỗ trợ nhanh nhất.
                  </p>
                </div>

                {/* Customer Cancel Section - Discreet, Clean, Non-intrusive */}
                {canCustomerCancel(detail.order) && (
                  <div className="pt-2 border-t">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setCancelReason("");
                        setActionError(null);
                        setIsCancelDialogOpen(true);
                      }}
                      className="w-full text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                    >
                      Hủy đơn hàng này
                    </Button>
                  </div>
                )}

                {detail.order.paymentStatus === "PAID" &&
                  detail.order.status !== "CANCELLED" && (
                    <p className="text-center text-[11px] text-muted-foreground pt-1">
                      Đơn hàng đã thanh toán. Để thay đổi thông tin, vui lòng liên hệ trực tiếp cửa hàng.
                    </p>
                  )}
              </div>
            </aside>
          </section>

          {/* Cancellation Dialog Modal */}
          <Dialog open={isCancelDialogOpen} onOpenChange={setIsCancelDialogOpen}>
            <DialogContent theme="storefront" className="sm:max-w-md">
              <DialogHeader>
                <div className="flex items-center gap-3 text-destructive">
                  <div className="grid size-10 shrink-0 place-items-center rounded-full bg-destructive/10">
                    <AlertTriangle className="size-5" />
                  </div>
                  <div>
                    <DialogTitle>Xác nhận hủy đơn hàng</DialogTitle>
                    <DialogDescription className="text-xs text-muted-foreground pt-0.5">
                      Đơn hàng #{detail.order.code}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-3 py-2">
                <p className="text-xs text-muted-foreground">
                  Bạn có chắc chắn muốn hủy đơn hàng này không? Sau khi xác nhận hủy, đơn hàng sẽ không thể khôi phục lại.
                </p>
                <label className="block space-y-1 text-sm">
                  <span className="font-medium text-foreground text-xs">
                    Lý do hủy đơn <span className="text-destructive">*</span>
                  </span>
                  <Textarea
                    required
                    value={cancelReason}
                    maxLength={1000}
                    rows={3}
                    placeholder="Vui lòng nhập lý do bạn muốn hủy đơn hàng này..."
                    onChange={(event) => setCancelReason(event.target.value)}
                    className="text-xs"
                  />
                </label>
                {actionError && (
                  <p role="alert" className="text-xs text-destructive bg-destructive/10 p-2.5 rounded-lg">
                    {actionError}
                  </p>
                )}
              </div>

              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isCancelling}
                  onClick={() => setIsCancelDialogOpen(false)}
                >
                  Quay lại
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={isCancelling}
                  isLoading={isCancelling}
                  onClick={() => void handleCancelOrder()}
                >
                  Xác nhận hủy đơn
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </main>
  );
}

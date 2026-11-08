"use client";

import * as React from "react";
import Link from "next/link";
import { Show, SignInButton } from "@clerk/nextjs";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Package,
  Search,
  ShieldCheck,
  Truck,
  User,
  Wrench,
} from "lucide-react";
import { useAuthenticatedRequest } from "@/features/auth";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Badge } from "@/shared/components/ui/badge";
import { BeeLoader } from "@/shared/components/ui/bee-loader";
import { ErrorAlert } from "@/shared/components/ui/error-alert";
import { cn } from "@/shared/lib/utils";
import { getCustomerOrder, getCustomerOrders } from "../orders.api";
import {
  filterOrdersByLookupQuery,
  formatOrderMoney,
  orderErrorMessage,
  resolveOrderProgressStep,
  storeRegionLabels,
} from "../order.logic";
import {
  WARRANTY_KIND_LABELS,
  WARRANTY_STATUS_LABELS,
  warrantyCoverage,
  type WarrantyStatus,
} from "@/features/store-warranties/warranty.logic";
import type {
  CustomerOrder,
  CustomerOrderDetail,
} from "../types/order";
import {
  OrderStatusBadge,
  PaymentStatusBadge,
  paymentMethodLabel,
} from "./order-presentation";

const ORDER_STEPS = [
  {
    step: 1,
    title: "Chờ xác nhận",
    description: "Ghi nhận đơn & kiểm tra kho bán tại miền",
    icon: Clock,
  },
  {
    step: 2,
    title: "Đã xác nhận & Giữ hàng",
    description: "Tạo phiếu xuất kho giữ lô/Serial thiết bị",
    icon: ClipboardCheck,
  },
  {
    step: 3,
    title: "Đang giao hàng",
    description: "Kho đã xuất hàng và bàn giao vận chuyển",
    icon: Truck,
  },
  {
    step: 4,
    title: "Giao thành công",
    description: "Hoàn tất đơn & kích hoạt bảo hành thiết bị",
    icon: CheckCircle2,
  },
] as const;

function SignedInOrderTracker() {
  const request = useAuthenticatedRequest();
  const [orders, setOrders] = React.useState<CustomerOrder[] | null>(null);
  const [listError, setListError] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");
  const [selectedOrderId, setSelectedOrderId] = React.useState<string | null>(
    null,
  );
  const [detailState, setDetailState] = React.useState<{
    id: string;
    detail?: CustomerOrderDetail;
    error?: string;
  } | null>(null);

  // The error clears when a reload answers, so the effect below sets no state synchronously.
  const loadOrders = React.useCallback(() => {
    void getCustomerOrders(request, 1)
      .then((res) => {
        setListError(null);
        setOrders(res.data);
        if (res.data.length > 0) {
          setSelectedOrderId((prev) => prev ?? res.data[0].id);
        }
      })
      .catch((err: unknown) => {
        setListError(orderErrorMessage(err));
      });
  }, [request]);

  React.useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const filteredOrders = React.useMemo(
    () => (orders ? filterOrdersByLookupQuery(orders, query) : []),
    [orders, query],
  );

  const activeOrderId = React.useMemo(() => {
    if (!filteredOrders.length) return null;
    if (
      selectedOrderId &&
      filteredOrders.some((order) => order.id === selectedOrderId)
    ) {
      return selectedOrderId;
    }
    return filteredOrders[0].id;
  }, [filteredOrders, selectedOrderId]);

  React.useEffect(() => {
    if (!activeOrderId) return;
    let cancelled = false;
    void getCustomerOrder(request, activeOrderId)
      .then((res) => {
        if (!cancelled) {
          setDetailState({ id: activeOrderId, detail: res.data });
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setDetailState({ id: activeOrderId, error: orderErrorMessage(err) });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [request, activeOrderId]);

  if (!orders && !listError) {
    return <BeeLoader label="Đang tải danh sách đơn hàng của bạn…" />;
  }

  if (listError) {
    return <ErrorAlert message={listError} onRetry={loadOrders} />;
  }

  if (orders && orders.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-2xs">
        <Package
          className="mx-auto size-12 text-muted-foreground/50 stroke-1.5"
          aria-hidden="true"
        />
        <h2 className="mt-3 font-serif text-xl font-bold text-foreground">
          Bạn chưa có đơn hàng nào để tra cứu
        </h2>
        <p className="mx-auto mt-1.5 max-w-md text-sm text-muted-foreground">
          Sau khi đặt hàng tại Mộc Ong, bạn có thể theo dõi tiến trình xuất kho,
          vận chuyển và thời hạn bảo hành thiết bị ngay tại đây.
        </p>
        <Link
          href="/products"
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <span>Khám phá sản phẩm</span>
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </div>
    );
  }

  const currentDetail =
    detailState?.id === activeOrderId ? detailState.detail : undefined;
  const currentDetailError =
    detailState?.id === activeOrderId ? detailState.error : undefined;
  const progress = currentDetail
    ? resolveOrderProgressStep(currentDetail.order.status)
    : null;

  return (
    <div className="space-y-6">
      {/* Thanh tìm kiếm nhanh theo mã đơn / SĐT */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="font-serif text-lg font-bold text-foreground">
              Chọn hoặc nhập mã đơn hàng
            </h2>
            <p className="text-xs text-muted-foreground">
              Tra cứu nhanh theo mã đơn (ví dụ: DH000001), tên người nhận hoặc
              số điện thoại.
            </p>
          </div>
          <Link
            href="/orders"
            className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1"
          >
            <span>Xem toàn bộ đơn hàng</span>
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        </div>

        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Nhập mã đơn (VD: DH000012) hoặc số điện thoại nhận hàng…"
            aria-label="Tìm mã đơn hàng"
            className="pl-10 h-11 rounded-xl"
          />
        </div>

        {/* Các chip chọn nhanh đơn gần đây */}
        {filteredOrders.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {filteredOrders.map((order) => {
              const isSelected = order.id === activeOrderId;
              return (
                <button
                  key={order.id}
                  type="button"
                  onClick={() => setSelectedOrderId(order.id)}
                  aria-pressed={isSelected}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs sm:text-sm font-medium transition-colors cursor-pointer",
                    isSelected
                      ? "border-primary bg-primary/10 text-primary font-semibold shadow-2xs"
                      : "border-border bg-background text-foreground hover:bg-muted/70",
                  )}
                >
                  <span>#{order.code}</span>
                  <span className="text-muted-foreground">·</span>
                  <span>{formatOrderMoney(order.total)}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <p role="status" className="text-sm text-muted-foreground">
            Không tìm thấy đơn hàng khớp với từ khóa &ldquo;{query}&rdquo;.
          </p>
        )}
      </div>

      {/* Chi tiết tiến trình của đơn đang chọn */}
      {activeOrderId && !currentDetail && !currentDetailError && (
        <BeeLoader label="Đang tải tiến trình đơn hàng & bảo hành…" />
      )}

      {currentDetailError && (
        <ErrorAlert
          message={currentDetailError}
          onRetry={() => setSelectedOrderId(activeOrderId)}
        />
      )}

      {currentDetail && progress && (
        <div className="rounded-2xl border border-border bg-card p-6 shadow-2xs space-y-6">
          {/* Header đơn hàng */}
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-4">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <h3 className="font-serif text-xl sm:text-2xl font-bold text-foreground">
                  Đơn hàng #{currentDetail.order.code}
                </h3>
                <OrderStatusBadge status={currentDetail.order.status} />
                <PaymentStatusBadge order={currentDetail.order} />
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Người nhận:{" "}
                <strong className="text-foreground">
                  {currentDetail.order.recipientName}
                </strong>{" "}
                · {currentDetail.order.phone}
                {currentDetail.order.region
                  ? ` · ${storeRegionLabels[currentDetail.order.region]}`
                  : ""}{" "}
                ({paymentMethodLabel(currentDetail.order.paymentMethod)})
              </p>
            </div>

            <Link
              href={`/orders/${encodeURIComponent(currentDetail.order.id)}`}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs sm:text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <span>Xem chi tiết & Thao tác đơn</span>
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>

          {/* Thanh tiến trình 4 bước */}
          <div className="space-y-3">
            <p
              className={cn(
                "rounded-xl border px-4 py-3 text-xs sm:text-sm font-medium",
                progress.isTerminalAlert
                  ? "border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200"
                  : "border-emerald-500/30 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200",
              )}
            >
              {progress.summary}
            </p>

            <ol className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {ORDER_STEPS.map((stepObj) => {
                const StepIcon = stepObj.icon;
                const isDone =
                  !progress.isTerminalAlert &&
                  progress.activeStep >= stepObj.step;
                const isCurrent =
                  !progress.isTerminalAlert &&
                  progress.activeStep === stepObj.step;

                return (
                  <li
                    key={stepObj.step}
                    className={cn(
                      "rounded-xl border p-3.5 transition-colors",
                      isCurrent
                        ? "border-primary bg-primary/10"
                        : isDone
                          ? "border-emerald-500/40 bg-emerald-500/5"
                          : "border-border/70 bg-muted/20 opacity-75",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "inline-flex size-7 items-center justify-center rounded-lg text-xs font-bold",
                          isDone
                            ? "bg-emerald-600 text-white"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        <StepIcon className="size-4" aria-hidden="true" />
                      </span>
                      <span className="text-xs sm:text-sm font-semibold text-foreground">
                        {stepObj.step}. {stepObj.title}
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                      {stepObj.description}
                    </p>
                  </li>
                );
              })}
            </ol>
          </div>

          {/* Danh sách sản phẩm & Thời hạn bảo hành */}
          <div className="space-y-3 border-t border-border pt-5">
            <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Sản phẩm & Thời hạn bảo hành thiết bị
            </h4>
            <div className="divide-y divide-border rounded-xl border border-border bg-background/60">
              {currentDetail.items.map((item) => {
                const coverage =
                  currentDetail.order.status === "COMPLETED"
                    ? warrantyCoverage(
                        currentDetail.order.completedAt,
                        item.warrantyMonths,
                      )
                    : null;

                return (
                  <div
                    key={item.id}
                    className="flex flex-wrap items-start justify-between gap-3 p-3.5 text-xs sm:text-sm"
                  >
                    <div className="space-y-1">
                      <p className="font-semibold text-foreground">
                        {item.productName}{" "}
                        <span className="font-normal text-muted-foreground">
                          ({item.variantName}) × {item.quantity}
                        </span>
                      </p>
                      {item.deliveredAssets && item.deliveredAssets.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-0.5">
                          {item.deliveredAssets.map((asset) => (
                            <span
                              key={asset.assetCode}
                              className="inline-flex items-center rounded-md border border-border bg-card px-2 py-0.5 font-mono text-[0.6875rem] text-foreground"
                            >
                              Mã TS: {asset.assetCode}
                              {asset.serialNumber
                                ? ` · Serial: ${asset.serialNumber}`
                                : ""}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {coverage ? (
                        <Badge
                          variant={coverage.inWarranty ? "success" : "secondary"}
                        >
                          {coverage.label}
                        </Badge>
                      ) : item.warrantyMonths && item.warrantyMonths > 0 ? (
                        <Badge variant="info">
                          Bảo hành {item.warrantyMonths} tháng khi giao xong
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Hàng tiêu hao / Vật tư</Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Tiến trình các phiếu bảo hành / sửa chữa (nếu có) */}
          {currentDetail.warranties && currentDetail.warranties.length > 0 && (
            <div className="space-y-3 border-t border-border pt-5">
              <h4 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                <Wrench className="size-4 text-primary" aria-hidden="true" />
                <span>Hồ sơ Bảo hành & Sửa chữa sau bán</span>
              </h4>
              <div className="grid gap-3">
                {currentDetail.warranties.map((w) => (
                  <div
                    key={w.id}
                    className="rounded-xl border border-border bg-muted/20 p-4 space-y-2 text-xs sm:text-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono font-bold text-foreground">
                          #{w.code}
                        </span>
                        <Badge variant="info">
                          {WARRANTY_KIND_LABELS[w.kind]}
                        </Badge>
                        <Badge
                          variant={
                            w.status === "CLOSED"
                              ? "success"
                              : w.status === "CANCELLED"
                                ? "destructive"
                                : "warning"
                          }
                        >
                          {WARRANTY_STATUS_LABELS[w.status as WarrantyStatus] ??
                            w.status}
                        </Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        Tiếp nhận:{" "}
                        {new Date(w.receivedAt).toLocaleDateString("vi-VN")}
                      </span>
                    </div>
                    <p className="text-foreground">
                      <strong>Thiết bị:</strong> {w.productName} ({w.variantName}) × {w.quantity}
                      {w.assetCode ? ` · Mã TS: ${w.assetCode}` : ""}
                      {w.assetSerialNumber
                        ? ` · Serial: ${w.assetSerialNumber}`
                        : ""}
                    </p>
                    {w.quoteAmount && (
                      <p className="text-foreground">
                        <strong>Chi phí báo giá:</strong>{" "}
                        {formatOrderMoney(w.quoteAmount)}
                      </p>
                    )}
                    {w.resolution && (
                      <p className="text-muted-foreground">
                        <strong>Phương án xử lý:</strong>{" "}
                        {w.resolution === "EXCHANGE"
                          ? "Đổi thiết bị mới"
                          : "Sửa chữa & hoàn trả thiết bị"}
                      </p>
                    )}
                    {w.result && (
                      <p className="text-emerald-700 dark:text-emerald-400">
                        <strong>Kết quả xử lý:</strong> {w.result}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function TrackOrderPageContent() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8 space-y-8">
      <nav
        aria-label="Đường dẫn trang"
        className="flex items-center gap-1.5 text-xs sm:text-sm text-muted-foreground"
      >
        <Link href="/" className="hover:text-primary transition-colors">
          Trang chủ
        </Link>
        <span aria-hidden="true">/</span>
        <span className="font-semibold text-foreground">
          Tra cứu đơn hàng & Bảo hành
        </span>
      </nav>

      <header className="space-y-2">
        <h1 className="font-serif text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-foreground">
          Tra cứu Đơn hàng & Tiến độ Bảo hành
        </h1>
        <p className="max-w-2xl text-sm sm:text-base text-muted-foreground leading-relaxed">
          Theo dõi trực tuyến trạng thái giữ hàng tại kho bán, lộ trình giao
          nhận 3 miền và thời hạn bảo hành thiết bị theo mã định danh tài sản
          (Serial).
        </p>
      </header>

      <Show when="signed-out">
        <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-2xs space-y-5">
          <div className="flex items-start gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ShieldCheck className="size-6" aria-hidden="true" />
            </div>
            <div className="space-y-2">
              <h2 className="font-serif text-lg sm:text-xl font-bold text-foreground">
                Đăng nhập để tra cứu đơn hàng và phiếu bảo hành của bạn
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Để bảo vệ thông tin người nhận, số điện thoại và mã định danh
                Serial thiết bị đã bàn giao, hệ thống liên kết trực tiếp đơn
                hàng với tài khoản đặt mua của bạn.
              </p>
              <div className="pt-2 flex flex-wrap gap-3">
                <SignInButton>
                  <Button type="button" className="gap-2 cursor-pointer">
                    <User className="size-4" aria-hidden="true" />
                    <span>Đăng nhập tra cứu ngay</span>
                  </Button>
                </SignInButton>
                <Link
                  href="/policy/returns"
                  className="inline-flex h-10 items-center justify-center rounded-xl border border-border bg-background px-4 text-sm font-medium text-foreground hover:bg-muted transition-colors"
                >
                  Xem chính sách bảo hành & đổi trả
                </Link>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 border-t border-border pt-5 sm:grid-cols-2 lg:grid-cols-4">
            {ORDER_STEPS.map((stepObj) => {
              const StepIcon = stepObj.icon;
              return (
                <div
                  key={stepObj.step}
                  className="rounded-xl border border-border/70 bg-muted/20 p-3.5"
                >
                  <div className="flex items-center gap-2">
                    <StepIcon
                      className="size-4 text-primary shrink-0"
                      aria-hidden="true"
                    />
                    <span className="text-xs font-semibold text-foreground">
                      Bước {stepObj.step}: {stepObj.title}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {stepObj.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </Show>

      <Show when="signed-in">
        <SignedInOrderTracker />
      </Show>
    </main>
  );
}

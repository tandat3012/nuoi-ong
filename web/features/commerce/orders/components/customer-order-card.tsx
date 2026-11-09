"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Store,
  Clock,
  Truck,
  CheckCircle2,
  XCircle,
  Package,
  RotateCcw,
  ShieldCheck,
  CreditCard,
  QrCode,
  Copy,
  Check,
  ChevronRight,
  ShoppingBag,
  PhoneCall,
} from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { cn } from "@/shared/lib/utils";
import {
  canCustomerCancel,
  formatOrderMoney,
} from "../order.logic";
import type {
  CustomerOrder,
  CustomerOrderDetail,
} from "../types/order";

interface CustomerOrderCardProps {
  order: CustomerOrder;
  detail?: CustomerOrderDetail;
  isLoadingDetail?: boolean;
  onPayNow: (detail: CustomerOrderDetail) => void;
  onCancelOrder: (order: CustomerOrder) => void;
  onReorder: (detail: CustomerOrderDetail) => void;
  onContactSupport: (order: CustomerOrder) => void;
}

function CopyCodeButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      title="Sao chép mã đơn hàng"
      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
    >
      {copied ? (
        <Check className="size-3 text-emerald-600" />
      ) : (
        <Copy className="size-3" />
      )}
      <span className="text-[11px]">{copied ? "Đã chép" : "Sao chép"}</span>
    </button>
  );
}

function ShopeeStatusHeader({ order }: { order: CustomerOrder }) {
  const isPaid = order.paymentStatus === "PAID";
  const isBankUnpaid =
    order.paymentMethod === "BANK_TRANSFER" && order.paymentStatus === "UNPAID";

  const renderStatus = () => {
    switch (order.status) {
      case "SHIPPING":
        return (
          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            <Truck className="size-4 animate-bounce" />
            <span>ĐANG VẬN CHUYỂN</span>
          </div>
        );
      case "COMPLETED":
        return (
          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="size-4" />
            <span>GIAO HÀNG THÀNH CÔNG</span>
          </div>
        );
      case "CANCELLED":
        return (
          <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400">
            <XCircle className="size-4" />
            <span>ĐÃ HỦY</span>
          </div>
        );
      case "RETURNING":
      case "RETURNED":
        return (
          <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
            <RotateCcw className="size-4" />
            <span>TRẢ HÀNG / HOÀN TIỀN</span>
          </div>
        );
      case "CONFIRMED":
        return (
          <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400">
            <ShieldCheck className="size-4" />
            <span>ĐÃ XÁC NHẬN</span>
          </div>
        );
      case "PREPARING":
        return (
          <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
            <Package className="size-4" />
            <span>ĐANG CHUẨN BỊ HÀNG</span>
          </div>
        );
      case "PENDING":
      default:
        return (
          <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
            <Clock className="size-4" />
            <span>CHỜ XÁC NHẬN</span>
          </div>
        );
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-card px-4 py-3 sm:px-6">
      {/* Shop Info & Order Code */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs">
        <div className="flex items-center gap-1.5 font-bold text-foreground">
          <Store className="size-4 text-primary" />
          <span>Mộc Ong Farm</span>
          <span className="rounded bg-primary/15 text-primary text-[10px] font-semibold px-1.5 py-0.2">
            Chính hãng
          </span>
        </div>

        <span className="text-muted-foreground/40 hidden sm:inline">|</span>

        <div className="flex items-center gap-1.5">
          <span className="font-mono font-medium text-foreground">#{order.code}</span>
          <CopyCodeButton code={order.code} />
        </div>

        <span className="text-muted-foreground/40 hidden md:inline">|</span>

        <span className="text-muted-foreground text-[11px] hidden md:inline-flex items-center gap-1">
          <Clock className="size-3" />
          {new Date(order.createdAt).toLocaleString("vi-VN", {
            hour: "2-digit",
            minute: "2-digit",
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
          })}
        </span>
      </div>

      {/* Status Indicators */}
      <div className="flex items-center gap-2.5">
        {renderStatus()}

        <span className="text-muted-foreground/30">|</span>

        {isPaid ? (
          <Badge variant="success" className="text-[11px] py-0 px-2 font-normal">
            Đã thanh toán
          </Badge>
        ) : isBankUnpaid ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-500 opacity-75"></span>
              <span className="relative inline-flex size-1.5 rounded-full bg-amber-500"></span>
            </span>
            Chờ chuyển khoản
          </span>
        ) : (
          <Badge variant="secondary" className="text-[11px] py-0 px-2 font-normal">
            COD
          </Badge>
        )}
      </div>
    </div>
  );
}

export function CustomerOrderCard({
  order,
  detail,
  isLoadingDetail = false,
  onPayNow,
  onCancelOrder,
  onReorder,
  onContactSupport,
}: CustomerOrderCardProps) {
  const items = detail?.items ?? [];
  const totalItemsCount = items.reduce((acc, it) => acc + it.quantity, 0);

  const canCancel = canCustomerCancel(order);
  const isUnpaidBank =
    order.paymentMethod === "BANK_TRANSFER" &&
    order.paymentStatus === "UNPAID" &&
    order.status !== "CANCELLED";
  const canReorder = items.length > 0;

  return (
    <article className="group rounded-2xl border bg-card shadow-xs transition-all duration-200 hover:shadow-md hover:border-primary/30 overflow-hidden">
      {/* 1. Header with Shop info & Status */}
      <ShopeeStatusHeader order={order} />

      {/* 2. Product Items list (Shopee Style) */}
      <div className="divide-y divide-border/60 px-4 sm:px-6">
        {isLoadingDetail && !items.length ? (
          /* Skeleton Loader */
          <div className="space-y-3 py-4">
            <div className="flex items-center gap-3 sm:gap-4 animate-pulse">
              <div className="size-16 sm:size-20 rounded-xl bg-muted/60 shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-3/5 rounded bg-muted/60" />
                <div className="h-3 w-1/4 rounded bg-muted/40" />
              </div>
              <div className="h-4 w-20 rounded bg-muted/60 shrink-0" />
            </div>
          </div>
        ) : items.length > 0 ? (
          /* Render Items */
          items.map((item) => (
            <div
              key={item.id}
              className="flex items-start sm:items-center gap-3 sm:gap-4 py-3.5 sm:py-4 transition-colors"
            >
              {/* Thumbnail Image */}
              <Link
                href={
                  item.productSlug
                    ? `/products/${encodeURIComponent(item.productSlug)}`
                    : `/orders/${encodeURIComponent(order.id)}`
                }
                className="relative size-16 sm:size-20 shrink-0 overflow-hidden rounded-xl border bg-muted/20 hover:opacity-90 transition-opacity"
              >
                {item.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.imageUrl}
                    alt={item.productName}
                    className="size-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="grid size-full place-items-center bg-primary/5 text-primary/40">
                    <Package className="size-7" />
                  </div>
                )}
              </Link>

              {/* Product Info */}
              <div className="min-w-0 flex-1 space-y-1">
                <Link
                  href={
                    item.productSlug
                      ? `/products/${encodeURIComponent(item.productSlug)}`
                      : `/orders/${encodeURIComponent(order.id)}`
                  }
                  className="line-clamp-2 text-sm sm:text-base font-medium text-foreground hover:text-primary transition-colors"
                >
                  {item.productName}
                </Link>

                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {item.variantName && item.variantName !== "Default" && (
                    <span className="inline-flex items-center rounded bg-muted/70 px-1.5 py-0.5 text-xs text-muted-foreground">
                      Phân loại: {item.variantName}
                    </span>
                  )}
                  <span className="font-medium text-foreground/80">x{item.quantity}</span>
                  {item.warrantyMonths && item.warrantyMonths > 0 && (
                    <span className="inline-flex items-center gap-1 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 text-[11px] font-medium border border-blue-500/20">
                      <ShieldCheck className="size-3" />
                      Bảo hành {item.warrantyMonths} tháng
                    </span>
                  )}
                </div>
              </div>

              {/* Price */}
              <div className="text-right shrink-0 space-y-0.5">
                <div className="text-sm sm:text-base font-semibold text-foreground font-mono">
                  {formatOrderMoney(item.unitPrice)}
                </div>
                {item.quantity > 1 && (
                  <div className="text-xs text-muted-foreground font-mono">
                    Tổng: {formatOrderMoney(item.lineTotal)}
                  </div>
                )}
              </div>
            </div>
          ))
        ) : (
          /* Minimal Summary if items not yet loaded */
          <div className="py-4 text-xs text-muted-foreground flex items-center justify-between">
            <span>Chi tiết sản phẩm đang được tải...</span>
            <span className="font-mono font-medium text-foreground">
              {formatOrderMoney(order.total)}
            </span>
          </div>
        )}
      </div>

      {/* 3. Summary Bar (Total Amount & Payment Method) */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-muted/10 px-4 py-3 sm:px-6">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-2.5 py-1 font-medium text-foreground">
            {order.paymentMethod === "COD" ? (
              <>
                <CreditCard className="size-3.5 text-muted-foreground" />
                <span>Thanh toán khi nhận hàng (COD)</span>
              </>
            ) : (
              <>
                <QrCode className="size-3.5 text-primary" />
                <span>Chuyển khoản VietQR</span>
              </>
            )}
          </span>

          {Number(order.shippingFee) > 0 && (
            <span className="text-[11px] text-muted-foreground hidden sm:inline">
              (Gồm {formatOrderMoney(order.shippingFee)} phí giao hàng)
            </span>
          )}

          {order.note && (
            <span className="text-[11px] text-muted-foreground italic truncate max-w-xs">
              Ghi chú: {order.note}
            </span>
          )}
        </div>

        <div className="flex items-baseline gap-2">
          <span className="text-xs sm:text-sm text-muted-foreground">
            Thành tiền {totalItemsCount > 0 ? `(${totalItemsCount} sản phẩm)` : ""}:
          </span>
          <span className="text-lg sm:text-xl font-bold text-primary font-mono tracking-tight">
            {formatOrderMoney(order.total)}
          </span>
        </div>
      </div>

      {/* 4. Action Buttons Footer */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 border-t bg-card px-4 py-3 sm:px-6">
        {/* Left Side: Support helper */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onContactSupport(order)}
          className="text-xs text-muted-foreground hover:text-foreground gap-1.5 h-8 px-2.5 cursor-pointer"
        >
          <PhoneCall className="size-3.5" />
          <span>Hỗ trợ</span>
        </Button>

        {/* Right Side: Primary and Secondary Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {canCancel && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onCancelOrder(order)}
              className="text-xs text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30 h-8 cursor-pointer"
            >
              Hủy đơn hàng
            </Button>
          )}

          {isUnpaidBank && (
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={() => detail && onPayNow(detail)}
              className="text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-semibold gap-1.5 h-8 shadow-xs cursor-pointer"
            >
              <QrCode className="size-3.5" />
              <span>Thanh toán ngay</span>
            </Button>
          )}

          {canReorder && (
            <Button
              type="button"
              variant={isUnpaidBank ? "outline" : "default"}
              size="sm"
              onClick={() => detail && onReorder(detail)}
              className={cn(
                "text-xs gap-1.5 h-8 cursor-pointer",
                !isUnpaidBank && "bg-primary hover:bg-primary/90 text-primary-foreground font-medium shadow-xs"
              )}
            >
              <ShoppingBag className="size-3.5" />
              <span>Mua lại</span>
            </Button>
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            asChild
            className="text-xs h-8 gap-1 cursor-pointer hover:border-primary/50"
          >
            <Link href={`/orders/${encodeURIComponent(order.id)}`}>
              <span>Xem chi tiết</span>
              <ChevronRight className="size-3 text-muted-foreground" />
            </Link>
          </Button>
        </div>
      </div>
    </article>
  );
}

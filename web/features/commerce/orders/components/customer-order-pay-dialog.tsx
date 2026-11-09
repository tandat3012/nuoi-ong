"use client";

import { useState } from "react";
import {
  QrCode,
  Copy,
  Check,
  Download,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { formatOrderMoney } from "../order.logic";
import type { CustomerOrderDetail } from "../types/order";

interface CustomerOrderPayDialogProps {
  isOpen: boolean;
  onClose: () => void;
  orderDetail?: CustomerOrderDetail | null;
}

export function CustomerOrderPayDialog({
  isOpen,
  onClose,
  orderDetail,
}: CustomerOrderPayDialogProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handleCopy = async (field: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      // fallback
    }
  };

  if (!orderDetail) return null;

  const { order, payment } = orderDetail;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl p-0 overflow-hidden sm:rounded-2xl border bg-card shadow-2xl">
        <DialogHeader className="p-5 sm:p-6 bg-gradient-to-r from-primary/10 via-amber-500/10 to-transparent border-b">
          <div className="flex items-center gap-2.5 text-primary">
            <div className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-xs">
              <QrCode className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-lg sm:text-xl font-bold text-foreground">
                Thanh toán đơn hàng #{order.code}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Quét mã VietQR hoặc chuyển khoản thủ công chính xác số tiền bên dưới
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-5 sm:p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {!payment ? (
            <div className="py-8 text-center space-y-3">
              <AlertCircle className="size-10 text-muted-foreground mx-auto" />
              <p className="text-sm text-muted-foreground">
                Thông tin thanh toán ngân hàng đang được chuẩn bị hoặc đơn hàng không hỗ trợ chuyển khoản.
              </p>
              <Link
                href={`/orders/${encodeURIComponent(order.id)}`}
                onClick={onClose}
                className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md border border-border bg-card px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                Xem chi tiết đơn hàng
              </Link>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-[13rem_1fr] items-start">
              {/* QR Image Box */}
              <div className="flex flex-col items-center justify-center rounded-xl border bg-muted/20 p-4 text-center shadow-xs">
                <div className="relative rounded-lg border bg-white p-2 shadow-xs">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(payment.qrSvg)}`}
                    alt={`Mã VietQR thanh toán đơn ${order.code}`}
                    className="size-44 object-contain"
                  />
                </div>
                <a
                  href={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(payment.qrSvg)}`}
                  download={`VietQR-${order.code}.svg`}
                  className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline cursor-pointer"
                >
                  <Download className="size-3.5" />
                  <span>Tải ảnh mã QR</span>
                </a>
                <p className="mt-2 text-[11px] text-muted-foreground leading-tight">
                  Mở ứng dụng ngân hàng quét mã để tự động nhập đầy đủ thông tin
                </p>
              </div>

              {/* Bank Details Table */}
              <div className="space-y-3 text-sm">
                <div className="rounded-xl border bg-muted/30 p-4 space-y-2.5">
                  <div className="flex items-center justify-between text-xs text-muted-foreground pb-2 border-b">
                    <span>Ngân hàng thụ hưởng</span>
                    <span className="font-semibold text-foreground">{payment.bankName}</span>
                  </div>

                  <div className="flex items-center justify-between text-xs text-muted-foreground pb-2 border-b">
                    <span>Chủ tài khoản</span>
                    <span className="font-semibold text-foreground uppercase">{payment.accountName}</span>
                  </div>

                  <div className="flex items-center justify-between gap-2 pb-2 border-b">
                    <span className="text-xs text-muted-foreground">Số tài khoản</span>
                    <div className="flex items-center gap-1.5 font-mono font-bold text-foreground">
                      <span>{payment.accountNumber}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopy("accountNumber", payment.accountNumber)}
                        className="h-6 px-1.5 text-[11px] text-primary hover:bg-primary/10 cursor-pointer"
                      >
                        {copiedField === "accountNumber" ? (
                          <Check className="size-3 text-emerald-600" />
                        ) : (
                          <Copy className="size-3" />
                        )}
                        <span className="sr-only">Sao chép số tài khoản</span>
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pb-2 border-b">
                    <span className="text-xs text-muted-foreground">Số tiền thanh toán</span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-base text-primary font-mono">
                        {formatOrderMoney(order.total)}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopy("amount", order.total)}
                        className="h-6 px-1.5 text-[11px] text-primary hover:bg-primary/10 cursor-pointer"
                      >
                        {copiedField === "amount" ? (
                          <Check className="size-3 text-emerald-600" />
                        ) : (
                          <Copy className="size-3" />
                        )}
                        <span className="sr-only">Sao chép số tiền</span>
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <span className="text-xs text-muted-foreground block">Nội dung chuyển khoản</span>
                      <span className="text-[10px] text-rose-500 font-medium">Bắt buộc nhập chính xác</span>
                    </div>
                    <div className="flex items-center gap-1.5 font-mono font-bold text-foreground bg-primary/10 px-2 py-1 rounded-md text-primary">
                      <span>{payment.content}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopy("content", payment.content)}
                        className="h-6 px-1.5 text-[11px] text-primary hover:bg-primary/20 cursor-pointer"
                      >
                        {copiedField === "content" ? (
                          <Check className="size-3 text-emerald-600" />
                        ) : (
                          <Copy className="size-3" />
                        )}
                        <span className="sr-only">Sao chép nội dung</span>
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-200">
                  <ShieldCheck className="size-4 shrink-0 text-amber-600 mt-0.5" />
                  <p>
                    Hệ thống sẽ tự động xác nhận đơn hàng trong vòng 1-3 phút sau khi nhận được chuyển khoản thành công.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5 bg-muted/20 border-t">
          <Button variant="outline" size="sm" onClick={onClose} className="cursor-pointer">
            Đóng
          </Button>
          <Link
            href={`/orders/${encodeURIComponent(order.id)}`}
            onClick={onClose}
            className="inline-flex h-8 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground shadow-xs transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <span>Trang chi tiết đơn hàng</span>
            <ExternalLink className="size-3.5" />
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  );
}

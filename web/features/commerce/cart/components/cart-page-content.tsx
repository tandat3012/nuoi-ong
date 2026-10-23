'use client';

import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  ShoppingBag,
  Package,
  Trash2,
  Plus,
  Minus,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  ShieldCheck,
  Truck,
  RotateCcw,
} from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { formatVndCurrency } from '@/shared/lib/currency';
import { useCart } from '../hooks/use-cart';

export function CartPageContent() {
  const {
    items,
    totalUnits,
    subtotal,
    isHydrated,
    updateQuantity,
    removeItem,
    clearCart,
  } = useCart();

  // Prevent flash of empty cart before hydration completes
  if (!isHydrated) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-48 rounded-lg bg-muted/60" />
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-8 space-y-4">
              <div className="h-28 rounded-2xl bg-muted/40" />
              <div className="h-28 rounded-2xl bg-muted/40" />
            </div>
            <div className="lg:col-span-4">
              <div className="h-64 rounded-2xl bg-muted/40" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      {/* Breadcrumb */}
      <nav aria-label="Đường dẫn trang" className="mb-6 flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
        <Link href="/" className="hover:text-primary transition-colors">
          Trang chủ
        </Link>
        <span aria-hidden="true">/</span>
        <span className="font-semibold text-foreground">Giỏ hàng</span>
      </nav>

      {/* Tiêu đề & Tổng số lượng */}
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 mb-8">
        <h1 className="font-serif text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-[#2d241e] dark:text-foreground">
          Giỏ hàng của bạn
        </h1>
        {items.length > 0 && (
          <span className="text-sm text-muted-foreground">
            Tổng cộng {totalUnits} sản phẩm ({items.length} phân loại)
          </span>
        )}
      </div>

      {items.length === 0 ? (
        /* Empty State */
        <div className="rounded-2xl border border-[#ede6dc] dark:border-border/80 bg-card p-8 sm:p-16 text-center max-w-2xl mx-auto shadow-2xs">
          <div className="inline-flex rounded-full bg-[#faf5ee] dark:bg-muted/40 p-6 mb-5 text-[#8c827a] dark:text-muted-foreground">
            <ShoppingBag className="size-12 stroke-1" aria-hidden="true" />
          </div>
          <h2 className="font-serif text-xl sm:text-2xl font-bold text-[#2d241e] dark:text-foreground mb-2">
            Giỏ hàng của bạn đang trống
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground max-w-md mx-auto mb-8 leading-relaxed">
            Bạn chưa chọn sản phẩm nào. Hãy khám phá danh mục mật ong thiên nhiên và thiết bị nuôi ong từ Mộc Ong nhé.
          </p>
          <Link
            href="/products"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground font-semibold px-8 py-3 text-sm sm:text-base shadow-xs hover:bg-primary/90 transition-colors"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            <span>Khám phá sản phẩm</span>
          </Link>
        </div>
      ) : (
        /* Non-empty 2-Column Responsive Layout */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Cột trái: Danh sách sản phẩm trong giỏ */}
          <div className="lg:col-span-8 flex flex-col gap-4">
            <div className="rounded-2xl border border-[#ede6dc] dark:border-border/80 bg-card shadow-2xs overflow-hidden">
              {/* Header hàng bảng desktop */}
              <div className="hidden sm:grid sm:grid-cols-12 gap-4 px-6 py-3.5 border-b border-[#ede6dc] dark:border-border/80 bg-[#fbf9f5] dark:bg-muted/30 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <span className="sm:col-span-6">Sản phẩm</span>
                <span className="sm:col-span-2 text-right">Đơn giá</span>
                <span className="sm:col-span-2 text-center">Số lượng</span>
                <span className="sm:col-span-2 text-right">Thành tiền</span>
              </div>

              {/* Danh sách các dòng sản phẩm */}
              <div className="divide-y divide-[#ede6dc] dark:divide-border/60">
                {items.map((item) => {
                  const formattedLineTotal = formatVndCurrency(item.unitPrice * item.quantity);
                  const formattedUnitPrice = formatVndCurrency(item.unitPrice);
                  const isUnavailable = !item.inStock || item.isUnavailable;

                  return (
                    <div
                      key={item.id}
                      className="p-4 sm:p-6 sm:grid sm:grid-cols-12 sm:gap-4 sm:items-center flex flex-col gap-3"
                    >
                      {/* Cột 1: Ảnh & Tên */}
                      <div className="sm:col-span-6 flex gap-4 items-center">
                        <Link
                          href={`/products/${item.productSlug}`}
                          className="relative size-16 sm:size-20 shrink-0 overflow-hidden rounded-xl border border-[#ede6dc] dark:border-border/80 bg-[#fbf9f5] dark:bg-muted/20"
                          tabIndex={-1}
                          aria-hidden="true"
                        >
                          {item.image?.src ? (
                            <Image
                              src={item.image.src}
                              alt={item.image.alt || item.productName}
                              fill
                              sizes="80px"
                              className="object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-muted-foreground/40">
                              <Package className="size-8 stroke-1" aria-hidden="true" />
                            </div>
                          )}
                        </Link>

                        <div className="min-w-0 flex-1">
                          <Link
                            href={`/products/${item.productSlug}`}
                            className="font-medium text-sm sm:text-base text-[#2d241e] dark:text-foreground hover:text-primary transition-colors line-clamp-2 leading-snug"
                          >
                            {item.productName}
                          </Link>

                          {item.variantName && (
                            <p className="mt-1 text-xs text-muted-foreground font-medium">
                              Quy cách: {item.variantName}
                            </p>
                          )}

                          {isUnavailable && (
                            <div className="mt-1.5 flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400 font-medium">
                              <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />
                              <span>Tạm hết hàng</span>
                            </div>
                          )}

                          {item.isPriceChanged && (
                            <div className="mt-1 text-xs text-primary font-medium">
                              Giá đã cập nhật theo hệ thống
                            </div>
                          )}

                          <button
                            type="button"
                            onClick={() => removeItem(item.id)}
                            className="mt-2 text-xs text-muted-foreground hover:text-destructive transition-colors flex items-center gap-1 sm:hidden"
                          >
                            <Trash2 className="size-3.5" aria-hidden="true" />
                            <span>Xóa</span>
                          </button>
                        </div>
                      </div>

                      {/* Cột 2: Đơn giá */}
                      <div className="sm:col-span-2 sm:text-right flex items-baseline justify-between sm:block">
                        <span className="sm:hidden text-xs text-muted-foreground">Đơn giá:</span>
                        <span className="text-sm font-medium text-[#453c35] dark:text-muted-foreground">
                          {formattedUnitPrice}
                        </span>
                      </div>

                      {/* Cột 3: Bộ điều chỉnh số lượng */}
                      <div className="sm:col-span-2 flex items-center justify-between sm:justify-center">
                        <span className="sm:hidden text-xs text-muted-foreground">Số lượng:</span>
                        <div className="flex items-center rounded-lg border border-[#e5dcd1] dark:border-border bg-background">
                          <button
                            type="button"
                            disabled={item.quantity <= 1}
                            onClick={() => updateQuantity(item.id, item.quantity - 1)}
                            aria-label={`Giảm số lượng ${item.productName}`}
                            className="size-8 flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                          >
                            <Minus className="size-3.5" aria-hidden="true" />
                          </button>
                          <span
                            className="w-10 text-center text-xs sm:text-sm font-semibold text-foreground select-none"
                            aria-label={`Số lượng: ${item.quantity}`}
                          >
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            disabled={
                              item.purchaseLimit !== undefined &&
                              item.quantity >= item.purchaseLimit
                            }
                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                            aria-label={`Tăng số lượng ${item.productName}`}
                            className="size-8 flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                          >
                            <Plus className="size-3.5" aria-hidden="true" />
                          </button>
                        </div>
                      </div>

                      {/* Cột 4: Thành tiền & Nút xóa desktop */}
                      <div className="sm:col-span-2 sm:text-right flex items-center justify-between sm:justify-end gap-3">
                        <span className="sm:hidden text-xs text-muted-foreground">Thành tiền:</span>
                        <div className="flex items-center gap-3">
                          <span className="font-semibold text-sm sm:text-base text-[#2d241e] dark:text-foreground">
                            {formattedLineTotal}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeItem(item.id)}
                            aria-label={`Xóa ${item.productName} khỏi giỏ hàng`}
                            className="hidden sm:inline-flex text-muted-foreground/50 hover:text-destructive transition-colors p-1 rounded-md"
                          >
                            <Trash2 className="size-4" aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Chân bảng: Nút Xóa hết & Tiếp tục mua sắm */}
              <div className="p-4 sm:px-6 sm:py-4 border-t border-[#ede6dc] dark:border-border/80 bg-[#fbf9f5] dark:bg-muted/20 flex flex-wrap items-center justify-between gap-3">
                <Link
                  href="/products"
                  className="text-xs sm:text-sm text-muted-foreground hover:text-primary gap-1.5 inline-flex items-center font-medium transition-colors"
                >
                  <ArrowLeft className="size-3.5" aria-hidden="true" />
                  <span>Tiếp tục chọn mua sản phẩm</span>
                </Link>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={clearCart}
                  className="text-xs sm:text-sm text-muted-foreground/80 hover:text-destructive gap-1.5"
                >
                  <Trash2 className="size-3.5" aria-hidden="true" />
                  <span>Xóa tất cả</span>
                </Button>
              </div>
            </div>

            {/* Cam kết dịch vụ */}
            <div className="mt-4 rounded-2xl border border-[#ede6dc] dark:border-border/80 bg-card p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs sm:text-sm text-muted-foreground">
              <div className="flex items-center gap-3">
                <Truck className="size-5 text-primary shrink-0" aria-hidden="true" />
                <span>Giao hàng toàn quốc an toàn</span>
              </div>
              <div className="flex items-center gap-3">
                <ShieldCheck className="size-5 text-primary shrink-0" aria-hidden="true" />
                <span>100% sản phẩm chính hãng</span>
              </div>
              <div className="flex items-center gap-3">
                <RotateCcw className="size-5 text-primary shrink-0" aria-hidden="true" />
                <span>Hỗ trợ đổi trả trong 7 ngày</span>
              </div>
            </div>
          </div>

          {/* Cột phải: Thẻ tóm tắt đơn hàng (Order Summary Card) */}
          <div className="lg:col-span-4">
            <div className="rounded-2xl border border-[#ede6dc] dark:border-border/80 bg-card p-6 shadow-2xs sticky top-6">
              <h2 className="font-serif text-lg sm:text-xl font-bold text-[#2d241e] dark:text-foreground mb-4">
                Tóm tắt đơn hàng
              </h2>

              <div className="space-y-3 border-b border-[#ede6dc] dark:border-border/80 pb-4 text-sm">
                <div className="flex justify-between items-center text-muted-foreground">
                  <span>Số lượng:</span>
                  <span className="font-medium text-foreground">{totalUnits} sản phẩm</span>
                </div>

                <div className="flex justify-between items-center text-muted-foreground">
                  <span>Phí vận chuyển:</span>
                  <span className="font-medium text-foreground">Tính khi thanh toán</span>
                </div>
              </div>

              {/* Tạm tính */}
              <div className="py-4 border-b border-[#ede6dc] dark:border-border/80">
                <div className="flex justify-between items-baseline">
                  <span className="text-base font-medium text-foreground">Tạm tính:</span>
                  <span className="font-serif text-2xl font-bold text-[#2d241e] dark:text-foreground">
                    {formatVndCurrency(subtotal)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                  (Giá đã bao gồm VAT. Phí vận chuyển và mã ưu đãi sẽ được áp dụng ở bước thanh toán)
                </p>
              </div>

              {/* Nút hành động */}
              <div className="pt-6 flex flex-col gap-3">
                <Button
                  type="button"
                  disabled
                  aria-disabled="true"
                  aria-label="Tiến hành thanh toán (Chức năng đặt hàng đang chuẩn bị)"
                  className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-semibold text-base flex items-center justify-center gap-2 cursor-not-allowed opacity-75 shadow-xs"
                >
                  <span>Thanh toán (Đang chuẩn bị)</span>
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Button>

                <p className="text-center text-xs text-muted-foreground">
                  Hệ thống thanh toán và tạo đơn hàng sẽ được kích hoạt ở giai đoạn tiếp theo.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

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
  AlertCircle,
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/shared/components/ui/sheet';
import { Button } from '@/shared/components/ui/button';
import { formatVndCurrency } from '@/shared/lib/currency';
import { useCart } from '../hooks/use-cart';

export function CartDrawer() {
  const {
    items,
    totalUnits,
    subtotal,
    isDrawerOpen,
    closeDrawer,
    updateQuantity,
    removeItem,
  } = useCart();

  return (
    <Sheet open={isDrawerOpen} onOpenChange={(open) => !open && closeDrawer()}>
      <SheetContent
        side="right"
        theme="storefront"
        className="w-full sm:max-w-md p-0 flex flex-col bg-background text-foreground shadow-2xl"
      >
        {/* Header */}
        <SheetHeader className="border-b border-[#ede6dc] dark:border-border/80 px-6 py-4 text-left">
          <SheetTitle className="font-serif text-lg sm:text-xl font-bold text-[#2d241e] dark:text-foreground flex items-center gap-2">
            <ShoppingBag className="size-5 text-primary" aria-hidden="true" />
            <span>Giỏ hàng của bạn</span>
            {totalUnits > 0 && (
              <span className="text-sm font-normal text-muted-foreground">
                ({totalUnits} sản phẩm)
              </span>
            )}
          </SheetTitle>
          <SheetDescription className="sr-only">
            Danh sách các sản phẩm đang được chọn mua trong giỏ hàng Mộc Ong
          </SheetDescription>
        </SheetHeader>

        {/* Content Body */}
        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
            <div className="rounded-full bg-[#faf5ee] dark:bg-muted/40 p-5 mb-4 text-[#8c827a] dark:text-muted-foreground">
              <ShoppingBag className="size-10 stroke-1" aria-hidden="true" />
            </div>
            <h3 className="font-serif text-lg font-semibold text-[#2d241e] dark:text-foreground mb-1">
              Giỏ hàng của bạn đang trống
            </h3>
            <p className="text-sm text-muted-foreground max-w-xs mb-6">
              Hãy khám phá các sản phẩm mật ong nguyên chất và thiết bị nuôi ong chất lượng tại Mộc Ong.
            </p>
            <Link
              href="/products"
              onClick={closeDrawer}
              className="rounded-xl bg-primary text-primary-foreground font-semibold px-6 py-2.5 text-sm shadow-xs hover:bg-primary/90 inline-flex items-center justify-center transition-colors"
            >
              Khám phá sản phẩm
            </Link>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-6 py-4 divide-y divide-[#ede6dc] dark:divide-border/60">
            {items.map((item) => {
              const formattedLineTotal = formatVndCurrency(item.unitPrice * item.quantity);
              const formattedUnitPrice = formatVndCurrency(item.unitPrice);
              const isUnavailable = !item.inStock || item.isUnavailable;

              return (
                <div key={item.id} className="py-4 first:pt-0 last:pb-0 flex gap-4">
                  {/* Ảnh sản phẩm */}
                  <Link
                    href={`/products/${item.productSlug}`}
                    onClick={closeDrawer}
                    className="relative size-20 shrink-0 overflow-hidden rounded-xl border border-[#ede6dc] dark:border-border/80 bg-[#fbf9f5] dark:bg-muted/20"
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

                  {/* Thông tin sản phẩm */}
                  <div className="flex-1 flex flex-col justify-between min-w-0">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <Link
                          href={`/products/${item.productSlug}`}
                          onClick={closeDrawer}
                          className="font-medium text-sm text-[#2d241e] dark:text-foreground hover:text-primary transition-colors line-clamp-2 leading-snug"
                        >
                          {item.productName}
                        </Link>
                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          aria-label={`Xóa ${item.productName} khỏi giỏ`}
                          className="text-muted-foreground/60 hover:text-destructive transition-colors p-1 -mr-1 rounded-md"
                        >
                          <Trash2 className="size-4" aria-hidden="true" />
                        </button>
                      </div>

                      {/* Variant name if any */}
                      {item.variantName && (
                        <p className="mt-0.5 text-xs text-muted-foreground font-medium">
                          Quy cách: {item.variantName}
                        </p>
                      )}

                      {/* Warning badges */}
                      {isUnavailable && (
                        <div className="mt-1 flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400 font-medium">
                          <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />
                          <span>Tạm hết hàng</span>
                        </div>
                      )}

                      {item.isPriceChanged && (
                        <div className="mt-1 text-[0.6875rem] text-primary font-medium">
                          Giá đã cập nhật theo cửa hàng
                        </div>
                      )}
                    </div>

                    {/* Hàng giá & Bộ điều chỉnh số lượng */}
                    <div className="mt-2.5 flex items-center justify-between gap-2">
                      <div className="flex flex-col">
                        <span className="font-semibold text-sm text-[#2d241e] dark:text-foreground">
                          {formattedLineTotal}
                        </span>
                        {item.quantity > 1 && (
                          <span className="text-[0.6875rem] text-muted-foreground">
                            {formattedUnitPrice} / sp
                          </span>
                        )}
                      </div>

                      {/* Quantity Stepper */}
                      <div className="flex items-center rounded-lg border border-[#e5dcd1] dark:border-border bg-background">
                        <button
                          type="button"
                          disabled={item.quantity <= 1}
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          aria-label={`Giảm số lượng ${item.productName}`}
                          className="size-7 flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                          <Minus className="size-3" aria-hidden="true" />
                        </button>
                        <span
                          className="w-8 text-center text-xs font-semibold text-foreground select-none"
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
                          className="size-7 flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                          <Plus className="size-3" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer */}
        {items.length > 0 && (
          <div className="border-t border-[#ede6dc] dark:border-border/80 p-6 bg-[#fdfbf7] dark:bg-card/50 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground font-medium">Tạm tính:</span>
              <span className="font-serif text-xl font-bold text-[#2d241e] dark:text-foreground">
                {formatVndCurrency(subtotal)}
              </span>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Phí vận chuyển và ưu đãi sẽ được tính khi tiến hành đặt hàng.
            </p>

            <div className="flex flex-col gap-2 pt-2">
              <Link
                href="/cart"
                onClick={closeDrawer}
                className="w-full h-11 rounded-xl border border-[#e5dcd1] dark:border-border bg-background text-[#453c35] dark:text-foreground font-semibold text-sm hover:bg-muted/50 inline-flex items-center justify-center transition-colors"
              >
                Xem chi tiết giỏ hàng
              </Link>

              <Button
                type="button"
                disabled
                aria-disabled="true"
                aria-label="Thanh toán (Chức năng đặt hàng đang chuẩn bị)"
                className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2 cursor-not-allowed opacity-75 shadow-2xs"
              >
                <span>Thanh toán (Đang chuẩn bị)</span>
                <ArrowRight className="size-4" aria-hidden="true" />
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

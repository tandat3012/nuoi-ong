'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, User, ShoppingBag } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/shared/components/ui/sheet';
import { STOREFRONT_CONFIG } from '../config/storefront-config';
import { StoreBrand } from './store-brand';
import { StoreSearchBar } from './store-search-bar';

export function StoreMobileNav() {
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden size-9 text-foreground hover:bg-muted/70"
          aria-label="Mở menu điều hướng"
        >
          <Menu className="size-5" aria-hidden="true" />
        </Button>
      </SheetTrigger>

      <SheetContent
        side="left"
        theme="storefront"
        className="w-80 max-w-[85vw] p-0 flex flex-col bg-background text-foreground"
      >
        <SheetHeader className="border-b border-border p-4 text-left">
          <SheetTitle asChild>
            <div>
              <StoreBrand isLink={false} showIcon />
            </div>
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6">
          {/* Ô tìm kiếm trong menu di động */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Tìm kiếm
            </p>
            <StoreSearchBar />
          </div>

          {/* Danh mục và điều hướng */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Danh mục
            </p>
            <nav aria-label="Menu di động" className="flex flex-col gap-1">
              {STOREFRONT_CONFIG.navigation.map((item) => {
                const isActive = item.isImplemented && item.href === pathname;

                return (
                  <div key={item.label}>
                    {item.isImplemented ? (
                      <Link
                        href={item.href}
                        onClick={() => setOpen(false)}
                        aria-current={isActive ? 'page' : undefined}
                        className={cn(
                          'flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                          isActive
                            ? 'bg-primary/10 text-primary font-semibold'
                            : 'text-foreground hover:bg-muted/70',
                          'focus-visible:outline-2 focus-visible:outline-primary',
                        )}
                      >
                        <span>{item.label}</span>
                      </Link>
                    ) : (
                      <div className="flex items-center justify-between px-3 py-2.5 text-sm text-muted-foreground/60 select-none cursor-default">
                        <span>{item.label}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>
          </div>

          {/* Tài khoản & Giỏ hàng */}
          <div className="border-t border-border pt-4 flex flex-col gap-2">
            <Link
              href="/sign-in"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-foreground hover:bg-muted/70 transition-colors focus-visible:outline-2 focus-visible:outline-primary"
            >
              <User className="size-4.5 text-primary" aria-hidden="true" />
              <span>Đăng nhập tài khoản</span>
            </Link>

            <div
              className="flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground/60 cursor-not-allowed select-none opacity-80"
              aria-disabled="true"
            >
              <div className="flex items-center gap-2.5">
                <ShoppingBag className="size-4.5 text-muted-foreground/60" aria-hidden="true" />
                <span>Giỏ hàng</span>
              </div>
              <span className="text-xs font-normal">(Đang chuẩn bị)</span>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

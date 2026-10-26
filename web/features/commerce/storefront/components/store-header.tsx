import * as React from 'react';
import { Show, SignInButton, UserButton } from '@clerk/nextjs';
import { User } from 'lucide-react';
import { StoreBrand } from './store-brand';
import { StoreSearchBar } from './store-search-bar';
import { StoreDesktopNav } from './store-desktop-nav';
import { StoreMobileNav } from './store-mobile-nav';
import { StoreCartButton } from '@/features/commerce/cart/components/store-cart-button';

export function StoreHeader() {
  return (
    <header className="border-b border-border bg-card text-foreground shadow-2xs">
      {/* Khung chính: Brand, Search, Account, Cart */}
      <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 sm:py-4 lg:px-8">
        <div className="flex items-center justify-between gap-3 sm:gap-6">
          {/* Vùng bên trái: Menu mobile hamburger + Brand */}
          <div className="flex items-center gap-2 sm:gap-3">
            <StoreMobileNav />
            <StoreBrand showIcon />
          </div>

          {/* Vùng ở giữa: Ô tìm kiếm desktop */}
          <div className="hidden md:flex flex-1 max-w-xl lg:max-w-2xl mx-3 lg:mx-8">
            <StoreSearchBar idSuffix="desktop" />
          </div>

          {/* Vùng bên phải: Tài khoản & Giỏ hàng */}
          <div className="flex items-center gap-1.5 sm:gap-3">
            {/* Đăng nhập */}
            <Show when="signed-out">
              <SignInButton>
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-medium text-foreground hover:bg-muted/70 hover:text-primary transition-colors focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                  aria-label="Đăng nhập tài khoản"
                >
                  <User className="size-5 shrink-0 text-primary" aria-hidden="true" />
                  <span className="hidden sm:inline">Đăng nhập</span>
                </button>
              </SignInButton>
            </Show>
            <Show when="signed-in">
              <UserButton />
            </Show>

            {/* Giỏ hàng */}
            <StoreCartButton />
          </div>
        </div>

        {/* Thanh tìm kiếm trên thiết bị di động */}
        <div className="mt-3 md:hidden">
          <StoreSearchBar idSuffix="mobile" />
        </div>
      </div>

      {/* Hàng danh mục và điều hướng chính trên Desktop */}
      <StoreDesktopNav />
    </header>
  );
}

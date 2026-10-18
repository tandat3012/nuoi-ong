'use client';

import * as React from 'react';
import Link from 'next/link';
import { Menu } from 'lucide-react';
import { Show, SignInButton, UserButton } from '@clerk/nextjs';
import { FarmSwitcher } from '@/features/auth/components/farm-switcher';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/shared/components/ui/sheet';
import { Button } from '@/shared/components/ui/button';
import { Breadcrumbs } from './breadcrumbs';
import { SidebarNavigation } from './sidebar-navigation';

export function HeaderBar() {
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-card/95 px-4 backdrop-blur-xs sm:px-6 lg:px-8">
      {/* Mobile left: Hamburger trigger + Brand */}
      <div className="flex items-center gap-3 lg:hidden">
        <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
          <SheetTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="size-8.5 rounded-md"
              aria-label="Mở menu điều hướng"
            >
              <Menu className="size-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0 flex flex-col">
            <SheetHeader className="border-b border-border p-4 text-left">
              <SheetTitle className="flex items-center gap-2.5">
                <div
                  aria-hidden="true"
                  className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground shadow-2xs"
                >
                  <svg
                    className="size-4.5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 2l7.5 4.3v8.6L12 22l-7.5-4.3V6.3L12 2z" />
                    <path d="M12 7l4 2.3v4.6L12 16.2l-4-2.3V9.3L12 7z" fill="currentColor" fillOpacity="0.3" />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-sm leading-tight text-foreground">Nuôi Ong</p>
                  <p className="text-[0.65rem] text-muted-foreground font-normal">Quản lý nông trại</p>
                </div>
              </SheetTitle>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto p-4">
              <SidebarNavigation onNavigate={() => setDrawerOpen(false)} />
            </div>
          </SheetContent>
        </Sheet>

        <Link href="/dashboard" className="flex items-center gap-2 font-semibold text-sm tracking-tight">
          <span className="grid size-7 place-items-center rounded-md bg-primary text-primary-foreground">
            <svg
              className="size-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 2l7.5 4.3v8.6L12 22l-7.5-4.3V6.3L12 2z" />
              <path d="M12 7l4 2.3v4.6L12 16.2l-4-2.3V9.3L12 7z" fill="currentColor" fillOpacity="0.3" />
            </svg>
          </span>
          <span className="font-semibold">Nuôi Ong</span>
        </Link>
      </div>

      {/* Desktop left: Breadcrumbs */}
      <div className="hidden lg:flex lg:items-center">
        <Breadcrumbs />
      </div>

      {/* Right controls: Farm Switcher + User profile */}
      <div className="flex items-center gap-3">
        <Show when="signed-out">
          <SignInButton>
            <Button variant="outline" size="sm">
              Đăng nhập
            </Button>
          </SignInButton>
        </Show>
        <Show when="signed-in">
          <FarmSwitcher />
          <div className="size-8.5 flex items-center justify-center">
            <UserButton />
          </div>
        </Show>
      </div>
    </header>
  );
}

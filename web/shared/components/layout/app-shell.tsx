import * as React from 'react';
import Link from 'next/link';
import { SidebarNavigation } from './sidebar-navigation';
import { HeaderBar } from './header-bar';
import { BrandMark } from './brand-mark';
import { RouteAccessGate } from './route-access-gate';

export function AppShell({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <a
        href="#main-content"
        className="sr-only z-50 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-md focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Đi tới nội dung chính
      </a>

      <div className="min-h-screen bg-muted dark:bg-background lg:grid lg:grid-cols-[16rem_1fr]">
        {/* Desktop persistent sidebar */}
        <aside className="hidden border-r border-border bg-card lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col">
          <div className="flex h-14 items-center gap-2.5 border-b border-border px-5">
            <Link href="/dashboard" className="flex items-center gap-2.5 font-semibold tracking-tight text-foreground">
              <BrandMark />
              <div>
                <p className="text-sm font-bold leading-tight">Nuôi Ong</p>
                <p className="text-[0.65rem] text-muted-foreground font-medium">Quản lý nông trại</p>
              </div>
            </Link>
          </div>

          <div className="flex-1 overflow-y-auto px-3.5 py-4">
            <SidebarNavigation />
          </div>
        </aside>

        {/* Content area */}
        <div className="flex min-w-0 flex-col">
          <HeaderBar />
          <main id="main-content" className="flex-1 p-4 sm:p-6 lg:p-8">
            <RouteAccessGate>{children}</RouteAccessGate>
          </main>
        </div>
      </div>
    </>
  );
}

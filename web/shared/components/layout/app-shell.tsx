import * as React from 'react';
import Link from 'next/link';
import { SidebarNavigation } from './sidebar-navigation';
import { HeaderBar } from './header-bar';

export function AppShell({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <a
        href="#main-content"
        className="sr-only z-50 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-md focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Đi tới nội dung chính
      </a>

      <div className="min-h-screen bg-background lg:grid lg:grid-cols-[16rem_1fr]">
        {/* Desktop persistent sidebar */}
        <aside className="hidden border-r border-border bg-card lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col">
          <div className="flex h-14 items-center gap-2.5 border-b border-border px-5">
            <Link href="/dashboard" className="flex items-center gap-2.5 font-semibold tracking-tight text-foreground">
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
                <p className="text-sm font-bold leading-tight">Nuôi Ong</p>
                <p className="text-[0.65rem] text-muted-foreground font-medium">Hệ thống quản lý</p>
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
            {children}
          </main>
        </div>
      </div>
    </>
  );
}

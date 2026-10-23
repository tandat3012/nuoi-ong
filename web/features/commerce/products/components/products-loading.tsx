import * as React from 'react';
import { Skeleton } from '@/shared/components/ui/skeleton';

export function ProductsLoading() {
  return (
    <main
      className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8"
      role="status"
      aria-label="Đang tải danh sách sản phẩm"
    >
      {/* Breadcrumb skeleton */}
      <div className="mb-6 flex items-center gap-2" aria-hidden="true">
        <Skeleton className="h-4 w-16 rounded" />
        <span className="text-muted-foreground/40 text-xs">/</span>
        <Skeleton className="h-4 w-28 rounded" />
      </div>

      {/* Header skeleton */}
      <header className="mb-8">
        <Skeleton className="h-8 sm:h-10 w-52 sm:w-72 rounded-lg" />
        <Skeleton className="mt-3 h-4 w-full max-w-lg rounded" />
      </header>

      {/* Layout: Sidebar + Grid */}
      <div className="flex flex-col lg:flex-row gap-8 items-start">
        {/* Desktop Sidebar skeleton */}
        <aside
          aria-hidden="true"
          className="w-64 shrink-0 hidden lg:block"
        >
          <div className="rounded-2xl border border-border bg-card p-5 space-y-2.5">
            <Skeleton className="h-3.5 w-32 rounded mb-4" />
            <Skeleton className="h-10 w-full rounded-xl" />
            <Skeleton className="h-10 w-full rounded-xl" />
            <Skeleton className="h-10 w-full rounded-xl" />
            <Skeleton className="h-10 w-full rounded-xl" />
            <Skeleton className="h-10 w-full rounded-xl" />
          </div>
        </aside>

        {/* Results area skeleton */}
        <div className="flex-1 w-full">
          <div className="flex items-center justify-between mb-6 pb-2 border-b border-border/60">
            <Skeleton className="h-4 w-24 rounded" />
            <Skeleton className="h-8 w-28 rounded-lg lg:hidden" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={`product-skeleton-${i}`}
                className="rounded-2xl border border-border bg-card overflow-hidden"
              >
                <Skeleton className="aspect-[4/3] w-full rounded-none" />
                <div className="p-4 space-y-2.5">
                  <Skeleton className="h-3 w-16 rounded" />
                  <Skeleton className="h-4 w-4/5 rounded" />
                  <Skeleton className="h-3.5 w-24 rounded" />
                  <Skeleton className="h-5 w-28 rounded mt-3" />
                  <Skeleton className="h-9 w-full rounded-lg mt-4" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}

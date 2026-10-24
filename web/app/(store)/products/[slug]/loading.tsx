import { Skeleton } from '@/shared/components/ui/skeleton';

export default function ProductDetailLoading() {
  return (
    <main
      role="status"
      aria-label="Đang tải thông tin sản phẩm"
      className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8"
    >
      {/* Breadcrumb Skeleton */}
      <div className="mb-6 sm:mb-8 flex items-center gap-2">
        <Skeleton className="h-4 w-16" />
        <span className="text-muted-foreground/40">/</span>
        <Skeleton className="h-4 w-24" />
        <span className="text-muted-foreground/40">/</span>
        <Skeleton className="h-4 w-40" />
      </div>

      {/* 2-column Layout Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 xl:gap-16 items-start">
        {/* Left: Gallery Skeleton */}
        <div className="space-y-4">
          <Skeleton className="aspect-square sm:aspect-[4/3] w-full rounded-2xl" />
          <div className="flex gap-2.5">
            <Skeleton className="size-16 sm:size-20 rounded-xl" />
            <Skeleton className="size-16 sm:size-20 rounded-xl" />
          </div>
        </div>

        {/* Right: Summary Skeleton */}
        <div className="space-y-5">
          <Skeleton className="h-6 w-24 rounded-md" />
          <Skeleton className="h-10 w-full max-w-md rounded-lg" />
          <Skeleton className="h-4 w-48 rounded" />
          <Skeleton className="h-5 w-36 rounded" />
          <div className="flex items-baseline gap-3 pt-2">
            <Skeleton className="h-9 w-32 rounded-lg" />
            <Skeleton className="h-6 w-24 rounded-lg" />
          </div>
          <Skeleton className="h-5 w-24 rounded" />
          <div className="space-y-2 pt-2">
            <Skeleton className="h-4 w-full rounded" />
            <Skeleton className="h-4 w-5/6 rounded" />
            <Skeleton className="h-4 w-4/6 rounded" />
          </div>
          <div className="pt-4 space-y-2">
            <Skeleton className="h-4 w-16 rounded" />
            <Skeleton className="h-10 w-32 rounded-xl" />
          </div>
          <div className="flex gap-3 pt-2">
            <Skeleton className="h-12 flex-1 rounded-xl" />
            <Skeleton className="h-12 flex-1 rounded-xl" />
          </div>
          <div className="pt-6 border-t border-[#ede6dc] dark:border-border/80 flex justify-between">
            <Skeleton className="h-4 w-28 rounded" />
            <Skeleton className="h-4 w-24 rounded" />
            <Skeleton className="h-4 w-24 rounded" />
          </div>
        </div>
      </div>
    </main>
  );
}

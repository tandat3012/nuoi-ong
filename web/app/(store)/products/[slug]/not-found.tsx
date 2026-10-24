import Link from 'next/link';
import { PackageSearch, ArrowLeft } from 'lucide-react';

export default function ProductNotFound() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
      <div className="flex flex-col items-center justify-center text-center">
        <div className="flex size-16 sm:size-20 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground mb-6">
          <PackageSearch className="size-8 sm:size-10 stroke-1" aria-hidden="true" />
        </div>

        <span className="text-xs sm:text-sm font-bold uppercase tracking-widest text-primary">
          404 · Không tìm thấy
        </span>

        <h1 className="mt-3 font-serif text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-[#2d241e] dark:text-foreground">
          Sản phẩm không tồn tại
        </h1>

        <p className="mt-3 max-w-md text-sm sm:text-base text-muted-foreground leading-relaxed">
          Sản phẩm bạn đang tìm kiếm có thể đã đổi tên, tạm ngừng kinh doanh hoặc đường dẫn không chính xác.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/products"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-2xs transition-all hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-primary"
          >
            <span>Khám phá sản phẩm</span>
          </Link>
          <Link
            href="/"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border px-6 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            <span>Về trang chủ</span>
          </Link>
        </div>
      </div>
    </main>
  );
}

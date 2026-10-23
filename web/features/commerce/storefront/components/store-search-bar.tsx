'use client';

import * as React from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Search } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { Input } from '@/shared/components/ui/input';
import { Button } from '@/shared/components/ui/button';

export interface StoreSearchBarProps {
  idSuffix?: string;
  className?: string;
  onSearchSubmit?: () => void;
}

function StoreSearchBarInner({
  idSuffix = 'desktop',
  className,
  onSearchSubmit,
}: StoreSearchBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentQ = searchParams?.get('q') ?? '';
  const [keyword, setKeyword] = React.useState(currentQ);
  const [prevQ, setPrevQ] = React.useState(currentQ);

  // Điều chỉnh state khi search param trên URL thay đổi (refresh hoặc Back/Forward)
  if (prevQ !== currentQ) {
    setPrevQ(currentQ);
    setKeyword(currentQ);
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = keyword.trim().slice(0, 100);

    if (pathname === '/products') {
      const nextParams = new URLSearchParams(searchParams?.toString() ?? '');
      // Luôn reset về trang 1 khi thay đổi từ khóa tìm kiếm
      nextParams.delete('page');

      if (trimmed) {
        nextParams.set('q', trimmed);
      } else {
        nextParams.delete('q');
      }

      const qs = nextParams.toString();
      router.push(qs ? `/products?${qs}` : '/products');
    } else {
      if (trimmed) {
        router.push(`/products?q=${encodeURIComponent(trimmed)}`);
      } else {
        router.push('/products');
      }
    }

    onSearchSubmit?.();
  };

  const inputId = `storefront-search-input-${idSuffix}`;

  return (
    <form onSubmit={handleSubmit} className={cn('relative w-full', className)}>
      <label htmlFor={inputId} className="sr-only">
        Tìm kiếm sản phẩm
      </label>
      <div className="relative flex items-center w-full">
        <Input
          id={inputId}
          name="q"
          type="search"
          maxLength={100}
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="Tìm kiếm sản phẩm..."
          className={cn(
            'h-11 sm:h-12 w-full rounded-xl sm:rounded-2xl border-input bg-card pl-4 sm:pl-5 pr-12 sm:pr-14 text-xs sm:text-sm text-foreground shadow-2xs transition-colors',
            'placeholder:text-muted-foreground/70',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-primary',
          )}
        />
        <Button
          type="submit"
          variant="default"
          size="icon"
          aria-label="Tìm kiếm sản phẩm"
          title="Tìm kiếm"
          className="absolute right-0 top-0 bottom-0 h-full w-auto aspect-square rounded-none rounded-r-xl sm:rounded-r-2xl bg-primary text-primary-foreground shadow-none hover:opacity-90 transition-opacity cursor-pointer"
        >

          <Search className="size-4.5 sm:size-5" aria-hidden="true" />
        </Button>
      </div>
    </form>
  );
}

export function StoreSearchBar(props: StoreSearchBarProps) {
  return (
    <React.Suspense
      fallback={
        <div className={cn('relative w-full', props.className)}>
          <div className="h-11 sm:h-12 w-full rounded-xl sm:rounded-2xl border border-input bg-card" />
        </div>
      }
    >
      <StoreSearchBarInner {...props} />
    </React.Suspense>
  );
}

'use client';

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { ArrowRight, Package, Search } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { imageLoader } from '@/shared/lib/cloudinary-image';
import { Input } from '@/shared/components/ui/input';
import { Button } from '@/shared/components/ui/button';
import { getProductsStore } from '@/features/commerce/products/api/product.api';
import { formatProductCardPriceRange } from '@/features/commerce/products/components/product-card.logic';
import type { StorefrontProduct } from '@/features/commerce/products/types/product';
import { useStoreRegion } from '@/features/commerce/region/region-context';

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
  const { region } = useStoreRegion();
  const containerRef = React.useRef<HTMLFormElement>(null);

  const currentQ = searchParams?.get('q') ?? '';
  const [keyword, setKeyword] = React.useState(currentQ);
  const [prevQ, setPrevQ] = React.useState(currentQ);
  const [isOpen, setIsOpen] = React.useState(false);
  const [suggestions, setSuggestions] = React.useState<{
    key: string;
    items: StorefrontProduct[];
    totalItems: number;
  } | null>(null);

  // Điều chỉnh state khi search param trên URL thay đổi (refresh hoặc Back/Forward)
  if (prevQ !== currentQ) {
    setPrevQ(currentQ);
    setKeyword(currentQ);
  }

  const trimmedKeyword = keyword.trim().slice(0, 100);
  const searchKey = `${region ?? ''}:${trimmedKeyword}`;
  const isSearching =
    isOpen && trimmedKeyword.length >= 2 && suggestions?.key !== searchKey;

  React.useEffect(() => {
    if (!isOpen || trimmedKeyword.length < 2) return;
    let active = true;
    const timer = setTimeout(() => {
      getProductsStore({ q: trimmedKeyword, pageSize: 5, region })
        .then((res) => {
          if (!active) return;
          setSuggestions({
            key: searchKey,
            items: res.data,
            totalItems: res.page.totalItems,
          });
        })
        .catch(() => {
          if (!active) return;
          setSuggestions({ key: searchKey, items: [], totalItems: 0 });
        });
    }, 300);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [isOpen, trimmedKeyword, region, searchKey]);

  React.useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (
        containerRef.current &&
        event.target instanceof Node &&
        !containerRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [isOpen]);

  const navigateToSearch = (trimmed: string) => {
    setIsOpen(false);
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

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    navigateToSearch(trimmedKeyword);
  };

  const inputId = `storefront-search-input-${idSuffix}`;
  const showDropdown = isOpen && trimmedKeyword.length >= 2;
  const currentSuggestions =
    suggestions?.key === searchKey ? suggestions : null;

  return (
    <form
      ref={containerRef}
      onSubmit={handleSubmit}
      className={cn('relative w-full', className)}
    >
      <label htmlFor={inputId} className="sr-only">
        Tìm kiếm sản phẩm
      </label>
      <div className="relative flex items-center w-full">
        <Input
          id={inputId}
          name="q"
          type="search"
          autoComplete="off"
          maxLength={100}
          value={keyword}
          onFocus={() => setIsOpen(true)}
          onChange={(e) => {
            setKeyword(e.target.value);
            setIsOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setIsOpen(false);
            }
          }}
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

      {showDropdown && (
        <div
          role="region"
          aria-label="Gợi ý tìm kiếm sản phẩm"
          className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-border bg-card text-foreground shadow-lg"
        >
          {isSearching || !currentSuggestions ? (
            <p
              role="status"
              className="px-4 py-3.5 text-xs sm:text-sm text-muted-foreground"
            >
              Đang tìm sản phẩm cho &ldquo;{trimmedKeyword}&rdquo;…
            </p>
          ) : currentSuggestions.items.length === 0 ? (
            <p
              role="status"
              className="px-4 py-3.5 text-xs sm:text-sm text-muted-foreground"
            >
              Không tìm thấy sản phẩm khớp với &ldquo;{trimmedKeyword}&rdquo;.
            </p>
          ) : (
            <div>
              <ul className="divide-y divide-border/60 max-h-80 overflow-y-auto">
                {currentSuggestions.items.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={`/products/${item.slug}`}
                      onClick={() => {
                        setIsOpen(false);
                        onSearchSubmit?.();
                      }}
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/60 transition-colors"
                    >
                      <div className="relative size-11 shrink-0 overflow-hidden rounded-lg border border-border/80 bg-muted/30">
                        {item.image?.src ? (
                          <Image
                            src={item.image.src}
                            loader={imageLoader(item.image.src)}
                            alt={item.image.alt || item.name}
                            fill
                            sizes="44px"
                            className="object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-muted-foreground/40">
                            <Package
                              className="size-5 stroke-1.5"
                              aria-hidden="true"
                            />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs sm:text-sm font-medium text-foreground">
                          {item.name}
                        </p>
                        <p className="truncate text-[0.6875rem] text-muted-foreground">
                          {item.category.name}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs sm:text-sm font-semibold text-foreground">
                        {formatProductCardPriceRange(item.price, item.maxPrice)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => navigateToSearch(trimmedKeyword)}
                className="flex w-full items-center justify-between border-t border-border bg-muted/30 px-4 py-2.5 text-xs font-semibold text-primary hover:bg-muted/60 transition-colors cursor-pointer"
              >
                <span>
                  Xem tất cả {currentSuggestions.totalItems} kết quả cho &ldquo;
                  {trimmedKeyword}&rdquo;
                </span>
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
      )}
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

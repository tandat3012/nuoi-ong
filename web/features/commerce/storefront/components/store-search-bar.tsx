import * as React from 'react';
import { Search } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { Input } from '@/shared/components/ui/input';
import { Button } from '@/shared/components/ui/button';

export function StoreSearchBar({ className }: { className?: string }) {
  return (
    <div className={cn('relative w-full', className)}>
      <label htmlFor="storefront-search-input" className="sr-only">
        Tìm kiếm sản phẩm (tính năng đang chuẩn bị)
      </label>
      <div className="relative flex items-center w-full">
        <Input
          id="storefront-search-input"
          type="search"
          disabled
          aria-disabled="true"
          placeholder="Tìm kiếm sản phẩm (tính năng đang chuẩn bị)..."
          className={cn(
            'h-11 sm:h-12 w-full rounded-xl sm:rounded-2xl border-input bg-card pl-4 sm:pl-5 pr-12 sm:pr-14 text-xs sm:text-sm text-foreground shadow-2xs transition-colors',
            'cursor-not-allowed opacity-80 select-none placeholder:text-muted-foreground/70',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-primary',
          )}
        />
        <Button
          type="button"
          variant="default"
          size="icon"
          disabled
          aria-disabled="true"
          aria-label="Tìm kiếm (tính năng đang chuẩn bị)"
          title="Tính năng tìm kiếm đang chuẩn bị"
          className="absolute right-1 sm:right-1.5 top-1/2 -translate-y-1/2 size-9 sm:size-9.5 rounded-lg sm:rounded-xl bg-primary text-primary-foreground shadow-xs cursor-not-allowed opacity-85"
        >
          <Search className="size-4.5 sm:size-5" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}

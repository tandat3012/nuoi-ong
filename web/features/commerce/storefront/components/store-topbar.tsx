import * as React from 'react';
import { Sparkles, Truck } from 'lucide-react';
import { STOREFRONT_CONFIG } from '../config/storefront-config';

export function StoreTopBar() {
  const { companionMessage, shippingMessage } = STOREFRONT_CONFIG.announcement;

  return (
    <aside
      aria-label="Thông báo khuyến mãi"
      className="bg-store-announcement text-store-announcement-foreground text-xs font-medium border-b border-amber-300/40"
    >
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-center gap-1 px-4 py-2 text-center sm:flex-row sm:text-left sm:gap-6 sm:px-6 lg:px-8">
        <div className="inline-flex items-center gap-1.5">
          <Sparkles className="size-3.5 shrink-0 text-amber-900/80" aria-hidden="true" />
          <span>{companionMessage}</span>
        </div>

        <div className="inline-flex items-center gap-1.5 font-semibold">
          <Truck className="size-3.5 shrink-0 text-amber-900/80" aria-hidden="true" />
          <span>{shippingMessage}</span>
        </div>
      </div>
    </aside>
  );
}

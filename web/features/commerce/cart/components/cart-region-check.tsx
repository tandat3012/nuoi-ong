'use client';

import * as React from 'react';
import {
  getCartAvailability,
  type CartAvailability,
} from '../../products/api/product.api';
import {
  availabilityLabels,
  cartLineName,
  splitOrderSuggestions,
  storeRegionLabels,
} from '../../region/region.logic';
import { useStoreRegion } from '../../region/region-context';
import { useCart } from '../hooks/use-cart';
import type { CartItem } from '../types/cart';
import {
  deserializeCart,
   isValidCartPrice,
  mergeSavedSplitItems,
  partitionCartByVariantGroup,
  SAVED_SPLIT_CART_STORAGE_KEY,
  serializeCart,
} from './cart.logic';

const SPLIT_CART_EVENT = 'moc-ong-split-cart-change';

function readSavedSplitItems(): CartItem[] {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  try {
    return deserializeCart(
      window.localStorage.getItem(SAVED_SPLIT_CART_STORAGE_KEY),
    );
  } catch {
    return [];
  }
}

function writeSavedSplitItems(items: CartItem[]) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    if (items.length === 0) {
      window.localStorage.removeItem(SAVED_SPLIT_CART_STORAGE_KEY);
    } else {
      window.localStorage.setItem(
        SAVED_SPLIT_CART_STORAGE_KEY,
        serializeCart(items),
      );
    }
    window.dispatchEvent(new Event(SPLIT_CART_EVENT));
  } catch {
    // Ignore storage quota errors
  }
}

export function SavedSplitCartBanner() {
  const { addItem, reconcileCart, isCheckoutSubmitting } = useCart();
  const [savedItems, setSavedItems] = React.useState<CartItem[]>([]);

  React.useEffect(() => {
    const sync = () => setSavedItems(readSavedSplitItems());
    sync();
    window.addEventListener(SPLIT_CART_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(SPLIT_CART_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  if (savedItems.length === 0) return null;

  const handleRestore = () => {
    let restoredAny = false;
    for (const item of savedItems) {
      if (!item.variantId || !isValidCartPrice(item.unitPrice)) continue;
      const added = addItem({
        productId: item.productId,
        productSlug: item.productSlug,
        productName: item.productName,
        variantId: item.variantId,
        variantName: item.variantName,
        unitPrice: item.unitPrice,
        originalPrice: item.originalPrice,
        image: item.image,
        quantity: item.quantity,
        purchaseLimit: item.purchaseLimit,
        inStock: true,
      });
      if (added) restoredAny = true;
    }
    writeSavedSplitItems([]);
    if (restoredAny) {
      void reconcileCart();
    }
  };

  return (
    <div
      role="status"
      className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs sm:text-sm text-foreground space-y-2"
    >
      <p className="font-medium text-amber-900 dark:text-amber-200">
        Đã lưu tạm {savedItems.length} phân loại để đặt ở đơn tiếp theo:
      </p>
      <p className="text-xs text-muted-foreground">
        {savedItems
          .map((item) =>
            item.variantName
              ? `${item.productName} (${item.variantName}) × ${item.quantity}`
              : `${item.productName} × ${item.quantity}`,
          )
          .join(', ')}
      </p>
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button
          type="button"
          disabled={isCheckoutSubmitting}
          onClick={handleRestore}
          className="inline-flex items-center rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity cursor-pointer"
        >
          Đưa lại vào giỏ để đặt đơn tiếp
        </button>
        <button
          type="button"
          disabled={isCheckoutSubmitting}
          onClick={() => writeSavedSplitItems([])}
          className="inline-flex items-center rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors cursor-pointer"
        >
          Bỏ lưu
        </button>
      </div>
    </div>
  );
}

/** Whether one warehouse of the chosen region can ship the whole cart. */
export function CartRegionCheck({
  hideSuccess = false,
}: {
  hideSuccess?: boolean;
}) {
  const { items, removeItem, isCheckoutSubmitting } = useCart();
  const { region, openPicker } = useStoreRegion();
  const lines = items.flatMap((item) =>
    item.variantId ? [{ variantId: item.variantId, quantity: item.quantity }] : [],
  );
  const key = JSON.stringify(lines);
  const [result, setResult] = React.useState<{
    key: string;
    data: CartAvailability | null;
  } | null>(null);

  React.useEffect(() => {
    if (!region || lines.length === 0) return;
    let active = true;
    const timer = setTimeout(() => {
      getCartAvailability(region, JSON.parse(key))
        .then((data) => active && setResult({ key: region + key, data }))
        .catch(() => active && setResult({ key: region + key, data: null }));
    }, 400);
    return () => {
      active = false;
      clearTimeout(timer);
    };
    // `key` carries the lines.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [region, key]);

  const handleKeepGroup = (groupVariantIds: string[]) => {
    const { keptItems, deferredItems } = partitionCartByVariantGroup(
      items,
      groupVariantIds,
    );
    if (keptItems.length === 0 || deferredItems.length === 0) return;
    const mergedSaved = mergeSavedSplitItems(
      readSavedSplitItems(),
      deferredItems,
    );
    writeSavedSplitItems(mergedSaved);
    for (const item of deferredItems) {
      removeItem(item.id);
    }
  };

  if (lines.length === 0) return <SavedSplitCartBanner />;
  if (!region)
    return (
      <div className="space-y-2">
        <p role="status" className="text-sm text-amber-800 dark:text-amber-300">
          Chọn khu vực giao hàng để kiểm tra giỏ.{' '}
          <button type="button" onClick={openPicker} className="underline">
            Chọn miền
          </button>
        </p>
        <SavedSplitCartBanner />
      </div>
    );
  if (result?.key !== region + key)
    return (
      <div className="space-y-2">
        <p role="status" className="text-sm text-muted-foreground">
          Đang kiểm tra khả năng giao tới {storeRegionLabels[region]}…
        </p>
        <SavedSplitCartBanner />
      </div>
    );
  if (!result.data)
    return (
      <div className="space-y-2">
        <p role="status" className="text-sm text-muted-foreground">
          Chưa kiểm tra được khu vực giao hàng; máy chủ sẽ kiểm tra lại khi đặt.
        </p>
        <SavedSplitCartBanner />
      </div>
    );

  const { canOrder, groups } = result.data;
  const problems = result.data.lines.filter(
    ({ availability }) => availability !== 'AVAILABLE',
  );
  const suggestions = splitOrderSuggestions(groups, items);

  return (
    <div role="status" className="space-y-2 text-sm">
      {canOrder && !hideSuccess ? (
        <p className="text-emerald-700 dark:text-emerald-400">
          Có thể giao cả giỏ tới {storeRegionLabels[region]}.
        </p>
      ) : !canOrder ? (
        <p className="text-amber-800 dark:text-amber-300">
          Chưa có kho nào tại {storeRegionLabels[region]} đáp ứng đủ cả giỏ
          hàng.
        </p>
      ) : null}
      {problems.map(({ variantId, availability }) => (
        <p key={variantId} className="text-muted-foreground">
          {cartLineName(items, variantId)}: {availabilityLabels[availability]}
        </p>
      ))}
      {!canOrder && groups.length > 1 && (
        <div className="space-y-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
          <p className="text-xs font-medium text-foreground">
            Bạn có thể tách giỏ thành các đơn riêng theo từng kho cấp hàng:
          </p>
          <ul className="space-y-2 text-xs text-muted-foreground">
            {suggestions.map((groupLabel, index) => {
              const groupIds = groups[index] ?? [];
              const { keptItems, deferredItems } = partitionCartByVariantGroup(
                items,
                groupIds,
              );
              return (
                <li
                  key={groupLabel}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/70 bg-card px-2.5 py-2"
                >
                  <span className="text-foreground">{groupLabel}</span>
                  {keptItems.length > 0 && deferredItems.length > 0 && (
                    <button
                      type="button"
                      disabled={isCheckoutSubmitting}
                      onClick={() => handleKeepGroup(groupIds)}
                      className="shrink-0 rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/20 disabled:opacity-50 transition-colors cursor-pointer"
                    >
                      Giữ Đơn {index + 1} để đặt trước (lưu tạm phần còn lại)
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
      <SavedSplitCartBanner />
    </div>
  );
}

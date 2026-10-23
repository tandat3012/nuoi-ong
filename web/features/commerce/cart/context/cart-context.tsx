'use client';

import * as React from 'react';
import type { StorefrontProductDetail } from '../../products/types/product';
import { getProductStore } from '../../products/api/product.api';
import type { AddToCartInput, CartContextValue, CartItem } from '../types/cart';
import {
  addItemToCart,
  calculateCartTotals,
  CART_STORAGE_KEY,
  deserializeCart,
  reconcileItemWithDetail,
  removeCartItem,
  serializeCart,
  updateCartItemQuantity,
} from '../components/cart.logic';

const CartContext = React.createContext<CartContextValue | null>(null);

export interface CartProviderProps {
  children: React.ReactNode;
}

export function CartProvider({ children }: CartProviderProps) {
  const [items, setItems] = React.useState<CartItem[]>([]);
  const [isHydrated, setIsHydrated] = React.useState(false);
  const [isReconciling, setIsReconciling] = React.useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = React.useState(false);
  const [lastAddedItem, setLastAddedItem] = React.useState<CartItem | null>(null);

  // 1. Safe Client Hydration: Read from localStorage only after mount
  React.useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          const raw = window.localStorage.getItem(CART_STORAGE_KEY);
          const restored = deserializeCart(raw);
          if (restored.length > 0) {
            setItems(restored);
          }
        }
      } catch (err) {
        console.warn('[Cart] Failed to restore cart from storage:', err);
      } finally {
        setIsHydrated(true);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  // 2. Persistence: Save to localStorage only after initial hydration completes
  React.useEffect(() => {
    if (!isHydrated) return;

    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const payload = serializeCart(items);
        window.localStorage.setItem(CART_STORAGE_KEY, payload);
      }
    } catch (err) {
      console.warn('[Cart] Failed to persist cart to storage:', err);
    }
  }, [items, isHydrated]);

  // 3. Reconcile with live catalog
  const reconcileCart = React.useCallback(async () => {
    if (items.length === 0) return;

    setIsReconciling(true);
    try {
      const uniqueSlugs = Array.from(new Set(items.map((i) => i.productSlug)));
      const detailMap = new Map<string, StorefrontProductDetail | null>();

      await Promise.all(
        uniqueSlugs.map(async (slug) => {
          try {
            const res = await getProductStore(slug);
            detailMap.set(slug, res ? res.data : null);
          } catch (fetchErr) {
            // Keep line intact if network/server is down
            console.warn(`[Cart] Reconciliation network error for "${slug}":`, fetchErr);
          }
        }),
      );

      setItems((prev) => {
        return prev.map((item) => {
          if (!detailMap.has(item.productSlug)) {
            // Network error occurred during reconciliation; preserve current snapshot
            return item;
          }
          const detail = detailMap.get(item.productSlug)!;
          return reconcileItemWithDetail(item, detail);
        });
      });
    } catch (err) {
      console.warn('[Cart] Reconciliation failed:', err);
    } finally {
      setIsReconciling(false);
    }
  }, [items]);

  // Reconcile once upon initial hydration if there are items
  React.useEffect(() => {
    if (isHydrated && items.length > 0) {
      queueMicrotask(() => {
        void reconcileCart();
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHydrated]);

  // 4. Cart actions using functional state updates
  const addItem = React.useCallback((input: AddToCartInput): boolean => {
    if (!input.productId || !input.productSlug || !input.productName) {
      return false;
    }

    let added: CartItem | null = null;
    setItems((prev) => {
      const result = addItemToCart(prev, input);
      added = result.addedItem;
      return result.items;
    });

    if (added) {
      setLastAddedItem(added);
      setIsDrawerOpen(true);
    }

    return true;
  }, []);

  const updateQuantity = React.useCallback((id: string, quantity: number) => {
    setItems((prev) => updateCartItemQuantity(prev, id, quantity));
  }, []);

  const removeItem = React.useCallback((id: string) => {
    setItems((prev) => removeCartItem(prev, id));
  }, []);

  const clearCart = React.useCallback(() => {
    setItems([]);
  }, []);

  const openDrawer = React.useCallback(() => {
    setIsDrawerOpen(true);
  }, []);

  const closeDrawer = React.useCallback(() => {
    setIsDrawerOpen(false);
  }, []);

  // 5. Compute totals
  const totals = React.useMemo(() => calculateCartTotals(items), [items]);

  const value = React.useMemo<CartContextValue>(
    () => ({
      items,
      totalUnits: totals.totalUnits,
      distinctLines: totals.distinctLines,
      subtotal: totals.subtotal,
      isHydrated,
      isReconciling,
      isDrawerOpen,
      lastAddedItem,
      setIsDrawerOpen,
      openDrawer,
      closeDrawer,
      addItem,
      updateQuantity,
      removeItem,
      clearCart,
      reconcileCart,
    }),
    [
      items,
      totals.totalUnits,
      totals.distinctLines,
      totals.subtotal,
      isHydrated,
      isReconciling,
      isDrawerOpen,
      lastAddedItem,
      openDrawer,
      closeDrawer,
      addItem,
      updateQuantity,
      removeItem,
      clearCart,
      reconcileCart,
    ],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = React.useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a <CartProvider>');
  }
  return context;
}

export function useOptionalCart(): CartContextValue | null {
  return React.useContext(CartContext);
}

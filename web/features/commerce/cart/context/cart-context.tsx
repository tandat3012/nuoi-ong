'use client';

import * as React from 'react';
import { getProductStore } from '../../products/api/product.api';
import type { AddToCartInput, CartContextValue } from '../types/cart';
import {
  calculateCartTotals,
  CART_STORAGE_KEY,
  cartReducer,
  initialCartState,
  deserializeCart,
  isValidCartInput,
  serializeCart,
  type CartCatalogResult,
} from '../components/cart.logic';

const CartContext = React.createContext<CartContextValue | null>(null);

export interface CartProviderProps {
  children: React.ReactNode;
}

export function CartProvider({ children }: CartProviderProps) {
  const [{ items, isHydrated, lastAddedItem }, dispatch] = React.useReducer(
    cartReducer,
    initialCartState,
  );
  const reconciliation = React.useRef(0);
  const storageReadable = React.useRef(false);
  const [isReconciling, setIsReconciling] = React.useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = React.useState(false);

  // 1. Safe Client Hydration: Read from localStorage only after mount
  React.useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          const raw = window.localStorage.getItem(CART_STORAGE_KEY);
          storageReadable.current = true;
          const restored = deserializeCart(raw);
          dispatch({ type: 'restore', items: restored });
        }
      } catch (err) {
        console.warn('[Cart] Failed to restore cart from storage:', err);
      } finally {
        dispatch({ type: 'restore', items: [] });
      }
    });

    return () => {
      active = false;
    };
  }, []);

  // 2. Persistence: Save to localStorage only after initial hydration completes
  React.useEffect(() => {
    if (!isHydrated || !storageReadable.current) return;

    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const payload = serializeCart(items);
        window.localStorage.setItem(CART_STORAGE_KEY, payload);
      }
    } catch (err) {
      console.warn('[Cart] Failed to persist cart to storage:', err);
    }
  }, [items, isHydrated]);

  // Catalog fields apply to current lines, never to a captured cart snapshot.
  const reconcileCart = React.useCallback(async () => {
    if (!isHydrated || items.length === 0) return;
    const request = ++reconciliation.current;
    const slugs = [...new Set(items.map((item) => item.productSlug))];
    dispatch({ type: 'pending', slugs });
    setIsReconciling(true);
    const catalog = new Map<string, CartCatalogResult>();
    await Promise.all(
      slugs.map(async (slug) => {
        try {
          const result = await getProductStore(slug);
          catalog.set(slug, result ? result.data : null);
        } catch {
          catalog.set(slug, 'error');
        }
      }),
    );
    if (request !== reconciliation.current) return;
    dispatch({ type: 'catalog', catalog });
    setIsReconciling(false);
  }, [isHydrated, items]);

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
    if (!isValidCartInput(input)) return false;
    dispatch({ type: 'add', input });
    setIsDrawerOpen(true);

    return true;
  }, []);

  const updateQuantity = React.useCallback((id: string, quantity: number) => {
    dispatch({ type: 'quantity', id, quantity });
  }, []);

  const removeItem = React.useCallback((id: string) => {
    dispatch({ type: 'remove', id });
  }, []);

  const clearCart = React.useCallback(() => {
    dispatch({ type: 'clear' });
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

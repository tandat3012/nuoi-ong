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
  reconcileCartItems,
  serializeCart,
  type CartCatalogResult,
} from '../components/cart.logic';

const CartContext = React.createContext<CartContextValue | null>(null);

export interface CartProviderProps {
  children: React.ReactNode;
}

export function CartProvider({ children }: CartProviderProps) {
  const [state, reactDispatch] = React.useReducer(
    cartReducer,
    initialCartState,
  );
  const stateRef = React.useRef(state);
  React.useLayoutEffect(() => {
    stateRef.current = state;
  }, [state]);
  const dispatch = React.useCallback(
    (action: Parameters<typeof cartReducer>[1]) => {
      stateRef.current = cartReducer(stateRef.current, action);
      reactDispatch(action);
    },
    [],
  );
  const { items, isHydrated, lastAddedItem } = state;
  const reconciliation = React.useRef(0);
  const checkoutSubmittingRef = React.useRef(false);
  const storageReadable = React.useRef(false);
  const [isReconciling, setIsReconciling] = React.useState(false);
  const [isCheckoutSubmitting, setIsCheckoutSubmitting] = React.useState(false);
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
  }, [dispatch]);

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
    if (!isHydrated || items.length === 0) return stateRef.current.items;
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
    if (request !== reconciliation.current) return stateRef.current.items;
    const snapshot = reconcileCartItems(stateRef.current.items, catalog);
    dispatch({ type: 'catalog', catalog });
    setIsReconciling(false);
    return snapshot;
  }, [dispatch, isHydrated, items]);

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
    if (checkoutSubmittingRef.current || !isValidCartInput(input)) return false;
    dispatch({ type: 'add', input });
    setIsDrawerOpen(true);

    return true;
  }, [dispatch]);

  const updateQuantity = React.useCallback((id: string, quantity: number) => {
    if (checkoutSubmittingRef.current) return;
    dispatch({ type: 'quantity', id, quantity });
  }, [dispatch]);

  const removeItem = React.useCallback((id: string) => {
    if (checkoutSubmittingRef.current) return;
    dispatch({ type: 'remove', id });
  }, [dispatch]);

  const clearCart = React.useCallback(() => {
    if (checkoutSubmittingRef.current) return;
    dispatch({ type: 'clear' });
  }, [dispatch]);

  const setCheckoutLock = React.useCallback((submitting: boolean) => {
    checkoutSubmittingRef.current = submitting;
    setIsCheckoutSubmitting(submitting);
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
      isCheckoutSubmitting,
      isDrawerOpen,
      lastAddedItem,
      setIsDrawerOpen,
      openDrawer,
      closeDrawer,
      addItem,
      updateQuantity,
      removeItem,
      clearCart,
      setCheckoutSubmitting: setCheckoutLock,
      reconcileCart,
    }),
    [
      items,
      totals.totalUnits,
      totals.distinctLines,
      totals.subtotal,
      isHydrated,
      isReconciling,
      isCheckoutSubmitting,
      isDrawerOpen,
      lastAddedItem,
      openDrawer,
      closeDrawer,
      addItem,
      updateQuantity,
      removeItem,
      clearCart,
      setCheckoutLock,
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

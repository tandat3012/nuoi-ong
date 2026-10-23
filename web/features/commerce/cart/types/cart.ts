import type { StorefrontProductImage } from '../../products/types/product';

export interface CartItem {
  /** Unique composite identifier: `${productId}__${variantId ?? 'default'}` */
  id: string;
  productId: string;
  productSlug: string;
  productName: string;
  variantId?: string;
  variantName?: string;
  /** Display snapshot price in VND */
  unitPrice: number;
  originalPrice?: number;
  image?: StorefrontProductImage;
  /** Safe positive integer >= 1 */
  quantity: number;
  purchaseLimit?: number;
  inStock: boolean;
  /** True when catalog price reconciliation indicates price differed from saved snapshot */
  isPriceChanged?: boolean;
  /** True if product or variant is no longer found in catalog */
  isUnavailable?: boolean;
}

export interface StoredCartItemV1 {
  id: string;
  productId: string;
  productSlug: string;
  productName: string;
  variantId?: string;
  variantName?: string;
  unitPrice: number;
  originalPrice?: number;
  image?: {
    src: string;
    alt: string;
  };
  quantity: number;
  purchaseLimit?: number;
  inStock: boolean;
}

export interface StoredCartV1 {
  version: 1;
  updatedAt: number;
  items: StoredCartItemV1[];
}

export interface AddToCartInput {
  productId: string;
  productSlug: string;
  productName: string;
  variantId?: string;
  variantName?: string;
  unitPrice: number;
  originalPrice?: number;
  image?: StorefrontProductImage;
  quantity?: number;
  purchaseLimit?: number;
  inStock?: boolean;
}

export interface CartTotals {
  totalUnits: number;
  distinctLines: number;
  subtotal: number;
}

export interface CartContextValue extends CartTotals {
  items: CartItem[];
  isHydrated: boolean;
  isReconciling: boolean;
  isDrawerOpen: boolean;
  lastAddedItem: CartItem | null;
  setIsDrawerOpen: (open: boolean) => void;
  openDrawer: () => void;
  closeDrawer: () => void;
  addItem: (input: AddToCartInput) => boolean;
  updateQuantity: (id: string, quantity: number) => void;
  removeItem: (id: string) => void;
  clearCart: () => void;
  reconcileCart: () => Promise<void>;
}

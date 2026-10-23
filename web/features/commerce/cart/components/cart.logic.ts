import type { StorefrontProductDetail } from '../../products/types/product';
import type {
  AddToCartInput,
  CartItem,
  CartTotals,
  StoredCartItemV1,
  StoredCartV1,
} from '../types/cart';

export const CART_STORAGE_KEY = 'moc_ong_cart_v1';

export function generateCartLineId(productId: string, variantId?: string): string {
  const pId = typeof productId === 'string' ? productId.trim() : '';
  const vId = variantId && typeof variantId === 'string' && variantId.trim().length > 0
    ? variantId.trim()
    : 'default';
  return `${pId}__${vId}`;
}

export function validateQuantity(
  value: unknown,
  purchaseLimit?: number,
  min = 1,
): number {
  let parsed: number;

  if (typeof value === 'number') {
    parsed = Number.isInteger(value) ? value : Math.floor(value);
  } else if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!/^\d+$/.test(trimmed)) {
      return min;
    }
    parsed = parseInt(trimmed, 10);
  } else {
    return min;
  }

  if (isNaN(parsed) || parsed < min || !Number.isFinite(parsed)) {
    return min;
  }

  if (
    purchaseLimit !== undefined &&
    Number.isFinite(purchaseLimit) &&
    purchaseLimit >= min &&
    parsed > purchaseLimit
  ) {
    return purchaseLimit;
  }

  return parsed;
}

export function addItemToCart(
  currentItems: CartItem[],
  input: AddToCartInput,
): { items: CartItem[]; addedItem: CartItem } {
  const lineId = generateCartLineId(input.productId, input.variantId);
  const addQty = validateQuantity(input.quantity ?? 1, input.purchaseLimit, 1);
  const existingIndex = currentItems.findIndex((item) => item.id === lineId);

  if (existingIndex >= 0) {
    const existing = currentItems[existingIndex];
    const effectiveLimit = input.purchaseLimit ?? existing.purchaseLimit;
    const combinedQty = validateQuantity(
      existing.quantity + addQty,
      effectiveLimit,
      1,
    );

    const updatedItem: CartItem = {
      ...existing,
      productName: input.productName || existing.productName,
      productSlug: input.productSlug || existing.productSlug,
      variantName: input.variantName ?? existing.variantName,
      unitPrice: Number.isFinite(input.unitPrice) && input.unitPrice >= 0
        ? input.unitPrice
        : existing.unitPrice,
      originalPrice: input.originalPrice ?? existing.originalPrice,
      image: input.image ?? existing.image,
      quantity: combinedQty,
      purchaseLimit: effectiveLimit,
      inStock: input.inStock ?? existing.inStock,
      isUnavailable: false,
    };

    const newItems = [...currentItems];
    newItems[existingIndex] = updatedItem;
    return { items: newItems, addedItem: updatedItem };
  }

  const newItem: CartItem = {
    id: lineId,
    productId: input.productId.trim(),
    productSlug: input.productSlug.trim(),
    productName: input.productName.trim(),
    variantId: input.variantId?.trim(),
    variantName: input.variantName?.trim(),
    unitPrice: Number.isFinite(input.unitPrice) && input.unitPrice >= 0 ? input.unitPrice : 0,
    originalPrice: input.originalPrice,
    image: input.image,
    quantity: addQty,
    purchaseLimit: input.purchaseLimit,
    inStock: input.inStock ?? true,
    isPriceChanged: false,
    isUnavailable: false,
  };

  return { items: [...currentItems, newItem], addedItem: newItem };
}

export function updateCartItemQuantity(
  currentItems: CartItem[],
  id: string,
  newQuantity: number,
): CartItem[] {
  const index = currentItems.findIndex((item) => item.id === id);
  if (index === -1) return currentItems;

  const item = currentItems[index];
  const validQty = validateQuantity(newQuantity, item.purchaseLimit, 1);

  const updated: CartItem = {
    ...item,
    quantity: validQty,
  };

  const nextItems = [...currentItems];
  nextItems[index] = updated;
  return nextItems;
}

export function removeCartItem(currentItems: CartItem[], id: string): CartItem[] {
  return currentItems.filter((item) => item.id !== id);
}

export function calculateCartTotals(items: CartItem[]): CartTotals {
  let totalUnits = 0;
  let subtotal = 0;

  for (const item of items) {
    if (Number.isFinite(item.quantity) && item.quantity > 0) {
      totalUnits += item.quantity;
    }

    if (
      item.inStock !== false &&
      !item.isUnavailable &&
      Number.isFinite(item.unitPrice) &&
      item.unitPrice >= 0 &&
      Number.isFinite(item.quantity) &&
      item.quantity > 0
    ) {
      const lineTotal = item.quantity * item.unitPrice;
      if (Number.isFinite(lineTotal)) {
        subtotal += lineTotal;
      }
    }
  }

  return {
    totalUnits,
    distinctLines: items.length,
    subtotal,
  };
}

export function serializeCart(items: CartItem[]): string {
  const storedItems: StoredCartItemV1[] = items.map((item) => ({
    id: item.id,
    productId: item.productId,
    productSlug: item.productSlug,
    productName: item.productName,
    variantId: item.variantId,
    variantName: item.variantName,
    unitPrice: item.unitPrice,
    originalPrice: item.originalPrice,
    image: item.image ? { src: item.image.src, alt: item.image.alt } : undefined,
    quantity: item.quantity,
    purchaseLimit: item.purchaseLimit,
    inStock: item.inStock,
  }));

  const payload: StoredCartV1 = {
    version: 1,
    updatedAt: Date.now(),
    items: storedItems,
  };

  return JSON.stringify(payload);
}

export function deserializeCart(raw: string | null): CartItem[] {
  if (!raw || typeof raw !== 'string') return [];

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || parsed.version !== 1 || !Array.isArray(parsed.items)) {
      return [];
    }

    const items: CartItem[] = [];

    for (const rawItem of parsed.items) {
      if (
        !rawItem ||
        typeof rawItem !== 'object' ||
        typeof rawItem.id !== 'string' ||
        typeof rawItem.productId !== 'string' ||
        typeof rawItem.productSlug !== 'string' ||
        typeof rawItem.productName !== 'string' ||
        typeof rawItem.unitPrice !== 'number' ||
        !Number.isFinite(rawItem.unitPrice) ||
        rawItem.unitPrice < 0
      ) {
        continue;
      }

      const validQuantity = validateQuantity(rawItem.quantity, rawItem.purchaseLimit, 1);

      items.push({
        id: rawItem.id,
        productId: rawItem.productId,
        productSlug: rawItem.productSlug,
        productName: rawItem.productName,
        variantId: typeof rawItem.variantId === 'string' ? rawItem.variantId : undefined,
        variantName: typeof rawItem.variantName === 'string' ? rawItem.variantName : undefined,
        unitPrice: rawItem.unitPrice,
        originalPrice:
          typeof rawItem.originalPrice === 'number' && Number.isFinite(rawItem.originalPrice)
            ? rawItem.originalPrice
            : undefined,
        image:
          rawItem.image && typeof rawItem.image.src === 'string'
            ? { src: rawItem.image.src, alt: rawItem.image.alt || rawItem.productName }
            : undefined,
        quantity: validQuantity,
        purchaseLimit:
          typeof rawItem.purchaseLimit === 'number' && Number.isFinite(rawItem.purchaseLimit)
            ? rawItem.purchaseLimit
            : undefined,
        inStock: typeof rawItem.inStock === 'boolean' ? rawItem.inStock : true,
        isPriceChanged: false,
        isUnavailable: false,
      });
    }

    return items;
  } catch {
    return [];
  }
}

export function reconcileItemWithDetail(
  item: CartItem,
  detail: StorefrontProductDetail | null,
): CartItem {
  if (detail === null) {
    return {
      ...item,
      inStock: false,
      isUnavailable: true,
    };
  }

  const effectiveLimit = detail.purchaseLimit;
  const clampedQty = effectiveLimit
    ? Math.min(item.quantity, effectiveLimit)
    : item.quantity;

  if (item.variantId) {
    const variant = detail.variants?.find((v) => v.id === item.variantId);
    if (!variant) {
      return {
        ...item,
        inStock: false,
        isUnavailable: true,
      };
    }

    const currentPrice = variant.price ?? detail.price;
    const currentStock = variant.inStock ?? detail.inStock;
    const isPriceChanged = currentPrice !== item.unitPrice;

    return {
      ...item,
      unitPrice: currentPrice,
      inStock: currentStock,
      isUnavailable: false,
      isPriceChanged,
      purchaseLimit: effectiveLimit,
      quantity: clampedQty,
      variantName: variant.name || item.variantName,
    };
  }

  const currentPrice = detail.price;
  const currentStock = detail.inStock;
  const isPriceChanged = currentPrice !== item.unitPrice;

  return {
    ...item,
    unitPrice: currentPrice,
    inStock: currentStock,
    isUnavailable: false,
    isPriceChanged,
    purchaseLimit: effectiveLimit,
    quantity: clampedQty,
  };
}

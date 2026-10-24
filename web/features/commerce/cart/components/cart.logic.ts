import type {
  StorefrontProduct,
  StorefrontProductDetail,
} from '../../products/types/product';
import type {
  AddToCartInput,
  CartItem,
  CartTotals,
  StoredCartItemV1,
  StoredCartV1,
} from '../types/cart';

export const CART_STORAGE_KEY = 'moc_ong_cart_v1';

export function generateCartLineId(
  productId: string,
  variantId?: string,
): string {
  const pId = typeof productId === 'string' ? productId.trim() : '';
  const vId =
    variantId && typeof variantId === 'string' && variantId.trim().length > 0
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

  if (isNaN(parsed) || parsed < min || !Number.isSafeInteger(parsed)) {
    return min;
  }

  if (
    purchaseLimit !== undefined &&
    Number.isSafeInteger(purchaseLimit) &&
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
): { items: CartItem[]; addedItem: CartItem | null } {
  if (!isValidCartInput(input)) return { items: currentItems, addedItem: null };
  const lineId = generateCartLineId(input.productId, input.variantId);
  const addQty = validateQuantity(input.quantity ?? 1, input.purchaseLimit, 1);
  const existingIndex = currentItems.findIndex((item) => item.id === lineId);

  if (existingIndex >= 0) {
    const existing = currentItems[existingIndex];
    const effectiveLimit = input.purchaseLimit;
    const combinedQty = validateQuantity(
      Math.min(Number.MAX_SAFE_INTEGER, existing.quantity + addQty),
      effectiveLimit,
      1,
    );

    const updatedItem: CartItem = {
      ...existing,
      productName: input.productName || existing.productName,
      productSlug: input.productSlug || existing.productSlug,
      variantName: input.variantName ?? existing.variantName,
      unitPrice: isValidCartPrice(input.unitPrice)
        ? input.unitPrice
        : existing.unitPrice,
      originalPrice: input.originalPrice ?? existing.originalPrice,
      image: input.image ?? existing.image,
      quantity: combinedQty,
      purchaseLimit: effectiveLimit,
      inStock: input.inStock ?? existing.inStock,
      isUnavailable: false,
      verification: 'verified',
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
    unitPrice: isValidCartPrice(input.unitPrice) ? input.unitPrice : null,
    originalPrice: input.originalPrice,
    image: input.image,
    quantity: addQty,
    purchaseLimit: input.purchaseLimit,
    inStock: input.inStock ?? true,
    isPriceChanged: false,
    isUnavailable: false,
    verification: 'verified',
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

export function removeCartItem(
  currentItems: CartItem[],
  id: string,
): CartItem[] {
  return currentItems.filter((item) => item.id !== id);
}

export function isValidCartInput(input: AddToCartInput): boolean {
  return Boolean(
    input.productId?.trim() &&
    input.productSlug?.trim() &&
    input.productName?.trim() &&
    input.variantId?.trim() &&
    isValidCartPrice(input.unitPrice) &&
    input.inStock === true,
  );
}

export async function resolveProductForCart(
  product: StorefrontProduct,
  lookup: (slug: string) => Promise<{ data: StorefrontProductDetail } | null>,
): Promise<StorefrontProduct | null> {
  if (Array.isArray(product.variants)) return product;
  return (await lookup(product.slug))?.data ?? null;
}

export function isValidCartPrice(price: unknown): price is number {
  return typeof price === 'number' && Number.isSafeInteger(price) && price >= 0;
}

// The current backend only sells variants; product.price is an advertised minimum.
export function resolveCartInput(
  product: StorefrontProduct,
  variantId?: string,
  quantity = 1,
): AddToCartInput | null {
  const variants = product.variants;
  if (!Array.isArray(variants)) return null;
  const variant = variantId
    ? variants.find((entry) => entry.id === variantId)
    : variants.length === 1
      ? variants[0]
      : undefined;
  if (
    !variant?.id ||
    !isValidCartPrice(variant.price) ||
    variant.inStock !== true
  )
    return null;
  return {
    productId: product.id,
    productSlug: product.slug,
    productName: product.name,
    variantId: variant.id,
    variantName: variant.name,
    unitPrice: variant.price,
    originalPrice: variant.originalPrice,
    image: variant.image ?? product.image,
    quantity,
    purchaseLimit:
      'purchaseLimit' in product
        ? (product as StorefrontProductDetail).purchaseLimit
        : undefined,
    inStock: variant.inStock,
  };
}

export function calculateCartTotals(items: CartItem[]): CartTotals {
  let totalUnits = 0;
  let subtotal: number | null = 0;
  for (const item of items) {
    totalUnits += item.quantity;
    if (
      item.inStock === false ||
      item.isUnavailable ||
      item.verification === 'selection-required'
    )
      continue;
    if (
      !isValidCartPrice(item.unitPrice) ||
      !Number.isSafeInteger(item.unitPrice * item.quantity)
    ) {
      subtotal = null;
    } else if (subtotal !== null) {
      subtotal += item.unitPrice * item.quantity;
      if (!Number.isSafeInteger(subtotal)) subtotal = null;
    }
  }
  return { totalUnits, distinctLines: items.length, subtotal };
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
    image: item.image
      ? { src: item.image.src, alt: item.image.alt }
      : undefined,
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
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      parsed.version !== 1 ||
      !Array.isArray(parsed.items)
    ) {
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
        !rawItem.productId.trim() ||
        !rawItem.productSlug.trim() ||
        !rawItem.productName.trim()
      ) {
        continue;
      }

      const validQuantity = validateQuantity(
        rawItem.quantity,
        rawItem.purchaseLimit,
        1,
      );

      items.push({
        id: generateCartLineId(rawItem.productId, rawItem.variantId),
        productId: rawItem.productId,
        productSlug: rawItem.productSlug,
        productName: rawItem.productName,
        variantId:
          typeof rawItem.variantId === 'string' ? rawItem.variantId : undefined,
        variantName:
          typeof rawItem.variantName === 'string'
            ? rawItem.variantName
            : undefined,
        unitPrice: isValidCartPrice(rawItem.unitPrice)
          ? rawItem.unitPrice
          : null,
        originalPrice:
          typeof rawItem.originalPrice === 'number' &&
          Number.isFinite(rawItem.originalPrice)
            ? rawItem.originalPrice
            : undefined,
        image:
          rawItem.image && typeof rawItem.image.src === 'string'
            ? {
                src: rawItem.image.src,
                alt: rawItem.image.alt || rawItem.productName,
              }
            : undefined,
        quantity: validQuantity,
        purchaseLimit:
          typeof rawItem.purchaseLimit === 'number' &&
          Number.isFinite(rawItem.purchaseLimit)
            ? rawItem.purchaseLimit
            : undefined,
        inStock: typeof rawItem.inStock === 'boolean' ? rawItem.inStock : true,
        isPriceChanged: false,
        isUnavailable: false,
        verification: 'pending',
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
  if (detail === null || detail.id !== item.productId) {
    return {
      ...item,
      verification: 'missing',
      isUnavailable: true,
      inStock: false,
    };
  }
  if (!Array.isArray(detail.variants)) {
    return { ...item, verification: 'error' };
  }
  if (!item.variantId && detail.variants.length > 1) {
    return {
      ...item,
      verification: 'selection-required',
      isUnavailable: false,
    };
  }
  const variant = item.variantId
    ? detail.variants.find((entry) => entry.id === item.variantId)
    : detail.variants.length === 1
      ? detail.variants[0]
      : undefined;
  if (!variant) {
    return {
      ...item,
      verification: 'missing',
      isUnavailable: true,
      inStock: false,
    };
  }
  if (
    !variant.id ||
    !isValidCartPrice(variant.price) ||
    typeof variant.inStock !== 'boolean'
  ) {
    return { ...item, unitPrice: null, verification: 'error' };
  }
  return {
    ...item,
    id: generateCartLineId(item.productId, variant.id),
    productName: detail.name,
    variantId: variant.id,
    variantName: variant.name,
    unitPrice: variant.price,
    originalPrice: variant.originalPrice,
    image: variant.image ?? detail.image ?? item.image,
    quantity: validateQuantity(item.quantity, detail.purchaseLimit),
    purchaseLimit: detail.purchaseLimit,
    inStock: variant.inStock,
    isUnavailable: false,
    isPriceChanged: item.isPriceChanged || item.unitPrice !== variant.price,
    verification: 'verified',
  };
}

export type CartCatalogResult = StorefrontProductDetail | null | 'error';

export function reconcileCartItems(
  items: CartItem[],
  catalog: Map<string, CartCatalogResult>,
): CartItem[] {
  const lines = new Map<string, CartItem>();
  for (const item of items) {
    const detail = catalog.get(item.productSlug);
    const next =
      detail === undefined
        ? item
        : detail === 'error'
          ? { ...item, verification: 'error' as const }
          : reconcileItemWithDetail(item, detail);
    const existing = lines.get(next.id);
    lines.set(
      next.id,
      existing
        ? {
            ...next,
            quantity: validateQuantity(
              Math.min(
                Number.MAX_SAFE_INTEGER,
                existing.quantity + next.quantity,
              ),
              next.purchaseLimit,
            ),
            isPriceChanged: existing.isPriceChanged || next.isPriceChanged,
          }
        : next,
    );
  }
  return [...lines.values()];
}

export type CartEdit =
  | { type: 'add'; input: AddToCartInput }
  | { type: 'quantity'; id: string; quantity: number }
  | { type: 'remove'; id: string }
  | { type: 'clear' };

type CartAction =
  | CartEdit
  | { type: 'restore'; items: CartItem[] }
  | { type: 'pending'; slugs: string[] }
  | { type: 'catalog'; catalog: Map<string, CartCatalogResult> };

export interface CartState {
  items: CartItem[];
  isHydrated: boolean;
  pendingEdits: CartEdit[];
  lastAddedItem: CartItem | null;
}

export const initialCartState: CartState = {
  items: [],
  isHydrated: false,
  pendingEdits: [],
  lastAddedItem: null,
};

function applyCartEdit(items: CartItem[], action: CartEdit): CartItem[] {
  switch (action.type) {
    case 'add':
      return addItemToCart(items, action.input).items;
    case 'quantity':
      return updateCartItemQuantity(items, action.id, action.quantity);
    case 'remove':
      return removeCartItem(items, action.id);
    case 'clear':
      return [];
  }
}

export function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'restore':
      if (state.isHydrated) return state;
      return {
        ...state,
        isHydrated: true,
        pendingEdits: [],
        items: state.pendingEdits.reduce(applyCartEdit, action.items),
      };
    case 'pending':
      return {
        ...state,
        items: state.items.map((item) =>
          action.slugs.includes(item.productSlug)
            ? { ...item, verification: 'pending' }
            : item,
        ),
      };
    case 'catalog':
      return {
        ...state,
        items: reconcileCartItems(state.items, action.catalog),
      };
    default: {
      const items = applyCartEdit(state.items, action);
      return {
        ...state,
        items,
        lastAddedItem:
          action.type === 'add'
            ? (items.find(
                (item) =>
                  item.id ===
                  generateCartLineId(
                    action.input.productId,
                    action.input.variantId,
                  ),
              ) ?? null)
            : state.lastAddedItem,
        pendingEdits: state.isHydrated ? [] : [...state.pendingEdits, action],
      };
    }
  }
}

export function cartItemStatus(item: CartItem): string {
  const exclusion =
    item.isUnavailable || !item.inStock
      ? ' Dòng này chưa tính vào tạm tính theo thông tin đã lưu.'
      : '';
  if (item.verification === 'pending')
    return 'Đang xác minh giá và tình trạng hàng…' + exclusion;
  if (item.verification === 'error')
    return (
      'Chưa xác minh được giá/tình trạng hàng. Đang giữ thông tin đã lưu.' +
      exclusion
    );
  if (item.verification === 'selection-required')
    return 'Cần chọn lại quy cách; chưa tính vào tạm tính.';
  if (item.isUnavailable)
    return 'Không còn tìm thấy sản phẩm/quy cách; chưa tính vào tạm tính.';
  if (!item.inStock) return 'Tạm hết hàng; chưa tính vào tạm tính.';
  if (!isValidCartPrice(item.unitPrice))
    return 'Chưa có giá hợp lệ; chưa thể tính tổng.';
  return 'Đã xác minh: còn hàng';
}

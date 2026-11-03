import { storeRegionLabels } from "../orders/order.logic.ts";
import type { StoreRegion } from "../orders/types/order";

export { storeRegionLabels };

export const REGION_COOKIE = "moc_ong_region";

/** Label the API gives instead of stock numbers. */
export type Availability =
  | "REGION_REQUIRED"
  | "AVAILABLE"
  | "INSUFFICIENT_IN_REGION"
  | "OUT_IN_REGION"
  | "REGION_NOT_SUPPORTED"
  | "OUT_OF_STOCK";

export const availabilityLabels: Record<Availability, string> = {
  REGION_REQUIRED: "Chọn khu vực giao hàng",
  AVAILABLE: "Có thể giao tại khu vực của bạn",
  INSUFFICIENT_IN_REGION: "Không đủ số lượng tại khu vực",
  OUT_IN_REGION: "Tạm hết hàng tại khu vực",
  REGION_NOT_SUPPORTED: "Chưa hỗ trợ giao đến khu vực này",
  OUT_OF_STOCK: "Hết hàng",
};

export function parseStoreRegion(value: unknown): StoreRegion | null {
  return typeof value === "string" && Object.hasOwn(storeRegionLabels, value)
    ? (value as StoreRegion)
    : null;
}

/** Older API responses without `availability` fall back to `inStock`. */
export function availabilityLabel(item: {
  availability?: Availability;
  inStock: boolean;
}) {
  return item.availability
    ? availabilityLabels[item.availability]
    : item.inStock
      ? "Còn hàng"
      : "Hết hàng";
}

type CartLine = { variantId?: string; productName: string; variantName?: string };

export function cartLineName(items: CartLine[], variantId: string) {
  const item = items.find((line) => line.variantId === variantId);
  if (!item) return "Sản phẩm khác";
  return item.variantName
    ? `${item.productName} (${item.variantName})`
    : item.productName;
}

/** "Đơn 1: A, B" lines for the split-order suggestion of the cart check. */
export function splitOrderSuggestions(groups: string[][], items: CartLine[]) {
  return groups.map(
    (group, index) =>
      `Đơn ${index + 1}: ${group.map((id) => cartLineName(items, id)).join(", ")}`,
  );
}

/** `groups` of a CART_NOT_FULFILLABLE error body, when well-formed. */
export function parseSplitGroups(details: unknown): string[][] | null {
  const groups =
    details && typeof details === "object" && "groups" in details
      ? details.groups
      : null;
  return Array.isArray(groups) &&
    groups.length > 0 &&
    groups.every(
      (group) =>
        Array.isArray(group) && group.every((id) => typeof id === "string"),
    )
    ? (groups as string[][])
    : null;
}

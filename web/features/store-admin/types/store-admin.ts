export type StoreProductStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

export type StoreCategory = { id: string; name: string; slug: string };

export type StoreProductRow = {
  id: string;
  name: string;
  slug: string;
  status: StoreProductStatus;
  category: { id: string; name: string };
  variantCount: number;
  imageUrl: string | null;
  updatedAt: string;
};

export type StoreVariant = {
  id: string;
  unitId: string;
  name: string;
  price: string;
  quantityStep: string;
  active: boolean;
  /** The item the selected farm sells for this variant; null until mapped. */
  item: { id: string; code: string; name: string } | null;
  /** Farms that supply this variant. */
  farmCount: number;
  unit?: { name: string; symbol: string | null };
};

export type { StoreRegion } from "@/features/commerce/orders/types/order";
import type { StoreRegion } from "@/features/commerce/orders/types/order";

export type StoreSettings = {
  salesEnabled: boolean;
  regions: StoreRegion[];
  salesWarehouse: {
    id: string;
    code: string;
    name: string;
    status: string;
  } | null;
};

export type StoreSalesStockRow = {
  productId: string;
  productName: string;
  variantId: string;
  variantName: string;
  itemCode: string;
  itemName: string;
  unitSymbol: string;
  /** Decimal strings; never sent to customers. */
  onHand: string;
  held: string;
  available: string;
  saleable: boolean;
};

export type StoreSalesStock = StoreSettings & { rows: StoreSalesStockRow[] };

export type StoreSettingsInput = {
  salesWarehouseId?: string;
  salesEnabled: boolean;
  regions: StoreRegion[];
};

export type StoreImage = {
  id: string;
  url: string;
  alt: string;
  position: number;
};

export type StoreProduct = {
  id: string;
  categoryId: string;
  name: string;
  slug: string;
  description: string;
  status: StoreProductStatus;
  variants: StoreVariant[];
  images: StoreImage[];
};

export type StoreProductInput = {
  categoryId: string;
  name: string;
  slug: string;
  description: string;
};

export type StoreVariantInput = {
  itemId?: string;
  name: string;
  price: string;
  quantityStep: string;
  active?: boolean;
};

export type StoreProductFilters = {
  page: number;
  search?: string;
  status?: StoreProductStatus;
};

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
  itemId: string;
  name: string;
  price: string;
  quantityStep: string;
  active: boolean;
  item?: { code: string; name: string };
  unit?: { name: string; symbol: string | null };
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

export type StorefrontProductRating = {
  score: number;
  reviewCount: number;
};

export type StorefrontProductCategory = {
  id: string;
  name: string;
  slug: string;
};

export type StorefrontProductImage = {
  src: string;
  alt: string;
};

export type StorefrontProduct = {
  id: string;
  slug: string;
  name: string;
  category: StorefrontProductCategory;
  price: number;
  originalPrice?: number;
  badge?: string;
  rating?: StorefrontProductRating;
  image?: StorefrontProductImage;
  inStock: boolean;
  variants?: StorefrontProductVariant[];
};

export type StorefrontProductVariant = {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  inStock: boolean;
  image?: StorefrontProductImage;
  sku?: string;
};

export type StorefrontProductSpecification = {
  name: string;
  value: string;
};

export type StorefrontProductReview = {
  id: string;
  author: string;
  rating: number;
  comment: string;
  date?: string;
};

export type StorefrontProductDetail = StorefrontProduct & {
  description: string;
  sku?: string;
  brand?: string;
  images?: StorefrontProductImage[];
  variants?: StorefrontProductVariant[];
  specifications?: StorefrontProductSpecification[];
  usageGuidance?: string;
  purchaseLimit?: number;
  reviews?: StorefrontProductReview[];
};

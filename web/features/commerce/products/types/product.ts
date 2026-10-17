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
};

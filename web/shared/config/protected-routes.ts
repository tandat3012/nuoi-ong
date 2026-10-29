export const backOfficeRoutes = [
  '/dashboard',
  '/warehouses',
  '/materials',
  '/catalog',
  '/inventory',
  '/receipts',
  '/issues',
  '/counts',
  '/transfers',
  '/assets',
  '/maintenance',
  '/requests',
  '/scan',
  '/personnel',
  '/store-products',
  '/store-orders',
  '/store-reports',
] as const;

export function isBackOfficePath(pathname: string) {
  return backOfficeRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

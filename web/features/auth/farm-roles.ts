// Mirrors api/src/modules/auth/farm-access/farm-role-groups.ts; the API stays authoritative.
export const FARM_ADMIN_ROLES = ['ADMIN', 'FARM_OWNER'];
export const WAREHOUSE_MANAGE_ROLES = [...FARM_ADMIN_ROLES, 'WAREHOUSE_MANAGER'];
export const STOCK_WRITE_ROLES = [...WAREHOUSE_MANAGE_ROLES, 'EMPLOYEE'];
export const STORE_MANAGE_ROLES = [...FARM_ADMIN_ROLES, 'STORE_MANAGER'];
/** Warehouse, asset and maintenance modules: every farm role except a store-only manager. */
export const FARM_AREA_ROLES = [...STOCK_WRITE_ROLES, 'GUEST'];
/** Staff with dashboard metrics and change history (own documents unless farm admin). */
export const HISTORY_ROLES = [...STOCK_WRITE_ROLES, 'STORE_MANAGER'];

export const hasAnyRole = (roles: readonly string[], allowed: readonly string[]) =>
  roles.some((role) => allowed.includes(role));

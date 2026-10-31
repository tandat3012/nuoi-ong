/** Fixed role groups for farm authorization; a member passes when any held role is listed. */
export const FARM_ADMIN_ROLES = ['ADMIN', 'FARM_OWNER'];
/** Warehouse master data, direct stock changes and approval of stock documents. */
export const WAREHOUSE_MANAGE_ROLES = [
  ...FARM_ADMIN_ROLES,
  'WAREHOUSE_MANAGER',
];
/** May create and submit their own stock documents. */
export const STOCK_WRITE_ROLES = [...WAREHOUSE_MANAGE_ROLES, 'EMPLOYEE'];
/** Store products, prices, images, orders and sales reports. */
export const STORE_MANAGE_ROLES = [...FARM_ADMIN_ROLES, 'STORE_MANAGER'];
/** Warehouse, asset and maintenance modules: every farm role except a store-only manager. */
export const FARM_AREA_ROLES = [...STOCK_WRITE_ROLES, 'GUEST'];

export const hasAnyRole = (roleCodes: string[], allowed: string[]) =>
  roleCodes.some((code) => allowed.includes(code));

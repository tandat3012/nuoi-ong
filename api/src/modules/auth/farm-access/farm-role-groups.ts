/** Fixed role groups for farm authorization; a member passes when any held role is listed. */
export const FARM_ADMIN_ROLES = ['ADMIN', 'FARM_OWNER'];
/** Warehouse master data, direct stock changes and approval of stock documents. */
export const WAREHOUSE_MANAGE_ROLES = [
  ...FARM_ADMIN_ROLES,
  'WAREHOUSE_MANAGER',
];
/** Limited to the warehouses they are assigned to (farm_member_warehouses), unless they also hold a FARM_ADMIN_ROLES role. */
export const WAREHOUSE_SCOPED_ROLES = ['WAREHOUSE_MANAGER', 'EMPLOYEE'];
/** May create and submit their own stock documents. */
export const STOCK_WRITE_ROLES = [...WAREHOUSE_MANAGE_ROLES, 'EMPLOYEE'];
/** Store products, prices, images, orders and sales reports. */
export const STORE_MANAGE_ROLES = [...FARM_ADMIN_ROLES, 'STORE_MANAGER'];
/** Take confirmed orders out for delivery, return them or mark them delivered. */
export const STORE_DELIVERY_ROLES = [
  ...STORE_MANAGE_ROLES,
  'EMPLOYEE',
  'DELIVERY_STAFF',
];
/** Warehouse, asset and maintenance modules: every farm role except a store-only manager. */
export const MAINTENANCE_WORK_ROLES = ['MAINTENANCE_STAFF'];
export const MAINTENANCE_SCHEDULE_ROLES = [
  ...WAREHOUSE_MANAGE_ROLES,
  ...MAINTENANCE_WORK_ROLES,
];
export const FARM_AREA_ROLES = [
  ...STOCK_WRITE_ROLES,
  ...MAINTENANCE_WORK_ROLES,
  'GUEST',
];
/** Read what a receipt form needs (warehouses, items, suppliers, locations, lots); store managers are scoped to the sales warehouse. */
export const RECEIPT_ROLES = [...FARM_AREA_ROLES, 'STORE_MANAGER'];

export const hasAnyRole = (roleCodes: string[], allowed: string[]) =>
  roleCodes.some((code) => allowed.includes(code));

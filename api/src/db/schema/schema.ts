import {
  pgTable,
  unique,
  uuid,
  varchar,
  text,
  timestamp,
  uniqueIndex,
  foreignKey,
  index,
  check,
  numeric,
  integer,
  date,
  jsonb,
  inet,
  primaryKey,
  pgEnum,
  boolean,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const assetStatus = pgEnum('asset_status', [
  'AVAILABLE',
  'ASSIGNED',
  'IN_USE',
  'MAINTENANCE',
  'LOST',
  'RETIRED',
]);
export const assignmentStatus = pgEnum('assignment_status', [
  'ACTIVE',
  'RETURNED',
  'CANCELLED',
]);
export const documentStatus = pgEnum('document_status', [
  'DRAFT',
  'CONFIRMED',
  'CANCELLED',
]);
export const incidentSeverity = pgEnum('incident_severity', [
  'LOW',
  'MEDIUM',
  'HIGH',
  'CRITICAL',
]);
export const incidentStatus = pgEnum('incident_status', [
  'OPEN',
  'IN_PROGRESS',
  'RESOLVED',
  'CANCELLED',
]);
export const inventoryTransactionType = pgEnum('inventory_transaction_type', [
  'RECEIPT',
  'ISSUE',
  'TRANSFER_OUT',
  'TRANSFER_IN',
  'ADJUSTMENT_IN',
  'ADJUSTMENT_OUT',
  'ASSIGNMENT_OUT',
  'RETURN_IN',
]);
export const issueType = pgEnum('issue_type', [
  'CONSUMPTION',
  'DAMAGE',
  'DISPOSAL',
  'OTHER',
]);
export const itemType = pgEnum('item_type', ['EQUIPMENT', 'TOOL', 'MATERIAL']);
export const materialKind = pgEnum('material_kind', [
  'FEED',
  'TREATMENT',
  'PACKAGING',
  'MAINTENANCE_SUPPLY',
  'CONSUMABLE',
  'OTHER',
]);
export const locationType = pgEnum('location_type', [
  'WAREHOUSE',
  'WAREHOUSE_ZONE',
  'APIARY',
  'SITE',
  'IN_USE',
  'MAINTENANCE',
  'OTHER',
]);
export const maintenanceStatus = pgEnum('maintenance_status', [
  'SCHEDULED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
]);
export const maintenanceType = pgEnum('maintenance_type', [
  'PREVENTIVE',
  'CORRECTIVE',
  'INSPECTION',
]);
export const memberStatus = pgEnum('member_status', ['ACTIVE', 'INACTIVE']);
export const recordStatus = pgEnum('record_status', ['ACTIVE', 'INACTIVE']);
export const roleScope = pgEnum('role_scope', ['SYSTEM', 'FARM']);
export const stockCountStatus = pgEnum('stock_count_status', [
  'DRAFT',
  'COUNTING',
  'CONFIRMED',
  'CANCELLED',
]);
export const trackingMode = pgEnum('tracking_mode', [
  'QUANTITY',
  'LOT',
  'ASSET',
]);

export const roles = pgTable(
  'roles',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    code: varchar({ length: 50 }).notNull(),
    name: varchar({ length: 100 }).notNull(),
    description: text(),
    scope: roleScope().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [unique('roles_code_key').on(table.code)],
);

export const users = pgTable(
  'users',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    authProvider: varchar('auth_provider', { length: 30 })
      .default('CLERK')
      .notNull(),
    authProviderUserId: varchar('auth_provider_user_id', {
      length: 255,
    }).notNull(),
    email: varchar({ length: 255 }).notNull(),
    fullName: varchar('full_name', { length: 255 }),
    avatarUrl: text('avatar_url'),
    systemRoleId: uuid('system_role_id'),
    status: recordStatus().default('ACTIVE').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex('ux_users_email_lower').using(
      'btree',
      sql`lower((email)::text)`,
    ),
    foreignKey({
      columns: [table.systemRoleId],
      foreignColumns: [roles.id],
      name: 'users_system_role_id_fkey',
    }),
    unique('users_auth_provider_user_id_key').on(table.authProviderUserId),
  ],
);

export const farms = pgTable(
  'farms',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    code: varchar({ length: 50 }).notNull(),
    name: varchar({ length: 255 }).notNull(),
    description: text(),
    status: recordStatus().default('ACTIVE').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [unique('farms_code_key').on(table.code)],
);

export const farmMembers = pgTable(
  'farm_members',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    farmId: uuid('farm_id').notNull(),
    userId: uuid('user_id').notNull(),
    status: memberStatus().default('ACTIVE').notNull(),
    joinedAt: timestamp('joined_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('idx_farm_members_user_id').using(
      'btree',
      table.userId.asc().nullsLast(),
    ),
    foreignKey({
      columns: [table.farmId],
      foreignColumns: [farms.id],
      name: 'farm_members_farm_id_fkey',
    }),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: 'farm_members_user_id_fkey',
    }),
    unique('uq_farm_member').on(table.farmId, table.userId),
  ],
);

export const suppliers = pgTable(
  'suppliers',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    farmId: uuid('farm_id').notNull(),
    code: varchar({ length: 50 }).notNull(),
    name: varchar({ length: 255 }).notNull(),
    phone: varchar({ length: 50 }),
    email: varchar({ length: 255 }),
    address: text(),
    note: text(),
    status: recordStatus().default('ACTIVE').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('idx_suppliers_farm_id').using(
      'btree',
      table.farmId.asc().nullsLast(),
    ),
    foreignKey({
      columns: [table.farmId],
      foreignColumns: [farms.id],
      name: 'suppliers_farm_id_fkey',
    }),
    unique('uq_supplier_code_per_farm').on(table.code, table.farmId),
  ],
);

export const warehouses = pgTable(
  'warehouses',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    farmId: uuid('farm_id').notNull(),
    code: varchar({ length: 50 }).notNull(),
    name: varchar({ length: 255 }).notNull(),
    address: text(),
    description: text(),
    status: recordStatus().default('ACTIVE').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('idx_warehouses_farm_id').using(
      'btree',
      table.farmId.asc().nullsLast(),
    ),
    foreignKey({
      columns: [table.farmId],
      foreignColumns: [farms.id],
      name: 'warehouses_farm_id_fkey',
    }),
    unique('uq_warehouse_code_per_farm').on(table.code, table.farmId),
  ],
);

export const locations = pgTable(
  'locations',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    farmId: uuid('farm_id').notNull(),
    warehouseId: uuid('warehouse_id'),
    code: varchar({ length: 50 }).notNull(),
    name: varchar({ length: 255 }).notNull(),
    type: locationType().notNull(),
    description: text(),
    status: recordStatus().default('ACTIVE').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('idx_locations_farm_id').using(
      'btree',
      table.farmId.asc().nullsLast(),
    ),
    index('idx_locations_warehouse_id').using(
      'btree',
      table.warehouseId.asc().nullsLast(),
    ),
    foreignKey({
      columns: [table.farmId],
      foreignColumns: [farms.id],
      name: 'locations_farm_id_fkey',
    }),
    foreignKey({
      columns: [table.warehouseId],
      foreignColumns: [warehouses.id],
      name: 'locations_warehouse_id_fkey',
    }),
    unique('uq_location_code_per_farm').on(table.code, table.farmId),
  ],
);

export const items = pgTable(
  'items',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    farmId: uuid('farm_id').notNull(),
    categoryId: uuid('category_id').notNull(),
    unitId: uuid('unit_id').notNull(),
    code: varchar({ length: 50 }).notNull(),
    name: varchar({ length: 255 }).notNull(),
    description: text(),
    itemType: itemType('item_type').notNull(),
    trackingMode: trackingMode('tracking_mode').notNull(),
    minStockLevel: numeric('min_stock_level', { precision: 18, scale: 3 })
      .default('0')
      .notNull(),
    maintenanceIntervalDays: integer('maintenance_interval_days'),
    barcode: varchar({ length: 255 }),
    imageUrl: text('image_url'),
    sourceUrl: text('source_url'),
    surveyedAt: timestamp('surveyed_at', {
      withTimezone: true,
      mode: 'string',
    }),
    status: recordStatus().default('ACTIVE').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('idx_items_category_id').using(
      'btree',
      table.categoryId.asc().nullsLast(),
    ),
    index('idx_items_farm_id').using('btree', table.farmId.asc().nullsLast()),
    index('idx_items_name_lower').using('btree', sql`lower((name)::text)`),
    uniqueIndex('ux_item_barcode_per_farm')
      .using(
        'btree',
        table.farmId.asc().nullsLast(),
        table.barcode.asc().nullsLast(),
      )
      .where(sql`(barcode IS NOT NULL)`),
    foreignKey({
      columns: [table.categoryId],
      foreignColumns: [categories.id],
      name: 'items_category_id_fkey',
    }),
    foreignKey({
      columns: [table.farmId],
      foreignColumns: [farms.id],
      name: 'items_farm_id_fkey',
    }),
    foreignKey({
      columns: [table.unitId],
      foreignColumns: [units.id],
      name: 'items_unit_id_fkey',
    }),
    unique('uq_item_code_per_farm').on(table.code, table.farmId),
    check(
      'ck_item_maintenance_interval_positive',
      sql`(maintenance_interval_days IS NULL) OR (maintenance_interval_days > 0)`,
    ),
    check(
      'ck_item_min_stock_nonnegative',
      sql`min_stock_level >= (0)::numeric`,
    ),
    check(
      'ck_item_type_tracking_mode',
      sql`((item_type = 'MATERIAL'::item_type) AND (tracking_mode IN ('QUANTITY'::tracking_mode, 'LOT'::tracking_mode))) OR ((item_type IN ('EQUIPMENT'::item_type, 'TOOL'::item_type)) AND (tracking_mode IN ('QUANTITY'::tracking_mode, 'ASSET'::tracking_mode)))`,
    ),
  ],
);

export const categories = pgTable(
  'categories',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    code: varchar({ length: 50 }).notNull(),
    name: varchar({ length: 255 }).notNull(),
    description: text(),
    status: recordStatus().default('ACTIVE').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [unique('categories_code_key').on(table.code)],
);

export const units = pgTable(
  'units',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    code: varchar({ length: 30 }).notNull(),
    name: varchar({ length: 100 }).notNull(),
    symbol: varchar({ length: 30 }),
    status: recordStatus().default('ACTIVE').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [unique('units_code_key').on(table.code)],
);

export const materialProfiles = pgTable(
  'material_profiles',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    farmId: uuid('farm_id').notNull(),
    itemId: uuid('item_id').notNull(),
    kind: materialKind().default('CONSUMABLE').notNull(),
    requiresExpiryTracking: boolean('requires_expiry_tracking')
      .default(false)
      .notNull(),
    expiryWarningDays: integer('expiry_warning_days').default(30).notNull(),
    defaultShelfLifeDays: integer('default_shelf_life_days'),
    storageInstructions: text('storage_instructions'),
    safetyNotes: text('safety_notes'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('idx_material_profiles_farm_kind').using(
      'btree',
      table.farmId.asc().nullsLast(),
      table.kind.asc().nullsLast(),
    ),
    foreignKey({
      columns: [table.farmId],
      foreignColumns: [farms.id],
      name: 'material_profiles_farm_id_fkey',
    }),
    foreignKey({
      columns: [table.itemId],
      foreignColumns: [items.id],
      name: 'material_profiles_item_id_fkey',
    }).onDelete('cascade'),
    unique('uq_material_profile_item').on(table.itemId),
    check('ck_material_expiry_warning_positive', sql`expiry_warning_days > 0`),
    check(
      'ck_material_shelf_life_positive',
      sql`(default_shelf_life_days IS NULL) OR (default_shelf_life_days > 0)`,
    ),
  ],
);

export const stockReceipts = pgTable(
  'stock_receipts',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    farmId: uuid('farm_id').notNull(),
    warehouseId: uuid('warehouse_id').notNull(),
    supplierId: uuid('supplier_id'),
    receiptCode: varchar('receipt_code', { length: 50 }).notNull(),
    receiptDate: date('receipt_date')
      .default(sql`CURRENT_DATE`)
      .notNull(),
    status: documentStatus().default('DRAFT').notNull(),
    note: text(),
    createdByMemberId: uuid('created_by_member_id').notNull(),
    confirmedByMemberId: uuid('confirmed_by_member_id'),
    confirmedAt: timestamp('confirmed_at', {
      withTimezone: true,
      mode: 'string',
    }),
    cancelledAt: timestamp('cancelled_at', {
      withTimezone: true,
      mode: 'string',
    }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('idx_stock_receipts_farm_date').using(
      'btree',
      table.farmId.asc().nullsLast(),
      table.receiptDate.desc().nullsFirst(),
    ),
    index('idx_stock_receipts_status').using(
      'btree',
      table.farmId.asc().nullsLast(),
      table.status.asc().nullsLast(),
    ),
    foreignKey({
      columns: [table.confirmedByMemberId],
      foreignColumns: [farmMembers.id],
      name: 'stock_receipts_confirmed_by_member_id_fkey',
    }),
    foreignKey({
      columns: [table.createdByMemberId],
      foreignColumns: [farmMembers.id],
      name: 'stock_receipts_created_by_member_id_fkey',
    }),
    foreignKey({
      columns: [table.farmId],
      foreignColumns: [farms.id],
      name: 'stock_receipts_farm_id_fkey',
    }),
    foreignKey({
      columns: [table.supplierId],
      foreignColumns: [suppliers.id],
      name: 'stock_receipts_supplier_id_fkey',
    }),
    foreignKey({
      columns: [table.warehouseId],
      foreignColumns: [warehouses.id],
      name: 'stock_receipts_warehouse_id_fkey',
    }),
    unique('uq_receipt_code_per_farm').on(table.farmId, table.receiptCode),
    check(
      'ck_receipt_confirm_fields',
      sql`(status <> 'CONFIRMED'::document_status) OR ((confirmed_by_member_id IS NOT NULL) AND (confirmed_at IS NOT NULL))`,
    ),
  ],
);

export const stockReceiptItems = pgTable(
  'stock_receipt_items',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    stockReceiptId: uuid('stock_receipt_id').notNull(),
    itemId: uuid('item_id').notNull(),
    quantity: numeric({ precision: 18, scale: 3 }).notNull(),
    unitPrice: numeric('unit_price', { precision: 18, scale: 2 })
      .default('0')
      .notNull(),
    note: text(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.itemId],
      foreignColumns: [items.id],
      name: 'stock_receipt_items_item_id_fkey',
    }),
    foreignKey({
      columns: [table.stockReceiptId],
      foreignColumns: [stockReceipts.id],
      name: 'stock_receipt_items_stock_receipt_id_fkey',
    }).onDelete('cascade'),
    check('ck_receipt_item_price_nonnegative', sql`unit_price >= (0)::numeric`),
    check('ck_receipt_item_quantity_positive', sql`quantity > (0)::numeric`),
  ],
);

export const inventoryLots = pgTable(
  'inventory_lots',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    farmId: uuid('farm_id').notNull(),
    itemId: uuid('item_id').notNull(),
    sourceReceiptItemId: uuid('source_receipt_item_id'),
    lotNumber: varchar('lot_number', { length: 100 }).notNull(),
    manufacturedDate: date('manufactured_date'),
    expiryDate: date('expiry_date'),
    initialQuantity: numeric('initial_quantity', {
      precision: 18,
      scale: 3,
    }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('idx_inventory_lots_expiry_date')
      .using('btree', table.expiryDate.asc().nullsLast())
      .where(sql`(expiry_date IS NOT NULL)`),
    index('idx_inventory_lots_item_id').using(
      'btree',
      table.itemId.asc().nullsLast(),
    ),
    foreignKey({
      columns: [table.farmId],
      foreignColumns: [farms.id],
      name: 'inventory_lots_farm_id_fkey',
    }),
    foreignKey({
      columns: [table.itemId],
      foreignColumns: [items.id],
      name: 'inventory_lots_item_id_fkey',
    }),
    foreignKey({
      columns: [table.sourceReceiptItemId],
      foreignColumns: [stockReceiptItems.id],
      name: 'inventory_lots_source_receipt_item_id_fkey',
    }),
    unique('uq_lot_per_item_farm').on(
      table.farmId,
      table.itemId,
      table.lotNumber,
    ),
    check(
      'ck_lot_expiry_after_manufacture',
      sql`(manufactured_date IS NULL) OR (expiry_date IS NULL) OR (expiry_date >= manufactured_date)`,
    ),
    check(
      'ck_lot_initial_quantity_positive',
      sql`initial_quantity > (0)::numeric`,
    ),
  ],
);

export const assets = pgTable(
  'assets',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    farmId: uuid('farm_id').notNull(),
    itemId: uuid('item_id').notNull(),
    sourceReceiptItemId: uuid('source_receipt_item_id'),
    currentLocationId: uuid('current_location_id'),
    assetCode: varchar('asset_code', { length: 100 }).notNull(),
    serialNumber: varchar('serial_number', { length: 255 }),
    qrToken: uuid('qr_token').defaultRandom().notNull(),
    status: assetStatus().default('AVAILABLE').notNull(),
    purchaseDate: date('purchase_date'),
    purchasePrice: numeric('purchase_price', { precision: 18, scale: 2 }),
    warrantyExpiryDate: date('warranty_expiry_date'),
    lastMaintenanceDate: date('last_maintenance_date'),
    nextMaintenanceDate: date('next_maintenance_date'),
    note: text(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('idx_assets_farm_item').using(
      'btree',
      table.farmId.asc().nullsLast(),
      table.itemId.asc().nullsLast(),
    ),
    index('idx_assets_next_maintenance')
      .using('btree', table.nextMaintenanceDate.asc().nullsLast())
      .where(sql`(next_maintenance_date IS NOT NULL)`),
    index('idx_assets_status').using(
      'btree',
      table.farmId.asc().nullsLast(),
      table.status.asc().nullsLast(),
    ),
    uniqueIndex('ux_asset_serial_per_farm')
      .using(
        'btree',
        table.farmId.asc().nullsLast(),
        table.serialNumber.asc().nullsLast(),
      )
      .where(sql`(serial_number IS NOT NULL)`),
    foreignKey({
      columns: [table.currentLocationId],
      foreignColumns: [locations.id],
      name: 'assets_current_location_id_fkey',
    }),
    foreignKey({
      columns: [table.farmId],
      foreignColumns: [farms.id],
      name: 'assets_farm_id_fkey',
    }),
    foreignKey({
      columns: [table.itemId],
      foreignColumns: [items.id],
      name: 'assets_item_id_fkey',
    }),
    foreignKey({
      columns: [table.sourceReceiptItemId],
      foreignColumns: [stockReceiptItems.id],
      name: 'assets_source_receipt_item_id_fkey',
    }),
    unique('uq_asset_code_per_farm').on(table.assetCode, table.farmId),
    unique('uq_asset_qr_token').on(table.qrToken),
    check(
      'ck_asset_next_maintenance_date',
      sql`(last_maintenance_date IS NULL) OR (next_maintenance_date IS NULL) OR (next_maintenance_date >= last_maintenance_date)`,
    ),
    check(
      'ck_asset_purchase_price_nonnegative',
      sql`(purchase_price IS NULL) OR (purchase_price >= (0)::numeric)`,
    ),
  ],
);

export const inventoryBalances = pgTable(
  'inventory_balances',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    farmId: uuid('farm_id').notNull(),
    warehouseId: uuid('warehouse_id').notNull(),
    itemId: uuid('item_id').notNull(),
    lotId: uuid('lot_id'),
    quantityOnHand: numeric('quantity_on_hand', { precision: 18, scale: 3 })
      .default('0')
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('idx_inventory_balances_lookup').using(
      'btree',
      table.farmId.asc().nullsLast(),
      table.warehouseId.asc().nullsLast(),
      table.itemId.asc().nullsLast(),
    ),
    foreignKey({
      columns: [table.farmId],
      foreignColumns: [farms.id],
      name: 'inventory_balances_farm_id_fkey',
    }),
    foreignKey({
      columns: [table.itemId],
      foreignColumns: [items.id],
      name: 'inventory_balances_item_id_fkey',
    }),
    foreignKey({
      columns: [table.lotId],
      foreignColumns: [inventoryLots.id],
      name: 'inventory_balances_lot_id_fkey',
    }),
    foreignKey({
      columns: [table.warehouseId],
      foreignColumns: [warehouses.id],
      name: 'inventory_balances_warehouse_id_fkey',
    }),
    unique('uq_inventory_balance').on(
      table.itemId,
      table.lotId,
      table.warehouseId,
    ),
    check(
      'ck_inventory_balance_nonnegative',
      sql`quantity_on_hand >= (0)::numeric`,
    ),
  ],
);

export const stockIssues = pgTable(
  'stock_issues',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    farmId: uuid('farm_id').notNull(),
    warehouseId: uuid('warehouse_id').notNull(),
    issueCode: varchar('issue_code', { length: 50 }).notNull(),
    issueDate: date('issue_date')
      .default(sql`CURRENT_DATE`)
      .notNull(),
    issueType: issueType('issue_type').default('CONSUMPTION').notNull(),
    status: documentStatus().default('DRAFT').notNull(),
    reason: text(),
    note: text(),
    createdByMemberId: uuid('created_by_member_id').notNull(),
    confirmedByMemberId: uuid('confirmed_by_member_id'),
    confirmedAt: timestamp('confirmed_at', {
      withTimezone: true,
      mode: 'string',
    }),
    cancelledAt: timestamp('cancelled_at', {
      withTimezone: true,
      mode: 'string',
    }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('idx_stock_issues_farm_date').using(
      'btree',
      table.farmId.asc().nullsLast(),
      table.issueDate.desc().nullsFirst(),
    ),
    index('idx_stock_issues_status').using(
      'btree',
      table.farmId.asc().nullsLast(),
      table.status.asc().nullsLast(),
    ),
    foreignKey({
      columns: [table.confirmedByMemberId],
      foreignColumns: [farmMembers.id],
      name: 'stock_issues_confirmed_by_member_id_fkey',
    }),
    foreignKey({
      columns: [table.createdByMemberId],
      foreignColumns: [farmMembers.id],
      name: 'stock_issues_created_by_member_id_fkey',
    }),
    foreignKey({
      columns: [table.farmId],
      foreignColumns: [farms.id],
      name: 'stock_issues_farm_id_fkey',
    }),
    foreignKey({
      columns: [table.warehouseId],
      foreignColumns: [warehouses.id],
      name: 'stock_issues_warehouse_id_fkey',
    }),
    unique('uq_issue_code_per_farm').on(table.farmId, table.issueCode),
    check(
      'ck_issue_confirm_fields',
      sql`(status <> 'CONFIRMED'::document_status) OR ((confirmed_by_member_id IS NOT NULL) AND (confirmed_at IS NOT NULL))`,
    ),
  ],
);

export const stockIssueItems = pgTable(
  'stock_issue_items',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    stockIssueId: uuid('stock_issue_id').notNull(),
    itemId: uuid('item_id').notNull(),
    lotId: uuid('lot_id'),
    assetId: uuid('asset_id'),
    quantity: numeric({ precision: 18, scale: 3 }).notNull(),
    note: text(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.assetId],
      foreignColumns: [assets.id],
      name: 'stock_issue_items_asset_id_fkey',
    }),
    foreignKey({
      columns: [table.itemId],
      foreignColumns: [items.id],
      name: 'stock_issue_items_item_id_fkey',
    }),
    foreignKey({
      columns: [table.lotId],
      foreignColumns: [inventoryLots.id],
      name: 'stock_issue_items_lot_id_fkey',
    }),
    foreignKey({
      columns: [table.stockIssueId],
      foreignColumns: [stockIssues.id],
      name: 'stock_issue_items_stock_issue_id_fkey',
    }).onDelete('cascade'),
    check(
      'ck_issue_asset_quantity',
      sql`(asset_id IS NULL) OR (quantity = (1)::numeric)`,
    ),
    check('ck_issue_item_quantity_positive', sql`quantity > (0)::numeric`),
  ],
);

export const stockTransfers = pgTable(
  'stock_transfers',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    farmId: uuid('farm_id').notNull(),
    fromWarehouseId: uuid('from_warehouse_id').notNull(),
    toWarehouseId: uuid('to_warehouse_id').notNull(),
    transferCode: varchar('transfer_code', { length: 50 }).notNull(),
    transferDate: date('transfer_date')
      .default(sql`CURRENT_DATE`)
      .notNull(),
    status: documentStatus().default('DRAFT').notNull(),
    note: text(),
    createdByMemberId: uuid('created_by_member_id').notNull(),
    confirmedByMemberId: uuid('confirmed_by_member_id'),
    confirmedAt: timestamp('confirmed_at', {
      withTimezone: true,
      mode: 'string',
    }),
    cancelledAt: timestamp('cancelled_at', {
      withTimezone: true,
      mode: 'string',
    }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('idx_stock_transfers_farm_date').using(
      'btree',
      table.farmId.asc().nullsLast(),
      table.transferDate.desc().nullsFirst(),
    ),
    foreignKey({
      columns: [table.confirmedByMemberId],
      foreignColumns: [farmMembers.id],
      name: 'stock_transfers_confirmed_by_member_id_fkey',
    }),
    foreignKey({
      columns: [table.createdByMemberId],
      foreignColumns: [farmMembers.id],
      name: 'stock_transfers_created_by_member_id_fkey',
    }),
    foreignKey({
      columns: [table.farmId],
      foreignColumns: [farms.id],
      name: 'stock_transfers_farm_id_fkey',
    }),
    foreignKey({
      columns: [table.fromWarehouseId],
      foreignColumns: [warehouses.id],
      name: 'stock_transfers_from_warehouse_id_fkey',
    }),
    foreignKey({
      columns: [table.toWarehouseId],
      foreignColumns: [warehouses.id],
      name: 'stock_transfers_to_warehouse_id_fkey',
    }),
    unique('uq_transfer_code_per_farm').on(table.farmId, table.transferCode),
    check(
      'ck_transfer_confirm_fields',
      sql`(status <> 'CONFIRMED'::document_status) OR ((confirmed_by_member_id IS NOT NULL) AND (confirmed_at IS NOT NULL))`,
    ),
    check(
      'ck_transfer_different_warehouses',
      sql`from_warehouse_id <> to_warehouse_id`,
    ),
  ],
);

export const stockTransferItems = pgTable(
  'stock_transfer_items',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    stockTransferId: uuid('stock_transfer_id').notNull(),
    itemId: uuid('item_id').notNull(),
    lotId: uuid('lot_id'),
    assetId: uuid('asset_id'),
    quantity: numeric({ precision: 18, scale: 3 }).notNull(),
    note: text(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.assetId],
      foreignColumns: [assets.id],
      name: 'stock_transfer_items_asset_id_fkey',
    }),
    foreignKey({
      columns: [table.itemId],
      foreignColumns: [items.id],
      name: 'stock_transfer_items_item_id_fkey',
    }),
    foreignKey({
      columns: [table.lotId],
      foreignColumns: [inventoryLots.id],
      name: 'stock_transfer_items_lot_id_fkey',
    }),
    foreignKey({
      columns: [table.stockTransferId],
      foreignColumns: [stockTransfers.id],
      name: 'stock_transfer_items_stock_transfer_id_fkey',
    }).onDelete('cascade'),
    check(
      'ck_transfer_asset_quantity',
      sql`(asset_id IS NULL) OR (quantity = (1)::numeric)`,
    ),
    check('ck_transfer_item_quantity_positive', sql`quantity > (0)::numeric`),
  ],
);

export const stockCounts = pgTable(
  'stock_counts',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    farmId: uuid('farm_id').notNull(),
    warehouseId: uuid('warehouse_id').notNull(),
    countCode: varchar('count_code', { length: 50 }).notNull(),
    countDate: date('count_date')
      .default(sql`CURRENT_DATE`)
      .notNull(),
    status: stockCountStatus().default('DRAFT').notNull(),
    createdByMemberId: uuid('created_by_member_id').notNull(),
    confirmedByMemberId: uuid('confirmed_by_member_id'),
    confirmedAt: timestamp('confirmed_at', {
      withTimezone: true,
      mode: 'string',
    }),
    note: text(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('idx_stock_counts_farm_date').using(
      'btree',
      table.farmId.asc().nullsLast(),
      table.countDate.desc().nullsFirst(),
    ),
    foreignKey({
      columns: [table.confirmedByMemberId],
      foreignColumns: [farmMembers.id],
      name: 'stock_counts_confirmed_by_member_id_fkey',
    }),
    foreignKey({
      columns: [table.createdByMemberId],
      foreignColumns: [farmMembers.id],
      name: 'stock_counts_created_by_member_id_fkey',
    }),
    foreignKey({
      columns: [table.farmId],
      foreignColumns: [farms.id],
      name: 'stock_counts_farm_id_fkey',
    }),
    foreignKey({
      columns: [table.warehouseId],
      foreignColumns: [warehouses.id],
      name: 'stock_counts_warehouse_id_fkey',
    }),
    unique('uq_count_code_per_farm').on(table.countCode, table.farmId),
    check(
      'ck_count_confirm_fields',
      sql`(status <> 'CONFIRMED'::stock_count_status) OR ((confirmed_by_member_id IS NOT NULL) AND (confirmed_at IS NOT NULL))`,
    ),
  ],
);

export const stockCountItems = pgTable(
  'stock_count_items',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    stockCountId: uuid('stock_count_id').notNull(),
    itemId: uuid('item_id').notNull(),
    lotId: uuid('lot_id'),
    assetId: uuid('asset_id'),
    systemQuantity: numeric('system_quantity', { precision: 18, scale: 3 })
      .default('0')
      .notNull(),
    actualQuantity: numeric('actual_quantity', { precision: 18, scale: 3 })
      .default('0')
      .notNull(),
    difference: numeric({ precision: 18, scale: 3 }).generatedAlwaysAs(
      sql`(actual_quantity - system_quantity)`,
    ),
    note: text(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.assetId],
      foreignColumns: [assets.id],
      name: 'stock_count_items_asset_id_fkey',
    }),
    foreignKey({
      columns: [table.itemId],
      foreignColumns: [items.id],
      name: 'stock_count_items_item_id_fkey',
    }),
    foreignKey({
      columns: [table.lotId],
      foreignColumns: [inventoryLots.id],
      name: 'stock_count_items_lot_id_fkey',
    }),
    foreignKey({
      columns: [table.stockCountId],
      foreignColumns: [stockCounts.id],
      name: 'stock_count_items_stock_count_id_fkey',
    }).onDelete('cascade'),
    check(
      'ck_count_actual_quantity_nonnegative',
      sql`actual_quantity >= (0)::numeric`,
    ),
    check(
      'ck_count_system_quantity_nonnegative',
      sql`system_quantity >= (0)::numeric`,
    ),
  ],
);

export const assetAssignments = pgTable(
  'asset_assignments',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    farmId: uuid('farm_id').notNull(),
    assetId: uuid('asset_id').notNull(),
    assignedToMemberId: uuid('assigned_to_member_id').notNull(),
    assignedByMemberId: uuid('assigned_by_member_id').notNull(),
    assignedAt: timestamp('assigned_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    expectedReturnAt: timestamp('expected_return_at', {
      withTimezone: true,
      mode: 'string',
    }),
    returnedAt: timestamp('returned_at', {
      withTimezone: true,
      mode: 'string',
    }),
    status: assignmentStatus().default('ACTIVE').notNull(),
    note: text(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('idx_asset_assignments_asset').using(
      'btree',
      table.assetId.asc().nullsLast(),
      table.assignedAt.desc().nullsFirst(),
    ),
    uniqueIndex('ux_one_active_assignment_per_asset')
      .using('btree', table.assetId.asc().nullsLast())
      .where(sql`(status = 'ACTIVE'::assignment_status)`),
    foreignKey({
      columns: [table.assetId],
      foreignColumns: [assets.id],
      name: 'asset_assignments_asset_id_fkey',
    }),
    foreignKey({
      columns: [table.assignedByMemberId],
      foreignColumns: [farmMembers.id],
      name: 'asset_assignments_assigned_by_member_id_fkey',
    }),
    foreignKey({
      columns: [table.assignedToMemberId],
      foreignColumns: [farmMembers.id],
      name: 'asset_assignments_assigned_to_member_id_fkey',
    }),
    foreignKey({
      columns: [table.farmId],
      foreignColumns: [farms.id],
      name: 'asset_assignments_farm_id_fkey',
    }),
    check(
      'ck_assignment_return_time',
      sql`(returned_at IS NULL) OR (returned_at >= assigned_at)`,
    ),
    check(
      'ck_assignment_status_fields',
      sql`((status = 'ACTIVE'::assignment_status) AND (returned_at IS NULL)) OR ((status = 'RETURNED'::assignment_status) AND (returned_at IS NOT NULL)) OR ((status = 'CANCELLED'::assignment_status) AND (returned_at IS NULL))`,
    ),
  ],
);

export const assetIncidents = pgTable(
  'asset_incidents',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    farmId: uuid('farm_id').notNull(),
    assetId: uuid('asset_id').notNull(),
    reportedByMemberId: uuid('reported_by_member_id').notNull(),
    incidentType: varchar('incident_type', { length: 100 }),
    description: text().notNull(),
    severity: incidentSeverity().default('MEDIUM').notNull(),
    status: incidentStatus().default('OPEN').notNull(),
    reportedAt: timestamp('reported_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    resolvedAt: timestamp('resolved_at', {
      withTimezone: true,
      mode: 'string',
    }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('idx_asset_incidents_asset').using(
      'btree',
      table.assetId.asc().nullsLast(),
      table.reportedAt.desc().nullsFirst(),
    ),
    index('idx_asset_incidents_status').using(
      'btree',
      table.farmId.asc().nullsLast(),
      table.status.asc().nullsLast(),
    ),
    foreignKey({
      columns: [table.assetId],
      foreignColumns: [assets.id],
      name: 'asset_incidents_asset_id_fkey',
    }),
    foreignKey({
      columns: [table.farmId],
      foreignColumns: [farms.id],
      name: 'asset_incidents_farm_id_fkey',
    }),
    foreignKey({
      columns: [table.reportedByMemberId],
      foreignColumns: [farmMembers.id],
      name: 'asset_incidents_reported_by_member_id_fkey',
    }),
    check(
      'ck_incident_resolved_time',
      sql`(resolved_at IS NULL) OR (resolved_at >= reported_at)`,
    ),
    check(
      'ck_incident_status_fields',
      sql`((status = 'RESOLVED'::incident_status) AND (resolved_at IS NOT NULL)) OR ((status <> 'RESOLVED'::incident_status) AND (resolved_at IS NULL))`,
    ),
  ],
);

export const maintenanceRecords = pgTable(
  'maintenance_records',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    farmId: uuid('farm_id').notNull(),
    assetId: uuid('asset_id').notNull(),
    incidentId: uuid('incident_id'),
    maintenanceType: maintenanceType('maintenance_type').notNull(),
    scheduledAt: timestamp('scheduled_at', {
      withTimezone: true,
      mode: 'string',
    }),
    startedAt: timestamp('started_at', { withTimezone: true, mode: 'string' }),
    completedAt: timestamp('completed_at', {
      withTimezone: true,
      mode: 'string',
    }),
    status: maintenanceStatus().default('SCHEDULED').notNull(),
    description: text(),
    resultNote: text('result_note'),
    performedByMemberId: uuid('performed_by_member_id'),
    supplierId: uuid('supplier_id'),
    laborCost: numeric('labor_cost', { precision: 18, scale: 2 })
      .default('0')
      .notNull(),
    materialCost: numeric('material_cost', { precision: 18, scale: 2 })
      .default('0')
      .notNull(),
    otherCost: numeric('other_cost', { precision: 18, scale: 2 })
      .default('0')
      .notNull(),
    totalCost: numeric('total_cost', {
      precision: 18,
      scale: 2,
    }).generatedAlwaysAs(sql`((labor_cost + material_cost) + other_cost)`),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('idx_maintenance_asset').using(
      'btree',
      table.assetId.asc().nullsLast(),
      table.scheduledAt.desc().nullsFirst(),
    ),
    index('idx_maintenance_status_schedule').using(
      'btree',
      table.farmId.asc().nullsLast(),
      table.status.asc().nullsLast(),
      table.scheduledAt.asc().nullsLast(),
    ),
    uniqueIndex('ux_one_active_maintenance_per_asset')
      .using('btree', table.assetId.asc().nullsLast())
      .where(
        sql`(status IN ('SCHEDULED'::maintenance_status, 'IN_PROGRESS'::maintenance_status))`,
      ),
    foreignKey({
      columns: [table.assetId],
      foreignColumns: [assets.id],
      name: 'maintenance_records_asset_id_fkey',
    }),
    foreignKey({
      columns: [table.farmId],
      foreignColumns: [farms.id],
      name: 'maintenance_records_farm_id_fkey',
    }),
    foreignKey({
      columns: [table.incidentId],
      foreignColumns: [assetIncidents.id],
      name: 'maintenance_records_incident_id_fkey',
    }),
    foreignKey({
      columns: [table.performedByMemberId],
      foreignColumns: [farmMembers.id],
      name: 'maintenance_records_performed_by_member_id_fkey',
    }),
    foreignKey({
      columns: [table.supplierId],
      foreignColumns: [suppliers.id],
      name: 'maintenance_records_supplier_id_fkey',
    }),
    check(
      'ck_maintenance_costs_nonnegative',
      sql`(labor_cost >= (0)::numeric) AND (material_cost >= (0)::numeric) AND (other_cost >= (0)::numeric)`,
    ),
    check(
      'ck_maintenance_time_order',
      sql`((started_at IS NULL) OR (scheduled_at IS NULL) OR (started_at >= scheduled_at)) AND ((completed_at IS NULL) OR (started_at IS NULL) OR (completed_at >= started_at))`,
    ),
    check(
      'ck_maintenance_status_fields',
      sql`((status = 'SCHEDULED'::maintenance_status) AND (started_at IS NULL) AND (completed_at IS NULL)) OR ((status = 'IN_PROGRESS'::maintenance_status) AND (started_at IS NOT NULL) AND (completed_at IS NULL)) OR ((status = 'COMPLETED'::maintenance_status) AND (started_at IS NOT NULL) AND (completed_at IS NOT NULL)) OR ((status = 'CANCELLED'::maintenance_status) AND (completed_at IS NULL))`,
    ),
  ],
);

export const inventoryTransactions = pgTable(
  'inventory_transactions',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    farmId: uuid('farm_id').notNull(),
    warehouseId: uuid('warehouse_id').notNull(),
    itemId: uuid('item_id').notNull(),
    lotId: uuid('lot_id'),
    assetId: uuid('asset_id'),
    transactionType: inventoryTransactionType('transaction_type').notNull(),
    quantityChange: numeric('quantity_change', {
      precision: 18,
      scale: 3,
    }).notNull(),
    sourceType: varchar('source_type', { length: 50 }).notNull(),
    sourceId: uuid('source_id').notNull(),
    movementGroupId: uuid('movement_group_id'),
    performedByMemberId: uuid('performed_by_member_id'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('idx_inventory_transactions_lookup').using(
      'btree',
      table.farmId.asc().nullsLast(),
      table.warehouseId.asc().nullsLast(),
      table.itemId.asc().nullsLast(),
      table.createdAt.desc().nullsFirst(),
    ),
    index('idx_inventory_transactions_movement_group')
      .using('btree', table.movementGroupId.asc().nullsLast())
      .where(sql`(movement_group_id IS NOT NULL)`),
    index('idx_inventory_transactions_source').using(
      'btree',
      table.sourceType.asc().nullsLast(),
      table.sourceId.asc().nullsLast(),
    ),
    foreignKey({
      columns: [table.assetId],
      foreignColumns: [assets.id],
      name: 'inventory_transactions_asset_id_fkey',
    }),
    foreignKey({
      columns: [table.farmId],
      foreignColumns: [farms.id],
      name: 'inventory_transactions_farm_id_fkey',
    }),
    foreignKey({
      columns: [table.itemId],
      foreignColumns: [items.id],
      name: 'inventory_transactions_item_id_fkey',
    }),
    foreignKey({
      columns: [table.lotId],
      foreignColumns: [inventoryLots.id],
      name: 'inventory_transactions_lot_id_fkey',
    }),
    foreignKey({
      columns: [table.performedByMemberId],
      foreignColumns: [farmMembers.id],
      name: 'inventory_transactions_performed_by_member_id_fkey',
    }),
    foreignKey({
      columns: [table.warehouseId],
      foreignColumns: [warehouses.id],
      name: 'inventory_transactions_warehouse_id_fkey',
    }),
    check(
      'ck_inventory_transaction_nonzero',
      sql`quantity_change <> (0)::numeric`,
    ),
  ],
);

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    farmId: uuid('farm_id'),
    userId: uuid('user_id'),
    action: varchar({ length: 100 }).notNull(),
    entityType: varchar('entity_type', { length: 100 }).notNull(),
    entityId: uuid('entity_id'),
    oldData: jsonb('old_data'),
    newData: jsonb('new_data'),
    ipAddress: inet('ip_address'),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('idx_audit_logs_entity').using(
      'btree',
      table.entityType.asc().nullsLast(),
      table.entityId.asc().nullsLast(),
      table.createdAt.desc().nullsFirst(),
    ),
    index('idx_audit_logs_farm').using(
      'btree',
      table.farmId.asc().nullsLast(),
      table.createdAt.desc().nullsFirst(),
    ),
    foreignKey({
      columns: [table.farmId],
      foreignColumns: [farms.id],
      name: 'audit_logs_farm_id_fkey',
    }),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: 'audit_logs_user_id_fkey',
    }),
  ],
);

export const farmMemberRoles = pgTable(
  'farm_member_roles',
  {
    farmMemberId: uuid('farm_member_id').notNull(),
    roleId: uuid('role_id').notNull(),
    assignedAt: timestamp('assigned_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('idx_farm_member_roles_role_id').using(
      'btree',
      table.roleId.asc().nullsLast(),
    ),
    foreignKey({
      columns: [table.farmMemberId],
      foreignColumns: [farmMembers.id],
      name: 'farm_member_roles_farm_member_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.roleId],
      foreignColumns: [roles.id],
      name: 'farm_member_roles_role_id_fkey',
    }),
    primaryKey({
      columns: [table.farmMemberId, table.roleId],
      name: 'farm_member_roles_pkey',
    }),
  ],
);

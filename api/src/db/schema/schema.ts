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
import type { AnyPgColumn } from 'drizzle-orm/pg-core';

export const assetStatus = pgEnum('asset_status', [
  'AVAILABLE',
  'ASSIGNED',
  'IN_USE',
  'MAINTENANCE',
  'LOST',
  'RETIRED',
  'TRANSFER_PENDING',
]);
export const assignmentStatus = pgEnum('assignment_status', [
  'ACTIVE',
  'RETURNED',
  'CANCELLED',
]);
export const documentStatus = pgEnum('document_status', [
  'DRAFT',
  'PENDING_APPROVAL',
  'CONFIRMED',
  'REJECTED',
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
  'MAINTENANCE_ISSUE',
]);
export const adjustmentReason = pgEnum('adjustment_reason', [
  'STOCK_COUNT',
  'SHRINKAGE',
  'DAMAGE',
  'EXPIRED',
  'DATA_ENTRY_ERROR',
  'OTHER',
]);
export const issueType = pgEnum('issue_type', [
  'SALE',
  'CONSUMPTION',
  'DAMAGE',
  'DISPOSAL',
  'OTHER',
  'MAINTENANCE',
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
  'PENDING_APPROVAL',
  'CONFIRMED',
  'REJECTED',
  'CANCELLED',
]);
export const trackingMode = pgEnum('tracking_mode', [
  'QUANTITY',
  'LOT',
  'ASSET',
]);
// Code prefixes of the stock documents: receipt, issue, count, transfer.
export const stockDocumentPrefix = pgEnum('stock_document_prefix', [
  'PN',
  'PX',
  'KK',
  'CK',
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
    mustChangePassword: boolean('must_change_password')
      .default(false)
      .notNull(),
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
    employeeCode: varchar('employee_code', { length: 50 }),
    jobTitle: varchar('job_title', { length: 100 }),
    phone: varchar({ length: 50 }),
    note: text(),
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
    uniqueIndex('ux_farm_member_employee_code')
      .on(table.farmId, sql`lower(${table.employeeCode})`)
      .where(sql`${table.employeeCode} IS NOT NULL`),
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

export const farmMemberWarehouses = pgTable(
  'farm_member_warehouses',
  {
    farmMemberId: uuid('farm_member_id')
      .notNull()
      .references(() => farmMembers.id, { onDelete: 'cascade' }),
    warehouseId: uuid('warehouse_id')
      .notNull()
      .references(() => warehouses.id),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.farmMemberId, table.warehouseId] }),
    index('idx_member_warehouses_warehouse').on(table.warehouseId),
  ],
);

export type PersonnelProvisionPayload = {
  fullName: string;
  email: string;
  roleCodes: string[];
  warehouseIds: string[];
  employeeCode: string | null;
  jobTitle: string | null;
  phone: string | null;
  note: string | null;
};

export const personnelAccountProvisions = pgTable(
  'personnel_account_provisions',
  {
    id: uuid().primaryKey(),
    farmId: uuid('farm_id')
      .notNull()
      .references(() => farms.id),
    actorUserId: uuid('actor_user_id')
      .notNull()
      .references(() => users.id),
    email: varchar({ length: 255 }).notNull(),
    payloadHash: varchar('payload_hash', { length: 64 }).notNull(),
    payload: jsonb().$type<PersonnelProvisionPayload>().notNull(),
    clerkUserId: varchar('clerk_user_id', { length: 255 }),
    memberId: uuid('member_id').references(() => farmMembers.id),
    status: varchar({ length: 30 })
      .$type<
        | 'PENDING'
        | 'IDENTITY_CREATED'
        | 'MEMBERSHIP_CREATED'
        | 'COMPLETED'
        | 'FAILED'
      >()
      .default('PENDING')
      .notNull(),
    errorCode: varchar('error_code', { length: 100 }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
);

// Shared PostgreSQL buckets keep credential throttling consistent across API instances.
export const credentialActionLimits = pgTable(
  'credential_action_limits',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    action: varchar({ length: 50 }).notNull(),
    windowStartedAt: timestamp('window_started_at', {
      withTimezone: true,
      mode: 'string',
    })
      .defaultNow()
      .notNull(),
    attempts: integer().default(1).notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.action] })],
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
    // Null on drafts: the permanent code is assigned at confirmation.
    receiptCode: varchar('receipt_code', { length: 50 }),
    receiptDate: date('receipt_date')
      .default(sql`CURRENT_DATE`)
      .notNull(),
    status: documentStatus().default('DRAFT').notNull(),
    note: text(),
    createdByMemberId: uuid('created_by_member_id').notNull(),
    confirmedByMemberId: uuid('confirmed_by_member_id'),
    rejectionReason: text('rejection_reason'),
    rejectedByMemberId: uuid('rejected_by_member_id'),
    rejectedAt: timestamp('rejected_at', {
      withTimezone: true,
      mode: 'string',
    }),
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
      columns: [table.rejectedByMemberId],
      foreignColumns: [farmMembers.id],
      name: 'stock_receipts_rejected_by_member_id_fkey',
    }),
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
    // Case/whitespace-insensitive so mixed-case legacy codes stay occupied.
    uniqueIndex('uq_receipt_code_per_farm').using(
      'btree',
      table.farmId,
      sql`upper(btrim(${table.receiptCode}))`,
    ),
    // An uncoded draft stores NULL, never an empty string.
    check('ck_receipt_code_not_blank', sql`btrim(receipt_code) <> ''`),
    check(
      'ck_receipt_confirmed_code',
      sql`(status <> 'CONFIRMED'::document_status) OR (receipt_code IS NOT NULL)`,
    ),
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
    lotId: uuid('lot_id').references((): AnyPgColumn => inventoryLots.id, {
      onDelete: 'set null',
    }),
    lotNumber: varchar('lot_number', { length: 100 }),
    manufacturedDate: date('manufactured_date'),
    expiryDate: date('expiry_date'),
    locationId: uuid('location_id').references(() => locations.id, {
      onDelete: 'set null',
    }),
    assetId: uuid('asset_id').references((): AnyPgColumn => assets.id, {
      onDelete: 'set null',
    }),
    assetCode: varchar('asset_code', { length: 100 }),
    serialNumber: varchar('serial_number', { length: 255 }),
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
    check(
      'ck_receipt_item_asset_quantity',
      sql`(asset_id IS NULL) OR (quantity = (1)::numeric)`,
    ),
    check(
      'ck_receipt_item_lot_dates',
      sql`(manufactured_date IS NULL) OR (expiry_date IS NULL) OR (expiry_date >= manufactured_date)`,
    ),
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
    unique('uq_inventory_balance')
      .on(table.itemId, table.lotId, table.warehouseId)
      .nullsNotDistinct(),
    check(
      'ck_inventory_balance_nonnegative',
      sql`quantity_on_hand >= (0)::numeric`,
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

export const stockIssues = pgTable(
  'stock_issues',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    farmId: uuid('farm_id').notNull(),
    warehouseId: uuid('warehouse_id').notNull(),
    // Null on drafts: the permanent code is assigned at confirmation.
    issueCode: varchar('issue_code', { length: 50 }),
    issueDate: date('issue_date')
      .default(sql`CURRENT_DATE`)
      .notNull(),
    issueType: issueType('issue_type').default('CONSUMPTION').notNull(),
    maintenanceRecordId: uuid('maintenance_record_id'),
    status: documentStatus().default('DRAFT').notNull(),
    reason: text(),
    note: text(),
    createdByMemberId: uuid('created_by_member_id').notNull(),
    confirmedByMemberId: uuid('confirmed_by_member_id'),
    rejectionReason: text('rejection_reason'),
    rejectedByMemberId: uuid('rejected_by_member_id'),
    rejectedAt: timestamp('rejected_at', {
      withTimezone: true,
      mode: 'string',
    }),
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
    index('idx_stock_issues_maintenance_record')
      .using('btree', table.maintenanceRecordId.asc().nullsLast())
      .where(sql`maintenance_record_id IS NOT NULL`),
    foreignKey({
      columns: [table.rejectedByMemberId],
      foreignColumns: [farmMembers.id],
      name: 'stock_issues_rejected_by_member_id_fkey',
    }),
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
    foreignKey({
      columns: [table.maintenanceRecordId],
      foreignColumns: [maintenanceRecords.id],
      name: 'fk_stock_issues_maintenance_record',
    }),
    // Case/whitespace-insensitive so mixed-case legacy codes stay occupied.
    uniqueIndex('uq_issue_code_per_farm').using(
      'btree',
      table.farmId,
      sql`upper(btrim(${table.issueCode}))`,
    ),
    // An uncoded draft stores NULL, never an empty string.
    check('ck_issue_code_not_blank', sql`btrim(issue_code) <> ''`),
    check(
      'ck_issue_confirmed_code',
      sql`(status <> 'CONFIRMED'::document_status) OR (issue_code IS NOT NULL)`,
    ),
    check(
      'ck_issue_maintenance_reference',
      sql`((issue_type = 'MAINTENANCE'::issue_type) AND (maintenance_record_id IS NOT NULL)) OR ((issue_type <> 'MAINTENANCE'::issue_type) AND (maintenance_record_id IS NULL))`,
    ),
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
    // Null on drafts: the permanent code is assigned at confirmation.
    transferCode: varchar('transfer_code', { length: 50 }),
    transferDate: date('transfer_date')
      .default(sql`CURRENT_DATE`)
      .notNull(),
    status: documentStatus().default('DRAFT').notNull(),
    note: text(),
    createdByMemberId: uuid('created_by_member_id').notNull(),
    confirmedByMemberId: uuid('confirmed_by_member_id'),
    rejectionReason: text('rejection_reason'),
    rejectedByMemberId: uuid('rejected_by_member_id'),
    rejectedAt: timestamp('rejected_at', {
      withTimezone: true,
      mode: 'string',
    }),
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
      columns: [table.rejectedByMemberId],
      foreignColumns: [farmMembers.id],
      name: 'stock_transfers_rejected_by_member_id_fkey',
    }),
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
    // Case/whitespace-insensitive so mixed-case legacy codes stay occupied.
    uniqueIndex('uq_transfer_code_per_farm').using(
      'btree',
      table.farmId,
      sql`upper(btrim(${table.transferCode}))`,
    ),
    // An uncoded draft stores NULL, never an empty string.
    check('ck_transfer_code_not_blank', sql`btrim(transfer_code) <> ''`),
    check(
      'ck_transfer_confirmed_code',
      sql`(status <> 'CONFIRMED'::document_status) OR (transfer_code IS NOT NULL)`,
    ),
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
    // Null on drafts: the permanent code is assigned at confirmation.
    countCode: varchar('count_code', { length: 50 }),
    countDate: date('count_date')
      .default(sql`CURRENT_DATE`)
      .notNull(),
    status: stockCountStatus().default('DRAFT').notNull(),
    createdByMemberId: uuid('created_by_member_id').notNull(),
    confirmedByMemberId: uuid('confirmed_by_member_id'),
    rejectionReason: text('rejection_reason'),
    rejectedByMemberId: uuid('rejected_by_member_id'),
    rejectedAt: timestamp('rejected_at', {
      withTimezone: true,
      mode: 'string',
    }),
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
      columns: [table.rejectedByMemberId],
      foreignColumns: [farmMembers.id],
      name: 'stock_counts_rejected_by_member_id_fkey',
    }),
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
    // Case/whitespace-insensitive so mixed-case legacy codes stay occupied.
    uniqueIndex('uq_count_code_per_farm').using(
      'btree',
      table.farmId,
      sql`upper(btrim(${table.countCode}))`,
    ),
    // An uncoded draft stores NULL, never an empty string.
    check('ck_count_code_not_blank', sql`btrim(count_code) <> ''`),
    check(
      'ck_count_confirmed_code',
      sql`(status <> 'CONFIRMED'::stock_count_status) OR (count_code IS NOT NULL)`,
    ),
    check(
      'ck_count_confirm_fields',
      sql`(status <> 'CONFIRMED'::stock_count_status) OR ((confirmed_by_member_id IS NOT NULL) AND (confirmed_at IS NOT NULL))`,
    ),
  ],
);

// Last automatic number used per farm, document prefix and confirmation year.
export const stockDocumentCounters = pgTable(
  'stock_document_counters',
  {
    farmId: uuid('farm_id').notNull(),
    prefix: stockDocumentPrefix().notNull(),
    year: integer().notNull(),
    lastValue: integer('last_value').default(0).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.farmId, table.prefix, table.year],
      name: 'stock_document_counters_pkey',
    }),
    foreignKey({
      columns: [table.farmId],
      foreignColumns: [farms.id],
      name: 'stock_document_counters_farm_id_fkey',
    }),
    check('ck_stock_document_counter_nonnegative', sql`last_value >= 0`),
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

export const inventoryAdjustments = pgTable(
  'inventory_adjustments',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    farmId: uuid('farm_id').notNull(),
    warehouseId: uuid('warehouse_id').notNull(),
    itemId: uuid('item_id').notNull(),
    lotId: uuid('lot_id'),
    quantityChange: numeric('quantity_change', {
      precision: 18,
      scale: 3,
    }).notNull(),
    reasonCode: adjustmentReason('reason_code').notNull(),
    note: text(),
    status: documentStatus().notNull(),
    idempotencyKey: uuid('idempotency_key').notNull(),
    requestedByMemberId: uuid('requested_by_member_id').notNull(),
    reviewedByMemberId: uuid('reviewed_by_member_id'),
    reviewedAt: timestamp('reviewed_at', {
      withTimezone: true,
      mode: 'string',
    }),
    rejectionReason: text('rejection_reason'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex('ux_inventory_adjustment_idempotency').using(
      'btree',
      table.farmId.asc().nullsLast(),
      table.idempotencyKey.asc().nullsLast(),
    ),
    index('idx_inventory_adjustments_farm_status').using(
      'btree',
      table.farmId.asc().nullsLast(),
      table.status.asc().nullsLast(),
      table.createdAt.desc().nullsFirst(),
    ),
    foreignKey({
      columns: [table.farmId],
      foreignColumns: [farms.id],
      name: 'inventory_adjustments_farm_id_fkey',
    }),
    foreignKey({
      columns: [table.warehouseId],
      foreignColumns: [warehouses.id],
      name: 'inventory_adjustments_warehouse_id_fkey',
    }),
    foreignKey({
      columns: [table.itemId],
      foreignColumns: [items.id],
      name: 'inventory_adjustments_item_id_fkey',
    }),
    foreignKey({
      columns: [table.lotId],
      foreignColumns: [inventoryLots.id],
      name: 'inventory_adjustments_lot_id_fkey',
    }),
    foreignKey({
      columns: [table.requestedByMemberId],
      foreignColumns: [farmMembers.id],
      name: 'inventory_adjustments_requested_by_member_id_fkey',
    }),
    foreignKey({
      columns: [table.reviewedByMemberId],
      foreignColumns: [farmMembers.id],
      name: 'inventory_adjustments_reviewed_by_member_id_fkey',
    }),
    check(
      'ck_inventory_adjustment_nonzero',
      sql`quantity_change <> (0)::numeric`,
    ),
    check(
      'ck_inventory_adjustment_other_note',
      sql`reason_code <> 'OTHER'::adjustment_reason OR coalesce(length(btrim(note)), 0) > 0`,
    ),
    check(
      'ck_inventory_adjustment_status',
      sql`status IN ('PENDING_APPROVAL'::document_status, 'CONFIRMED'::document_status, 'REJECTED'::document_status)`,
    ),
    check(
      'ck_inventory_adjustment_review',
      sql`(status = 'PENDING_APPROVAL'::document_status) = (reviewed_at IS NULL)`,
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
    reason: text(),
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

export const notifications = pgTable(
  'notifications',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    userId: uuid('user_id').notNull(),
    farmId: uuid('farm_id'),
    type: varchar({ length: 80 }).notNull(),
    title: varchar({ length: 200 }).notNull(),
    body: text().notNull(),
    data: jsonb(),
    entityType: varchar('entity_type', { length: 100 }),
    entityId: uuid('entity_id'),
    readAt: timestamp('read_at', { withTimezone: true, mode: 'string' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: 'notifications_user_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.farmId],
      foreignColumns: [farms.id],
      name: 'notifications_farm_id_fkey',
    }).onDelete('cascade'),
    index('idx_notifications_user_created_at').using(
      'btree',
      table.userId.asc().nullsLast(),
      table.createdAt.desc().nullsFirst(),
    ),
    index('idx_notifications_user_unread_created_at')
      .using(
        'btree',
        table.userId.asc().nullsLast(),
        table.createdAt.desc().nullsFirst(),
      )
      .where(sql`read_at IS NULL`),
    index('idx_notifications_farm_created_at').using(
      'btree',
      table.farmId.asc().nullsLast(),
      table.createdAt.desc().nullsFirst(),
    ),
  ],
);

export const devicePushTokens = pgTable(
  'device_push_tokens',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    userId: uuid('user_id').notNull(),
    installationId: uuid('installation_id').notNull(),
    expoPushToken: text('expo_push_token').notNull(),
    platform: varchar({ length: 10, enum: ['ANDROID', 'IOS'] }).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    lastSeenAt: timestamp('last_seen_at', {
      withTimezone: true,
      mode: 'string',
    })
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
    unique('uq_device_push_tokens_installation_id').on(table.installationId),
    unique('uq_device_push_tokens_expo_push_token').on(table.expoPushToken),
    check(
      'ck_device_push_tokens_platform',
      sql`${table.platform} IN ('ANDROID', 'IOS')`,
    ),
    check(
      'ck_device_push_tokens_token_nonempty',
      sql`length(btrim(${table.expoPushToken})) > 0`,
    ),
    index('idx_device_push_tokens_user_active')
      .on(table.userId)
      .where(sql`${table.isActive} = true`),
    // Covers account cleanup, including inactive registrations.
    index('idx_device_push_tokens_user_id').on(table.userId),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: 'device_push_tokens_user_id_fkey',
    }).onDelete('cascade'),
  ],
);

export const notificationPushOutbox = pgTable(
  'notification_push_outbox',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    notificationId: uuid('notification_id').notNull(),
    devicePushTokenId: uuid('device_push_token_id').notNull(),
    status: varchar({
      length: 24,
      enum: [
        'PENDING',
        'PROCESSING',
        'AWAITING_RECEIPT',
        'SUCCEEDED',
        'FAILED',
        'CANCELLED',
      ],
    })
      .default('PENDING')
      .notNull(),
    attemptCount: integer('attempt_count').default(0).notNull(),
    nextAttemptAt: timestamp('next_attempt_at', {
      withTimezone: true,
      mode: 'string',
    })
      .defaultNow()
      .notNull(),
    lockedAt: timestamp('locked_at', { withTimezone: true, mode: 'string' }),
    lockId: uuid('lock_id'),
    expoTicketId: varchar('expo_ticket_id', { length: 255 }),
    lastError: text('last_error'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique('uq_notification_push_outbox_notification_device').on(
      table.notificationId,
      table.devicePushTokenId,
    ),
    check(
      'ck_notification_push_outbox_status',
      sql`${table.status} IN ('PENDING', 'PROCESSING', 'AWAITING_RECEIPT', 'SUCCEEDED', 'FAILED', 'CANCELLED')`,
    ),
    check(
      'ck_notification_push_outbox_attempt_count',
      sql`${table.attemptCount} >= 0`,
    ),
    check(
      'ck_notification_push_outbox_lock_pair',
      sql`(${table.lockedAt} IS NULL AND ${table.lockId} IS NULL) OR (${table.lockedAt} IS NOT NULL AND ${table.lockId} IS NOT NULL)`,
    ),
    check(
      'ck_notification_push_outbox_processing_lock',
      sql`${table.status} <> 'PROCESSING' OR ${table.lockId} IS NOT NULL`,
    ),
    check(
      'ck_notification_push_outbox_receipt_ticket',
      sql`${table.status} NOT IN ('AWAITING_RECEIPT', 'SUCCEEDED') OR (${table.expoTicketId} IS NOT NULL AND length(btrim(${table.expoTicketId})) > 0)`,
    ),
    index('idx_notification_push_outbox_pending')
      .on(table.status, table.nextAttemptAt)
      .where(sql`${table.status} IN ('PENDING', 'AWAITING_RECEIPT')`),
    index('idx_notification_push_outbox_processing_lock')
      .on(table.lockedAt)
      .where(sql`${table.status} = 'PROCESSING'`),
    index('idx_notification_push_outbox_device_push_token_id').on(
      table.devicePushTokenId,
    ),
    foreignKey({
      columns: [table.notificationId],
      foreignColumns: [notifications.id],
      name: 'notification_push_outbox_notification_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.devicePushTokenId],
      foreignColumns: [devicePushTokens.id],
      name: 'notification_push_outbox_device_push_token_id_fkey',
    }).onDelete('cascade'),
  ],
);

export const maintenanceRequests = pgTable(
  'maintenance_requests',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    farmId: uuid('farm_id').notNull(),
    assetId: uuid('asset_id').notNull(),
    requestedByMemberId: uuid('requested_by_member_id').notNull(),
    maintenanceType: maintenanceType('maintenance_type').notNull(),
    description: text().notNull(),
    status: documentStatus().default('PENDING_APPROVAL').notNull(),
    rejectionReason: text('rejection_reason'),
    reviewedByMemberId: uuid('reviewed_by_member_id'),
    reviewedAt: timestamp('reviewed_at', {
      withTimezone: true,
      mode: 'string',
    }),
    maintenanceRecordId: uuid('maintenance_record_id'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('idx_maintenance_requests_farm_status_created').using(
      'btree',
      table.farmId.asc().nullsLast(),
      table.status.asc().nullsLast(),
      table.createdAt.desc().nullsFirst(),
    ),
    index('idx_maintenance_requests_asset_created').using(
      'btree',
      table.assetId.asc().nullsLast(),
      table.createdAt.desc().nullsFirst(),
    ),
    uniqueIndex('ux_pending_maintenance_request_per_asset')
      .using(
        'btree',
        table.farmId.asc().nullsLast(),
        table.assetId.asc().nullsLast(),
      )
      .where(sql`status = 'PENDING_APPROVAL'::document_status`),
    foreignKey({
      columns: [table.farmId],
      foreignColumns: [farms.id],
      name: 'maintenance_requests_farm_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.assetId],
      foreignColumns: [assets.id],
      name: 'maintenance_requests_asset_id_fkey',
    }),
    foreignKey({
      columns: [table.requestedByMemberId],
      foreignColumns: [farmMembers.id],
      name: 'maintenance_requests_requested_by_member_id_fkey',
    }),
    foreignKey({
      columns: [table.reviewedByMemberId],
      foreignColumns: [farmMembers.id],
      name: 'maintenance_requests_reviewed_by_member_id_fkey',
    }),
    foreignKey({
      columns: [table.maintenanceRecordId],
      foreignColumns: [maintenanceRecords.id],
      name: 'maintenance_requests_maintenance_record_id_fkey',
    }),
    check(
      'ck_maintenance_request_review_fields',
      sql`((status IN ('CONFIRMED'::document_status, 'REJECTED'::document_status)) AND reviewed_by_member_id IS NOT NULL AND reviewed_at IS NOT NULL) OR (status NOT IN ('CONFIRMED'::document_status, 'REJECTED'::document_status) AND reviewed_by_member_id IS NULL AND reviewed_at IS NULL)`,
    ),
    check(
      'ck_maintenance_request_approval_record',
      sql`(status <> 'CONFIRMED'::document_status) OR maintenance_record_id IS NOT NULL`,
    ),
    check(
      'ck_maintenance_request_rejection_reason',
      sql`(status <> 'REJECTED'::document_status) OR length(btrim(coalesce(rejection_reason, ''))) > 0`,
    ),
  ],
);

// An employee asks to move an AVAILABLE asset; the asset stays TRANSFER_PENDING
// until an approver runs the transfer (CONFIRMED) or rejects it.
export const assetTransferRequests = pgTable(
  'asset_transfer_requests',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    farmId: uuid('farm_id').notNull(),
    assetId: uuid('asset_id').notNull(),
    requestedByMemberId: uuid('requested_by_member_id').notNull(),
    fromLocationId: uuid('from_location_id').notNull(),
    toWarehouseId: uuid('to_warehouse_id').notNull(),
    toLocationId: uuid('to_location_id').notNull(),
    note: text(),
    status: documentStatus().default('PENDING_APPROVAL').notNull(),
    rejectionReason: text('rejection_reason'),
    reviewedByMemberId: uuid('reviewed_by_member_id'),
    reviewedAt: timestamp('reviewed_at', {
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
    index('idx_asset_transfer_requests_farm_status_created').using(
      'btree',
      table.farmId.asc().nullsLast(),
      table.status.asc().nullsLast(),
      table.createdAt.desc().nullsFirst(),
    ),
    index('idx_asset_transfer_requests_asset_created').using(
      'btree',
      table.assetId.asc().nullsLast(),
      table.createdAt.desc().nullsFirst(),
    ),
    uniqueIndex('ux_pending_asset_transfer_request_per_asset')
      .using(
        'btree',
        table.farmId.asc().nullsLast(),
        table.assetId.asc().nullsLast(),
      )
      .where(sql`status = 'PENDING_APPROVAL'::document_status`),
    foreignKey({
      columns: [table.farmId],
      foreignColumns: [farms.id],
      name: 'asset_transfer_requests_farm_id_fkey',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.assetId],
      foreignColumns: [assets.id],
      name: 'asset_transfer_requests_asset_id_fkey',
    }),
    foreignKey({
      columns: [table.requestedByMemberId],
      foreignColumns: [farmMembers.id],
      name: 'asset_transfer_requests_requested_by_member_id_fkey',
    }),
    foreignKey({
      columns: [table.reviewedByMemberId],
      foreignColumns: [farmMembers.id],
      name: 'asset_transfer_requests_reviewed_by_member_id_fkey',
    }),
    foreignKey({
      columns: [table.fromLocationId],
      foreignColumns: [locations.id],
      name: 'asset_transfer_requests_from_location_id_fkey',
    }),
    foreignKey({
      columns: [table.toWarehouseId],
      foreignColumns: [warehouses.id],
      name: 'asset_transfer_requests_to_warehouse_id_fkey',
    }),
    foreignKey({
      columns: [table.toLocationId],
      foreignColumns: [locations.id],
      name: 'asset_transfer_requests_to_location_id_fkey',
    }),
    check(
      'ck_asset_transfer_request_review_fields',
      sql`((status IN ('CONFIRMED'::document_status, 'REJECTED'::document_status)) AND reviewed_by_member_id IS NOT NULL AND reviewed_at IS NOT NULL) OR (status NOT IN ('CONFIRMED'::document_status, 'REJECTED'::document_status) AND reviewed_by_member_id IS NULL AND reviewed_at IS NULL)`,
    ),
    check(
      'ck_asset_transfer_request_rejection_reason',
      sql`(status <> 'REJECTED'::document_status) OR length(btrim(coalesce(rejection_reason, ''))) > 0`,
    ),
  ],
);

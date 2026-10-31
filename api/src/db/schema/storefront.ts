import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import {
  farms,
  farmMembers,
  items,
  stockIssues,
  users,
  warehouses,
} from './schema';

export const storeProductStatus = pgEnum('store_product_status', [
  'DRAFT',
  'PUBLISHED',
  'ARCHIVED',
]);

export const storeSettings = pgTable(
  'store_settings',
  {
    id: integer().primaryKey().default(1),
    warehouseId: uuid('warehouse_id')
      .notNull()
      .references(() => warehouses.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [check('ck_store_settings_singleton', sql`${table.id} = 1`)],
);

export const storeOrderStatus = pgEnum('store_order_status', [
  'PENDING',
  'CONFIRMED',
  'SHIPPING',
  'COMPLETED',
  'CANCELLED',
]);
export const storePaymentMethod = pgEnum('store_payment_method', [
  'COD',
  'BANK_TRANSFER',
]);
export const storePaymentStatus = pgEnum('store_payment_status', [
  'UNPAID',
  'PAID',
]);

export const storeOrders = pgTable(
  'store_orders',
  {
    id: uuid().defaultRandom().primaryKey(),
    orderNumber: integer('order_number').generatedAlwaysAsIdentity().notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    farmId: uuid('farm_id')
      .notNull()
      .references(() => farms.id, { onDelete: 'restrict' }),
    warehouseId: uuid('warehouse_id')
      .notNull()
      .references(() => warehouses.id, { onDelete: 'restrict' }),
    recipientName: varchar('recipient_name', { length: 255 }).notNull(),
    phone: varchar({ length: 30 }).notNull(),
    address: text().notNull(),
    note: text(),
    paymentMethod: storePaymentMethod('payment_method').notNull(),
    paymentStatus: storePaymentStatus('payment_status')
      .default('UNPAID')
      .notNull(),
    status: storeOrderStatus().default('PENDING').notNull(),
    subtotal: numeric({ precision: 18, scale: 0 }).notNull(),
    shippingFee: numeric('shipping_fee', { precision: 18, scale: 0 })
      .default('0')
      .notNull(),
    total: numeric({ precision: 18, scale: 0 }).notNull(),
    stockIssueId: uuid('stock_issue_id').references(() => stockIssues.id, {
      onDelete: 'restrict',
    }),
    cancelReason: text('cancel_reason'),
    idempotencyKey: uuid('idempotency_key').notNull(),
    requestFingerprint: text('request_fingerprint').notNull(),
    confirmedAt: timestamp('confirmed_at', {
      withTimezone: true,
      mode: 'string',
    }),
    shippedAt: timestamp('shipped_at', { withTimezone: true, mode: 'string' }),
    completedAt: timestamp('completed_at', {
      withTimezone: true,
      mode: 'string',
    }),
    cancelledAt: timestamp('cancelled_at', {
      withTimezone: true,
      mode: 'string',
    }),
    paidAt: timestamp('paid_at', { withTimezone: true, mode: 'string' }),
    paidByMemberId: uuid('paid_by_member_id').references(() => farmMembers.id, {
      onDelete: 'restrict',
    }),
    // Set when a verified bank transaction paid the order instead of a staff member.
    paymentTransactionId: uuid('payment_transaction_id').references(
      (): AnyPgColumn => paymentTransactions.id,
      { onDelete: 'restrict' },
    ),
    handledByMemberId: uuid('handled_by_member_id').references(
      () => farmMembers.id,
      { onDelete: 'restrict' },
    ),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique('uq_store_orders_number').on(table.orderNumber),
    unique('uq_store_orders_idempotency').on(
      table.userId,
      table.idempotencyKey,
    ),
    unique('uq_store_orders_stock_issue').on(table.stockIssueId),
    unique('uq_store_orders_payment_transaction').on(
      table.paymentTransactionId,
    ),
    index('idx_store_orders_status_created').on(
      table.farmId,
      table.status,
      table.createdAt.desc(),
      table.id,
    ),
    index('idx_store_orders_user_created').on(
      table.userId,
      table.createdAt.desc(),
      table.id,
    ),
    index('idx_store_orders_completed').on(table.farmId, table.completedAt),
    check(
      'ck_store_orders_money',
      sql`${table.subtotal} >= 0 AND ${table.shippingFee} >= 0 AND ${table.total} = ${table.subtotal} + ${table.shippingFee} AND ${table.total} <= 9007199254740991`,
    ),
    check(
      'ck_store_orders_recipient',
      sql`length(trim(${table.recipientName})) > 0 AND length(trim(${table.phone})) > 0 AND length(trim(${table.address})) > 0`,
    ),
    check(
      'ck_store_orders_payment',
      sql`(${table.paymentStatus} = 'UNPAID' AND ${table.paidAt} IS NULL AND ${table.paidByMemberId} IS NULL AND ${table.paymentTransactionId} IS NULL) OR (${table.paymentStatus} = 'PAID' AND ${table.paidAt} IS NOT NULL AND (${table.paidByMemberId} IS NOT NULL OR ${table.paymentTransactionId} IS NOT NULL))`,
    ),
    check(
      'ck_store_orders_status_fields',
      sql`
    (${table.status} <> 'PENDING' OR ${table.stockIssueId} IS NULL)
    AND (${table.status} NOT IN ('CONFIRMED', 'SHIPPING', 'COMPLETED') OR (${table.stockIssueId} IS NOT NULL AND ${table.confirmedAt} IS NOT NULL))
    AND (${table.status} NOT IN ('SHIPPING', 'COMPLETED') OR ${table.shippedAt} IS NOT NULL)
    AND (${table.status} <> 'COMPLETED' OR (${table.completedAt} IS NOT NULL AND ${table.paymentStatus} = 'PAID'))
    AND (${table.status} <> 'CANCELLED' OR (${table.cancelledAt} IS NOT NULL AND ${table.cancelReason} IS NOT NULL AND length(trim(${table.cancelReason})) > 0 AND ${table.paymentStatus} = 'UNPAID'))
  `,
    ),
  ],
).enableRLS();

export const storeCategories = pgTable(
  'store_categories',
  {
    id: uuid().defaultRandom().primaryKey(),
    name: varchar({ length: 255 }).notNull(),
    slug: varchar({ length: 100 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique('uq_store_categories_slug').on(table.slug),
    check('ck_store_categories_name', sql`length(trim(${table.name})) > 0`),
    check(
      'ck_store_categories_slug',
      sql`${table.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`,
    ),
  ],
);

export const storeProducts = pgTable(
  'store_products',
  {
    id: uuid().defaultRandom().primaryKey(),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => storeCategories.id, { onDelete: 'restrict' }),
    name: varchar({ length: 255 }).notNull(),
    slug: varchar({ length: 255 }).notNull(),
    description: text().default('').notNull(),
    status: storeProductStatus().default('DRAFT').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique('uq_store_products_slug').on(table.slug),
    check('ck_store_products_name', sql`length(trim(${table.name})) > 0`),
    check(
      'ck_store_products_slug',
      sql`${table.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`,
    ),
    index('idx_store_products_status_name').on(
      table.status,
      table.name,
      table.id,
    ),
    index('idx_store_products_category_status_name').on(
      table.categoryId,
      table.status,
      table.name,
      table.id,
    ),
  ],
);

export const storeProductImages = pgTable(
  'store_product_images',
  {
    id: uuid().defaultRandom().primaryKey(),
    productId: uuid('product_id')
      .notNull()
      .references(() => storeProducts.id, { onDelete: 'restrict' }),
    url: text().notNull(),
    // Cloudinary public ID; null for images not hosted on Cloudinary (seed).
    publicId: text('public_id'),
    alt: text().default('').notNull(),
    position: integer().default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique('uq_store_product_images_position').on(
      table.productId,
      table.position,
    ),
    check('ck_store_product_images_position', sql`${table.position} >= 0`),
    check('ck_store_product_images_url', sql`length(trim(${table.url})) > 0`),
  ],
);

export const storeProductVariants = pgTable(
  'store_product_variants',
  {
    id: uuid().defaultRandom().primaryKey(),
    productId: uuid('product_id')
      .notNull()
      .references(() => storeProducts.id, { onDelete: 'restrict' }),
    itemId: uuid('item_id')
      .notNull()
      .references(() => items.id, { onDelete: 'restrict' }),
    name: varchar({ length: 255 }).notNull(),
    price: numeric({ precision: 18, scale: 0 }).notNull(),
    quantityStep: numeric('quantity_step', { precision: 18, scale: 3 })
      .default('1')
      .notNull(),
    active: boolean().default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique('uq_store_product_variants_item').on(table.itemId),
    index('idx_store_product_variants_product').on(table.productId),
    check(
      'ck_store_product_variants_name',
      sql`length(trim(${table.name})) > 0`,
    ),
    check(
      'ck_store_product_variants_price',
      sql`${table.price} >= 0 AND ${table.price} <> 'NaN'::numeric`,
    ),
    check(
      'ck_store_product_variants_quantity_step',
      sql`${table.quantityStep} > 0 AND ${table.quantityStep} <> 'NaN'::numeric`,
    ),
  ],
);

export const storeOrderItems = pgTable(
  'store_order_items',
  {
    id: uuid().defaultRandom().primaryKey(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => storeOrders.id, { onDelete: 'restrict' }),
    variantId: uuid('variant_id')
      .notNull()
      .references(() => storeProductVariants.id, { onDelete: 'restrict' }),
    productId: uuid('product_id')
      .notNull()
      .references(() => storeProducts.id, { onDelete: 'restrict' }),
    itemId: uuid('item_id')
      .notNull()
      .references(() => items.id, { onDelete: 'restrict' }),
    productName: varchar('product_name', { length: 255 }).notNull(),
    variantName: varchar('variant_name', { length: 255 }).notNull(),
    unitPrice: numeric('unit_price', { precision: 18, scale: 0 }).notNull(),
    quantity: integer().notNull(),
    stockQuantity: numeric('stock_quantity', {
      precision: 18,
      scale: 3,
    }).notNull(),
    lineTotal: numeric('line_total', { precision: 18, scale: 0 }).notNull(),
  },
  (table) => [
    unique('uq_store_order_items_variant').on(table.orderId, table.variantId),
    index('idx_store_order_items_product').on(table.productId),
    check(
      'ck_store_order_items_quantity',
      sql`${table.quantity} BETWEEN 1 AND 10000 AND ${table.stockQuantity} > 0 AND ${table.stockQuantity} < 'NaN'::numeric`,
    ),
    check(
      'ck_store_order_items_money',
      sql`${table.unitPrice} >= 0 AND ${table.lineTotal} = ${table.unitPrice} * ${table.quantity} AND ${table.lineTotal} <= 9007199254740991`,
    ),
  ],
).enableRLS();

export const paymentProvider = pgEnum('payment_provider', [
  'SEPAY',
  'SIMULATOR',
]);
export const paymentTransactionResult = pgEnum('payment_transaction_result', [
  'MATCHED',
  'AMOUNT_MISMATCH',
  'ORDER_NOT_FOUND',
  'ORDER_NOT_PAYABLE',
  'ALREADY_PAID',
  'WRONG_ACCOUNT',
]);

/** Every incoming bank transfer the store was told about, matched or not. */
export const paymentTransactions = pgTable(
  'payment_transactions',
  {
    id: uuid().defaultRandom().primaryKey(),
    farmId: uuid('farm_id')
      .notNull()
      .references(() => farms.id, { onDelete: 'restrict' }),
    provider: paymentProvider().notNull(),
    providerTxId: varchar('provider_tx_id', { length: 100 }).notNull(),
    accountNumber: varchar('account_number', { length: 50 }).notNull(),
    amount: numeric({ precision: 18, scale: 0 }).notNull(),
    content: text().notNull(),
    transactionAt: timestamp('transaction_at', {
      withTimezone: true,
      mode: 'string',
    }).notNull(),
    orderId: uuid('order_id').references(() => storeOrders.id, {
      onDelete: 'restrict',
    }),
    result: paymentTransactionResult().notNull(),
    rawPayload: jsonb('raw_payload').notNull(),
    createdByMemberId: uuid('created_by_member_id').references(
      () => farmMembers.id,
      { onDelete: 'restrict' },
    ),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique('uq_payment_transactions_provider_tx').on(
      table.provider,
      table.providerTxId,
    ),
    // One bank transfer can settle an order; later ones are ALREADY_PAID.
    uniqueIndex('ux_payment_transactions_matched_order')
      .on(table.orderId)
      .where(sql`result = 'MATCHED'`),
    index('idx_payment_transactions_farm_created').on(
      table.farmId,
      table.createdAt.desc(),
      table.id,
    ),
    index('idx_payment_transactions_order').on(table.orderId),
    check(
      'ck_payment_transactions_amount',
      sql`${table.amount} >= 0 AND ${table.amount} <= 9007199254740991`,
    ),
    check(
      'ck_payment_transactions_order',
      sql`${table.result} IN ('ORDER_NOT_FOUND', 'WRONG_ACCOUNT') OR ${table.orderId} IS NOT NULL`,
    ),
  ],
).enableRLS();

import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { items, warehouses } from './schema';

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

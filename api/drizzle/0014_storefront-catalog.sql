CREATE TYPE "public"."store_product_status" AS ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED');--> statement-breakpoint
CREATE TABLE "store_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_store_categories_slug" UNIQUE("slug"),
	CONSTRAINT "ck_store_categories_name" CHECK (length(trim("store_categories"."name")) > 0),
	CONSTRAINT "ck_store_categories_slug" CHECK ("store_categories"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);
--> statement-breakpoint
CREATE TABLE "store_product_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"url" text NOT NULL,
	"alt" text DEFAULT '' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_store_product_images_position" UNIQUE("product_id","position"),
	CONSTRAINT "ck_store_product_images_position" CHECK ("store_product_images"."position" >= 0),
	CONSTRAINT "ck_store_product_images_url" CHECK (length(trim("store_product_images"."url")) > 0)
);
--> statement-breakpoint
CREATE TABLE "store_product_variants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"price" numeric(18, 0) NOT NULL,
	"quantity_step" numeric(18, 3) DEFAULT '1' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_store_product_variants_item" UNIQUE("item_id"),
	CONSTRAINT "ck_store_product_variants_name" CHECK (length(trim("store_product_variants"."name")) > 0),
	CONSTRAINT "ck_store_product_variants_price" CHECK ("store_product_variants"."price" >= 0 AND "store_product_variants"."price" <> 'NaN'::numeric),
	CONSTRAINT "ck_store_product_variants_quantity_step" CHECK ("store_product_variants"."quantity_step" > 0 AND "store_product_variants"."quantity_step" <> 'NaN'::numeric)
);
--> statement-breakpoint
CREATE TABLE "store_products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"status" "store_product_status" DEFAULT 'DRAFT' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_store_products_slug" UNIQUE("slug"),
	CONSTRAINT "ck_store_products_name" CHECK (length(trim("store_products"."name")) > 0),
	CONSTRAINT "ck_store_products_slug" CHECK ("store_products"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);
--> statement-breakpoint
CREATE TABLE "store_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_store_settings_singleton" CHECK ("store_settings"."id" = 1)
);
--> statement-breakpoint
ALTER TABLE "store_product_images" ADD CONSTRAINT "store_product_images_product_id_store_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."store_products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_product_variants" ADD CONSTRAINT "store_product_variants_product_id_store_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."store_products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_product_variants" ADD CONSTRAINT "store_product_variants_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_products" ADD CONSTRAINT "store_products_category_id_store_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."store_categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_settings" ADD CONSTRAINT "store_settings_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_store_product_variants_product" ON "store_product_variants" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_store_products_status_name" ON "store_products" USING btree ("status","name","id");--> statement-breakpoint
CREATE INDEX "idx_store_products_category_status_name" ON "store_products" USING btree ("category_id","status","name","id");
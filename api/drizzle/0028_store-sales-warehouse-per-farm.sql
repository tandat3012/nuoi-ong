CREATE TYPE "public"."store_region" AS ENUM('NORTH', 'CENTRAL', 'SOUTH');--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "uq_items_id_farm" UNIQUE("id","farm_id");--> statement-breakpoint
ALTER TABLE "warehouses" ADD CONSTRAINT "uq_warehouses_id_farm" UNIQUE("id","farm_id");--> statement-breakpoint
CREATE TABLE "store_variant_items" (
	"variant_id" uuid NOT NULL,
	"farm_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "store_variant_items_variant_id_farm_id_pk" PRIMARY KEY("variant_id","farm_id"),
	CONSTRAINT "uq_store_variant_items_item" UNIQUE("item_id")
);
--> statement-breakpoint
ALTER TABLE "store_variant_items" ADD CONSTRAINT "store_variant_items_variant_id_store_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."store_product_variants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_variant_items" ADD CONSTRAINT "store_variant_items_farm_id_farms_id_fk" FOREIGN KEY ("farm_id") REFERENCES "public"."farms"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_variant_items" ADD CONSTRAINT "fk_store_variant_items_item_farm" FOREIGN KEY ("item_id","farm_id") REFERENCES "public"."items"("id","farm_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
-- Each existing variant keeps selling its item, now as that item's farm mapping.
INSERT INTO "store_variant_items" ("variant_id", "farm_id", "item_id")
SELECT v."id", i."farm_id", v."item_id"
FROM "store_product_variants" v
JOIN "items" i ON i."id" = v."item_id";--> statement-breakpoint
ALTER TABLE "store_product_variants" ADD COLUMN "unit_id" uuid;--> statement-breakpoint
UPDATE "store_product_variants" v SET "unit_id" = i."unit_id"
FROM "items" i WHERE i."id" = v."item_id";--> statement-breakpoint
ALTER TABLE "store_product_variants" ALTER COLUMN "unit_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "store_product_variants" ADD CONSTRAINT "store_product_variants_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
DROP TRIGGER "trg_validate_store_variant_quantity_step" ON "store_product_variants";--> statement-breakpoint
DROP TRIGGER "trg_protect_store_variant_tracking_mode" ON "items";--> statement-breakpoint
DROP FUNCTION validate_store_variant_quantity_step();--> statement-breakpoint
DROP FUNCTION protect_store_variant_tracking_mode();--> statement-breakpoint
ALTER TABLE "store_product_variants" DROP CONSTRAINT "uq_store_product_variants_item";--> statement-breakpoint
ALTER TABLE "store_product_variants" DROP CONSTRAINT "store_product_variants_item_id_items_id_fk";--> statement-breakpoint
ALTER TABLE "store_product_variants" DROP COLUMN "item_id";--> statement-breakpoint
-- ASSET items sell one serial at a time, whichever side of the mapping changes.
CREATE FUNCTION validate_store_variant_quantity_step()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.quantity_step <> 1 AND EXISTS (
        SELECT 1 FROM store_variant_items m
        JOIN items i ON i.id = m.item_id
        WHERE m.variant_id = NEW.id AND i.tracking_mode = 'ASSET'
        FOR SHARE OF i
    ) THEN
        RAISE EXCEPTION 'ASSET-tracked storefront variants must have quantity_step = 1'
            USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER trg_validate_store_variant_quantity_step
BEFORE UPDATE OF quantity_step ON store_product_variants
FOR EACH ROW EXECUTE FUNCTION validate_store_variant_quantity_step();
--> statement-breakpoint
CREATE FUNCTION validate_store_variant_item_step()
RETURNS TRIGGER AS $$
DECLARE
    item_tracking_mode tracking_mode;
BEGIN
    -- Lock the item so a concurrent tracking-mode change cannot bypass validation.
    SELECT tracking_mode INTO item_tracking_mode
    FROM items WHERE id = NEW.item_id FOR SHARE;

    IF item_tracking_mode = 'ASSET' AND EXISTS (
        SELECT 1 FROM store_product_variants
        WHERE id = NEW.variant_id AND quantity_step <> 1
    ) THEN
        RAISE EXCEPTION 'ASSET-tracked storefront variants must have quantity_step = 1'
            USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER trg_validate_store_variant_item_step
BEFORE INSERT OR UPDATE OF item_id, variant_id ON store_variant_items
FOR EACH ROW EXECUTE FUNCTION validate_store_variant_item_step();
--> statement-breakpoint
CREATE FUNCTION protect_store_variant_tracking_mode()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.tracking_mode = 'ASSET' AND EXISTS (
        SELECT 1 FROM store_variant_items m
        JOIN store_product_variants v ON v.id = m.variant_id
        WHERE m.item_id = NEW.id AND v.quantity_step <> 1
    ) THEN
        RAISE EXCEPTION 'ASSET-tracked storefront variants must have quantity_step = 1'
            USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER trg_protect_store_variant_tracking_mode
BEFORE UPDATE OF tracking_mode ON items
FOR EACH ROW EXECUTE FUNCTION protect_store_variant_tracking_mode();
--> statement-breakpoint
-- The old singleton row becomes the settings of the farm that owns its warehouse,
-- still selling to every region so the live store keeps working.
ALTER TABLE "store_settings" DROP CONSTRAINT "ck_store_settings_singleton";--> statement-breakpoint
ALTER TABLE "store_settings" DROP CONSTRAINT "store_settings_warehouse_id_warehouses_id_fk";--> statement-breakpoint
ALTER TABLE "store_settings" ADD COLUMN "farm_id" uuid;--> statement-breakpoint
ALTER TABLE "store_settings" ADD COLUMN "sales_warehouse_id" uuid;--> statement-breakpoint
ALTER TABLE "store_settings" ADD COLUMN "sales_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "store_settings" ADD COLUMN "regions" "store_region"[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
UPDATE "store_settings" s
SET "farm_id" = w."farm_id",
    "sales_warehouse_id" = w."id",
    "sales_enabled" = true,
    "regions" = '{NORTH,CENTRAL,SOUTH}'
FROM "warehouses" w WHERE w."id" = s."warehouse_id";--> statement-breakpoint
ALTER TABLE "store_settings" DROP COLUMN "id";--> statement-breakpoint
ALTER TABLE "store_settings" DROP COLUMN "warehouse_id";--> statement-breakpoint
ALTER TABLE "store_settings" ADD PRIMARY KEY ("farm_id");--> statement-breakpoint
ALTER TABLE "store_settings" ADD CONSTRAINT "store_settings_farm_id_farms_id_fk" FOREIGN KEY ("farm_id") REFERENCES "public"."farms"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_settings" ADD CONSTRAINT "fk_store_settings_sales_warehouse_farm" FOREIGN KEY ("sales_warehouse_id","farm_id") REFERENCES "public"."warehouses"("id","farm_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_settings" ADD CONSTRAINT "uq_store_settings_sales_warehouse" UNIQUE("sales_warehouse_id");--> statement-breakpoint
ALTER TABLE "store_settings" ADD CONSTRAINT "ck_store_settings_enabled" CHECK (NOT "store_settings"."sales_enabled" OR ("store_settings"."sales_warehouse_id" IS NOT NULL AND cardinality("store_settings"."regions") > 0));--> statement-breakpoint
ALTER TABLE "payment_transactions" ALTER COLUMN "farm_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_transactions" ADD CONSTRAINT "ck_payment_transactions_farm" CHECK ("payment_transactions"."order_id" IS NULL OR "payment_transactions"."farm_id" IS NOT NULL);
--> statement-breakpoint
ALTER TABLE "store_orders" ADD COLUMN "region" "store_region";--> statement-breakpoint
-- The variant price is per unit: a mapped item must keep the variant's unit.
CREATE FUNCTION protect_store_variant_item_unit()
RETURNS TRIGGER AS $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM store_variant_items m
        JOIN store_product_variants v ON v.id = m.variant_id
        WHERE m.item_id = NEW.id AND v.unit_id <> NEW.unit_id
    ) THEN
        RAISE EXCEPTION 'Items sold through a storefront variant must keep the variant unit'
            USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER trg_protect_store_variant_item_unit
BEFORE UPDATE OF unit_id ON items
FOR EACH ROW EXECUTE FUNCTION protect_store_variant_item_unit();

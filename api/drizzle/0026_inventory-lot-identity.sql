-- Split lot identity: server-assigned lot_code (global UNIQUE), optional non-unique
-- supplier_lot_number, and the old mixed-purpose lot_number kept as legacy evidence.
CREATE SEQUENCE "public"."inventory_lot_code_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
-- greatest() keeps every digit once the sequence passes nine digits (plain lpad would truncate).
CREATE FUNCTION "public"."next_inventory_lot_code"() RETURNS varchar LANGUAGE sql VOLATILE AS $$
  SELECT 'LOT-' || lpad(n::text, greatest(9, length(n::text)), '0') FROM nextval('public.inventory_lot_code_seq') AS n
$$;--> statement-breakpoint
ALTER TABLE "inventory_lots" DROP CONSTRAINT "uq_lot_per_item_farm";--> statement-breakpoint
ALTER TABLE "inventory_lots" RENAME COLUMN "lot_number" TO "legacy_lot_number";--> statement-breakpoint
ALTER TABLE "inventory_lots" ALTER COLUMN "legacy_lot_number" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "inventory_lots" ADD COLUMN "supplier_lot_number" varchar(100);--> statement-breakpoint
ALTER TABLE "inventory_lots" ADD COLUMN "lot_code" varchar(30);--> statement-breakpoint
-- Existing lots get codes in creation order; the sequence then continues after them.
WITH ordered AS (
  SELECT id, row_number() OVER (ORDER BY created_at, id) AS n FROM inventory_lots
)
UPDATE inventory_lots l
SET lot_code = 'LOT-' || lpad(o.n::text, greatest(9, length(o.n::text)), '0')
FROM ordered o
WHERE l.id = o.id;--> statement-breakpoint
SELECT setval('public.inventory_lot_code_seq', greatest(count(*), 1), count(*) > 0) FROM inventory_lots;--> statement-breakpoint
ALTER TABLE "inventory_lots" ALTER COLUMN "lot_code" SET DEFAULT next_inventory_lot_code();--> statement-breakpoint
ALTER TABLE "inventory_lots" ALTER COLUMN "lot_code" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "inventory_lots" ADD CONSTRAINT "uq_inventory_lot_code" UNIQUE("lot_code");--> statement-breakpoint
ALTER TABLE "inventory_lots" ADD CONSTRAINT "ck_lot_code_not_blank" CHECK (btrim(lot_code) <> '');--> statement-breakpoint
CREATE INDEX "idx_inventory_lots_supplier_number" ON "inventory_lots" USING btree ("farm_id","item_id","supplier_lot_number");--> statement-breakpoint
ALTER TABLE "stock_receipt_items" RENAME COLUMN "lot_number" TO "legacy_lot_number";--> statement-breakpoint
ALTER TABLE "stock_receipt_items" ADD COLUMN "supplier_lot_number" varchar(100);

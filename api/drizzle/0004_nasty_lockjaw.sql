ALTER TABLE "stock_receipt_items" ADD COLUMN "lot_id" uuid;--> statement-breakpoint
ALTER TABLE "stock_receipt_items" ADD COLUMN "lot_number" varchar(100);--> statement-breakpoint
ALTER TABLE "stock_receipt_items" ADD COLUMN "manufactured_date" date;--> statement-breakpoint
ALTER TABLE "stock_receipt_items" ADD COLUMN "expiry_date" date;--> statement-breakpoint
ALTER TABLE "stock_receipt_items" ADD COLUMN "asset_id" uuid;--> statement-breakpoint
ALTER TABLE "stock_receipt_items" ADD COLUMN "asset_code" varchar(100);--> statement-breakpoint
ALTER TABLE "stock_receipt_items" ADD COLUMN "serial_number" varchar(255);--> statement-breakpoint
ALTER TABLE "stock_receipt_items" ADD CONSTRAINT "stock_receipt_items_lot_id_inventory_lots_id_fk" FOREIGN KEY ("lot_id") REFERENCES "public"."inventory_lots"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_receipt_items" ADD CONSTRAINT "stock_receipt_items_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_receipt_items" ADD CONSTRAINT "ck_receipt_item_asset_quantity" CHECK ((asset_id IS NULL) OR (quantity = (1)::numeric));--> statement-breakpoint
ALTER TABLE "stock_receipt_items" ADD CONSTRAINT "ck_receipt_item_lot_dates" CHECK ((manufactured_date IS NULL) OR (expiry_date IS NULL) OR (expiry_date >= manufactured_date));
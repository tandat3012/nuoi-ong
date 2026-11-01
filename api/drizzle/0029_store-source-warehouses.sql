CREATE TABLE "store_order_replenishments" (
	"stock_transfer_id" uuid PRIMARY KEY NOT NULL,
	"order_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store_source_warehouses" (
	"warehouse_id" uuid PRIMARY KEY NOT NULL,
	"farm_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "store_order_replenishments" ADD CONSTRAINT "store_order_replenishments_stock_transfer_id_stock_transfers_id_fk" FOREIGN KEY ("stock_transfer_id") REFERENCES "public"."stock_transfers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_order_replenishments" ADD CONSTRAINT "store_order_replenishments_order_id_store_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."store_orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_source_warehouses" ADD CONSTRAINT "store_source_warehouses_farm_id_store_settings_farm_id_fk" FOREIGN KEY ("farm_id") REFERENCES "public"."store_settings"("farm_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_source_warehouses" ADD CONSTRAINT "fk_store_source_warehouses_warehouse_farm" FOREIGN KEY ("warehouse_id","farm_id") REFERENCES "public"."warehouses"("id","farm_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_store_order_replenishments_order" ON "store_order_replenishments" USING btree ("order_id");
CREATE TYPE "public"."store_order_status" AS ENUM('PENDING', 'CONFIRMED', 'SHIPPING', 'COMPLETED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."store_payment_method" AS ENUM('COD', 'BANK_TRANSFER');--> statement-breakpoint
CREATE TYPE "public"."store_payment_status" AS ENUM('UNPAID', 'PAID');--> statement-breakpoint
ALTER TYPE "public"."issue_type" ADD VALUE 'SALE' BEFORE 'CONSUMPTION';--> statement-breakpoint
CREATE TABLE "store_order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"variant_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"product_name" varchar(255) NOT NULL,
	"variant_name" varchar(255) NOT NULL,
	"unit_price" numeric(18, 0) NOT NULL,
	"quantity" integer NOT NULL,
	"stock_quantity" numeric(18, 3) NOT NULL,
	"line_total" numeric(18, 0) NOT NULL,
	CONSTRAINT "uq_store_order_items_variant" UNIQUE("order_id","variant_id"),
	CONSTRAINT "ck_store_order_items_quantity" CHECK ("store_order_items"."quantity" BETWEEN 1 AND 10000 AND "store_order_items"."stock_quantity" > 0 AND "store_order_items"."stock_quantity" < 'NaN'::numeric),
	CONSTRAINT "ck_store_order_items_money" CHECK ("store_order_items"."unit_price" >= 0 AND "store_order_items"."line_total" = "store_order_items"."unit_price" * "store_order_items"."quantity" AND "store_order_items"."line_total" <= 9007199254740991)
);
--> statement-breakpoint
ALTER TABLE "store_order_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "store_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_number" integer GENERATED ALWAYS AS IDENTITY (sequence name "store_orders_order_number_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" uuid NOT NULL,
	"farm_id" uuid NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"recipient_name" varchar(255) NOT NULL,
	"phone" varchar(30) NOT NULL,
	"address" text NOT NULL,
	"note" text,
	"payment_method" "store_payment_method" NOT NULL,
	"payment_status" "store_payment_status" DEFAULT 'UNPAID' NOT NULL,
	"status" "store_order_status" DEFAULT 'PENDING' NOT NULL,
	"subtotal" numeric(18, 0) NOT NULL,
	"shipping_fee" numeric(18, 0) DEFAULT '0' NOT NULL,
	"total" numeric(18, 0) NOT NULL,
	"stock_issue_id" uuid,
	"cancel_reason" text,
	"idempotency_key" uuid NOT NULL,
	"request_fingerprint" text NOT NULL,
	"confirmed_at" timestamp with time zone,
	"shipped_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"paid_by_member_id" uuid,
	"handled_by_member_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_store_orders_number" UNIQUE("order_number"),
	CONSTRAINT "uq_store_orders_idempotency" UNIQUE("user_id","idempotency_key"),
	CONSTRAINT "uq_store_orders_stock_issue" UNIQUE("stock_issue_id"),
	CONSTRAINT "ck_store_orders_money" CHECK ("store_orders"."subtotal" >= 0 AND "store_orders"."shipping_fee" >= 0 AND "store_orders"."total" = "store_orders"."subtotal" + "store_orders"."shipping_fee" AND "store_orders"."total" <= 9007199254740991),
	CONSTRAINT "ck_store_orders_recipient" CHECK (length(trim("store_orders"."recipient_name")) > 0 AND length(trim("store_orders"."phone")) > 0 AND length(trim("store_orders"."address")) > 0),
	CONSTRAINT "ck_store_orders_payment" CHECK (("store_orders"."payment_status" = 'UNPAID' AND "store_orders"."paid_at" IS NULL AND "store_orders"."paid_by_member_id" IS NULL) OR ("store_orders"."payment_status" = 'PAID' AND "store_orders"."paid_at" IS NOT NULL AND "store_orders"."paid_by_member_id" IS NOT NULL)),
	CONSTRAINT "ck_store_orders_status_fields" CHECK (
    ("store_orders"."status" <> 'PENDING' OR "store_orders"."stock_issue_id" IS NULL)
    AND ("store_orders"."status" NOT IN ('CONFIRMED', 'SHIPPING', 'COMPLETED') OR ("store_orders"."stock_issue_id" IS NOT NULL AND "store_orders"."confirmed_at" IS NOT NULL))
    AND ("store_orders"."status" NOT IN ('SHIPPING', 'COMPLETED') OR "store_orders"."shipped_at" IS NOT NULL)
    AND ("store_orders"."status" <> 'COMPLETED' OR ("store_orders"."completed_at" IS NOT NULL AND "store_orders"."payment_status" = 'PAID'))
    AND ("store_orders"."status" <> 'CANCELLED' OR ("store_orders"."cancelled_at" IS NOT NULL AND "store_orders"."cancel_reason" IS NOT NULL AND length(trim("store_orders"."cancel_reason")) > 0 AND "store_orders"."payment_status" = 'UNPAID'))
  )
);
--> statement-breakpoint
ALTER TABLE "store_orders" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "store_order_items" ADD CONSTRAINT "store_order_items_order_id_store_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."store_orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_order_items" ADD CONSTRAINT "store_order_items_variant_id_store_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."store_product_variants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_order_items" ADD CONSTRAINT "store_order_items_product_id_store_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."store_products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_order_items" ADD CONSTRAINT "store_order_items_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_orders" ADD CONSTRAINT "store_orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_orders" ADD CONSTRAINT "store_orders_farm_id_farms_id_fk" FOREIGN KEY ("farm_id") REFERENCES "public"."farms"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_orders" ADD CONSTRAINT "store_orders_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_orders" ADD CONSTRAINT "store_orders_stock_issue_id_stock_issues_id_fk" FOREIGN KEY ("stock_issue_id") REFERENCES "public"."stock_issues"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_orders" ADD CONSTRAINT "store_orders_paid_by_member_id_farm_members_id_fk" FOREIGN KEY ("paid_by_member_id") REFERENCES "public"."farm_members"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_orders" ADD CONSTRAINT "store_orders_handled_by_member_id_farm_members_id_fk" FOREIGN KEY ("handled_by_member_id") REFERENCES "public"."farm_members"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_store_order_items_product" ON "store_order_items" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_store_orders_status_created" ON "store_orders" USING btree ("farm_id","status","created_at" DESC NULLS LAST,"id");--> statement-breakpoint
CREATE INDEX "idx_store_orders_user_created" ON "store_orders" USING btree ("user_id","created_at" DESC NULLS LAST,"id");--> statement-breakpoint
CREATE INDEX "idx_store_orders_completed" ON "store_orders" USING btree ("farm_id","completed_at");
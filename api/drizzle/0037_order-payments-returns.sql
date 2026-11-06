ALTER TYPE "public"."payment_provider" ADD VALUE 'MANUAL';--> statement-breakpoint
ALTER TYPE "public"."store_order_status" ADD VALUE 'RETURNING';--> statement-breakpoint
ALTER TYPE "public"."store_order_status" ADD VALUE 'RETURNED';--> statement-breakpoint
ALTER TABLE "store_orders" DROP CONSTRAINT "ck_store_orders_status_fields";--> statement-breakpoint
ALTER TABLE "store_orders" ADD COLUMN "cod_remitted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "store_orders" ADD COLUMN "cod_remitted_by_member_id" uuid;--> statement-breakpoint
ALTER TABLE "store_orders" ADD COLUMN "refund_amount" numeric(18, 0);--> statement-breakpoint
ALTER TABLE "store_orders" ADD COLUMN "refund_reference" text;--> statement-breakpoint
ALTER TABLE "store_orders" ADD COLUMN "refunded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "store_orders" ADD COLUMN "refunded_by_member_id" uuid;--> statement-breakpoint
ALTER TABLE "store_orders" ADD COLUMN "return_receipt_id" uuid;--> statement-breakpoint
ALTER TABLE "store_orders" ADD CONSTRAINT "store_orders_cod_remitted_by_member_id_farm_members_id_fk" FOREIGN KEY ("cod_remitted_by_member_id") REFERENCES "public"."farm_members"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_orders" ADD CONSTRAINT "store_orders_refunded_by_member_id_farm_members_id_fk" FOREIGN KEY ("refunded_by_member_id") REFERENCES "public"."farm_members"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_orders" ADD CONSTRAINT "store_orders_return_receipt_id_stock_receipts_id_fk" FOREIGN KEY ("return_receipt_id") REFERENCES "public"."stock_receipts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_orders" ADD CONSTRAINT "uq_store_orders_return_receipt" UNIQUE("return_receipt_id");--> statement-breakpoint
ALTER TABLE "store_orders" ADD CONSTRAINT "ck_store_orders_cod_remit" CHECK (("store_orders"."cod_remitted_at" IS NULL) = ("store_orders"."cod_remitted_by_member_id" IS NULL) AND ("store_orders"."cod_remitted_at" IS NULL OR ("store_orders"."payment_method" = 'COD' AND "store_orders"."status" = 'COMPLETED')));--> statement-breakpoint
ALTER TABLE "store_orders" ADD CONSTRAINT "ck_store_orders_refund" CHECK (("store_orders"."refunded_at" IS NULL AND "store_orders"."refund_amount" IS NULL AND "store_orders"."refund_reference" IS NULL AND "store_orders"."refunded_by_member_id" IS NULL) OR ("store_orders"."refunded_at" IS NOT NULL AND "store_orders"."refunded_by_member_id" IS NOT NULL AND "store_orders"."payment_status" = 'PAID' AND "store_orders"."status"::text IN ('CANCELLED', 'RETURNED') AND "store_orders"."refund_amount" > 0 AND "store_orders"."refund_amount" <= "store_orders"."total" AND length(trim("store_orders"."refund_reference")) > 0));--> statement-breakpoint
ALTER TABLE "store_orders" ADD CONSTRAINT "ck_store_orders_status_fields" CHECK (
    ("store_orders"."status" <> 'PENDING' OR "store_orders"."stock_issue_id" IS NULL)
    AND ("store_orders"."status" NOT IN ('CONFIRMED', 'SHIPPING', 'COMPLETED') OR ("store_orders"."stock_issue_id" IS NOT NULL AND "store_orders"."confirmed_at" IS NOT NULL))
    AND ("store_orders"."status" NOT IN ('SHIPPING', 'COMPLETED') OR "store_orders"."shipped_at" IS NOT NULL)
    AND ("store_orders"."status" <> 'COMPLETED' OR ("store_orders"."completed_at" IS NOT NULL AND "store_orders"."payment_status" = 'PAID'))
    AND ("store_orders"."status" <> 'CANCELLED' OR ("store_orders"."cancelled_at" IS NOT NULL AND "store_orders"."cancel_reason" IS NOT NULL AND length(trim("store_orders"."cancel_reason")) > 0 AND ("store_orders"."payment_status" = 'UNPAID' OR "store_orders"."refunded_at" IS NOT NULL)))
    AND ("store_orders"."status"::text NOT IN ('RETURNING', 'RETURNED') OR ("store_orders"."return_receipt_id" IS NOT NULL AND "store_orders"."stock_issue_id" IS NOT NULL AND "store_orders"."shipped_at" IS NOT NULL))
  );
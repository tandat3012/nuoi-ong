CREATE TYPE "public"."payment_provider" AS ENUM('SEPAY', 'SIMULATOR');--> statement-breakpoint
CREATE TYPE "public"."payment_transaction_result" AS ENUM('MATCHED', 'AMOUNT_MISMATCH', 'ORDER_NOT_FOUND', 'ORDER_NOT_PAYABLE', 'ALREADY_PAID', 'WRONG_ACCOUNT');--> statement-breakpoint
CREATE TABLE "payment_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"farm_id" uuid NOT NULL,
	"provider" "payment_provider" NOT NULL,
	"provider_tx_id" varchar(100) NOT NULL,
	"account_number" varchar(50) NOT NULL,
	"amount" numeric(18, 0) NOT NULL,
	"content" text NOT NULL,
	"transaction_at" timestamp with time zone NOT NULL,
	"order_id" uuid,
	"result" "payment_transaction_result" NOT NULL,
	"raw_payload" jsonb NOT NULL,
	"created_by_member_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_payment_transactions_provider_tx" UNIQUE("provider","provider_tx_id"),
	CONSTRAINT "ck_payment_transactions_amount" CHECK ("payment_transactions"."amount" >= 0 AND "payment_transactions"."amount" <= 9007199254740991),
	CONSTRAINT "ck_payment_transactions_order" CHECK ("payment_transactions"."result" IN ('ORDER_NOT_FOUND', 'WRONG_ACCOUNT') OR "payment_transactions"."order_id" IS NOT NULL)
);
--> statement-breakpoint
ALTER TABLE "payment_transactions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "store_orders" DROP CONSTRAINT "ck_store_orders_payment";--> statement-breakpoint
ALTER TABLE "store_orders" ADD COLUMN "payment_transaction_id" uuid;--> statement-breakpoint
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_farm_id_farms_id_fk" FOREIGN KEY ("farm_id") REFERENCES "public"."farms"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_order_id_store_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."store_orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_created_by_member_id_farm_members_id_fk" FOREIGN KEY ("created_by_member_id") REFERENCES "public"."farm_members"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ux_payment_transactions_matched_order" ON "payment_transactions" USING btree ("order_id") WHERE result = 'MATCHED';--> statement-breakpoint
CREATE INDEX "idx_payment_transactions_farm_created" ON "payment_transactions" USING btree ("farm_id","created_at" DESC NULLS LAST,"id");--> statement-breakpoint
CREATE INDEX "idx_payment_transactions_order" ON "payment_transactions" USING btree ("order_id");--> statement-breakpoint
ALTER TABLE "store_orders" ADD CONSTRAINT "store_orders_payment_transaction_id_payment_transactions_id_fk" FOREIGN KEY ("payment_transaction_id") REFERENCES "public"."payment_transactions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_orders" ADD CONSTRAINT "uq_store_orders_payment_transaction" UNIQUE("payment_transaction_id");--> statement-breakpoint
ALTER TABLE "store_orders" ADD CONSTRAINT "ck_store_orders_payment" CHECK (("store_orders"."payment_status" = 'UNPAID' AND "store_orders"."paid_at" IS NULL AND "store_orders"."paid_by_member_id" IS NULL AND "store_orders"."payment_transaction_id" IS NULL) OR ("store_orders"."payment_status" = 'PAID' AND "store_orders"."paid_at" IS NOT NULL AND ("store_orders"."paid_by_member_id" IS NOT NULL OR "store_orders"."payment_transaction_id" IS NOT NULL)));
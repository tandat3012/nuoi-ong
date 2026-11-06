CREATE TYPE "public"."store_warranty_kind" AS ENUM('WARRANTY', 'PAID_REPAIR');--> statement-breakpoint
CREATE TYPE "public"."store_warranty_resolution" AS ENUM('RETURN', 'EXCHANGE');--> statement-breakpoint
CREATE TYPE "public"."store_warranty_status" AS ENUM('RECEIVED', 'AT_PARTNER', 'AWAITING_CUSTOMER', 'IN_REPAIR', 'BACK_FROM_PARTNER', 'EXCHANGING', 'CLOSED', 'CANCELLED');--> statement-breakpoint
CREATE TABLE "store_warranty_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_number" integer GENERATED ALWAYS AS IDENTITY (sequence name "store_warranty_requests_request_number_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"farm_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"order_item_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	"kind" "store_warranty_kind" NOT NULL,
	"status" "store_warranty_status" DEFAULT 'RECEIVED' NOT NULL,
	"issue_description" text NOT NULL,
	"intake_note" text,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"partner_name" varchar(255),
	"sent_at" timestamp with time zone,
	"quote_amount" numeric(18, 0),
	"customer_approved" boolean,
	"customer_decision_note" text,
	"customer_decided_at" timestamp with time zone,
	"repair_started_at" timestamp with time zone,
	"back_at" timestamp with time zone,
	"result" text,
	"actual_cost" numeric(18, 0),
	"resolution" "store_warranty_resolution",
	"exchange_issue_id" uuid,
	"closed_at" timestamp with time zone,
	"cancel_reason" text,
	"created_by_member_id" uuid NOT NULL,
	"handled_by_member_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_store_warranty_requests_number" UNIQUE("request_number"),
	CONSTRAINT "uq_store_warranty_requests_exchange_issue" UNIQUE("exchange_issue_id"),
	CONSTRAINT "ck_store_warranty_quantity" CHECK ("store_warranty_requests"."quantity" BETWEEN 1 AND 10000),
	CONSTRAINT "ck_store_warranty_money" CHECK (("store_warranty_requests"."quote_amount" IS NULL OR "store_warranty_requests"."quote_amount" BETWEEN 0 AND 9007199254740991) AND ("store_warranty_requests"."actual_cost" IS NULL OR "store_warranty_requests"."actual_cost" BETWEEN 0 AND 9007199254740991)),
	CONSTRAINT "ck_store_warranty_paid_consent" CHECK ("store_warranty_requests"."repair_started_at" IS NULL OR "store_warranty_requests"."kind" = 'WARRANTY' OR "store_warranty_requests"."customer_approved" IS TRUE),
	CONSTRAINT "ck_store_warranty_partner" CHECK ("store_warranty_requests"."sent_at" IS NULL OR btrim(coalesce("store_warranty_requests"."partner_name", '')) <> ''),
	CONSTRAINT "ck_store_warranty_exchange" CHECK (("store_warranty_requests"."status" = 'EXCHANGING' OR ("store_warranty_requests"."status" = 'CLOSED' AND "store_warranty_requests"."resolution" = 'EXCHANGE')) = ("store_warranty_requests"."exchange_issue_id" IS NOT NULL)),
	CONSTRAINT "ck_store_warranty_closed" CHECK (("store_warranty_requests"."status" = 'CLOSED') = ("store_warranty_requests"."closed_at" IS NOT NULL AND "store_warranty_requests"."resolution" IS NOT NULL)),
	CONSTRAINT "ck_store_warranty_cancelled" CHECK (("store_warranty_requests"."status" = 'CANCELLED') = (btrim(coalesce("store_warranty_requests"."cancel_reason", '')) <> ''))
);
--> statement-breakpoint
ALTER TABLE "store_warranty_requests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "warranty_months" integer;--> statement-breakpoint
ALTER TABLE "store_order_items" ADD COLUMN "warranty_months" integer;--> statement-breakpoint
ALTER TABLE "store_warranty_requests" ADD CONSTRAINT "store_warranty_requests_farm_id_farms_id_fk" FOREIGN KEY ("farm_id") REFERENCES "public"."farms"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_warranty_requests" ADD CONSTRAINT "store_warranty_requests_order_id_store_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."store_orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_warranty_requests" ADD CONSTRAINT "store_warranty_requests_order_item_id_store_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."store_order_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_warranty_requests" ADD CONSTRAINT "store_warranty_requests_exchange_issue_id_stock_issues_id_fk" FOREIGN KEY ("exchange_issue_id") REFERENCES "public"."stock_issues"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_warranty_requests" ADD CONSTRAINT "store_warranty_requests_created_by_member_id_farm_members_id_fk" FOREIGN KEY ("created_by_member_id") REFERENCES "public"."farm_members"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_warranty_requests" ADD CONSTRAINT "store_warranty_requests_handled_by_member_id_farm_members_id_fk" FOREIGN KEY ("handled_by_member_id") REFERENCES "public"."farm_members"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_store_warranty_requests_farm" ON "store_warranty_requests" USING btree ("farm_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_store_warranty_requests_order" ON "store_warranty_requests" USING btree ("order_id");--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "ck_item_warranty_months" CHECK ((warranty_months IS NULL) OR ((warranty_months BETWEEN 1 AND 120) AND (item_type IN ('EQUIPMENT'::item_type, 'TOOL'::item_type))));--> statement-breakpoint
ALTER TABLE "store_order_items" ADD CONSTRAINT "ck_store_order_items_warranty" CHECK ("store_order_items"."warranty_months" IS NULL OR "store_order_items"."warranty_months" BETWEEN 0 AND 120);
CREATE TYPE "public"."adjustment_reason" AS ENUM('STOCK_COUNT', 'SHRINKAGE', 'DAMAGE', 'EXPIRED', 'DATA_ENTRY_ERROR', 'OTHER');--> statement-breakpoint
CREATE TABLE "inventory_adjustments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"farm_id" uuid NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"lot_id" uuid,
	"quantity_change" numeric(18, 3) NOT NULL,
	"reason_code" "adjustment_reason" NOT NULL,
	"note" text,
	"status" "document_status" NOT NULL,
	"idempotency_key" uuid NOT NULL,
	"requested_by_member_id" uuid NOT NULL,
	"reviewed_by_member_id" uuid,
	"reviewed_at" timestamp with time zone,
	"rejection_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_inventory_adjustment_nonzero" CHECK (quantity_change <> (0)::numeric),
	CONSTRAINT "ck_inventory_adjustment_other_note" CHECK (reason_code <> 'OTHER'::adjustment_reason OR coalesce(length(btrim(note)), 0) > 0),
	CONSTRAINT "ck_inventory_adjustment_status" CHECK (status IN ('PENDING_APPROVAL'::document_status, 'CONFIRMED'::document_status, 'REJECTED'::document_status)),
	CONSTRAINT "ck_inventory_adjustment_review" CHECK ((status = 'PENDING_APPROVAL'::document_status) = (reviewed_at IS NULL))
);
--> statement-breakpoint
ALTER TABLE "inventory_adjustments" ADD CONSTRAINT "inventory_adjustments_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "public"."farms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_adjustments" ADD CONSTRAINT "inventory_adjustments_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_adjustments" ADD CONSTRAINT "inventory_adjustments_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_adjustments" ADD CONSTRAINT "inventory_adjustments_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "public"."inventory_lots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_adjustments" ADD CONSTRAINT "inventory_adjustments_requested_by_member_id_fkey" FOREIGN KEY ("requested_by_member_id") REFERENCES "public"."farm_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_adjustments" ADD CONSTRAINT "inventory_adjustments_reviewed_by_member_id_fkey" FOREIGN KEY ("reviewed_by_member_id") REFERENCES "public"."farm_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ux_inventory_adjustment_idempotency" ON "inventory_adjustments" USING btree ("farm_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "idx_inventory_adjustments_farm_status" ON "inventory_adjustments" USING btree ("farm_id","status","created_at" DESC NULLS FIRST);
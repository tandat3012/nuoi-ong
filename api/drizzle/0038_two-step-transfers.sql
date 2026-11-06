ALTER TYPE "public"."document_status" ADD VALUE 'IN_TRANSIT';--> statement-breakpoint
ALTER TABLE "stock_transfer_items" ADD COLUMN "received_quantity" numeric(18, 3);--> statement-breakpoint
ALTER TABLE "stock_transfer_items" ADD COLUMN "discrepancy_reason" text;--> statement-breakpoint
ALTER TABLE "stock_transfers" ADD COLUMN "dispatched_by_member_id" uuid;--> statement-breakpoint
ALTER TABLE "stock_transfers" ADD COLUMN "dispatched_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_dispatched_by_member_id_fkey" FOREIGN KEY ("dispatched_by_member_id") REFERENCES "public"."farm_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transfer_items" ADD CONSTRAINT "ck_transfer_item_received" CHECK ((received_quantity IS NULL) OR ((received_quantity >= (0)::numeric) AND (received_quantity <= quantity) AND ((received_quantity = quantity) OR (btrim(coalesce(discrepancy_reason, '')) <> ''))));--> statement-breakpoint
ALTER TABLE "stock_transfers" ADD CONSTRAINT "ck_transfer_dispatch_fields" CHECK ((status::text <> 'IN_TRANSIT') OR ((transfer_code IS NOT NULL) AND (dispatched_by_member_id IS NOT NULL) AND (dispatched_at IS NOT NULL)));
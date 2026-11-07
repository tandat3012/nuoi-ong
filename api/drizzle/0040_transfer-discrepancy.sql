ALTER TYPE "public"."document_status" ADD VALUE 'DISCREPANCY';--> statement-breakpoint
ALTER TABLE "stock_transfers" ADD COLUMN "resolution" varchar(20);--> statement-breakpoint
ALTER TABLE "stock_transfers" ADD COLUMN "resolution_note" text;--> statement-breakpoint
ALTER TABLE "stock_transfers" ADD COLUMN "resolved_by_member_id" uuid;--> statement-breakpoint
ALTER TABLE "stock_transfers" ADD COLUMN "resolved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_resolved_by_member_id_fkey" FOREIGN KEY ("resolved_by_member_id") REFERENCES "public"."farm_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transfers" ADD CONSTRAINT "ck_transfer_resolution" CHECK ((resolution IS NULL AND resolved_by_member_id IS NULL AND resolved_at IS NULL) OR (resolution IN ('RETURN_TO_SOURCE', 'WRITE_OFF') AND resolved_by_member_id IS NOT NULL AND resolved_at IS NOT NULL));
ALTER TABLE "stock_transfers" ADD COLUMN "rejection_reason" text;--> statement-breakpoint
ALTER TABLE "stock_transfers" ADD COLUMN "rejected_by_member_id" uuid;--> statement-breakpoint
ALTER TABLE "stock_transfers" ADD COLUMN "rejected_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_rejected_by_member_id_fkey" FOREIGN KEY ("rejected_by_member_id") REFERENCES "public"."farm_members"("id") ON DELETE no action ON UPDATE no action;
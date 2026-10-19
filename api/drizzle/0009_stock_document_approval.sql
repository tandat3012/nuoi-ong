ALTER TYPE "public"."document_status" ADD VALUE 'PENDING_APPROVAL' BEFORE 'CONFIRMED';--> statement-breakpoint
ALTER TYPE "public"."document_status" ADD VALUE 'REJECTED' BEFORE 'CANCELLED';--> statement-breakpoint
ALTER TYPE "public"."stock_count_status" ADD VALUE 'PENDING_APPROVAL' BEFORE 'CONFIRMED';--> statement-breakpoint
ALTER TYPE "public"."stock_count_status" ADD VALUE 'REJECTED' BEFORE 'CANCELLED';--> statement-breakpoint
ALTER TABLE "stock_counts" ADD COLUMN "rejection_reason" text;--> statement-breakpoint
ALTER TABLE "stock_counts" ADD COLUMN "rejected_by_member_id" uuid;--> statement-breakpoint
ALTER TABLE "stock_counts" ADD COLUMN "rejected_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "stock_issues" ADD COLUMN "rejection_reason" text;--> statement-breakpoint
ALTER TABLE "stock_issues" ADD COLUMN "rejected_by_member_id" uuid;--> statement-breakpoint
ALTER TABLE "stock_issues" ADD COLUMN "rejected_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "stock_receipts" ADD COLUMN "rejection_reason" text;--> statement-breakpoint
ALTER TABLE "stock_receipts" ADD COLUMN "rejected_by_member_id" uuid;--> statement-breakpoint
ALTER TABLE "stock_receipts" ADD COLUMN "rejected_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "stock_counts" ADD CONSTRAINT "stock_counts_rejected_by_member_id_fkey" FOREIGN KEY ("rejected_by_member_id") REFERENCES "public"."farm_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_issues" ADD CONSTRAINT "stock_issues_rejected_by_member_id_fkey" FOREIGN KEY ("rejected_by_member_id") REFERENCES "public"."farm_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_receipts" ADD CONSTRAINT "stock_receipts_rejected_by_member_id_fkey" FOREIGN KEY ("rejected_by_member_id") REFERENCES "public"."farm_members"("id") ON DELETE no action ON UPDATE no action;
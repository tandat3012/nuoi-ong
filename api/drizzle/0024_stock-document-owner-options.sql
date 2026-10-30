CREATE TYPE "public"."document_code_source" AS ENUM('AUTO', 'MANUAL');--> statement-breakpoint
ALTER TABLE "stock_counts" ADD COLUMN "external_reference" varchar(100);--> statement-breakpoint
ALTER TABLE "stock_counts" ADD COLUMN "requested_code" varchar(50);--> statement-breakpoint
ALTER TABLE "stock_counts" ADD COLUMN "requested_code_reason" varchar(500);--> statement-breakpoint
ALTER TABLE "stock_counts" ADD COLUMN "requested_by_member_id" uuid;--> statement-breakpoint
ALTER TABLE "stock_counts" ADD COLUMN "code_source" "document_code_source";--> statement-breakpoint
ALTER TABLE "stock_issues" ADD COLUMN "external_reference" varchar(100);--> statement-breakpoint
ALTER TABLE "stock_issues" ADD COLUMN "requested_code" varchar(50);--> statement-breakpoint
ALTER TABLE "stock_issues" ADD COLUMN "requested_code_reason" varchar(500);--> statement-breakpoint
ALTER TABLE "stock_issues" ADD COLUMN "requested_by_member_id" uuid;--> statement-breakpoint
ALTER TABLE "stock_issues" ADD COLUMN "code_source" "document_code_source";--> statement-breakpoint
ALTER TABLE "stock_receipts" ADD COLUMN "external_reference" varchar(100);--> statement-breakpoint
ALTER TABLE "stock_receipts" ADD COLUMN "requested_code" varchar(50);--> statement-breakpoint
ALTER TABLE "stock_receipts" ADD COLUMN "requested_code_reason" varchar(500);--> statement-breakpoint
ALTER TABLE "stock_receipts" ADD COLUMN "requested_by_member_id" uuid;--> statement-breakpoint
ALTER TABLE "stock_receipts" ADD COLUMN "code_source" "document_code_source";--> statement-breakpoint
ALTER TABLE "stock_transfers" ADD COLUMN "external_reference" varchar(100);--> statement-breakpoint
ALTER TABLE "stock_transfers" ADD COLUMN "requested_code" varchar(50);--> statement-breakpoint
ALTER TABLE "stock_transfers" ADD COLUMN "requested_code_reason" varchar(500);--> statement-breakpoint
ALTER TABLE "stock_transfers" ADD COLUMN "requested_by_member_id" uuid;--> statement-breakpoint
ALTER TABLE "stock_transfers" ADD COLUMN "code_source" "document_code_source";--> statement-breakpoint
ALTER TABLE "stock_counts" ADD CONSTRAINT "stock_counts_requested_by_member_id_fkey" FOREIGN KEY ("requested_by_member_id") REFERENCES "public"."farm_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_issues" ADD CONSTRAINT "stock_issues_requested_by_member_id_fkey" FOREIGN KEY ("requested_by_member_id") REFERENCES "public"."farm_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_receipts" ADD CONSTRAINT "stock_receipts_requested_by_member_id_fkey" FOREIGN KEY ("requested_by_member_id") REFERENCES "public"."farm_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_requested_by_member_id_fkey" FOREIGN KEY ("requested_by_member_id") REFERENCES "public"."farm_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_counts" ADD CONSTRAINT "ck_count_requested_code" CHECK ((requested_code IS NULL) OR ((btrim(requested_code) <> '') AND (coalesce(btrim(requested_code_reason), '') <> '') AND (requested_by_member_id IS NOT NULL)));--> statement-breakpoint
ALTER TABLE "stock_issues" ADD CONSTRAINT "ck_issue_requested_code" CHECK ((requested_code IS NULL) OR ((btrim(requested_code) <> '') AND (coalesce(btrim(requested_code_reason), '') <> '') AND (requested_by_member_id IS NOT NULL)));--> statement-breakpoint
ALTER TABLE "stock_receipts" ADD CONSTRAINT "ck_receipt_requested_code" CHECK ((requested_code IS NULL) OR ((btrim(requested_code) <> '') AND (coalesce(btrim(requested_code_reason), '') <> '') AND (requested_by_member_id IS NOT NULL)));--> statement-breakpoint
ALTER TABLE "stock_transfers" ADD CONSTRAINT "ck_transfer_requested_code" CHECK ((requested_code IS NULL) OR ((btrim(requested_code) <> '') AND (coalesce(btrim(requested_code_reason), '') <> '') AND (requested_by_member_id IS NOT NULL)));
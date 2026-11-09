ALTER TABLE "stock_receipt_items" DROP CONSTRAINT "ck_receipt_item_quantity_positive";--> statement-breakpoint
ALTER TABLE "stock_receipt_items" ADD COLUMN "source_issue_item_id" uuid;--> statement-breakpoint
ALTER TABLE "stock_receipt_items" ADD COLUMN "rejected_quantity" numeric(18, 3) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "stock_receipt_items" ADD COLUMN "rejection_reason" text;--> statement-breakpoint
ALTER TABLE "stock_receipts" ADD COLUMN "source_issue_id" uuid;--> statement-breakpoint
ALTER TABLE "stock_receipt_items" ADD CONSTRAINT "stock_receipt_items_source_issue_item_id_stock_issue_items_id_fk" FOREIGN KEY ("source_issue_item_id") REFERENCES "public"."stock_issue_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_receipts" ADD CONSTRAINT "stock_receipts_source_issue_id_stock_issues_id_fk" FOREIGN KEY ("source_issue_id") REFERENCES "public"."stock_issues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_stock_receipts_source_issue" ON "stock_receipts" USING btree ("source_issue_id") WHERE source_issue_id IS NOT NULL;--> statement-breakpoint
ALTER TABLE "stock_receipt_items" ADD CONSTRAINT "ck_receipt_item_rejected_return" CHECK (rejected_quantity = (0)::numeric OR (rejected_quantity > (0)::numeric AND source_issue_item_id IS NOT NULL AND coalesce(btrim(rejection_reason), '') <> ''));--> statement-breakpoint
ALTER TABLE "stock_receipt_items" ADD CONSTRAINT "ck_receipt_item_quantity_positive" CHECK (quantity > (0)::numeric OR (quantity = (0)::numeric AND rejected_quantity > (0)::numeric));
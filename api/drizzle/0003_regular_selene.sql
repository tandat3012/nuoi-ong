ALTER TYPE "public"."inventory_transaction_type" ADD VALUE 'MAINTENANCE_ISSUE';--> statement-breakpoint
ALTER TYPE "public"."issue_type" ADD VALUE 'MAINTENANCE';--> statement-breakpoint
ALTER TABLE "stock_issues" ADD COLUMN "maintenance_record_id" uuid;--> statement-breakpoint
ALTER TABLE "stock_issues" ADD CONSTRAINT "fk_stock_issues_maintenance_record" FOREIGN KEY ("maintenance_record_id") REFERENCES "public"."maintenance_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_stock_issues_maintenance_record" ON "stock_issues" USING btree ("maintenance_record_id") WHERE maintenance_record_id IS NOT NULL;--> statement-breakpoint
ALTER TABLE "stock_issues"
ADD CONSTRAINT "ck_issue_maintenance_reference"
CHECK (
  (issue_type::text = 'MAINTENANCE' AND maintenance_record_id IS NOT NULL)
  OR
  (issue_type::text <> 'MAINTENANCE' AND maintenance_record_id IS NULL)
);
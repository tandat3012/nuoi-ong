ALTER TYPE "public"."asset_status" ADD VALUE 'TRANSFER_PENDING';--> statement-breakpoint
CREATE TABLE "asset_transfer_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"farm_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"requested_by_member_id" uuid NOT NULL,
	"from_location_id" uuid NOT NULL,
	"to_warehouse_id" uuid NOT NULL,
	"to_location_id" uuid NOT NULL,
	"note" text,
	"status" "document_status" DEFAULT 'PENDING_APPROVAL' NOT NULL,
	"rejection_reason" text,
	"reviewed_by_member_id" uuid,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_asset_transfer_request_review_fields" CHECK (((status IN ('CONFIRMED'::document_status, 'REJECTED'::document_status)) AND reviewed_by_member_id IS NOT NULL AND reviewed_at IS NOT NULL) OR (status NOT IN ('CONFIRMED'::document_status, 'REJECTED'::document_status) AND reviewed_by_member_id IS NULL AND reviewed_at IS NULL)),
	CONSTRAINT "ck_asset_transfer_request_rejection_reason" CHECK ((status <> 'REJECTED'::document_status) OR length(btrim(coalesce(rejection_reason, ''))) > 0)
);
--> statement-breakpoint
ALTER TABLE "asset_transfer_requests" ADD CONSTRAINT "asset_transfer_requests_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "public"."farms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_transfer_requests" ADD CONSTRAINT "asset_transfer_requests_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_transfer_requests" ADD CONSTRAINT "asset_transfer_requests_requested_by_member_id_fkey" FOREIGN KEY ("requested_by_member_id") REFERENCES "public"."farm_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_transfer_requests" ADD CONSTRAINT "asset_transfer_requests_reviewed_by_member_id_fkey" FOREIGN KEY ("reviewed_by_member_id") REFERENCES "public"."farm_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_transfer_requests" ADD CONSTRAINT "asset_transfer_requests_from_location_id_fkey" FOREIGN KEY ("from_location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_transfer_requests" ADD CONSTRAINT "asset_transfer_requests_to_warehouse_id_fkey" FOREIGN KEY ("to_warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_transfer_requests" ADD CONSTRAINT "asset_transfer_requests_to_location_id_fkey" FOREIGN KEY ("to_location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_asset_transfer_requests_farm_status_created" ON "asset_transfer_requests" USING btree ("farm_id","status","created_at" DESC NULLS FIRST);--> statement-breakpoint
CREATE INDEX "idx_asset_transfer_requests_asset_created" ON "asset_transfer_requests" USING btree ("asset_id","created_at" DESC NULLS FIRST);--> statement-breakpoint
CREATE UNIQUE INDEX "ux_pending_asset_transfer_request_per_asset" ON "asset_transfer_requests" USING btree ("farm_id","asset_id") WHERE status = 'PENDING_APPROVAL'::document_status;
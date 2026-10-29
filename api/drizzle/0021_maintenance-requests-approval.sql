CREATE TABLE "maintenance_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"farm_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"requested_by_member_id" uuid NOT NULL,
	"maintenance_type" "maintenance_type" NOT NULL,
	"description" text NOT NULL,
	"status" "document_status" DEFAULT 'PENDING_APPROVAL' NOT NULL,
	"rejection_reason" text,
	"reviewed_by_member_id" uuid,
	"reviewed_at" timestamp with time zone,
	"maintenance_record_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_maintenance_request_review_fields" CHECK (((status IN ('CONFIRMED'::document_status, 'REJECTED'::document_status)) AND reviewed_by_member_id IS NOT NULL AND reviewed_at IS NOT NULL) OR (status NOT IN ('CONFIRMED'::document_status, 'REJECTED'::document_status) AND reviewed_by_member_id IS NULL AND reviewed_at IS NULL)),
	CONSTRAINT "ck_maintenance_request_approval_record" CHECK ((status <> 'CONFIRMED'::document_status) OR maintenance_record_id IS NOT NULL),
	CONSTRAINT "ck_maintenance_request_rejection_reason" CHECK ((status <> 'REJECTED'::document_status) OR length(btrim(coalesce(rejection_reason, ''))) > 0)
);
--> statement-breakpoint
ALTER TABLE "maintenance_requests" ADD CONSTRAINT "maintenance_requests_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "public"."farms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_requests" ADD CONSTRAINT "maintenance_requests_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_requests" ADD CONSTRAINT "maintenance_requests_requested_by_member_id_fkey" FOREIGN KEY ("requested_by_member_id") REFERENCES "public"."farm_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_requests" ADD CONSTRAINT "maintenance_requests_reviewed_by_member_id_fkey" FOREIGN KEY ("reviewed_by_member_id") REFERENCES "public"."farm_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_requests" ADD CONSTRAINT "maintenance_requests_maintenance_record_id_fkey" FOREIGN KEY ("maintenance_record_id") REFERENCES "public"."maintenance_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_maintenance_requests_farm_status_created" ON "maintenance_requests" USING btree ("farm_id","status","created_at" DESC NULLS FIRST);--> statement-breakpoint
CREATE INDEX "idx_maintenance_requests_asset_created" ON "maintenance_requests" USING btree ("asset_id","created_at" DESC NULLS FIRST);--> statement-breakpoint
CREATE UNIQUE INDEX "ux_pending_maintenance_request_per_asset" ON "maintenance_requests" USING btree ("farm_id","asset_id") WHERE status = 'PENDING_APPROVAL'::document_status;
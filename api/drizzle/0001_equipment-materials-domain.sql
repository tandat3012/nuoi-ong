CREATE TYPE "public"."material_kind" AS ENUM('FEED', 'TREATMENT', 'PACKAGING', 'MAINTENANCE_SUPPLY', 'CONSUMABLE', 'OTHER');--> statement-breakpoint
CREATE TABLE "material_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"farm_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"kind" "material_kind" DEFAULT 'CONSUMABLE' NOT NULL,
	"requires_expiry_tracking" boolean DEFAULT false NOT NULL,
	"expiry_warning_days" integer DEFAULT 30 NOT NULL,
	"default_shelf_life_days" integer,
	"storage_instructions" text,
	"safety_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_material_profile_item" UNIQUE("item_id"),
	CONSTRAINT "ck_material_expiry_warning_positive" CHECK (expiry_warning_days > 0),
	CONSTRAINT "ck_material_shelf_life_positive" CHECK ((default_shelf_life_days IS NULL) OR (default_shelf_life_days > 0))
);
--> statement-breakpoint
ALTER TABLE "material_profiles" ADD CONSTRAINT "material_profiles_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "public"."farms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_profiles" ADD CONSTRAINT "material_profiles_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_material_profiles_farm_kind" ON "material_profiles" USING btree ("farm_id","kind");--> statement-breakpoint
CREATE UNIQUE INDEX "ux_one_active_maintenance_per_asset" ON "maintenance_records" USING btree ("asset_id") WHERE (status IN ('SCHEDULED'::maintenance_status, 'IN_PROGRESS'::maintenance_status));--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "ck_item_type_tracking_mode" CHECK (((item_type = 'MATERIAL'::item_type) AND (tracking_mode IN ('QUANTITY'::tracking_mode, 'LOT'::tracking_mode))) OR ((item_type IN ('EQUIPMENT'::item_type, 'TOOL'::item_type)) AND (tracking_mode IN ('QUANTITY'::tracking_mode, 'ASSET'::tracking_mode))));--> statement-breakpoint
ALTER TABLE "asset_assignments" ADD CONSTRAINT "ck_assignment_status_fields" CHECK (((status = 'ACTIVE'::assignment_status) AND (returned_at IS NULL)) OR ((status = 'RETURNED'::assignment_status) AND (returned_at IS NOT NULL)) OR ((status = 'CANCELLED'::assignment_status) AND (returned_at IS NULL)));--> statement-breakpoint
ALTER TABLE "asset_incidents" ADD CONSTRAINT "ck_incident_status_fields" CHECK (((status = 'RESOLVED'::incident_status) AND (resolved_at IS NOT NULL)) OR ((status <> 'RESOLVED'::incident_status) AND (resolved_at IS NULL)));--> statement-breakpoint
ALTER TABLE "maintenance_records" ADD CONSTRAINT "ck_maintenance_status_fields" CHECK (((status = 'SCHEDULED'::maintenance_status) AND (started_at IS NULL) AND (completed_at IS NULL)) OR ((status = 'IN_PROGRESS'::maintenance_status) AND (started_at IS NOT NULL) AND (completed_at IS NULL)) OR ((status = 'COMPLETED'::maintenance_status) AND (started_at IS NOT NULL) AND (completed_at IS NOT NULL)) OR ((status = 'CANCELLED'::maintenance_status) AND (completed_at IS NULL)));
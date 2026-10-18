CREATE TYPE "public"."asset_status" AS ENUM('AVAILABLE', 'ASSIGNED', 'IN_USE', 'MAINTENANCE', 'LOST', 'RETIRED');--> statement-breakpoint
CREATE TYPE "public"."assignment_status" AS ENUM('ACTIVE', 'RETURNED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."document_status" AS ENUM('DRAFT', 'CONFIRMED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."incident_severity" AS ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');--> statement-breakpoint
CREATE TYPE "public"."incident_status" AS ENUM('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."inventory_transaction_type" AS ENUM('RECEIPT', 'ISSUE', 'TRANSFER_OUT', 'TRANSFER_IN', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'ASSIGNMENT_OUT', 'RETURN_IN');--> statement-breakpoint
CREATE TYPE "public"."issue_type" AS ENUM('CONSUMPTION', 'DAMAGE', 'DISPOSAL', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."item_type" AS ENUM('EQUIPMENT', 'TOOL', 'MATERIAL');--> statement-breakpoint
CREATE TYPE "public"."location_type" AS ENUM('WAREHOUSE', 'WAREHOUSE_ZONE', 'APIARY', 'SITE', 'IN_USE', 'MAINTENANCE', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."maintenance_status" AS ENUM('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."maintenance_type" AS ENUM('PREVENTIVE', 'CORRECTIVE', 'INSPECTION');--> statement-breakpoint
CREATE TYPE "public"."member_status" AS ENUM('ACTIVE', 'INACTIVE');--> statement-breakpoint
CREATE TYPE "public"."record_status" AS ENUM('ACTIVE', 'INACTIVE');--> statement-breakpoint
CREATE TYPE "public"."role_scope" AS ENUM('SYSTEM', 'FARM');--> statement-breakpoint
CREATE TYPE "public"."stock_count_status" AS ENUM('DRAFT', 'COUNTING', 'CONFIRMED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."tracking_mode" AS ENUM('QUANTITY', 'LOT', 'ASSET');--> statement-breakpoint
CREATE TABLE "roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(50) NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"scope" "role_scope" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "roles_code_key" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auth_provider" varchar(30) DEFAULT 'CLERK' NOT NULL,
	"auth_provider_user_id" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"full_name" varchar(255),
	"avatar_url" text,
	"system_role_id" uuid,
	"status" "record_status" DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_auth_provider_user_id_key" UNIQUE("auth_provider_user_id")
);
--> statement-breakpoint
CREATE TABLE "farms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(50) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"status" "record_status" DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "farms_code_key" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "farm_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"farm_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"status" "member_status" DEFAULT 'ACTIVE' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_farm_member" UNIQUE("farm_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"farm_id" uuid NOT NULL,
	"code" varchar(50) NOT NULL,
	"name" varchar(255) NOT NULL,
	"phone" varchar(50),
	"email" varchar(255),
	"address" text,
	"note" text,
	"status" "record_status" DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_supplier_code_per_farm" UNIQUE("code","farm_id")
);
--> statement-breakpoint
CREATE TABLE "warehouses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"farm_id" uuid NOT NULL,
	"code" varchar(50) NOT NULL,
	"name" varchar(255) NOT NULL,
	"address" text,
	"description" text,
	"status" "record_status" DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_warehouse_code_per_farm" UNIQUE("code","farm_id")
);
--> statement-breakpoint
CREATE TABLE "locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"farm_id" uuid NOT NULL,
	"warehouse_id" uuid,
	"code" varchar(50) NOT NULL,
	"name" varchar(255) NOT NULL,
	"type" "location_type" NOT NULL,
	"description" text,
	"status" "record_status" DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_location_code_per_farm" UNIQUE("code","farm_id")
);
--> statement-breakpoint
CREATE TABLE "items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"farm_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"unit_id" uuid NOT NULL,
	"code" varchar(50) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"item_type" "item_type" NOT NULL,
	"tracking_mode" "tracking_mode" NOT NULL,
	"min_stock_level" numeric(18, 3) DEFAULT '0' NOT NULL,
	"maintenance_interval_days" integer,
	"barcode" varchar(255),
	"image_url" text,
	"source_url" text,
	"surveyed_at" timestamp with time zone,
	"status" "record_status" DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_item_code_per_farm" UNIQUE("code","farm_id"),
	CONSTRAINT "ck_item_maintenance_interval_positive" CHECK ((maintenance_interval_days IS NULL) OR (maintenance_interval_days > 0)),
	CONSTRAINT "ck_item_min_stock_nonnegative" CHECK (min_stock_level >= (0)::numeric)
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(50) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"status" "record_status" DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "categories_code_key" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "units" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(30) NOT NULL,
	"name" varchar(100) NOT NULL,
	"symbol" varchar(30),
	"status" "record_status" DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "units_code_key" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "stock_receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"farm_id" uuid NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"supplier_id" uuid,
	"receipt_code" varchar(50) NOT NULL,
	"receipt_date" date DEFAULT CURRENT_DATE NOT NULL,
	"status" "document_status" DEFAULT 'DRAFT' NOT NULL,
	"note" text,
	"created_by_member_id" uuid NOT NULL,
	"confirmed_by_member_id" uuid,
	"confirmed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_receipt_code_per_farm" UNIQUE("farm_id","receipt_code"),
	CONSTRAINT "ck_receipt_confirm_fields" CHECK ((status <> 'CONFIRMED'::document_status) OR ((confirmed_by_member_id IS NOT NULL) AND (confirmed_at IS NOT NULL)))
);
--> statement-breakpoint
CREATE TABLE "stock_receipt_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stock_receipt_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"quantity" numeric(18, 3) NOT NULL,
	"unit_price" numeric(18, 2) DEFAULT '0' NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_receipt_item_price_nonnegative" CHECK (unit_price >= (0)::numeric),
	CONSTRAINT "ck_receipt_item_quantity_positive" CHECK (quantity > (0)::numeric)
);
--> statement-breakpoint
CREATE TABLE "inventory_lots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"farm_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"source_receipt_item_id" uuid,
	"lot_number" varchar(100) NOT NULL,
	"manufactured_date" date,
	"expiry_date" date,
	"initial_quantity" numeric(18, 3) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_lot_per_item_farm" UNIQUE("farm_id","item_id","lot_number"),
	CONSTRAINT "ck_lot_expiry_after_manufacture" CHECK ((manufactured_date IS NULL) OR (expiry_date IS NULL) OR (expiry_date >= manufactured_date)),
	CONSTRAINT "ck_lot_initial_quantity_positive" CHECK (initial_quantity > (0)::numeric)
);
--> statement-breakpoint
CREATE TABLE "assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"farm_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"source_receipt_item_id" uuid,
	"current_location_id" uuid,
	"asset_code" varchar(100) NOT NULL,
	"serial_number" varchar(255),
	"qr_token" uuid DEFAULT gen_random_uuid() NOT NULL,
	"status" "asset_status" DEFAULT 'AVAILABLE' NOT NULL,
	"purchase_date" date,
	"purchase_price" numeric(18, 2),
	"warranty_expiry_date" date,
	"last_maintenance_date" date,
	"next_maintenance_date" date,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_asset_code_per_farm" UNIQUE("asset_code","farm_id"),
	CONSTRAINT "uq_asset_qr_token" UNIQUE("qr_token"),
	CONSTRAINT "ck_asset_next_maintenance_date" CHECK ((last_maintenance_date IS NULL) OR (next_maintenance_date IS NULL) OR (next_maintenance_date >= last_maintenance_date)),
	CONSTRAINT "ck_asset_purchase_price_nonnegative" CHECK ((purchase_price IS NULL) OR (purchase_price >= (0)::numeric))
);
--> statement-breakpoint
CREATE TABLE "inventory_balances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"farm_id" uuid NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"lot_id" uuid,
	"quantity_on_hand" numeric(18, 3) DEFAULT '0' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_inventory_balance" UNIQUE("item_id","lot_id","warehouse_id"),
	CONSTRAINT "ck_inventory_balance_nonnegative" CHECK (quantity_on_hand >= (0)::numeric)
);
--> statement-breakpoint
CREATE TABLE "stock_issues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"farm_id" uuid NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"issue_code" varchar(50) NOT NULL,
	"issue_date" date DEFAULT CURRENT_DATE NOT NULL,
	"issue_type" "issue_type" DEFAULT 'CONSUMPTION' NOT NULL,
	"status" "document_status" DEFAULT 'DRAFT' NOT NULL,
	"reason" text,
	"note" text,
	"created_by_member_id" uuid NOT NULL,
	"confirmed_by_member_id" uuid,
	"confirmed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_issue_code_per_farm" UNIQUE("farm_id","issue_code"),
	CONSTRAINT "ck_issue_confirm_fields" CHECK ((status <> 'CONFIRMED'::document_status) OR ((confirmed_by_member_id IS NOT NULL) AND (confirmed_at IS NOT NULL)))
);
--> statement-breakpoint
CREATE TABLE "stock_issue_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stock_issue_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"lot_id" uuid,
	"asset_id" uuid,
	"quantity" numeric(18, 3) NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_issue_asset_quantity" CHECK ((asset_id IS NULL) OR (quantity = (1)::numeric)),
	CONSTRAINT "ck_issue_item_quantity_positive" CHECK (quantity > (0)::numeric)
);
--> statement-breakpoint
CREATE TABLE "stock_transfers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"farm_id" uuid NOT NULL,
	"from_warehouse_id" uuid NOT NULL,
	"to_warehouse_id" uuid NOT NULL,
	"transfer_code" varchar(50) NOT NULL,
	"transfer_date" date DEFAULT CURRENT_DATE NOT NULL,
	"status" "document_status" DEFAULT 'DRAFT' NOT NULL,
	"note" text,
	"created_by_member_id" uuid NOT NULL,
	"confirmed_by_member_id" uuid,
	"confirmed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_transfer_code_per_farm" UNIQUE("farm_id","transfer_code"),
	CONSTRAINT "ck_transfer_confirm_fields" CHECK ((status <> 'CONFIRMED'::document_status) OR ((confirmed_by_member_id IS NOT NULL) AND (confirmed_at IS NOT NULL))),
	CONSTRAINT "ck_transfer_different_warehouses" CHECK (from_warehouse_id <> to_warehouse_id)
);
--> statement-breakpoint
CREATE TABLE "stock_transfer_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stock_transfer_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"lot_id" uuid,
	"asset_id" uuid,
	"quantity" numeric(18, 3) NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_transfer_asset_quantity" CHECK ((asset_id IS NULL) OR (quantity = (1)::numeric)),
	CONSTRAINT "ck_transfer_item_quantity_positive" CHECK (quantity > (0)::numeric)
);
--> statement-breakpoint
CREATE TABLE "stock_counts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"farm_id" uuid NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"count_code" varchar(50) NOT NULL,
	"count_date" date DEFAULT CURRENT_DATE NOT NULL,
	"status" "stock_count_status" DEFAULT 'DRAFT' NOT NULL,
	"created_by_member_id" uuid NOT NULL,
	"confirmed_by_member_id" uuid,
	"confirmed_at" timestamp with time zone,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_count_code_per_farm" UNIQUE("count_code","farm_id"),
	CONSTRAINT "ck_count_confirm_fields" CHECK ((status <> 'CONFIRMED'::stock_count_status) OR ((confirmed_by_member_id IS NOT NULL) AND (confirmed_at IS NOT NULL)))
);
--> statement-breakpoint
CREATE TABLE "stock_count_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stock_count_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"lot_id" uuid,
	"asset_id" uuid,
	"system_quantity" numeric(18, 3) DEFAULT '0' NOT NULL,
	"actual_quantity" numeric(18, 3) DEFAULT '0' NOT NULL,
	"difference" numeric(18, 3) GENERATED ALWAYS AS ((actual_quantity - system_quantity)) STORED,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_count_actual_quantity_nonnegative" CHECK (actual_quantity >= (0)::numeric),
	CONSTRAINT "ck_count_system_quantity_nonnegative" CHECK (system_quantity >= (0)::numeric)
);
--> statement-breakpoint
CREATE TABLE "asset_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"farm_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"assigned_to_member_id" uuid NOT NULL,
	"assigned_by_member_id" uuid NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expected_return_at" timestamp with time zone,
	"returned_at" timestamp with time zone,
	"status" "assignment_status" DEFAULT 'ACTIVE' NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_assignment_return_time" CHECK ((returned_at IS NULL) OR (returned_at >= assigned_at))
);
--> statement-breakpoint
CREATE TABLE "asset_incidents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"farm_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"reported_by_member_id" uuid NOT NULL,
	"incident_type" varchar(100),
	"description" text NOT NULL,
	"severity" "incident_severity" DEFAULT 'MEDIUM' NOT NULL,
	"status" "incident_status" DEFAULT 'OPEN' NOT NULL,
	"reported_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_incident_resolved_time" CHECK ((resolved_at IS NULL) OR (resolved_at >= reported_at))
);
--> statement-breakpoint
CREATE TABLE "maintenance_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"farm_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"incident_id" uuid,
	"maintenance_type" "maintenance_type" NOT NULL,
	"scheduled_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"status" "maintenance_status" DEFAULT 'SCHEDULED' NOT NULL,
	"description" text,
	"result_note" text,
	"performed_by_member_id" uuid,
	"supplier_id" uuid,
	"labor_cost" numeric(18, 2) DEFAULT '0' NOT NULL,
	"material_cost" numeric(18, 2) DEFAULT '0' NOT NULL,
	"other_cost" numeric(18, 2) DEFAULT '0' NOT NULL,
	"total_cost" numeric(18, 2) GENERATED ALWAYS AS (((labor_cost + material_cost) + other_cost)) STORED,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_maintenance_costs_nonnegative" CHECK ((labor_cost >= (0)::numeric) AND (material_cost >= (0)::numeric) AND (other_cost >= (0)::numeric)),
	CONSTRAINT "ck_maintenance_time_order" CHECK (((started_at IS NULL) OR (scheduled_at IS NULL) OR (started_at >= scheduled_at)) AND ((completed_at IS NULL) OR (started_at IS NULL) OR (completed_at >= started_at)))
);
--> statement-breakpoint
CREATE TABLE "inventory_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"farm_id" uuid NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"lot_id" uuid,
	"asset_id" uuid,
	"transaction_type" "inventory_transaction_type" NOT NULL,
	"quantity_change" numeric(18, 3) NOT NULL,
	"source_type" varchar(50) NOT NULL,
	"source_id" uuid NOT NULL,
	"movement_group_id" uuid,
	"performed_by_member_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_inventory_transaction_nonzero" CHECK (quantity_change <> (0)::numeric)
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"farm_id" uuid,
	"user_id" uuid,
	"action" varchar(100) NOT NULL,
	"entity_type" varchar(100) NOT NULL,
	"entity_id" uuid,
	"old_data" jsonb,
	"new_data" jsonb,
	"ip_address" "inet",
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "farm_member_roles" (
	"farm_member_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "farm_member_roles_pkey" PRIMARY KEY("farm_member_id","role_id")
);
--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_system_role_id_fkey" FOREIGN KEY ("system_role_id") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "farm_members" ADD CONSTRAINT "farm_members_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "public"."farms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "farm_members" ADD CONSTRAINT "farm_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "public"."farms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "public"."farms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "public"."farms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "public"."farms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_receipts" ADD CONSTRAINT "stock_receipts_confirmed_by_member_id_fkey" FOREIGN KEY ("confirmed_by_member_id") REFERENCES "public"."farm_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_receipts" ADD CONSTRAINT "stock_receipts_created_by_member_id_fkey" FOREIGN KEY ("created_by_member_id") REFERENCES "public"."farm_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_receipts" ADD CONSTRAINT "stock_receipts_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "public"."farms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_receipts" ADD CONSTRAINT "stock_receipts_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_receipts" ADD CONSTRAINT "stock_receipts_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_receipt_items" ADD CONSTRAINT "stock_receipt_items_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_receipt_items" ADD CONSTRAINT "stock_receipt_items_stock_receipt_id_fkey" FOREIGN KEY ("stock_receipt_id") REFERENCES "public"."stock_receipts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_lots" ADD CONSTRAINT "inventory_lots_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "public"."farms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_lots" ADD CONSTRAINT "inventory_lots_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_lots" ADD CONSTRAINT "inventory_lots_source_receipt_item_id_fkey" FOREIGN KEY ("source_receipt_item_id") REFERENCES "public"."stock_receipt_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_current_location_id_fkey" FOREIGN KEY ("current_location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "public"."farms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_source_receipt_item_id_fkey" FOREIGN KEY ("source_receipt_item_id") REFERENCES "public"."stock_receipt_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_balances" ADD CONSTRAINT "inventory_balances_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "public"."farms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_balances" ADD CONSTRAINT "inventory_balances_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_balances" ADD CONSTRAINT "inventory_balances_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "public"."inventory_lots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_balances" ADD CONSTRAINT "inventory_balances_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_issues" ADD CONSTRAINT "stock_issues_confirmed_by_member_id_fkey" FOREIGN KEY ("confirmed_by_member_id") REFERENCES "public"."farm_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_issues" ADD CONSTRAINT "stock_issues_created_by_member_id_fkey" FOREIGN KEY ("created_by_member_id") REFERENCES "public"."farm_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_issues" ADD CONSTRAINT "stock_issues_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "public"."farms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_issues" ADD CONSTRAINT "stock_issues_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_issue_items" ADD CONSTRAINT "stock_issue_items_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_issue_items" ADD CONSTRAINT "stock_issue_items_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_issue_items" ADD CONSTRAINT "stock_issue_items_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "public"."inventory_lots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_issue_items" ADD CONSTRAINT "stock_issue_items_stock_issue_id_fkey" FOREIGN KEY ("stock_issue_id") REFERENCES "public"."stock_issues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_confirmed_by_member_id_fkey" FOREIGN KEY ("confirmed_by_member_id") REFERENCES "public"."farm_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_created_by_member_id_fkey" FOREIGN KEY ("created_by_member_id") REFERENCES "public"."farm_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "public"."farms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_from_warehouse_id_fkey" FOREIGN KEY ("from_warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_to_warehouse_id_fkey" FOREIGN KEY ("to_warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transfer_items" ADD CONSTRAINT "stock_transfer_items_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transfer_items" ADD CONSTRAINT "stock_transfer_items_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transfer_items" ADD CONSTRAINT "stock_transfer_items_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "public"."inventory_lots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transfer_items" ADD CONSTRAINT "stock_transfer_items_stock_transfer_id_fkey" FOREIGN KEY ("stock_transfer_id") REFERENCES "public"."stock_transfers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_counts" ADD CONSTRAINT "stock_counts_confirmed_by_member_id_fkey" FOREIGN KEY ("confirmed_by_member_id") REFERENCES "public"."farm_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_counts" ADD CONSTRAINT "stock_counts_created_by_member_id_fkey" FOREIGN KEY ("created_by_member_id") REFERENCES "public"."farm_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_counts" ADD CONSTRAINT "stock_counts_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "public"."farms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_counts" ADD CONSTRAINT "stock_counts_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_count_items" ADD CONSTRAINT "stock_count_items_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_count_items" ADD CONSTRAINT "stock_count_items_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_count_items" ADD CONSTRAINT "stock_count_items_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "public"."inventory_lots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_count_items" ADD CONSTRAINT "stock_count_items_stock_count_id_fkey" FOREIGN KEY ("stock_count_id") REFERENCES "public"."stock_counts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_assignments" ADD CONSTRAINT "asset_assignments_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_assignments" ADD CONSTRAINT "asset_assignments_assigned_by_member_id_fkey" FOREIGN KEY ("assigned_by_member_id") REFERENCES "public"."farm_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_assignments" ADD CONSTRAINT "asset_assignments_assigned_to_member_id_fkey" FOREIGN KEY ("assigned_to_member_id") REFERENCES "public"."farm_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_assignments" ADD CONSTRAINT "asset_assignments_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "public"."farms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_incidents" ADD CONSTRAINT "asset_incidents_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_incidents" ADD CONSTRAINT "asset_incidents_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "public"."farms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_incidents" ADD CONSTRAINT "asset_incidents_reported_by_member_id_fkey" FOREIGN KEY ("reported_by_member_id") REFERENCES "public"."farm_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_records" ADD CONSTRAINT "maintenance_records_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_records" ADD CONSTRAINT "maintenance_records_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "public"."farms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_records" ADD CONSTRAINT "maintenance_records_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "public"."asset_incidents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_records" ADD CONSTRAINT "maintenance_records_performed_by_member_id_fkey" FOREIGN KEY ("performed_by_member_id") REFERENCES "public"."farm_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_records" ADD CONSTRAINT "maintenance_records_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "public"."farms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "public"."inventory_lots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_performed_by_member_id_fkey" FOREIGN KEY ("performed_by_member_id") REFERENCES "public"."farm_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "public"."farms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "farm_member_roles" ADD CONSTRAINT "farm_member_roles_farm_member_id_fkey" FOREIGN KEY ("farm_member_id") REFERENCES "public"."farm_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "farm_member_roles" ADD CONSTRAINT "farm_member_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ux_users_email_lower" ON "users" USING btree (lower((email)::text));--> statement-breakpoint
CREATE INDEX "idx_farm_members_user_id" ON "farm_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_suppliers_farm_id" ON "suppliers" USING btree ("farm_id");--> statement-breakpoint
CREATE INDEX "idx_warehouses_farm_id" ON "warehouses" USING btree ("farm_id");--> statement-breakpoint
CREATE INDEX "idx_locations_farm_id" ON "locations" USING btree ("farm_id");--> statement-breakpoint
CREATE INDEX "idx_locations_warehouse_id" ON "locations" USING btree ("warehouse_id");--> statement-breakpoint
CREATE INDEX "idx_items_category_id" ON "items" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "idx_items_farm_id" ON "items" USING btree ("farm_id");--> statement-breakpoint
CREATE INDEX "idx_items_name_lower" ON "items" USING btree (lower((name)::text));--> statement-breakpoint
CREATE UNIQUE INDEX "ux_item_barcode_per_farm" ON "items" USING btree ("farm_id","barcode") WHERE (barcode IS NOT NULL);--> statement-breakpoint
CREATE INDEX "idx_stock_receipts_farm_date" ON "stock_receipts" USING btree ("farm_id","receipt_date");--> statement-breakpoint
CREATE INDEX "idx_stock_receipts_status" ON "stock_receipts" USING btree ("farm_id","status");--> statement-breakpoint
CREATE INDEX "idx_inventory_lots_expiry_date" ON "inventory_lots" USING btree ("expiry_date") WHERE (expiry_date IS NOT NULL);--> statement-breakpoint
CREATE INDEX "idx_inventory_lots_item_id" ON "inventory_lots" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "idx_assets_farm_item" ON "assets" USING btree ("farm_id","item_id");--> statement-breakpoint
CREATE INDEX "idx_assets_next_maintenance" ON "assets" USING btree ("next_maintenance_date") WHERE (next_maintenance_date IS NOT NULL);--> statement-breakpoint
CREATE INDEX "idx_assets_status" ON "assets" USING btree ("farm_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "ux_asset_serial_per_farm" ON "assets" USING btree ("farm_id","serial_number") WHERE (serial_number IS NOT NULL);--> statement-breakpoint
CREATE INDEX "idx_inventory_balances_lookup" ON "inventory_balances" USING btree ("farm_id","warehouse_id","item_id");--> statement-breakpoint
CREATE INDEX "idx_stock_issues_farm_date" ON "stock_issues" USING btree ("farm_id","issue_date");--> statement-breakpoint
CREATE INDEX "idx_stock_issues_status" ON "stock_issues" USING btree ("farm_id","status");--> statement-breakpoint
CREATE INDEX "idx_stock_transfers_farm_date" ON "stock_transfers" USING btree ("farm_id","transfer_date");--> statement-breakpoint
CREATE INDEX "idx_stock_counts_farm_date" ON "stock_counts" USING btree ("farm_id","count_date");--> statement-breakpoint
CREATE INDEX "idx_asset_assignments_asset" ON "asset_assignments" USING btree ("asset_id","assigned_at");--> statement-breakpoint
CREATE UNIQUE INDEX "ux_one_active_assignment_per_asset" ON "asset_assignments" USING btree ("asset_id") WHERE (status = 'ACTIVE'::assignment_status);--> statement-breakpoint
CREATE INDEX "idx_asset_incidents_asset" ON "asset_incidents" USING btree ("asset_id","reported_at");--> statement-breakpoint
CREATE INDEX "idx_asset_incidents_status" ON "asset_incidents" USING btree ("farm_id","status");--> statement-breakpoint
CREATE INDEX "idx_maintenance_asset" ON "maintenance_records" USING btree ("asset_id","scheduled_at");--> statement-breakpoint
CREATE INDEX "idx_maintenance_status_schedule" ON "maintenance_records" USING btree ("farm_id","status","scheduled_at");--> statement-breakpoint
CREATE INDEX "idx_inventory_transactions_lookup" ON "inventory_transactions" USING btree ("farm_id","warehouse_id","item_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_inventory_transactions_movement_group" ON "inventory_transactions" USING btree ("movement_group_id") WHERE (movement_group_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "idx_inventory_transactions_source" ON "inventory_transactions" USING btree ("source_type","source_id");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_entity" ON "audit_logs" USING btree ("entity_type","entity_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_farm" ON "audit_logs" USING btree ("farm_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_farm_member_roles_role_id" ON "farm_member_roles" USING btree ("role_id");

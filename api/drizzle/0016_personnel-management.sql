CREATE TABLE "credential_action_limits" (
	"user_id" uuid NOT NULL,
	"action" varchar(50) NOT NULL,
	"window_started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"attempts" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "credential_action_limits_user_id_action_pk" PRIMARY KEY("user_id","action")
);
--> statement-breakpoint
CREATE TABLE "farm_member_warehouses" (
	"farm_member_id" uuid NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "farm_member_warehouses_farm_member_id_warehouse_id_pk" PRIMARY KEY("farm_member_id","warehouse_id")
);
--> statement-breakpoint
CREATE TABLE "personnel_account_provisions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"farm_id" uuid NOT NULL,
	"actor_user_id" uuid NOT NULL,
	"email" varchar(255) NOT NULL,
	"payload_hash" varchar(64) NOT NULL,
	"payload" jsonb NOT NULL,
	"clerk_user_id" varchar(255),
	"member_id" uuid,
	"status" varchar(30) DEFAULT 'PENDING' NOT NULL,
	"error_code" varchar(100),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "farm_members" ADD COLUMN "employee_code" varchar(50);--> statement-breakpoint
ALTER TABLE "farm_members" ADD COLUMN "job_title" varchar(100);--> statement-breakpoint
ALTER TABLE "farm_members" ADD COLUMN "phone" varchar(50);--> statement-breakpoint
ALTER TABLE "farm_members" ADD COLUMN "note" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "must_change_password" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "credential_action_limits" ADD CONSTRAINT "credential_action_limits_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "farm_member_warehouses" ADD CONSTRAINT "farm_member_warehouses_farm_member_id_farm_members_id_fk" FOREIGN KEY ("farm_member_id") REFERENCES "public"."farm_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "farm_member_warehouses" ADD CONSTRAINT "farm_member_warehouses_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personnel_account_provisions" ADD CONSTRAINT "personnel_account_provisions_farm_id_farms_id_fk" FOREIGN KEY ("farm_id") REFERENCES "public"."farms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personnel_account_provisions" ADD CONSTRAINT "personnel_account_provisions_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personnel_account_provisions" ADD CONSTRAINT "personnel_account_provisions_member_id_farm_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."farm_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_member_warehouses_warehouse" ON "farm_member_warehouses" USING btree ("warehouse_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ux_farm_member_employee_code" ON "farm_members" USING btree ("farm_id",lower("employee_code")) WHERE "farm_members"."employee_code" IS NOT NULL;
--> statement-breakpoint
CREATE FUNCTION validate_member_warehouse_scope() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE member_farm uuid; warehouse_farm uuid;
BEGIN
  SELECT farm_id INTO member_farm FROM farm_members WHERE id = NEW.farm_member_id FOR SHARE;
  SELECT farm_id INTO warehouse_farm FROM warehouses WHERE id = NEW.warehouse_id FOR SHARE;
  IF member_farm IS NULL OR warehouse_farm IS NULL OR member_farm <> warehouse_farm THEN
    RAISE EXCEPTION 'Member and workplace must belong to the same farm' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER member_warehouse_scope BEFORE INSERT OR UPDATE ON farm_member_warehouses
FOR EACH ROW EXECUTE FUNCTION validate_member_warehouse_scope();
--> statement-breakpoint
CREATE FUNCTION preserve_member_warehouse_scope() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME = 'farm_members' THEN
    IF EXISTS (SELECT 1 FROM farm_member_warehouses mw JOIN warehouses w ON w.id = mw.warehouse_id WHERE mw.farm_member_id = NEW.id AND w.farm_id <> NEW.farm_id) THEN
      RAISE EXCEPTION 'Cannot move a member with assigned workplaces to another farm' USING ERRCODE = '23514';
    END IF;
  ELSE
    IF EXISTS (SELECT 1 FROM farm_member_warehouses mw JOIN farm_members m ON m.id = mw.farm_member_id WHERE mw.warehouse_id = NEW.id AND m.farm_id <> NEW.farm_id) THEN
      RAISE EXCEPTION 'Cannot move an assigned workplace to another farm' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER member_workplace_farm BEFORE UPDATE OF farm_id ON farm_members FOR EACH ROW EXECUTE FUNCTION preserve_member_warehouse_scope();
--> statement-breakpoint
CREATE TRIGGER workplace_member_farm BEFORE UPDATE OF farm_id ON warehouses FOR EACH ROW EXECUTE FUNCTION preserve_member_warehouse_scope();

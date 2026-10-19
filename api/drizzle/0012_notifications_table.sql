CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"farm_id" uuid,
	"type" varchar(80) NOT NULL,
	"title" varchar(200) NOT NULL,
	"body" text NOT NULL,
	"data" jsonb,
	"entity_type" varchar(100),
	"entity_id" uuid,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "public"."farms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_notifications_user_created_at" ON "notifications" USING btree ("user_id","created_at" DESC NULLS FIRST);--> statement-breakpoint
CREATE INDEX "idx_notifications_user_unread_created_at" ON "notifications" USING btree ("user_id","created_at" DESC NULLS FIRST) WHERE read_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_notifications_farm_created_at" ON "notifications" USING btree ("farm_id","created_at" DESC NULLS FIRST);
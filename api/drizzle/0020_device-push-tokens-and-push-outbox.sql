CREATE TABLE "device_push_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"installation_id" uuid NOT NULL,
	"expo_push_token" text NOT NULL,
	"platform" varchar(10) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_device_push_tokens_installation_id" UNIQUE("installation_id"),
	CONSTRAINT "uq_device_push_tokens_expo_push_token" UNIQUE("expo_push_token"),
	CONSTRAINT "ck_device_push_tokens_platform" CHECK ("device_push_tokens"."platform" IN ('ANDROID', 'IOS')),
	CONSTRAINT "ck_device_push_tokens_token_nonempty" CHECK (length(btrim("device_push_tokens"."expo_push_token")) > 0)
);
--> statement-breakpoint
CREATE TABLE "notification_push_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"notification_id" uuid NOT NULL,
	"device_push_token_id" uuid NOT NULL,
	"status" varchar(24) DEFAULT 'PENDING' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_at" timestamp with time zone,
	"lock_id" uuid,
	"expo_ticket_id" varchar(255),
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_notification_push_outbox_notification_device" UNIQUE("notification_id","device_push_token_id"),
	CONSTRAINT "ck_notification_push_outbox_status" CHECK ("notification_push_outbox"."status" IN ('PENDING', 'PROCESSING', 'AWAITING_RECEIPT', 'SUCCEEDED', 'FAILED', 'CANCELLED')),
	CONSTRAINT "ck_notification_push_outbox_attempt_count" CHECK ("notification_push_outbox"."attempt_count" >= 0),
	CONSTRAINT "ck_notification_push_outbox_lock_pair" CHECK (("notification_push_outbox"."locked_at" IS NULL AND "notification_push_outbox"."lock_id" IS NULL) OR ("notification_push_outbox"."locked_at" IS NOT NULL AND "notification_push_outbox"."lock_id" IS NOT NULL)),
	CONSTRAINT "ck_notification_push_outbox_processing_lock" CHECK ("notification_push_outbox"."status" <> 'PROCESSING' OR "notification_push_outbox"."lock_id" IS NOT NULL),
	CONSTRAINT "ck_notification_push_outbox_receipt_ticket" CHECK ("notification_push_outbox"."status" NOT IN ('AWAITING_RECEIPT', 'SUCCEEDED') OR ("notification_push_outbox"."expo_ticket_id" IS NOT NULL AND length(btrim("notification_push_outbox"."expo_ticket_id")) > 0))
);
--> statement-breakpoint
ALTER TABLE "device_push_tokens" ADD CONSTRAINT "device_push_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_push_outbox" ADD CONSTRAINT "notification_push_outbox_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "public"."notifications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_push_outbox" ADD CONSTRAINT "notification_push_outbox_device_push_token_id_fkey" FOREIGN KEY ("device_push_token_id") REFERENCES "public"."device_push_tokens"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_device_push_tokens_user_active" ON "device_push_tokens" USING btree ("user_id") WHERE "device_push_tokens"."is_active" = true;--> statement-breakpoint
CREATE INDEX "idx_device_push_tokens_user_id" ON "device_push_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_notification_push_outbox_pending" ON "notification_push_outbox" USING btree ("status","next_attempt_at") WHERE "notification_push_outbox"."status" IN ('PENDING', 'AWAITING_RECEIPT');--> statement-breakpoint
CREATE INDEX "idx_notification_push_outbox_processing_lock" ON "notification_push_outbox" USING btree ("locked_at") WHERE "notification_push_outbox"."status" = 'PROCESSING';--> statement-breakpoint
CREATE INDEX "idx_notification_push_outbox_device_push_token_id" ON "notification_push_outbox" USING btree ("device_push_token_id");
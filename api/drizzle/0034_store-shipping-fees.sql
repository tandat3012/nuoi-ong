CREATE TABLE "store_shipping_fees" (
	"region" "store_region" PRIMARY KEY NOT NULL,
	"fee" numeric(18, 0) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_store_shipping_fees_fee" CHECK ("store_shipping_fees"."fee" >= 0 AND "store_shipping_fees"."fee" <= 9007199254740991)
);
--> statement-breakpoint
ALTER TABLE "store_shipping_fees" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
INSERT INTO "store_shipping_fees" ("region", "fee") VALUES ('NORTH', 40000), ('CENTRAL', 20000), ('SOUTH', 30000);
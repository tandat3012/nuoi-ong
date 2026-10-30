CREATE TYPE "public"."stock_document_prefix" AS ENUM('PN', 'PX', 'KK', 'CK');--> statement-breakpoint
CREATE TABLE "stock_document_counters" (
	"farm_id" uuid NOT NULL,
	"prefix" "stock_document_prefix" NOT NULL,
	"year" integer NOT NULL,
	"last_value" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stock_document_counters_pkey" PRIMARY KEY("farm_id","prefix","year"),
	CONSTRAINT "ck_stock_document_counter_nonnegative" CHECK (last_value >= 0)
);
--> statement-breakpoint
ALTER TABLE "stock_counts" DROP CONSTRAINT "uq_count_code_per_farm";--> statement-breakpoint
ALTER TABLE "stock_issues" DROP CONSTRAINT "uq_issue_code_per_farm";--> statement-breakpoint
ALTER TABLE "stock_receipts" DROP CONSTRAINT "uq_receipt_code_per_farm";--> statement-breakpoint
ALTER TABLE "stock_transfers" DROP CONSTRAINT "uq_transfer_code_per_farm";--> statement-breakpoint
ALTER TABLE "stock_counts" ALTER COLUMN "count_code" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "stock_issues" ALTER COLUMN "issue_code" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "stock_receipts" ALTER COLUMN "receipt_code" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "stock_transfers" ALTER COLUMN "transfer_code" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "stock_document_counters" ADD CONSTRAINT "stock_document_counters_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "public"."farms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_count_code_per_farm" ON "stock_counts" USING btree ("farm_id",upper(btrim("count_code")));--> statement-breakpoint
CREATE UNIQUE INDEX "uq_issue_code_per_farm" ON "stock_issues" USING btree ("farm_id",upper(btrim("issue_code")));--> statement-breakpoint
CREATE UNIQUE INDEX "uq_receipt_code_per_farm" ON "stock_receipts" USING btree ("farm_id",upper(btrim("receipt_code")));--> statement-breakpoint
CREATE UNIQUE INDEX "uq_transfer_code_per_farm" ON "stock_transfers" USING btree ("farm_id",upper(btrim("transfer_code")));--> statement-breakpoint
ALTER TABLE "stock_counts" ADD CONSTRAINT "ck_count_confirmed_code" CHECK ((status <> 'CONFIRMED'::stock_count_status) OR ((count_code IS NOT NULL) AND (btrim(count_code) <> '')));--> statement-breakpoint
ALTER TABLE "stock_issues" ADD CONSTRAINT "ck_issue_confirmed_code" CHECK ((status <> 'CONFIRMED'::document_status) OR ((issue_code IS NOT NULL) AND (btrim(issue_code) <> '')));--> statement-breakpoint
ALTER TABLE "stock_receipts" ADD CONSTRAINT "ck_receipt_confirmed_code" CHECK ((status <> 'CONFIRMED'::document_status) OR ((receipt_code IS NOT NULL) AND (btrim(receipt_code) <> '')));--> statement-breakpoint
ALTER TABLE "stock_transfers" ADD CONSTRAINT "ck_transfer_confirmed_code" CHECK ((status <> 'CONFIRMED'::document_status) OR ((transfer_code IS NOT NULL) AND (btrim(transfer_code) <> '')));--> statement-breakpoint
-- Seed counters from existing canonical codes (PREFIX-YYYY-NNNNNN+) of every status.
-- A suffix above integer range fails the migration on purpose so it gets reviewed.
INSERT INTO "stock_document_counters" ("farm_id", "prefix", "year", "last_value")
SELECT "farm_id", "prefix"::"stock_document_prefix", substring("code" from 4 for 4)::integer, max(substring("code" from 9)::bigint)::integer
FROM (
	SELECT "farm_id", 'PN' AS "prefix", upper(btrim("receipt_code")) AS "code" FROM "stock_receipts"
	UNION ALL SELECT "farm_id", 'PX', upper(btrim("issue_code")) FROM "stock_issues"
	UNION ALL SELECT "farm_id", 'KK', upper(btrim("count_code")) FROM "stock_counts"
	UNION ALL SELECT "farm_id", 'CK', upper(btrim("transfer_code")) FROM "stock_transfers"
) AS "codes"
WHERE "code" ~ ('^' || "prefix" || '-[0-9]{4}-[0-9]{6,}$')
GROUP BY 1, 2, 3;

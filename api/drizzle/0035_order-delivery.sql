ALTER TABLE "store_orders" ADD COLUMN "shipper_member_id" uuid;--> statement-breakpoint
ALTER TABLE "store_orders" ADD CONSTRAINT "store_orders_shipper_member_id_farm_members_id_fk" FOREIGN KEY ("shipper_member_id") REFERENCES "public"."farm_members"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
-- Orders already out for delivery were shipped by whoever last handled them.
UPDATE "store_orders" SET "shipper_member_id" = "handled_by_member_id" WHERE "status" = 'SHIPPING';--> statement-breakpoint
ALTER TABLE "store_orders" ADD CONSTRAINT "ck_store_orders_shipper" CHECK ("store_orders"."status" <> 'SHIPPING' OR "store_orders"."shipper_member_id" IS NOT NULL);--> statement-breakpoint
INSERT INTO roles(code,name,description,scope) VALUES ('DELIVERY_STAFF','Nhân viên giao hàng','Nhận đơn đã xác nhận, giao cho khách và báo giao xong hoặc trả đơn.','FARM') ON CONFLICT (code) DO NOTHING;

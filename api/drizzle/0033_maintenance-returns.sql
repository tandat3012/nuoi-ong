ALTER TABLE maintenance_records
 ADD COLUMN expected_return_at timestamptz,
 ADD COLUMN received_at timestamptz,
 ADD COLUMN received_by_member_id uuid REFERENCES farm_members(id),
 ADD COLUMN inspected_by_member_id uuid REFERENCES farm_members(id),
 ADD COLUMN interval_months integer CONSTRAINT ck_maintenance_interval CHECK (interval_months BETWEEN 1 AND 120),
 ADD COLUMN next_due_date date,
 ADD COLUMN return_status document_status,
 ADD COLUMN return_warehouse_id uuid REFERENCES warehouses(id),
 ADD COLUMN return_location_id uuid REFERENCES locations(id),
 ADD COLUMN return_created_by_member_id uuid REFERENCES farm_members(id),
 ADD COLUMN return_reviewed_by_member_id uuid REFERENCES farm_members(id),
 ADD COLUMN return_reviewed_at timestamptz,
 ADD COLUMN return_rejection_reason text;
--> statement-breakpoint
ALTER TABLE maintenance_records DROP CONSTRAINT ck_maintenance_status_fields;
--> statement-breakpoint
ALTER TABLE maintenance_records ADD CONSTRAINT ck_maintenance_status_fields CHECK (
 (status = 'SCHEDULED' AND started_at IS NULL AND completed_at IS NULL) OR
 (status::text IN ('IN_PROGRESS','RECEIVED') AND started_at IS NOT NULL AND completed_at IS NULL) OR
 (status::text IN ('COMPLETED','FAILED') AND started_at IS NOT NULL AND completed_at IS NOT NULL) OR
 (status = 'CANCELLED' AND completed_at IS NULL));
--> statement-breakpoint
ALTER TABLE maintenance_records ADD CONSTRAINT ck_maintenance_return CHECK (
 (received_at IS NULL OR (started_at IS NOT NULL AND received_at >= started_at)) AND
 (status::text <> 'RECEIVED' OR received_at IS NOT NULL) AND
 (return_status IS NULL OR (status::text IN ('COMPLETED','FAILED') AND received_at IS NOT NULL AND return_warehouse_id IS NOT NULL AND return_location_id IS NOT NULL AND return_created_by_member_id IS NOT NULL)));
--> statement-breakpoint
DROP INDEX ux_one_active_maintenance_per_asset;
--> statement-breakpoint
CREATE UNIQUE INDEX ux_one_active_maintenance_per_asset ON maintenance_records(asset_id)
 WHERE (completed_at IS NULL AND status <> 'CANCELLED') OR (received_at IS NOT NULL AND return_status IS DISTINCT FROM 'CONFIRMED');
--> statement-breakpoint
INSERT INTO roles(code,name,description,scope) VALUES ('MAINTENANCE_STAFF','Nhân viên bảo trì','Gửi, nhận và nghiệm thu bảo trì, lập phiếu nhập lại kho.','FARM') ON CONFLICT (code) DO NOTHING;
--> statement-breakpoint
CREATE UNIQUE INDEX ux_maintenance_notification_milestone ON notifications(user_id,entity_type,entity_id,type,(data->>'milestone')) WHERE entity_type IN ('MAINTENANCE_RECORD','MAINTENANCE_ASSET');
--> statement-breakpoint
ALTER TABLE maintenance_records DROP CONSTRAINT ck_maintenance_time_order;
--> statement-breakpoint
ALTER TABLE maintenance_records ADD CONSTRAINT ck_maintenance_time_order CHECK (completed_at IS NULL OR started_at IS NULL OR completed_at >= started_at);

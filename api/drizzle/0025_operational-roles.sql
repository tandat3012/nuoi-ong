-- Operational farm roles. Existing memberships are not changed: owners assign these explicitly.
INSERT INTO "roles" ("code", "name", "description", "scope") VALUES
  ('WAREHOUSE_MANAGER', 'Quản lý kho', 'Quản lý và duyệt nghiệp vụ kho trong trại.', 'FARM'),
  ('STORE_MANAGER', 'Quản lý cửa hàng', 'Quản lý sản phẩm, giá bán, đơn hàng và doanh thu cửa hàng.', 'FARM')
ON CONFLICT ("code") DO NOTHING;

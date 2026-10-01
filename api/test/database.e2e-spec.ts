import 'dotenv/config';

import { Pool, type PoolClient } from 'pg';

describe('PostgreSQL schema, constraints, functions and triggers', () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  let client: PoolClient;

  const ids = {
    farmA: '11111111-1111-4111-8111-111111111111',
    farmB: '22222222-2222-4222-8222-222222222222',
    userA: '33333333-3333-4333-8333-333333333333',
    userB: '44444444-4444-4444-8444-444444444444',
    memberA: '55555555-5555-4555-8555-555555555555',
    memberB: '66666666-6666-4666-8666-666666666666',
    roleA: '77777777-7777-4777-8777-777777777777',
    roleB: '88888888-8888-4888-8888-888888888888',
    category: '99999999-9999-4999-8999-999999999999',
    unit: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    assetItem: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    materialItem: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    locationA: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    locationB: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    asset: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
    supplierB: '12121212-1212-4121-8121-121212121212',
    warehouseA: '16161616-1616-4161-8161-161616161616',
    assignment: '17171717-1717-4171-8171-171717171717',
    assignmentB: '18181818-1818-4181-8181-181818181818',
    incident: '19191919-1919-4191-8191-191919191919',
    maintenance: '20202020-2020-4202-8202-202020202020',
    lot: '21212121-2121-4212-8212-212121212121',
    balance: '23232323-2323-4232-8232-232323232323',
    transaction: '24242424-2424-4242-8242-242424242424',
  };

  async function expectDatabaseError(
    text: string,
    values: unknown[],
    message?: string,
  ): Promise<void> {
    await client.query('SAVEPOINT db_test_failure');
    let error: { code?: string; message?: string } | undefined;

    try {
      await client.query(text, values);
    } catch (caught: unknown) {
      error = caught as { code?: string; message?: string };
    }

    await client.query('ROLLBACK TO SAVEPOINT db_test_failure');
    await client.query('RELEASE SAVEPOINT db_test_failure');

    expect(error).toBeDefined();
    if (message) {
      expect(error?.message).toContain(message);
    }
  }

  beforeAll(async () => {
    client = await pool.connect();
    await client.query("SELECT to_regclass('public.users')");
  });

  beforeEach(async () => {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO roles (id, code, name, scope)
       VALUES ($1, 'DB_TEST_ADMIN', 'DB test admin', 'SYSTEM'),
              ($2, 'DB_TEST_MEMBER', 'DB test member', 'FARM')`,
      [ids.roleA, ids.roleB],
    );
    await client.query(
      `INSERT INTO users (id, auth_provider, auth_provider_user_id, email)
       VALUES ($1, 'DB_TEST', 'db-test-user-a', 'db-test-a@example.local'),
              ($2, 'DB_TEST', 'db-test-user-b', 'db-test-b@example.local')`,
      [ids.userA, ids.userB],
    );
    await client.query(
      `INSERT INTO farms (id, code, name)
       VALUES ($1, 'DB-TEST-FARM-A', 'DB test farm A'),
              ($2, 'DB-TEST-FARM-B', 'DB test farm B')`,
      [ids.farmA, ids.farmB],
    );
    await client.query(
      `INSERT INTO farm_members (id, farm_id, user_id)
       VALUES ($1, $3, $5), ($2, $4, $6)`,
      [ids.memberA, ids.memberB, ids.farmA, ids.farmB, ids.userA, ids.userB],
    );
    await client.query(
      `INSERT INTO farm_member_roles (farm_member_id, role_id)
       VALUES ($1, $3), ($2, $4)`,
      [ids.memberA, ids.memberB, ids.roleA, ids.roleB],
    );
    await client.query(
      `INSERT INTO categories (id, code, name)
       VALUES ($1, 'DB-TEST-CATEGORY', 'DB test category')`,
      [ids.category],
    );
    await client.query(
      `INSERT INTO units (id, code, name, symbol)
       VALUES ($1, 'DB-TEST-UNIT', 'DB test unit', 'u')`,
      [ids.unit],
    );
    await client.query(
      `INSERT INTO items
        (id, farm_id, category_id, unit_id, code, name, item_type, tracking_mode)
       VALUES ($1, $3, $4, $5, 'DB-TEST-ASSET', 'DB test asset item', 'EQUIPMENT', 'ASSET'),
              ($2, $3, $4, $5, 'DB-TEST-MATERIAL', 'DB test material item', 'MATERIAL', 'LOT')`,
      [ids.assetItem, ids.materialItem, ids.farmA, ids.category, ids.unit],
    );
    await client.query(
      `INSERT INTO material_profiles
        (farm_id, item_id, kind, requires_expiry_tracking)
       VALUES ($1, $2, 'FEED', true)`,
      [ids.farmA, ids.materialItem],
    );
    await client.query(
      `INSERT INTO locations (id, farm_id, code, name, type)
       VALUES ($1, $3, 'DB-TEST-LOC-A', 'DB test location A', 'WAREHOUSE'),
              ($2, $4, 'DB-TEST-LOC-B', 'DB test location B', 'WAREHOUSE')`,
      [ids.locationA, ids.locationB, ids.farmA, ids.farmB],
    );
    await client.query(
      `INSERT INTO warehouses (id, farm_id, code, name)
       VALUES ($1, $2, 'DB-TEST-WAREHOUSE-A', 'DB test warehouse A')`,
      [ids.warehouseA, ids.farmA],
    );
    await client.query(
      `INSERT INTO assets
        (id, farm_id, item_id, current_location_id, asset_code, serial_number)
       VALUES ($1, $2, $3, $4, 'DB-TEST-ASSET-001', 'DB-TEST-SERIAL-001')`,
      [ids.asset, ids.farmA, ids.assetItem, ids.locationA],
    );
    await client.query(
      `INSERT INTO suppliers (id, farm_id, code, name)
       VALUES ($1, $2, 'DB-TEST-SUPPLIER-B', 'DB test supplier B')`,
      [ids.supplierB, ids.farmB],
    );
  });

  afterEach(async () => {
    await client.query('ROLLBACK');
  });

  afterAll(async () => {
    client.release();
    await pool.end();
  });

  it('has the expected functions and triggers installed', async () => {
    const functions = await client.query<{ proname: string }>(
      `SELECT p.proname
       FROM pg_proc p
       JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public'
         AND p.proname IN (
           'validate_asset_scope',
           'validate_asset_assignment_scope',
           'validate_asset_incident_scope',
           'validate_maintenance_scope',
           'validate_material_profile_scope',
           'protect_item_material_profile',
           'set_material_profile_updated_at'
         )
       ORDER BY p.proname`,
    );
    const triggers = await client.query<{ trigger_name: string }>(
      `SELECT DISTINCT trigger_name
       FROM information_schema.triggers
       WHERE trigger_schema = 'public'
         AND trigger_name LIKE 'trg_%'
       ORDER BY trigger_name`,
    );

    expect(functions.rows.map((row) => row.proname)).toEqual([
      'protect_item_material_profile',
      'set_material_profile_updated_at',
      'validate_asset_assignment_scope',
      'validate_asset_incident_scope',
      'validate_asset_scope',
      'validate_maintenance_scope',
      'validate_material_profile_scope',
    ]);
    expect(triggers.rows.map((row) => row.trigger_name)).toEqual([
      'trg_material_profiles_updated_at',
      'trg_protect_item_material_profile',
      'trg_validate_asset_assignment_scope',
      'trg_validate_asset_incident_scope',
      'trg_validate_asset_scope',
      'trg_validate_maintenance_scope',
      'trg_validate_material_profile_scope',
    ]);
  });

  it('enforces item uniqueness and nonnegative constraints', async () => {
    await expectDatabaseError(
      `INSERT INTO items (farm_id, category_id, unit_id, code, name, item_type, tracking_mode)
       VALUES ($1, $2, $3, 'DB-TEST-ASSET', 'duplicate', 'EQUIPMENT', 'ASSET')`,
      [ids.farmA, ids.category, ids.unit],
    );
    await expectDatabaseError(
      `INSERT INTO items (farm_id, category_id, unit_id, code, name, item_type, tracking_mode, min_stock_level)
       VALUES ($1, $2, $3, 'DB-TEST-NEGATIVE', 'negative', 'MATERIAL', 'QUANTITY', -1)`,
      [ids.farmA, ids.category, ids.unit],
    );
  });

  it('supports a material item CRUD lifecycle at database level', async () => {
    const itemId = '13131313-1313-4131-8131-131313131313';

    await client.query(
      `INSERT INTO items
        (id, farm_id, category_id, unit_id, code, name, item_type, tracking_mode)
       VALUES ($1, $2, $3, $4, 'DB-CRUD-MATERIAL', 'CRUD material', 'MATERIAL', 'QUANTITY')`,
      [itemId, ids.farmA, ids.category, ids.unit],
    );
    await client.query(
      `INSERT INTO material_profiles (farm_id, item_id, kind)
       VALUES ($1, $2, 'CONSUMABLE')`,
      [ids.farmA, itemId],
    );

    const created = await client.query<{ name: string }>(
      `SELECT name FROM items WHERE id = $1`,
      [itemId],
    );
    expect(created.rows[0].name).toBe('CRUD material');

    await client.query(
      `UPDATE items SET name = 'CRUD material updated' WHERE id = $1`,
      [itemId],
    );
    const updated = await client.query<{ name: string }>(
      `SELECT name FROM items WHERE id = $1`,
      [itemId],
    );
    expect(updated.rows[0].name).toBe('CRUD material updated');

    await client.query(`DELETE FROM material_profiles WHERE item_id = $1`, [
      itemId,
    ]);
    await client.query(`DELETE FROM items WHERE id = $1`, [itemId]);
    const deleted = await client.query<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM items WHERE id = $1`,
      [itemId],
    );
    expect(deleted.rows[0].count).toBe(0);
  });

  it('supports an asset CRUD lifecycle at database level', async () => {
    const itemId = '14141414-1414-4141-8141-141414141414';
    const assetId = '15151515-1515-4151-8151-151515151515';

    await client.query(
      `INSERT INTO items
        (id, farm_id, category_id, unit_id, code, name, item_type, tracking_mode)
       VALUES ($1, $2, $3, $4, 'DB-CRUD-ASSET', 'CRUD asset item', 'EQUIPMENT', 'ASSET')`,
      [itemId, ids.farmA, ids.category, ids.unit],
    );
    await client.query(
      `INSERT INTO assets
        (id, farm_id, item_id, current_location_id, asset_code, serial_number)
       VALUES ($1, $2, $3, $4, 'DB-CRUD-ASSET-001', 'DB-CRUD-SERIAL-001')`,
      [assetId, ids.farmA, itemId, ids.locationA],
    );

    const created = await client.query<{ status: string }>(
      `SELECT status FROM assets WHERE id = $1`,
      [assetId],
    );
    expect(created.rows[0].status).toBe('AVAILABLE');

    await client.query(
      `UPDATE assets SET status = 'MAINTENANCE' WHERE id = $1`,
      [assetId],
    );
    const updated = await client.query<{ status: string }>(
      `SELECT status FROM assets WHERE id = $1`,
      [assetId],
    );
    expect(updated.rows[0].status).toBe('MAINTENANCE');

    await client.query(`DELETE FROM assets WHERE id = $1`, [assetId]);
    await client.query(`DELETE FROM items WHERE id = $1`, [itemId]);
    const deleted = await client.query<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM assets WHERE id = $1`,
      [assetId],
    );
    expect(deleted.rows[0].count).toBe(0);
  });

  it('enforces asset assignment, incident, and maintenance state rules', async () => {
    await client.query(
      `INSERT INTO asset_assignments
        (id, farm_id, asset_id, assigned_to_member_id, assigned_by_member_id)
       VALUES ($1, $2, $3, $4, $4)`,
      [ids.assignment, ids.farmA, ids.asset, ids.memberA],
    );

    await expectDatabaseError(
      `INSERT INTO asset_assignments
        (id, farm_id, asset_id, assigned_to_member_id, assigned_by_member_id)
       VALUES ($1, $2, $3, $4, $4)`,
      [ids.assignmentB, ids.farmA, ids.asset, ids.memberA],
    );
    await expectDatabaseError(
      `UPDATE asset_assignments
       SET status = 'RETURNED'
       WHERE id = $1`,
      [ids.assignment],
    );

    await client.query(
      `UPDATE asset_assignments
       SET status = 'RETURNED', returned_at = assigned_at + INTERVAL '1 hour'
       WHERE id = $1`,
      [ids.assignment],
    );
    await client.query(
      `INSERT INTO asset_incidents
        (id, farm_id, asset_id, reported_by_member_id, description)
       VALUES ($1, $2, $3, $4, 'DB test incident')`,
      [ids.incident, ids.farmA, ids.asset, ids.memberA],
    );
    await expectDatabaseError(
      `UPDATE asset_incidents SET status = 'RESOLVED' WHERE id = $1`,
      [ids.incident],
    );

    await client.query(
      `INSERT INTO maintenance_records
        (id, farm_id, asset_id, maintenance_type, status, description)
       VALUES ($1, $2, $3, 'PREVENTIVE', 'SCHEDULED', 'DB test maintenance')`,
      [ids.maintenance, ids.farmA, ids.asset],
    );
    await expectDatabaseError(
      `INSERT INTO maintenance_records
        (farm_id, asset_id, maintenance_type, status)
       VALUES ($1, $2, 'CORRECTIVE', 'IN_PROGRESS')`,
      [ids.farmA, ids.asset],
    );
  });

  it('enforces lot, inventory balance, and transaction quantity rules', async () => {
    await client.query(
      `INSERT INTO inventory_lots
        (id, farm_id, item_id, lot_number, initial_quantity)
       VALUES ($1, $2, $3, 'DB-TEST-LOT-001', 20)`,
      [ids.lot, ids.farmA, ids.materialItem],
    );
    await expectDatabaseError(
      `INSERT INTO inventory_lots
        (farm_id, item_id, lot_number, manufactured_date, expiry_date, initial_quantity)
       VALUES ($1, $2, 'DB-TEST-LOT-BAD-DATE', DATE '2026-12-31', DATE '2026-01-01', 5)`,
      [ids.farmA, ids.materialItem],
    );
    await expectDatabaseError(
      `INSERT INTO inventory_lots
        (farm_id, item_id, lot_number, initial_quantity)
       VALUES ($1, $2, 'DB-TEST-LOT-ZERO', 0)`,
      [ids.farmA, ids.materialItem],
    );

    await client.query(
      `INSERT INTO inventory_balances
        (id, farm_id, warehouse_id, item_id, lot_id, quantity_on_hand)
       VALUES ($1, $2, $3, $4, $5, 10)`,
      [ids.balance, ids.farmA, ids.warehouseA, ids.materialItem, ids.lot],
    );
    await expectDatabaseError(
      `UPDATE inventory_balances SET quantity_on_hand = -1 WHERE id = $1`,
      [ids.balance],
    );
    await expectDatabaseError(
      `INSERT INTO inventory_transactions
        (id, farm_id, warehouse_id, item_id, transaction_type, quantity_change, source_type, source_id)
       VALUES ($1, $2, $3, $4, 'ISSUE', 0, 'DB_TEST', $5)`,
      [ids.transaction, ids.farmA, ids.warehouseA, ids.materialItem, ids.lot],
    );
  });

  it('rejects material profiles with an invalid farm, item type, or expiry mode', async () => {
    await expectDatabaseError(
      `INSERT INTO material_profiles (farm_id, item_id, kind, requires_expiry_tracking)
       VALUES ($1, $2, 'FEED', true)`,
      [ids.farmB, ids.materialItem],
      'material profile and item must belong to the same farm',
    );
    await expectDatabaseError(
      `INSERT INTO material_profiles (farm_id, item_id, kind)
       VALUES ($1, $2, 'FEED')`,
      [ids.farmA, ids.assetItem],
      'material profile must reference a MATERIAL item',
    );
    await client.query(
      `INSERT INTO items (farm_id, category_id, unit_id, code, name, item_type, tracking_mode)
       VALUES ($1, $2, $3, 'DB-TEST-QUANTITY-MATERIAL', 'quantity material', 'MATERIAL', 'QUANTITY')`,
      [ids.farmA, ids.category, ids.unit],
    );
    await expectDatabaseError(
      `INSERT INTO material_profiles (farm_id, item_id, kind, requires_expiry_tracking)
       SELECT $1, id, 'FEED', true FROM items WHERE code = 'DB-TEST-QUANTITY-MATERIAL'`,
      [ids.farmA],
      'expiry-tracked material must use LOT tracking mode',
    );
  });

  it('protects an expiry-tracked material when its item changes', async () => {
    await expectDatabaseError(
      `UPDATE items SET tracking_mode = 'QUANTITY' WHERE id = $1`,
      [ids.materialItem],
      'expiry-tracked material must keep LOT tracking mode',
    );
    await expectDatabaseError(
      `UPDATE items SET item_type = 'EQUIPMENT' WHERE id = $1`,
      [ids.materialItem],
      'item with a material profile must keep MATERIAL item type',
    );
  });

  it('updates material profile timestamps through its trigger', async () => {
    const result = await client.query<{ updated: boolean }>(
      `UPDATE material_profiles
       SET safety_notes = 'updated by db test', updated_at = '2000-01-01'
       WHERE item_id = $1
       RETURNING updated_at > TIMESTAMPTZ '2000-01-01' AS updated`,
      [ids.materialItem],
    );

    expect(result.rows[0].updated).toBe(true);
  });

  it('enforces asset farm, item tracking, and location scope', async () => {
    await expectDatabaseError(
      `INSERT INTO assets (farm_id, item_id, asset_code)
       VALUES ($1, $2, 'DB-TEST-WRONG-FARM')`,
      [ids.farmB, ids.assetItem],
      'asset and item must belong to the same farm',
    );
    await expectDatabaseError(
      `INSERT INTO assets (farm_id, item_id, asset_code)
       VALUES ($1, $2, 'DB-TEST-WRONG-TRACKING')`,
      [ids.farmA, ids.materialItem],
      'assets.item_id must reference an ASSET-tracked item',
    );
    await expectDatabaseError(
      `INSERT INTO assets (farm_id, item_id, current_location_id, asset_code)
       VALUES ($1, $2, $3, 'DB-TEST-WRONG-LOCATION')`,
      [ids.farmA, ids.assetItem, ids.locationB],
      'asset and current location must belong to the same farm',
    );
  });

  it('enforces assignment, incident, and maintenance farm scope', async () => {
    await expectDatabaseError(
      `INSERT INTO asset_assignments
        (farm_id, asset_id, assigned_to_member_id, assigned_by_member_id)
       VALUES ($1, $2, $3, $4)`,
      [ids.farmA, ids.asset, ids.memberB, ids.memberA],
      'assignment, asset and members must belong to the same farm',
    );
    await expectDatabaseError(
      `INSERT INTO asset_incidents
        (farm_id, asset_id, reported_by_member_id, description)
       VALUES ($1, $2, $3, 'wrong farm incident')`,
      [ids.farmA, ids.asset, ids.memberB],
      'incident, asset and reporter must belong to the same farm',
    );
    await expectDatabaseError(
      `INSERT INTO maintenance_records
        (farm_id, asset_id, maintenance_type, performed_by_member_id, supplier_id)
       VALUES ($1, $2, 'PREVENTIVE', $3, $4)`,
      [ids.farmA, ids.asset, ids.memberA, ids.supplierB],
      'maintenance supplier must belong to the same farm',
    );
  });

  it('rolls back a failed write without leaving partial data', async () => {
    await client.query('SAVEPOINT rollback_test');
    await client.query(
      `INSERT INTO items (farm_id, category_id, unit_id, code, name, item_type, tracking_mode)
       VALUES ($1, $2, $3, 'DB-TEST-ROLLBACK', 'rollback item', 'TOOL', 'ASSET')`,
      [ids.farmA, ids.category, ids.unit],
    );
    await client.query('ROLLBACK TO SAVEPOINT rollback_test');
    const result = await client.query<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM items WHERE code = 'DB-TEST-ROLLBACK'`,
    );
    await client.query('RELEASE SAVEPOINT rollback_test');

    expect(result.rows[0].count).toBe(0);
  });
});

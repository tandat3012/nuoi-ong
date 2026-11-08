import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import request from 'supertest';
import type { App } from 'supertest/types';
import { DatabaseService } from '../src/db/database.service';
import * as schema from '../src/db/schema';
import { FarmAccessGuard } from '../src/modules/auth/farm-access/farm-access.guard';
import { CatalogController } from '../src/modules/catalog/catalog.controller';
import { CatalogService } from '../src/modules/catalog/catalog.service';

describe('Catalog management (migrated PostgreSQL, real farm guard)', () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool, { schema });
  const tag =
    `CAT-${randomUUID().replaceAll('-', '').slice(0, 16)}`.toUpperCase();
  const farm = randomUUID(),
    otherFarm = randomUUID(),
    otherWarehouse = randomUUID(),
    warehouse = randomUUID(),
    secondWarehouse = randomUUID();
  const people = {
    admin: { user: randomUUID(), member: randomUUID(), role: 'ADMIN' },
    owner: { user: randomUUID(), member: randomUUID(), role: 'FARM_OWNER' },
    employee: { user: randomUUID(), member: randomUUID(), role: 'EMPLOYEE' },
    manager: {
      user: randomUUID(),
      member: randomUUID(),
      role: 'WAREHOUSE_MANAGER',
    },
  } as const;
  const createdCategories: string[] = [];
  const createdUnits: string[] = [];
  let actor: keyof typeof people = 'owner';
  let app: INestApplication<App>;
  const as = (who: keyof typeof people) => {
    actor = who;
    return request(app.getHttpServer());
  };

  beforeAll(async () => {
    await pool.query(
      `INSERT INTO roles (code, name, scope) VALUES
         ('ADMIN','Quản trị viên','SYSTEM'),
         ('FARM_OWNER','Chủ trại','FARM'),
         ('EMPLOYEE','Nhân viên','FARM'),
         ('WAREHOUSE_MANAGER','Quản lý kho','FARM')
       ON CONFLICT (code) DO NOTHING`,
    );
    const roleIds = Object.fromEntries(
      (
        await pool.query<{ id: string; code: string }>(
          `SELECT id, code FROM roles WHERE code IN ('ADMIN','FARM_OWNER','EMPLOYEE','WAREHOUSE_MANAGER')`,
        )
      ).rows.map((row) => [row.code, row.id]),
    );
    await db.transaction(async (tx) => {
      await tx.insert(schema.farms).values([
        { id: farm, code: tag, name: tag },
        { id: otherFarm, code: `${tag}-O`, name: `${tag}-O` },
      ]);
      await tx.insert(schema.warehouses).values([
        { id: warehouse, farmId: farm, code: 'MAIN', name: 'Main' },
        { id: secondWarehouse, farmId: farm, code: 'SECOND', name: 'Second' },
        { id: otherWarehouse, farmId: otherFarm, code: 'MAIN', name: 'Main' },
      ]);
      for (const [key, person] of Object.entries(people)) {
        await tx.insert(schema.users).values({
          id: person.user,
          authProvider: 'CLERK',
          authProviderUserId: `${tag}-${key}`,
          email: `${tag}-${key}@example.local`.toLowerCase(),
        });
        await tx
          .insert(schema.farmMembers)
          .values({ id: person.member, farmId: farm, userId: person.user });
        await tx.insert(schema.farmMemberRoles).values({
          farmMemberId: person.member,
          roleId: roleIds[person.role],
        });
      }
    });
    const module = await Test.createTestingModule({
      controllers: [CatalogController],
      providers: [
        CatalogService,
        FarmAccessGuard,
        { provide: DatabaseService, useValue: { db } },
      ],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalGuards({
      canActivate(context) {
        context
          .switchToHttp()
          .getRequest<{ auth: { clerkUserId: string } }>().auth = {
          clerkUserId: `${tag}-${actor}`,
        };
        return true;
      },
    });
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    try {
      await pool.query(
        'DELETE FROM stock_receipt_items WHERE stock_receipt_id IN (SELECT id FROM stock_receipts WHERE farm_id = ANY($1))',
        [[farm, otherFarm]],
      );
      for (const table of [
        'stock_receipts',
        'inventory_balances',
        'assets',
        'items',
        'locations',
        'suppliers',
        'warehouses',
      ]) {
        await pool.query(`DELETE FROM ${table} WHERE farm_id = ANY($1)`, [
          [farm, otherFarm],
        ]);
      }
      await pool.query('DELETE FROM categories WHERE id = ANY($1)', [
        createdCategories,
      ]);
      await pool.query('DELETE FROM units WHERE id = ANY($1)', [createdUnits]);
      const members = Object.values(people).map((person) => person.member);
      await pool.query(
        'DELETE FROM farm_member_roles WHERE farm_member_id = ANY($1)',
        [members],
      );
      await pool.query('DELETE FROM farm_members WHERE id = ANY($1)', [
        members,
      ]);
      await pool.query('DELETE FROM users WHERE id = ANY($1)', [
        Object.values(people).map((person) => person.user),
      ]);
      await pool.query(
        'DELETE FROM stock_document_counters WHERE farm_id = ANY($1)',
        [[farm, otherFarm]],
      );
      await pool.query('DELETE FROM farms WHERE id = ANY($1)', [
        [farm, otherFarm],
      ]);
    } finally {
      await pool.end();
    }
  });

  it('lets farm managers create, rename and deactivate suppliers', async () => {
    const created = await as('owner')
      .post('/api/v1/suppliers')
      .query({ farmId: farm })
      .send({ code: ' sup-1 ', name: ' Nhà cung cấp A ', email: '' })
      .expect(201);
    const supplier = (created.body as { data: { id: string } }).data;
    expect(created.body).toMatchObject({
      data: {
        code: 'SUP-1',
        name: 'Nhà cung cấp A',
        email: null,
        farmId: farm,
      },
    });
    await as('owner')
      .post('/api/v1/suppliers')
      .query({ farmId: farm })
      .send({ code: 'SUP-1', name: 'Trùng mã' })
      .expect(409);
    await as('owner')
      .post('/api/v1/suppliers')
      .query({ farmId: farm })
      .send({ code: 'SUP-2', name: 'Sai email', email: 'not-an-email' })
      .expect(400);
    await as('owner')
      .patch(`/api/v1/suppliers/${supplier.id}`)
      .query({ farmId: farm })
      .send({})
      .expect(400);
    await expect(
      as('owner')
        .patch(`/api/v1/suppliers/${supplier.id}`)
        .query({ farmId: farm })
        .send({ status: 'INACTIVE' })
        .expect(200)
        .then((response) => response.body as unknown),
    ).resolves.toMatchObject({ data: { status: 'INACTIVE' } });
  });

  it('forbids employees from writing farm reference data', async () => {
    await as('employee')
      .post('/api/v1/suppliers')
      .query({ farmId: farm })
      .send({ code: 'EMP', name: 'Employee' })
      .expect(403);
    await as('employee')
      .post('/api/v1/locations')
      .query({ farmId: farm })
      .send({ code: 'EMP', name: 'Employee', type: 'SITE' })
      .expect(403);
  });

  it('keeps supplier edits inside the requested farm', async () => {
    const foreign = randomUUID();
    await pool.query(
      `INSERT INTO suppliers (id, farm_id, code, name) VALUES ($1, $2, 'FOREIGN', 'Foreign')`,
      [foreign, otherFarm],
    );
    await as('owner')
      .patch(`/api/v1/suppliers/${foreign}`)
      .query({ farmId: farm })
      .send({ name: 'Hijacked' })
      .expect(404);
  });

  it('only links locations to active warehouses of the same farm', async () => {
    await as('owner')
      .post('/api/v1/locations')
      .query({ farmId: farm })
      .send({
        code: 'ZONE-X',
        name: 'Foreign zone',
        type: 'WAREHOUSE_ZONE',
        warehouseId: otherWarehouse,
      })
      .expect(400);
    const created = await as('owner')
      .post('/api/v1/locations')
      .query({ farmId: farm })
      .send({
        code: 'zone-a',
        name: 'Khu A',
        type: 'WAREHOUSE_ZONE',
        warehouseId: warehouse,
      })
      .expect(201);
    const location = (created.body as { data: { id: string } }).data;
    await as('owner')
      .patch(`/api/v1/locations/${location.id}`)
      .query({ farmId: farm })
      .send({ warehouseId: otherWarehouse })
      .expect(400);
    await as('owner')
      .patch(`/api/v1/locations/${location.id}`)
      .query({ farmId: farm })
      .send({ type: 'NOT_A_TYPE' })
      .expect(400);
    for (const body of [{ type: null }, { name: null }, { name: '   ' }])
      await as('owner')
        .patch(`/api/v1/locations/${location.id}`)
        .query({ farmId: farm })
        .send(body)
        .expect(400);
  });

  it('keeps locations that hold assets in their warehouse and active', async () => {
    const created = await as('owner')
      .post('/api/v1/locations')
      .query({ farmId: farm })
      .send({
        code: 'zone-asset',
        name: 'Khu tài sản',
        type: 'WAREHOUSE_ZONE',
        warehouseId: warehouse,
      })
      .expect(201);
    const location = (created.body as { data: { id: string } }).data;
    const category = randomUUID(),
      unit = randomUUID(),
      item = randomUUID(),
      asset = randomUUID();
    createdCategories.push(category);
    createdUnits.push(unit);
    await pool.query(
      `INSERT INTO categories (id, code, name) VALUES ($1, $2, 'Asset cat')`,
      [category, `${tag}-AC`],
    );
    await pool.query(
      `INSERT INTO units (id, code, name) VALUES ($1, $2, 'Cái')`,
      [unit, `${tag}-AU`.slice(0, 30)],
    );
    await pool.query(
      `INSERT INTO items (id, farm_id, category_id, unit_id, code, name, item_type, tracking_mode)
       VALUES ($1, $2, $3, $4, 'EQ-1', 'Máy quay mật', 'EQUIPMENT', 'ASSET')`,
      [item, farm, category, unit],
    );
    await pool.query(
      `INSERT INTO assets (id, farm_id, item_id, current_location_id, asset_code)
       VALUES ($1, $2, $3, $4, $5)`,
      [asset, farm, item, location.id, `${tag}-A1`],
    );
    const patch = (body: object) =>
      as('owner')
        .patch(`/api/v1/locations/${location.id}`)
        .query({ farmId: farm })
        .send(body);
    await patch({ warehouseId: secondWarehouse }).expect(409);
    await patch({ warehouseId: null }).expect(409);
    await patch({ status: 'INACTIVE' }).expect(409);
    // Edits that leave the warehouse and status alone still work.
    await patch({ name: 'Khu tài sản 1', warehouseId: warehouse }).expect(200);

    // Retired assets no longer hold stock, so they do not block the location.
    await pool.query(`UPDATE assets SET status = 'RETIRED' WHERE id = $1`, [
      asset,
    ]);
    await expect(
      patch({ warehouseId: secondWarehouse, status: 'INACTIVE' })
        .expect(200)
        .then((response) => response.body as unknown),
    ).resolves.toMatchObject({
      data: { warehouseId: secondWarehouse, status: 'INACTIVE' },
    });
  });

  it('lets warehouse managers create and edit equipment/tool templates without stock (AC25)', async () => {
    const category = randomUUID(),
      unit = randomUUID(),
      material = randomUUID(),
      foreign = randomUUID();
    createdCategories.push(category);
    createdUnits.push(unit);
    await pool.query(
      `INSERT INTO categories (id, code, name) VALUES ($1, $2, 'Thiết bị')`,
      [category, `${tag}-EC`],
    );
    await pool.query(
      `INSERT INTO units (id, code, name) VALUES ($1, $2, 'Cái')`,
      [unit, `${tag}-EU`.slice(0, 30)],
    );
    await pool.query(
      `INSERT INTO items (id, farm_id, category_id, unit_id, code, name, item_type, tracking_mode)
       VALUES ($1, $2, $3, $4, 'MAT-1', 'Đường', 'MATERIAL', 'QUANTITY'),
              ($5, $6, $3, $4, 'EQ-F', 'Foreign', 'EQUIPMENT', 'ASSET')`,
      [material, farm, category, unit, foreign, otherFarm],
    );
    const template = {
      categoryId: category,
      unitId: unit,
      code: ' eq-smoker ',
      name: ' Bình phun khói ',
      itemType: 'EQUIPMENT',
      trackingMode: 'ASSET',
      maintenanceIntervalDays: 90,
    };
    const post = (who: keyof typeof people, body: object) =>
      as(who).post('/api/v1/items').query({ farmId: farm }).send(body);
    const created = await post('manager', template).expect(201);
    const item = (created.body as { data: { id: string } }).data;
    expect(created.body).toMatchObject({
      data: {
        code: 'EQ-SMOKER',
        name: 'Bình phun khói',
        farmId: farm,
        minStockLevel: '0.000',
        maintenanceIntervalDays: 90,
      },
    });
    const stock = await pool.query(
      `SELECT (SELECT count(*) FROM inventory_balances WHERE item_id = $1)::int AS balances,
              (SELECT count(*) FROM inventory_transactions WHERE item_id = $1)::int AS moves,
              (SELECT count(*) FROM assets WHERE item_id = $1)::int AS assets`,
      [item.id],
    );
    expect(stock.rows[0]).toEqual({ balances: 0, moves: 0, assets: 0 });

    await post('owner', template).expect(409);
    await post('employee', { ...template, code: 'EQ-2' }).expect(403);
    for (const invalid of [
      { itemType: 'MATERIAL' },
      { trackingMode: 'LOT' },
      { maintenanceIntervalDays: 0 },
      { categoryId: randomUUID() },
    ])
      await post('owner', { ...template, code: 'EQ-3', ...invalid }).expect(
        400,
      );

    const listed = await as('employee')
      .get('/api/v1/items')
      .query({ farmId: farm, itemType: 'EQUIPMENT,TOOL' })
      .expect(200);
    const types = (
      listed.body as { data: { item: { id: string; itemType: string } }[] }
    ).data.map((row) => row.item);
    expect(types).toContainEqual(expect.objectContaining({ id: item.id }));
    expect(types.every((row) => row.itemType !== 'MATERIAL')).toBe(true);

    const patch = (id: string, body: object) =>
      as('owner')
        .patch(`/api/v1/items/${id}`)
        .query({ farmId: farm })
        .send(body);
    await patch(item.id, { itemType: 'TOOL', trackingMode: 'QUANTITY' }).expect(
      200,
    );
    await patch(item.id, { trackingMode: 'ASSET' }).expect(200);
    await patch(material, { name: 'Không sửa vật tư ở đây' }).expect(404);
    await patch(foreign, { name: 'Hijacked' }).expect(404);
    await patch(item.id, { itemType: 'MATERIAL' }).expect(400);
    await patch(item.id, { minStockLevel: null }).expect(400);

    await pool.query(
      `INSERT INTO assets (id, farm_id, item_id, asset_code) VALUES ($1, $2, $3, $4)`,
      [randomUUID(), farm, item.id, `${tag}-T1`],
    );
    await patch(item.id, { trackingMode: 'QUANTITY' }).expect(409);
    // Inactive references can be kept but not newly chosen.
    const retired = randomUUID();
    createdCategories.push(retired);
    await pool.query(
      `INSERT INTO categories (id, code, name, status) VALUES ($1, $2, 'Cũ', 'INACTIVE')`,
      [retired, `${tag}-EX`],
    );
    await post('manager', {
      ...template,
      code: 'EQ-4',
      categoryId: retired,
    }).expect(400);
    await patch(item.id, { categoryId: retired }).expect(400);
    await pool.query(`UPDATE items SET category_id = $1 WHERE id = $2`, [
      retired,
      item.id,
    ]);
    await patch(item.id, { categoryId: retired, name: 'Giữ nhóm' }).expect(200);
    await expect(
      patch(item.id, { name: 'Bình khói', status: 'INACTIVE' })
        .expect(200)
        .then((response) => response.body as unknown),
    ).resolves.toMatchObject({
      data: { name: 'Bình khói', status: 'INACTIVE', trackingMode: 'ASSET' },
    });
  });

  it('locks the tracking mode once a balance or a stock document line exists', async () => {
    const category = randomUUID(),
      unit = randomUUID(),
      counted = randomUUID(),
      drafted = randomUUID(),
      receipt = randomUUID();
    createdCategories.push(category);
    createdUnits.push(unit);
    await pool.query(
      `INSERT INTO categories (id, code, name) VALUES ($1, $2, 'Dụng cụ')`,
      [category, `${tag}-TC`],
    );
    await pool.query(
      `INSERT INTO units (id, code, name) VALUES ($1, $2, 'Cái')`,
      [unit, `${tag}-TU`.slice(0, 30)],
    );
    await pool.query(
      `INSERT INTO items (id, farm_id, category_id, unit_id, code, name, item_type, tracking_mode)
       VALUES ($1, $3, $4, $5, 'TL-1', 'Kéo', 'TOOL', 'QUANTITY'),
              ($2, $3, $4, $5, 'TL-2', 'Dao', 'TOOL', 'QUANTITY')`,
      [counted, drafted, farm, category, unit],
    );
    // A zero balance still means the item has stock history.
    await pool.query(
      `INSERT INTO inventory_balances (farm_id, warehouse_id, item_id, quantity_on_hand)
       VALUES ($1, $2, $3, 0)`,
      [farm, warehouse, counted],
    );
    await pool.query(
      `INSERT INTO stock_receipts (id, farm_id, warehouse_id, receipt_code, receipt_date, created_by_member_id)
       VALUES ($1, $2, $3, $4, CURRENT_DATE, $5)`,
      [receipt, farm, warehouse, `${tag}-R1`, people.manager.member],
    );
    await pool.query(
      `INSERT INTO stock_receipt_items (stock_receipt_id, item_id, quantity)
       VALUES ($1, $2, 1)`,
      [receipt, drafted],
    );
    for (const id of [counted, drafted])
      await as('manager')
        .patch(`/api/v1/items/${id}`)
        .query({ farmId: farm })
        .send({ trackingMode: 'ASSET' })
        .expect(409);
  });

  it('restricts shared categories and units to ADMIN', async () => {
    for (const who of ['owner', 'employee'] as const) {
      await as(who)
        .post('/api/v1/categories')
        .query({ farmId: farm })
        .send({ code: `${tag}-C`, name: 'Nhóm' })
        .expect(403);
      await as(who)
        .post('/api/v1/units')
        .query({ farmId: farm })
        .send({ code: `${tag}-U`.slice(0, 30), name: 'Đơn vị' })
        .expect(403);
    }
    const category = await as('admin')
      .post('/api/v1/categories')
      .query({ farmId: farm })
      .send({ code: `${tag}-C`, name: 'Nhóm' })
      .expect(201);
    const categoryId = (category.body as { data: { id: string } }).data.id;
    createdCategories.push(categoryId);
    await as('admin')
      .post('/api/v1/categories')
      .query({ farmId: farm })
      .send({ code: `${tag}-C`, name: 'Trùng' })
      .expect(409);
    await as('owner')
      .patch(`/api/v1/categories/${categoryId}`)
      .query({ farmId: farm })
      .send({ name: 'Đổi tên' })
      .expect(403);
    await as('admin')
      .patch(`/api/v1/categories/${categoryId}`)
      .query({ farmId: farm })
      .send({ name: 'Đổi tên', status: 'INACTIVE' })
      .expect(200);

    const unit = await as('admin')
      .post('/api/v1/units')
      .query({ farmId: farm })
      .send({ code: `${tag}-U`.slice(0, 30), name: 'Đơn vị', symbol: '' })
      .expect(201);
    expect(unit.body).toMatchObject({ data: { symbol: null } });
    createdUnits.push((unit.body as { data: { id: string } }).data.id);
    await as('admin')
      .patch(`/api/v1/units/${randomUUID()}`)
      .query({ farmId: farm })
      .send({ name: 'Không có' })
      .expect(404);
  });
});

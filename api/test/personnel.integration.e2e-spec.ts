import 'dotenv/config';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { eq, type SQL } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import request from 'supertest';
import type { App } from 'supertest/types';
import { DatabaseService } from '../src/db/database.service';
import * as schema from '../src/db/schema';
import { AuthController } from '../src/modules/auth/accounts/auth.controller';
import { AuthService } from '../src/modules/auth/accounts/auth.service';
import { AccountStateGuard } from '../src/modules/auth/accounts/account-state.guard';
import { CLERK_CLIENT } from '../src/modules/auth/clerk/clerk-client.provider';
import { FarmAccessGuard } from '../src/modules/auth/farm-access/farm-access.guard';
import { PersonnelController } from '../src/modules/personnel/personnel.controller';
import { PersonnelService } from '../src/modules/personnel/personnel.service';
import { AccountProvisioningService } from '../src/modules/personnel/account-provisioning.service';
import { AssetsController } from '../src/modules/assets/assets.controller';
import { AssetsService } from '../src/modules/assets/assets.service';
import { AssetLifecycleService } from '../src/modules/assets/asset-lifecycle.service';
import { AssetHistoryService } from '../src/modules/assets/asset-history.service';
import { WarehousesService } from '../src/modules/warehouses/warehouses.service';

type Detail = Awaited<ReturnType<PersonnelService['detail']>>;
type FakeIdentity = {
  id: string;
  externalId: string | null;
  firstName: string;
  lastName: string | null;
  imageUrl: string;
  banned: boolean;
  locked: boolean;
  emailAddresses: { emailAddress: string }[];
};
jest.setTimeout(30000);

// Real HTTP, guards, DTOs and independent PostgreSQL transactions; only Clerk is mocked.
describe('Personnel HTTP, provisioning and PostgreSQL consistency', () => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 12,
    connectionTimeoutMillis: 5000,
  });
  const db = drizzle({ client: pool, schema });
  const tag = `personnel-${randomUUID().slice(0, 8)}`;
  const farmA = randomUUID(),
    farmB = randomUUID();
  const warehouseA = randomUUID(),
    warehouseA2 = randomUUID(),
    warehouseB = randomUUID();
  const identities = new Map<string, FakeIdentity>();
  const passwords = new Map<string, string>();
  const people: Record<
    string,
    { userId: string; memberId: string; identity: string }
  > = {};
  let app: INestApplication<App>;
  let personnel: PersonnelService;
  let failUnban = false;
  let afterCreate: (() => Promise<void>) | undefined;
  const clerk = {
    users: {
      getUser: jest.fn((id: string) => {
        const user = identities.get(id);
        if (!user)
          return Promise.reject(
            Object.assign(new Error('Identity not found'), { status: 404 }),
          );
        return Promise.resolve({
          ...user,
          primaryEmailAddress: user.emailAddresses[0],
        });
      }),
      getUserList: jest.fn(
        (params: { externalId?: string[]; emailAddress?: string[] }) =>
          Promise.resolve({
            data: [...identities.values()].filter((user) =>
              params.externalId
                ? params.externalId.includes(user.externalId ?? '')
                : user.emailAddresses.some((email) =>
                    params.emailAddress?.includes(email.emailAddress),
                  ),
            ),
          }),
      ),
      createUser: jest.fn(
        async (input: {
          externalId: string;
          emailAddress: string[];
          firstName: string;
          password: string;
          banned: boolean;
        }) => {
          if (
            [...identities.values()].some(
              (user) =>
                user.externalId === input.externalId ||
                user.emailAddresses.some((email) =>
                  input.emailAddress.includes(email.emailAddress),
                ),
            )
          )
            throw Object.assign(new Error('Identity exists'), {
              status: 422,
              errors: [{ code: 'form_identifier_exists' }],
            });
          const user: FakeIdentity = {
            id: `${tag}-new-${randomUUID()}`,
            externalId: input.externalId,
            firstName: input.firstName,
            lastName: null,
            imageUrl: '',
            banned: input.banned,
            locked: false,
            emailAddresses: input.emailAddress.map((emailAddress) => ({
              emailAddress,
            })),
          };
          identities.set(user.id, user);
          passwords.set(user.id, input.password);
          await afterCreate?.();
          return user;
        },
      ),
      unbanUser: jest.fn((id: string) => {
        if (failUnban)
          return Promise.reject(
            Object.assign(new Error('Unban failed'), {
              status: 503,
              request: { password: 'private initial secret' },
            }),
          );
        const user = identities.get(id)!;
        user.banned = false;
        return Promise.resolve(user);
      }),
      verifyPassword: jest.fn(
        ({ userId, password }: { userId: string; password: string }) => {
          if (passwords.get(userId) !== password)
            return Promise.reject(
              Object.assign(new Error('Incorrect password'), {
                status: 422,
                errors: [{ code: 'form_password_incorrect' }],
              }),
            );
          return Promise.resolve({ verified: true });
        },
      ),
      updateUser: jest.fn((id: string, input: { password: string }) => {
        passwords.set(id, input.password);
        return Promise.resolve(identities.get(id));
      }),
    },
  };
  const http = (actor = 'owner') => ({
    get: (path: string, farmId = farmA) =>
      request(app.getHttpServer())
        .get(`/api/v1${path}`)
        .set('x-test-identity', people[actor]?.identity ?? actor)
        .query({ farmId }),
    post: (path: string, body: object, farmId = farmA) =>
      request(app.getHttpServer())
        .post(`/api/v1${path}`)
        .set('x-test-identity', people[actor]?.identity ?? actor)
        .query({ farmId })
        .send(body),
    put: (path: string, body: object, farmId = farmA) =>
      request(app.getHttpServer())
        .put(`/api/v1${path}`)
        .set('x-test-identity', people[actor]?.identity ?? actor)
        .query({ farmId })
        .send(body),
    patch: (path: string, body: object, farmId = farmA) =>
      request(app.getHttpServer())
        .patch(`/api/v1${path}`)
        .set('x-test-identity', people[actor]?.identity ?? actor)
        .query({ farmId })
        .send(body),
  });
  const createInput = () => ({
    requestId: randomUUID(),
    fullName: 'New Employee',
    email: `${tag}-${randomUUID()}@example.test`,
    initialPassword: 'private initial secret',
    employeeCode: `NEW-${randomUUID().slice(0, 8)}`,
    roleCodes: ['EMPLOYEE'],
    warehouseIds: [warehouseA],
  });
  const detail = (body: unknown) => (body as { data: Detail }).data;

  beforeAll(async () => {
    await migrate(db, { migrationsFolder: './drizzle' });
    for (const code of ['ADMIN', 'FARM_OWNER', 'EMPLOYEE', 'GUEST'])
      await pool.query(
        'INSERT INTO roles (code,name,scope) VALUES ($1,$1,$2) ON CONFLICT (code) DO NOTHING',
        [code, code === 'ADMIN' ? 'SYSTEM' : 'FARM'],
      );
    const module = await Test.createTestingModule({
      controllers: [PersonnelController, AuthController, AssetsController],
      providers: [
        PersonnelService,
        AccountProvisioningService,
        AuthService,
        AccountStateGuard,
        FarmAccessGuard,
        WarehousesService,
        AssetsService,
        AssetLifecycleService,
        AssetHistoryService,
        { provide: DatabaseService, useValue: { db } },
        { provide: CLERK_CLIENT, useValue: clerk },
      ],
    }).compile();
    personnel = module.get(PersonnelService);
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalGuards(
      {
        canActivate(context) {
          const req = context.switchToHttp().getRequest<{
            headers: Record<string, string>;
            auth: { clerkUserId: string };
          }>();
          req.auth = { clerkUserId: req.headers['x-test-identity'] };
          return true;
        },
      },
      module.get(AccountStateGuard),
    );
    await app.init();
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    failUnban = false;
    afterCreate = undefined;
    identities.clear();
    passwords.clear();
    await pool.query(
      'INSERT INTO farms (id,code,name) VALUES ($1,$3,$3),($2,$4,$4)',
      [farmA, farmB, `${tag}-A`, `${tag}-B`],
    );
    for (const [name, codes, farmId] of [
      ['owner', ['FARM_OWNER'], farmA],
      ['owner2', ['FARM_OWNER'], farmA],
      ['admin', ['ADMIN', 'EMPLOYEE'], farmA],
      ['admin2', ['ADMIN'], farmA],
      ['staff', ['EMPLOYEE', 'GUEST'], farmA],
      ['guest', ['GUEST'], farmA],
      ['foreign', ['FARM_OWNER'], farmB],
    ] as const) {
      const userId = randomUUID(),
        memberId = randomUUID(),
        identity = `${tag}-${name}`;
      people[name] = { userId, memberId, identity };
      const email = `${identity}@example.test`;
      await pool.query(
        'INSERT INTO users (id,auth_provider_user_id,email,full_name) VALUES ($1,$2,$3,$4)',
        [userId, identity, email, name],
      );
      await pool.query(
        'INSERT INTO farm_members (id,farm_id,user_id,employee_code) VALUES ($1,$2,$3,$4)',
        [memberId, farmId, userId, name.toUpperCase()],
      );
      for (const code of codes)
        await pool.query(
          'INSERT INTO farm_member_roles (farm_member_id,role_id) SELECT $1,id FROM roles WHERE code=$2',
          [memberId, code],
        );
      identities.set(identity, {
        id: identity,
        externalId: null,
        firstName: name,
        lastName: null,
        imageUrl: '',
        banned: false,
        locked: false,
        emailAddresses: [{ emailAddress: email }],
      });
    }
    people.staffOther = {
      userId: people.staff.userId,
      identity: people.staff.identity,
      memberId: randomUUID(),
    };
    await pool.query(
      'INSERT INTO farm_members (id,farm_id,user_id,employee_code) VALUES ($1,$2,$3,$4)',
      [people.staffOther.memberId, farmB, people.staff.userId, 'STAFF'],
    );
    await pool.query(
      "INSERT INTO farm_member_roles (farm_member_id,role_id) SELECT $1,id FROM roles WHERE code='EMPLOYEE'",
      [people.staffOther.memberId],
    );
    await pool.query(
      'INSERT INTO warehouses (id,farm_id,code,name) VALUES ($1,$4,$6,$6),($2,$4,$7,$7),($3,$5,$6,$6)',
      [
        warehouseA,
        warehouseA2,
        warehouseB,
        farmA,
        farmB,
        `${tag}-W1`,
        `${tag}-W2`,
      ],
    );
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    for (const table of [
      'audit_logs',
      'personnel_account_provisions',
      'asset_assignments',
      'inventory_transactions',
      'inventory_balances',
      'assets',
      'items',
      'locations',
      'farm_members',
      'warehouses',
    ])
      await pool.query(`DELETE FROM ${table} WHERE farm_id IN ($1,$2)`, [
        farmA,
        farmB,
      ]);
    await pool.query('DELETE FROM farms WHERE id IN ($1,$2)', [farmA, farmB]);
    await pool.query('DELETE FROM users WHERE auth_provider_user_id LIKE $1', [
      `${tag}-%`,
    ]);
    await pool.query('DELETE FROM categories WHERE code=$1', [tag]);
    await pool.query('DELETE FROM units WHERE code=$1', [tag]);
  });
  afterAll(async () => {
    await app?.close();
    await pool.end();
  });

  it('isolates all member reads/writes, validates access before targets, and denies employee/guest management', async () => {
    await http().get('/personnel', farmB).expect(403);
    for (const role of ['staff', 'guest'])
      await http(role).get('/personnel').expect(403);
    const id = people.foreign.memberId;
    for (const suffix of ['', '/assets', '/history'])
      await http().get(`/personnel/${id}${suffix}`).expect(404);
    await http().patch(`/personnel/${id}`, { jobTitle: 'Denied' }).expect(404);
    await http()
      .put(`/personnel/${id}/roles`, { roleCodes: ['GUEST'] })
      .expect(404);
    await http()
      .put(`/personnel/${id}/warehouses`, { warehouseIds: [] })
      .expect(404);
    await http()
      .patch(`/personnel/${id}/status`, { status: 'INACTIVE' })
      .expect(404);
    const rejected = await http()
      .post('/personnel/accounts', {
        ...createInput(),
        warehouseIds: [warehouseB],
      })
      .expect(400);
    expect(rejected.body).toHaveProperty('code', 'INVALID_WORKPLACE');
    expect(clerk.users.createUser).not.toHaveBeenCalled();
  });

  it('rejects escalation/shared identity edits and protects self/owners; retains legacy system grants', async () => {
    const staffId = people.staff.memberId;
    await http()
      .put(`/personnel/${staffId}/roles`, { roleCodes: ['ADMIN'] })
      .expect(400);
    await http()
      .put(`/personnel/${staffId}/roles`, { roleCodes: ['FARM_OWNER'] })
      .expect(403);
    await http()
      .patch(`/personnel/${staffId}`, {
        fullName: 'Changed',
        email: 'changed@example.test',
        systemRoleId: randomUUID(),
      })
      .expect(400);
    await http()
      .patch(`/personnel/${people.owner2.memberId}`, { jobTitle: 'Denied' })
      .expect(403);
    await http('admin')
      .put(`/personnel/${people.admin.memberId}/roles`, {
        roleCodes: ['EMPLOYEE'],
      })
      .expect(403);
    await http('admin')
      .patch(`/personnel/${people.admin.memberId}/status`, {
        status: 'INACTIVE',
      })
      .expect(403);
    const changed = await http('admin2')
      .put(`/personnel/${people.admin.memberId}/roles`, {
        roleCodes: ['GUEST'],
      })
      .expect(200);
    expect(detail(changed.body).roleCodes.sort()).toEqual(['ADMIN', 'GUEST']);
    await http('admin2')
      .patch(`/personnel/${people.admin.memberId}/status`, {
        status: 'INACTIVE',
      })
      .expect(200);
    const active = await http('admin2')
      .patch(`/personnel/${people.admin.memberId}/status`, {
        status: 'ACTIVE',
        roleCodes: ['EMPLOYEE'],
        warehouseIds: [],
      })
      .expect(200);
    expect(detail(active.body).roleCodes.sort()).toEqual(['ADMIN', 'EMPLOYEE']);
  });

  it('serializes two concurrent owner removals using separate PostgreSQL transactions', async () => {
    const responses = await Promise.all([
      http('admin').put(`/personnel/${people.owner.memberId}/roles`, {
        roleCodes: ['EMPLOYEE'],
      }),
      http('admin2').patch(`/personnel/${people.owner2.memberId}/status`, {
        status: 'INACTIVE',
      }),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([
      200, 409,
    ]);
    const remaining = await pool.query<{ count: number }>(
      "SELECT count(*)::int AS count FROM farm_members m JOIN users u ON u.id=m.user_id JOIN farm_member_roles mr ON mr.farm_member_id=m.id JOIN roles r ON r.id=mr.role_id WHERE m.farm_id=$1 AND m.status='ACTIVE' AND u.status='ACTIVE' AND r.code='FARM_OWNER'",
      [farmA],
    );
    expect(remaining.rows[0].count).toBe(1);
  });

  it('enforces workplace scope in SQL and service and paginates many-to-many filters without duplicates', async () => {
    const id = people.staff.memberId;
    await http()
      .put(`/personnel/${id}/warehouses`, {
        warehouseIds: [warehouseA, warehouseA2],
      })
      .expect(200);
    await http()
      .put(`/personnel/${id}/warehouses`, { warehouseIds: [warehouseB] })
      .expect(400);
    await expect(
      pool.query(
        'INSERT INTO farm_member_warehouses (farm_member_id,warehouse_id) VALUES ($1,$2)',
        [id, warehouseB],
      ),
    ).rejects.toMatchObject({ code: '23514' });
    const response = await http()
      .get('/personnel')
      .query({
        search: 'STAFF',
        role: 'EMPLOYEE',
        warehouseId: warehouseA2,
        pageSize: 1,
      })
      .expect(200);
    expect((response.body as { data: unknown[] }).data).toHaveLength(1);
    expect(response.body).toHaveProperty('page.totalItems', 1);
    expect(
      detail({ data: (response.body as { data: unknown[] }).data[0] })
        .warehouses,
    ).toHaveLength(2);
    expect(JSON.stringify(response.body)).not.toContain('phone');
    await pool.query("UPDATE users SET full_name='Literal%_name' WHERE id=$1", [
      people.staff.userId,
    ]);
    const literal = await http()
      .get('/personnel')
      .query({ search: '%_' })
      .expect(200);
    expect(literal.body).toHaveProperty('page.totalItems', 1);
    await expect(
      pool.query('UPDATE farm_members SET employee_code=$1 WHERE id=$2', [
        'staff',
        people.guest.memberId,
      ]),
    ).rejects.toMatchObject({ code: '23505' });
  });

  it('deactivates membership only, preserves history, excludes recipients, and reactivates the same ID', async () => {
    const id = people.staff.memberId;
    await http()
      .patch(`/personnel/${id}/status`, {
        status: 'INACTIVE',
        reason: 'Finished work',
      })
      .expect(200);
    await expect(
      new WarehousesService({
        db,
      } as unknown as DatabaseService).assertFarmAccess(
        farmA,
        people.staff.identity,
        false,
      ),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      new WarehousesService({
        db,
      } as unknown as DatabaseService).assertFarmAccess(
        farmB,
        people.staff.identity,
        false,
      ),
    ).resolves.toBe(people.staffOther.memberId);
    const recipients = await http().get('/assets/members').expect(200);
    expect(
      (recipients.body as { data: { id: string }[] }).data.some(
        (row) => row.id === id,
      ),
    ).toBe(false);
    const history = await http().get(`/personnel/${id}/history`).expect(200);
    expect(history.body).toHaveProperty('page.totalItems', 1);
    await http()
      .patch(`/personnel/${id}/status`, { status: 'ACTIVE' })
      .expect(400);
    const active = await http()
      .patch(`/personnel/${id}/status`, {
        status: 'ACTIVE',
        roleCodes: ['EMPLOYEE'],
        warehouseIds: [],
      })
      .expect(200);
    expect(detail(active.body).memberId).toBe(id);
  });

  it('creates one identity/member under concurrent submissions and never persists/returns initial passwords', async () => {
    const input = createInput();
    const results = await Promise.all([
      http().post('/personnel/accounts', input),
      http().post('/personnel/accounts', input),
    ]);
    expect(
      results.every((response) => [200, 201, 202].includes(response.status)),
    ).toBe(true);
    const replay = await http()
      .post('/personnel/accounts', {
        ...input,
        initialPassword: 'different replay secret',
      })
      .expect(200);
    expect(clerk.users.createUser).toHaveBeenCalledTimes(1);
    const created = detail(replay.body);
    expect(created.roleCodes).toEqual(['EMPLOYEE']);
    expect(created.warehouses.map((w) => w.id)).toEqual([warehouseA]);
    const provision = await db
      .select()
      .from(schema.personnelAccountProvisions)
      .where(eq(schema.personnelAccountProvisions.id, input.requestId));
    expect(provision[0]).toMatchObject({
      status: 'COMPLETED',
      memberId: created.memberId,
    });
    const audit = await http()
      .get(`/personnel/${created.memberId}/history`)
      .expect(200);
    expect(audit.body).toHaveProperty('page.totalItems', 1);
    expect(
      JSON.stringify({
        responses: results.map((r) => r.body as unknown),
        provision,
        audit: audit.body as unknown,
      }),
    ).not.toMatch(
      /private initial secret|different replay secret|initialPassword|passwordHash/,
    );
    expect(passwords.get(provision[0].clerkUserId!)).toBe(
      input.initialPassword,
    );
    await http()
      .post('/personnel/accounts', { ...input, fullName: 'Different payload' })
      .expect(409);
  });

  it('rolls back profile, roles and assignment changes when the audit write fails', async () => {
    const name = `personnel_audit_${randomUUID().replaceAll('-', '')}`;
    try {
      await pool.query(
        `CREATE FUNCTION public.${name}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.farm_id = '${farmA}'::uuid AND NEW.entity_type = 'PERSONNEL' THEN RAISE EXCEPTION 'injected personnel audit failure'; END IF; RETURN NEW; END $$`,
      );
      await pool.query(
        `CREATE TRIGGER ${name} BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION public.${name}()`,
      );
      for (const operation of [
        () =>
          personnel.updateProfile(
            people.staff.memberId,
            farmA,
            people.owner.identity,
            { jobTitle: 'Must roll back' },
          ),
        () =>
          personnel.updateRoles(
            people.staff.memberId,
            farmA,
            people.owner.identity,
            ['GUEST'],
          ),
        () =>
          personnel.updateWarehouses(
            people.staff.memberId,
            farmA,
            people.owner.identity,
            [warehouseA],
          ),
      ])
        await expect(operation()).rejects.toThrow();
      const current = await personnel.detail(
        people.staff.memberId,
        farmA,
        people.owner.identity,
      );
      expect(current.jobTitle).toBeNull();
      expect(current.roleCodes.sort()).toEqual(['EMPLOYEE', 'GUEST']);
      expect(current.warehouses).toEqual([]);
    } finally {
      await pool.query(`DROP TRIGGER IF EXISTS ${name} ON audit_logs`);
      await pool.query(`DROP FUNCTION IF EXISTS public.${name}()`);
    }
  });

  it('preserves assets/history after deactivation and lets owners process the return', async () => {
    const categoryId = randomUUID(),
      unitId = randomUUID(),
      itemId = randomUUID(),
      locationId = randomUUID();
    await pool.query(
      'INSERT INTO categories (id,code,name) VALUES ($1,$2,$2)',
      [categoryId, tag],
    );
    await pool.query('INSERT INTO units (id,code,name) VALUES ($1,$2,$2)', [
      unitId,
      tag,
    ]);
    await pool.query(
      "INSERT INTO items (id,farm_id,category_id,unit_id,code,name,item_type,tracking_mode) VALUES ($1,$2,$3,$4,$5,$5,'EQUIPMENT','ASSET')",
      [itemId, farmA, categoryId, unitId, tag],
    );
    await pool.query(
      "INSERT INTO locations (id,farm_id,warehouse_id,code,name,type) VALUES ($1,$2,$3,$4,$4,'WAREHOUSE')",
      [locationId, farmA, warehouseA, tag],
    );
    const asset = await http()
      .post('/assets', {
        itemId,
        warehouseId: warehouseA,
        locationId,
        assetCode: tag,
      })
      .expect(201);
    const assetId = (asset.body as { data: { id: string } }).data.id;
    await http()
      .post(`/assets/${assetId}/assign`, {
        assignedToMemberId: people.staff.memberId,
        locationId,
      })
      .expect(201);
    await http()
      .patch(`/personnel/${people.staff.memberId}/status`, {
        status: 'INACTIVE',
      })
      .expect(200);
    const held = await http()
      .get(`/personnel/${people.staff.memberId}/assets`)
      .expect(200);
    expect(held.body).toHaveProperty('page.totalItems', 1);
    const holder = await http().get(`/assets/${assetId}/holder`).expect(200);
    expect(JSON.stringify(holder.body)).toContain(people.staff.memberId);
    const balance = await pool.query<{ quantity_on_hand: string }>(
      'SELECT quantity_on_hand FROM inventory_balances WHERE farm_id=$1 AND item_id=$2',
      [farmA, itemId],
    );
    expect(Number(balance.rows[0].quantity_on_hand)).toBe(0);
    await http()
      .post(`/assets/${assetId}/return`, {
        warehouseId: warehouseA,
        locationId,
      })
      .expect(201);
    const returned = await http()
      .get(`/personnel/${people.staff.memberId}/assets`)
      .expect(200);
    expect(returned.body).toHaveProperty('page.totalItems', 0);
    const history = await http()
      .get(`/assets/${assetId}/history`)
      .query({ kind: 'assignments' })
      .expect(200);
    expect(JSON.stringify(history.body)).toContain('staff');
    const assignment = await pool.query<{
      assigned_to_member_id: string;
      status: string;
    }>(
      'SELECT assigned_to_member_id,status FROM asset_assignments WHERE asset_id=$1',
      [assetId],
    );
    expect(assignment.rows[0]).toEqual({
      assigned_to_member_id: people.staff.memberId,
      status: 'RETURNED',
    });
  });

  it('recovers an uncertain Clerk timeout by external ID without creating another identity', async () => {
    const input = createInput();
    afterCreate = () => {
      afterCreate = undefined;
      return Promise.reject(new Error('network response lost'));
    };
    await http().post('/personnel/accounts', input).expect(503);
    expect(
      [...identities.values()].filter(
        (user) => user.externalId === `personnel:${input.requestId}`,
      ),
    ).toHaveLength(1);
    const result = await http().post('/personnel/accounts', input).expect(201);
    expect(detail(result.body).email).toBe(input.email);
    expect(clerk.users.createUser).toHaveBeenCalledTimes(1);
  });

  it('leaves identities banned after database failure and resumes the saved identity', async () => {
    const input = createInput();
    jest
      .spyOn(personnel, 'createMembership')
      .mockRejectedValueOnce(new Error('commit unavailable'));
    const failed = await http().post('/personnel/accounts', input).expect(503);
    expect(JSON.stringify(failed.body)).not.toContain(input.initialPassword);
    const [provision] = await db
      .select()
      .from(schema.personnelAccountProvisions)
      .where(eq(schema.personnelAccountProvisions.id, input.requestId));
    expect(identities.get(provision.clerkUserId!)?.banned).toBe(true);
    expect(provision.memberId).toBeNull();
    await http().post('/personnel/accounts', input).expect(201);
    expect(clerk.users.createUser).toHaveBeenCalledTimes(1);
  });

  it('retries unban after membership commit without duplicating membership/audit', async () => {
    const input = createInput();
    failUnban = true;
    await http().post('/personnel/accounts', input).expect(503);
    const [provision] = await db
      .select()
      .from(schema.personnelAccountProvisions)
      .where(eq(schema.personnelAccountProvisions.id, input.requestId));
    expect(provision.status).toBe('MEMBERSHIP_CREATED');
    expect(provision.memberId).toBeTruthy();
    expect(identities.get(provision.clerkUserId!)?.banned).toBe(true);
    failUnban = false;
    const resumed = await http().post('/personnel/accounts', input).expect(201);
    expect(detail(resumed.body).memberId).toBe(provision.memberId);
    expect(clerk.users.createUser).toHaveBeenCalledTimes(1);
    const audit = await http()
      .get(`/personnel/${provision.memberId}/history`)
      .expect(200);
    expect(audit.body).toHaveProperty('page.totalItems', 1);
  });

  it('never downgrades a completed provision when a concurrent failure is annotated later', async () => {
    const input = createInput();
    await http().post('/personnel/accounts', input).expect(201);
    await pool.query(
      "UPDATE personnel_account_provisions SET status='MEMBERSHIP_CREATED' WHERE id=$1",
      [input.requestId],
    );
    clerk.users.getUser.mockRejectedValueOnce(
      Object.assign(new Error('Provider rejected an older request'), {
        status: 422,
      }),
    );
    const annotation = db.update(schema.personnelAccountProvisions);
    jest.spyOn(db, 'update').mockReturnValueOnce({
      set: (
        changes: Partial<typeof schema.personnelAccountProvisions.$inferInsert>,
      ) => ({
        where: async (condition: SQL) => {
          // Model another request completing after the failing transaction releases its lock.
          await pool.query(
            "UPDATE personnel_account_provisions SET status='COMPLETED',error_code=NULL WHERE id=$1",
            [input.requestId],
          );
          return annotation.set(changes).where(condition);
        },
      }),
    } as never);
    await http().post('/personnel/accounts', input).expect(400);
    const [provision] = await db
      .select()
      .from(schema.personnelAccountProvisions)
      .where(eq(schema.personnelAccountProvisions.id, input.requestId));
    expect(provision).toMatchObject({ status: 'COMPLETED', errorCode: null });
    await http().post('/personnel/accounts', input).expect(200);
    expect(clerk.users.unbanUser).toHaveBeenCalledTimes(1);
  });

  it('keeps the safe dependency error when recording failure metadata is also unavailable', async () => {
    const input = createInput();
    afterCreate = () =>
      Promise.reject(new Error('uncertain identity response'));
    jest.spyOn(db, 'update').mockReturnValueOnce({
      set: () => ({
        where: () => Promise.reject(new Error('database unavailable')),
      }),
    } as never);
    const response = await http()
      .post('/personnel/accounts', input)
      .expect(503);
    expect(response.body).toHaveProperty('code', 'IDENTITY_UNAVAILABLE');
    expect(JSON.stringify(response.body)).not.toContain(input.initialPassword);
    expect(clerk.users.unbanUser).not.toHaveBeenCalled();
  });

  it('rechecks actor permission after Clerk responds before granting membership', async () => {
    const input = createInput();
    afterCreate = async () => {
      await personnel.updateStatus(
        people.owner.memberId,
        farmA,
        people.admin.identity,
        { status: 'INACTIVE' },
      );
    };
    await http().post('/personnel/accounts', input).expect(403);
    const [provision] = await db
      .select()
      .from(schema.personnelAccountProvisions)
      .where(eq(schema.personnelAccountProvisions.id, input.requestId));
    expect(provision.memberId).toBeNull();
    expect(identities.get(provision.clerkUserId!)?.banned).toBe(true);
  });

  it('adds an existing account without changing shared identity, password or other-farm membership', async () => {
    const user = identities.get(people.foreign.identity)!;
    const password = 'existing private secret';
    passwords.set(user.id, password);
    const input = {
      email: user.emailAddresses[0].emailAddress,
      roleCodes: ['GUEST'],
      warehouseIds: [],
    };
    const response = await http()
      .post('/personnel/existing-accounts', input)
      .expect(201);
    expect(detail(response.body).fullName).toBe('foreign');
    expect(passwords.get(user.id)).toBe(password);
    expect(clerk.users.createUser).not.toHaveBeenCalled();
    expect(clerk.users.updateUser).not.toHaveBeenCalled();
    expect(clerk.users.unbanUser).not.toHaveBeenCalled();
    await http().post('/personnel/existing-accounts', input).expect(409);
    const foreign = await http('foreign')
      .get(`/personnel/${people.foreign.memberId}`, farmB)
      .expect(200);
    expect(detail(foreign.body).membershipStatus).toBe('ACTIVE');
    await http()
      .post('/personnel/accounts', { ...createInput(), email: input.email })
      .expect(409);
    expect(clerk.users.unbanUser).not.toHaveBeenCalled();
  });

  it('lists signed-in accounts without any farm membership as customers to managers only', async () => {
    const customer = `${tag}-customer`;
    await pool.query(
      'INSERT INTO users (auth_provider_user_id,email,full_name) VALUES ($1,$2,$3)',
      [customer, `${customer}@example.test`, 'customer'],
    );
    const response = await http()
      .get(`/personnel/customers?search=${tag}`)
      .expect(200);
    expect(
      (response.body as { data: { email: string }[] }).data.map(
        (row) => row.email,
      ),
    ).toEqual([`${customer}@example.test`]);
    await http('staff').get('/personnel/customers').expect(403);
  });

  it('enforces first-password policy on direct APIs and changes only the session identity', async () => {
    const input = createInput();
    const response = await http()
      .post('/personnel/accounts', input)
      .expect(201);
    const [provision] = await db
      .select()
      .from(schema.personnelAccountProvisions)
      .where(eq(schema.personnelAccountProvisions.id, input.requestId));
    const identity = provision.clerkUserId!;
    const me = await http(identity).get('/auth/me').expect(200);
    expect(me.body).toHaveProperty('user.mustChangePassword', true);
    await http(identity).get('/assets').expect(403);
    await http(identity)
      .post('/auth/change-initial-password', {
        currentPassword: 'wrong secret',
        newPassword: 'personal secret',
      })
      .expect(400);
    await http(identity)
      .post('/auth/change-initial-password', {
        currentPassword: input.initialPassword,
        newPassword: 'personal secret',
        userId: people.owner.userId,
      })
      .expect(400);
    await http(identity)
      .post('/auth/change-initial-password', {
        currentPassword: input.initialPassword,
        newPassword: 'personal secret',
      })
      .expect(200);
    expect(clerk.users.updateUser).toHaveBeenCalledWith(identity, {
      password: 'personal secret',
      signOutOfOtherSessions: true,
    });
    expect(passwords.get(identity)).toBe('personal secret');
    const updated = await http(identity).get('/auth/me').expect(200);
    expect(updated.body).toHaveProperty('user.mustChangePassword', false);
    await http(identity).get('/assets').expect(200);
    expect(detail(response.body).memberId).toBe(provision.memberId);
  });

  it('shares credential throttling through PostgreSQL and blocks inactive accounts/farms', async () => {
    const auth = app.get(AuthService);
    await Promise.all(
      Array.from({ length: 10 }, () =>
        auth.limitCredentialAction(people.owner.userId, 'CHANGE_PASSWORD'),
      ),
    );
    await expect(
      auth.limitCredentialAction(people.owner.userId, 'CHANGE_PASSWORD'),
    ).rejects.toMatchObject({ status: 429 });
    await pool.query("UPDATE users SET status='INACTIVE' WHERE id=$1", [
      people.staff.userId,
    ]);
    await http('staff').get('/auth/me').expect(403);
    await pool.query("UPDATE farms SET status='INACTIVE' WHERE id=$1", [farmA]);
    await http().get('/personnel').expect(403);
    await expect(
      new WarehousesService({
        db,
      } as unknown as DatabaseService).assertFarmAccess(
        farmA,
        people.owner.identity,
        false,
      ),
    ).rejects.toMatchObject({ status: 403 });
  });
});

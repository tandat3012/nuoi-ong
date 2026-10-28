import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { DatabaseService } from '../src/db/database.service';
import * as schema from '../src/db/schema';
import { NotificationsService } from '../src/modules/notifications/notifications.service';

// Farm membership is enforced by FarmAccessGuard; this suite covers per-user scoping.
describe('In-app notifications with PostgreSQL', () => {
  const tag = `notifications-test-${randomUUID()}`;
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool, { schema });
  const service = new NotificationsService({
    db,
  } as unknown as DatabaseService);
  const userA = randomUUID();
  const userB = randomUUID();
  const farm = randomUUID();
  const otherFarm = randomUUID();
  const page = { page: 1, pageSize: 20, offset: 0 };
  let fixturesCreated = false;

  const seed = (userId: string, farmId: string, read = false) =>
    db
      .insert(schema.notifications)
      .values({
        userId,
        farmId,
        type: 'TEST',
        title: tag,
        body: tag,
        readAt: read ? new Date().toISOString() : null,
      })
      .returning({ id: schema.notifications.id })
      .then(([row]) => row.id);

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
    await db.insert(schema.users).values([
      {
        id: userA,
        authProviderUserId: `${tag}-a`,
        email: `${tag}-a@example.local`,
      },
      {
        id: userB,
        authProviderUserId: `${tag}-b`,
        email: `${tag}-b@example.local`,
      },
    ]);
    fixturesCreated = true;
    await db.insert(schema.farms).values([
      { id: farm, code: `NTF-${farm.slice(0, 8)}`, name: tag },
      { id: otherFarm, code: `NTF-${otherFarm.slice(0, 8)}`, name: tag },
    ]);
  });

  beforeEach(async () => {
    await pool.query(
      'DELETE FROM notifications WHERE user_id = ANY($1::uuid[])',
      [[userA, userB]],
    );
  });

  afterAll(async () => {
    try {
      if (fixturesCreated) {
        await pool.query('DELETE FROM farms WHERE id = ANY($1::uuid[])', [
          [farm, otherFarm],
        ]);
        await pool.query('DELETE FROM users WHERE id = ANY($1::uuid[])', [
          [userA, userB],
        ]);
      }
    } finally {
      await pool.end();
    }
  });

  it('lists only the caller notifications in the selected farm, with unread count and filter', async () => {
    const unread = await seed(userA, farm);
    const read = await seed(userA, farm, true);
    await seed(userA, otherFarm);
    await seed(userB, farm);

    const all = await service.list({
      ...page,
      clerkUserId: `${tag}-a`,
      farmId: farm,
    });
    expect(all.data.map((row) => row.id).sort()).toEqual([unread, read].sort());
    expect(all.unreadCount).toBe(1);
    expect(all.page.totalItems).toBe(2);

    const unreadOnly = await service.list({
      ...page,
      clerkUserId: `${tag}-a`,
      farmId: farm,
      unreadOnly: true,
    });
    expect(unreadOnly.data.map((row) => row.id)).toEqual([unread]);
    expect(unreadOnly.page.totalItems).toBe(1);
  });

  it('marks only the caller notification as read and reports a repeat as alreadyRead', async () => {
    const own = await seed(userA, farm);
    const foreign = await seed(userB, farm);

    const first = await service.markRead(own, farm, `${tag}-a`);
    expect(first.data.id).toBe(own);
    expect(first).not.toHaveProperty('alreadyRead');
    await expect(
      service.markRead(own, farm, `${tag}-a`),
    ).resolves.toMatchObject({
      alreadyRead: true,
    });
    await expect(service.markRead(foreign, farm, `${tag}-a`)).rejects.toThrow(
      'Notification not found',
    );
    await expect(service.markRead(own, otherFarm, `${tag}-a`)).rejects.toThrow(
      'Notification not found',
    );
  });

  it('marks all unread notifications of the caller in one farm', async () => {
    await seed(userA, farm);
    await seed(userA, farm);
    await seed(userA, farm, true);
    await seed(userA, otherFarm);
    await seed(userB, farm);

    await expect(service.markAllRead(farm, `${tag}-a`)).resolves.toEqual({
      updatedCount: 2,
    });
    const other = await service.list({
      ...page,
      clerkUserId: `${tag}-a`,
      farmId: otherFarm,
    });
    expect(other.unreadCount).toBe(1);
    const b = await service.list({
      ...page,
      clerkUserId: `${tag}-b`,
      farmId: farm,
    });
    expect(b.unreadCount).toBe(1);
  });

  it('rejects an unknown or inactive account', async () => {
    await expect(
      service.list({ ...page, clerkUserId: `${tag}-missing`, farmId: farm }),
    ).rejects.toThrow('Active user account is required');
  });
});

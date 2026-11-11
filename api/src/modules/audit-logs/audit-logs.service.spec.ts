import { NotFoundException } from '@nestjs/common';
import {
  farmMembers,
  locations,
  stockCounts,
  warehouses,
} from '../../db/schema';
import { DatabaseService } from '../../db/database.service';
import { WarehousesService } from '../warehouses/warehouses.service';
import { AuditLogsController } from './audit-logs.controller';
import { AuditLogsService } from './audit-logs.service';

describe('AuditLogsService', () => {
  const farmId = '11111111-1111-4111-8111-111111111111';
  const logId = '22222222-2222-4222-8222-222222222222';
  const warehouseId = '33333333-3333-4333-8333-333333333333';
  const memberId = '44444444-4444-4444-8444-444444444444';
  const locationId = '55555555-5555-4555-8555-555555555555';
  const countId = '66666666-6666-4666-8666-666666666666';
  const userId = '77777777-7777-4777-8777-777777777777';

  function createService({
    row,
    tableRows = new Map<unknown, unknown[]>(),
    roles = ['FARM_OWNER'],
  }: {
    row: Record<string, unknown> | undefined;
    tableRows?: Map<unknown, unknown[]>;
    roles?: string[];
  }) {
    let referenceQueries = 0;
    const select = jest.fn(() => {
      let currentTable: unknown;
      let isAuditRowQuery = false;
      const chain: Record<string, unknown> = {
        from: (table: unknown) => {
          currentTable = table;
          return chain;
        },
        leftJoin: () => {
          isAuditRowQuery = true;
          return chain;
        },
        innerJoin: () => chain,
        where: () => {
          if (!isAuditRowQuery) {
            referenceQueries += 1;
            return Promise.resolve(tableRows.get(currentTable) ?? []);
          }
          return chain;
        },
        limit: () => Promise.resolve(row ? [row] : []),
      };
      return chain;
    });

    const databaseService = { db: { select } } as unknown as DatabaseService;
    const warehousesService = {
      getActiveMembership: jest.fn().mockResolvedValue({
        userId,
        memberId,
        roleCodes: roles,
      }),
    } as unknown as WarehousesService;

    return {
      service: new AuditLogsService(databaseService, warehousesService),
      controller: new AuditLogsController(
        new AuditLogsService(databaseService, warehousesService),
      ),
      getReferenceQueryCount: () => referenceQueries,
    };
  }

  it('returns the presented audit row from get() and adds resolved references in getDetail()', async () => {
    const row = {
      id: logId,
      farmId,
      userId,
      action: 'SUBMIT',
      entityType: 'STOCK_COUNT',
      entityId: countId,
      oldData: {
        status: 'DRAFT',
        warehouseId,
        createdByMemberId: memberId,
      },
      newData: {
        status: 'PENDING_APPROVAL',
        warehouseId,
        createdByMemberId: memberId,
        summary: `Vị trí kiểm kê tại ${locationId}`,
      },
      createdAt: '2026-11-11T09:20:00.000Z',
      actorName: 'Nguyễn Văn A',
      actorEmail: 'a@example.com',
    };
    const tableRows = new Map<unknown, unknown[]>([
      [warehouses, [{ id: warehouseId, label: 'KHO-01 — Kho điểm nuôi số 1' }]],
      [farmMembers, [{ id: memberId, label: 'Nguyễn Văn A' }]],
      [locations, [{ id: locationId, label: 'VT-01 — Khu vực A' }]],
      [stockCounts, [{ id: countId, label: 'KK-66666666' }]],
    ]);
    const { service } = createService({ row, tableRows });

    await expect(service.get(logId, farmId, 'clerk-1')).resolves.toMatchObject({
      id: logId,
      entityId: countId,
      actor: { name: 'Nguyễn Văn A', email: 'a@example.com' },
    });

    const detail = await service.getDetail(logId, farmId, 'clerk-1');
    expect(detail.data).toMatchObject({
      id: logId,
      entityId: countId,
      actor: { name: 'Nguyễn Văn A', email: 'a@example.com' },
    });
    expect(detail.references).toEqual({
      [warehouseId]: 'KHO-01 — Kho điểm nuôi số 1',
      [memberId]: 'Nguyễn Văn A',
      [locationId]: 'VT-01 — Khu vực A',
      [countId]: 'KK-66666666',
    });
  });

  it('skips reference queries when snapshot and entity contain no UUIDs', async () => {
    const row = {
      id: logId,
      farmId,
      userId,
      action: 'SHIPPING_FEES_UPDATED',
      entityType: 'STORE_SHIPPING_FEES',
      entityId: null,
      oldData: { NORTH: '40000' },
      newData: { NORTH: '45000' },
      createdAt: '2026-11-11T09:20:00.000Z',
      actorName: null,
      actorEmail: 'owner@example.com',
    };
    const { service, getReferenceQueryCount } = createService({ row });

    const detail = await service.getDetail(logId, farmId, 'clerk-1');
    expect(detail.references).toEqual({});
    expect(getReferenceQueryCount()).toBe(0);
  });

  it('throws NotFoundException when the audit log is outside the caller scope', async () => {
    const { controller } = createService({ row: undefined });

    await expect(
      controller.get({ clerkUserId: 'clerk-1' }, logId, farmId),
    ).rejects.toThrow(NotFoundException);
  });
});

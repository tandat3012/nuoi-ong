import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, count, desc, eq, inArray, SQL } from 'drizzle-orm';
import { PaginationParams } from '../../common/query-params';
import { DatabaseService } from '../../db/database.service';
import { assets, maintenanceRecords, maintenanceStatus } from '../../db/schema';
import { WarehousesService } from '../warehouses/warehouses.service';
import { CreateMaintenanceRecordDto, UpdateMaintenanceRecordDto } from './dto/maintenance.dto';

type Filters = PaginationParams & { farmId: string; clerkUserId: string; assetId?: string; status?: (typeof maintenanceStatus.enumValues)[number] };

@Injectable()
export class MaintenanceService {
  constructor(private readonly databaseService: DatabaseService, private readonly warehousesService: WarehousesService) {}

  async list(filters: Filters) {
    await this.warehousesService.assertFarmAccess(filters.farmId, filters.clerkUserId, false);
    const conditions: SQL[] = [eq(maintenanceRecords.farmId, filters.farmId)];
    if (filters.assetId) conditions.push(eq(maintenanceRecords.assetId, filters.assetId));
    if (filters.status) conditions.push(eq(maintenanceRecords.status, filters.status));
    const where = and(...conditions);
    const [data, totals] = await Promise.all([
      this.databaseService.db.select().from(maintenanceRecords).where(where).orderBy(desc(maintenanceRecords.createdAt)).limit(filters.pageSize).offset(filters.offset),
      this.databaseService.db.select({ value: count() }).from(maintenanceRecords).where(where),
    ]);
    const totalItems = Number(totals[0]?.value ?? 0);
    return { data, page: { number: filters.page, size: filters.pageSize, totalItems, totalPages: Math.ceil(totalItems / filters.pageSize) } };
  }

  async get(id: string, farmId: string, clerkUserId: string) { await this.warehousesService.assertFarmAccess(farmId, clerkUserId, false); return this.getOnly(id, farmId); }

  async create(farmId: string, clerkUserId: string, input: CreateMaintenanceRecordDto) {
    await this.warehousesService.assertFarmAccess(farmId, clerkUserId, true);
    const [asset] = await this.databaseService.db.select({ id: assets.id }).from(assets).where(and(eq(assets.id, input.assetId), eq(assets.farmId, farmId)));
    if (!asset) throw new NotFoundException('Asset not found');
    const [activeRecord] = await this.databaseService.db
      .select({ id: maintenanceRecords.id })
      .from(maintenanceRecords)
      .where(
        and(
          eq(maintenanceRecords.assetId, input.assetId),
          eq(maintenanceRecords.farmId, farmId),
          inArray(maintenanceRecords.status, ['SCHEDULED', 'IN_PROGRESS']),
        ),
      )
      .limit(1);
    if (activeRecord) {
      throw new ConflictException('Asset already has an active maintenance record');
    }
    const [record] = await this.databaseService.db.insert(maintenanceRecords).values({ farmId, assetId: input.assetId, incidentId: input.incidentId, maintenanceType: input.maintenanceType, scheduledAt: input.scheduledAt, description: input.description, performedByMemberId: input.performedByMemberId, supplierId: input.supplierId, laborCost: input.laborCost ?? '0', materialCost: input.materialCost ?? '0', otherCost: input.otherCost ?? '0' }).returning();
    return record;
  }

  async update(id: string, farmId: string, clerkUserId: string, input: UpdateMaintenanceRecordDto) {
    await this.warehousesService.assertFarmAccess(farmId, clerkUserId, true);
    const current = await this.getOnly(id, farmId);
    if (current.status === 'COMPLETED' || current.status === 'CANCELLED') throw new ConflictException('Completed or cancelled records cannot be edited');
    const changes: Partial<typeof maintenanceRecords.$inferInsert> = {};
    for (const key of ['maintenanceType', 'scheduledAt', 'description', 'resultNote', 'performedByMemberId', 'supplierId', 'laborCost', 'materialCost', 'otherCost'] as const) if (input[key] !== undefined) changes[key] = input[key] as never;
    if (!Object.keys(changes).length) return current;
    changes.updatedAt = new Date().toISOString();
    const [record] = await this.databaseService.db.update(maintenanceRecords).set(changes).where(eq(maintenanceRecords.id, id)).returning();
    return record;
  }

  async start(id: string, farmId: string, clerkUserId: string) { await this.warehousesService.assertFarmAccess(farmId, clerkUserId, true); const record = await this.getOnly(id, farmId); if (record.status !== 'SCHEDULED') throw new ConflictException('Only SCHEDULED records can start'); const now = new Date().toISOString(); const [updated] = await this.databaseService.db.update(maintenanceRecords).set({ status: 'IN_PROGRESS', startedAt: now, updatedAt: now }).where(eq(maintenanceRecords.id, id)).returning(); return updated; }
  async complete(id: string, farmId: string, clerkUserId: string) { await this.warehousesService.assertFarmAccess(farmId, clerkUserId, true); const record = await this.getOnly(id, farmId); if (record.status !== 'IN_PROGRESS') throw new ConflictException('Only IN_PROGRESS records can complete'); const now = new Date().toISOString(); const [updated] = await this.databaseService.db.update(maintenanceRecords).set({ status: 'COMPLETED', completedAt: now, updatedAt: now }).where(eq(maintenanceRecords.id, id)).returning(); return updated; }
  async cancel(id: string, farmId: string, clerkUserId: string) { await this.warehousesService.assertFarmAccess(farmId, clerkUserId, true); const record = await this.getOnly(id, farmId); if (!['SCHEDULED', 'IN_PROGRESS'].includes(record.status)) throw new ConflictException('Only active records can be cancelled'); const [updated] = await this.databaseService.db.update(maintenanceRecords).set({ status: 'CANCELLED', updatedAt: new Date().toISOString() }).where(eq(maintenanceRecords.id, id)).returning(); return updated; }
  private async getOnly(id: string, farmId: string) { const [record] = await this.databaseService.db.select().from(maintenanceRecords).where(and(eq(maintenanceRecords.id, id), eq(maintenanceRecords.farmId, farmId))).limit(1); if (!record) throw new NotFoundException('Maintenance record not found'); return record; }
}

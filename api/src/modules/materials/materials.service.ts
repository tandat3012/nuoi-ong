import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  and,
  asc,
  count,
  eq,
  gte,
  ilike,
  isNotNull,
  lte,
  or,
  SQL,
  sql,
} from 'drizzle-orm';
import { PaginationParams } from '../../common/query-params';
import { DatabaseService } from '../../db/database.service';
import {
  categories,
  inventoryBalances,
  inventoryLots,
  items,
  materialKind,
  materialProfiles,
  recordStatus,
  trackingMode,
  units,
} from '../../db/schema';
import { CreateMaterialDto } from './dto/create-material.dto';
import { UpdateMaterialDto } from './dto/update-material.dto';

type MaterialKind = (typeof materialKind.enumValues)[number];
type RecordStatus = (typeof recordStatus.enumValues)[number];
type MaterialTrackingMode = Extract<
  (typeof trackingMode.enumValues)[number],
  'QUANTITY' | 'LOT'
>;

export interface MaterialListFilters extends PaginationParams {
  farmId: string;
  search?: string;
  kind?: MaterialKind;
  trackingMode?: MaterialTrackingMode;
  status?: RecordStatus;
  categoryId?: string;
}

@Injectable()
export class MaterialsService {
  constructor(private readonly databaseService: DatabaseService) {}

  async createMaterial(farmId: string, input: CreateMaterialDto) {
    this.validateExpiryTracking(
      input.trackingMode,
      input.requiresExpiryTracking ?? false,
    );

    let itemId: string;

    try {
      itemId = await this.databaseService.db.transaction(
        async (transaction) => {
          await this.validateReferences(
            transaction,
            input.categoryId,
            input.unitId,
          );

          const [item] = await transaction
            .insert(items)
            .values({
              farmId,
              categoryId: input.categoryId,
              unitId: input.unitId,
              code: input.code,
              name: input.name,
              description: input.description,
              itemType: 'MATERIAL',
              trackingMode: input.trackingMode,
              minStockLevel: input.minStockLevel ?? '0',
              barcode: input.barcode,
              imageUrl: input.imageUrl,
              sourceUrl: input.sourceUrl,
            })
            .returning({ id: items.id });

          await transaction.insert(materialProfiles).values({
            farmId,
            itemId: item.id,
            kind: input.kind,
            requiresExpiryTracking: input.requiresExpiryTracking ?? false,
            expiryWarningDays: input.expiryWarningDays ?? 30,
            defaultShelfLifeDays: input.defaultShelfLifeDays,
            storageInstructions: input.storageInstructions,
            safetyNotes: input.safetyNotes,
          });

          return item.id;
        },
      );
    } catch (error: unknown) {
      this.throwMappedDatabaseError(error);
    }

    return this.getMaterial(itemId, farmId);
  }

  async updateMaterial(id: string, farmId: string, input: UpdateMaterialDto) {
    if (!this.hasDefinedValue(input)) {
      throw new BadRequestException('At least one field must be provided');
    }

    const current = await this.getMaterial(id, farmId);
    if (current.item.trackingMode === 'ASSET') {
      throw new ConflictException(
        'Material item has an invalid ASSET tracking mode',
      );
    }
    const nextTrackingMode = input.trackingMode ?? current.item.trackingMode;
    const nextRequiresExpiry =
      input.requiresExpiryTracking ??
      current.profile?.requiresExpiryTracking ??
      false;

    this.validateExpiryTracking(nextTrackingMode, nextRequiresExpiry);

    try {
      await this.databaseService.db.transaction(async (transaction) => {
        if (input.categoryId !== undefined || input.unitId !== undefined) {
          await this.validateReferences(
            transaction,
            input.categoryId ?? current.item.categoryId,
            input.unitId ?? current.item.unitId,
          );
        }

        if (
          input.trackingMode !== undefined &&
          input.trackingMode !== current.item.trackingMode
        ) {
          const [lotUsage] = await transaction
            .select({ value: count() })
            .from(inventoryLots)
            .where(
              and(
                eq(inventoryLots.itemId, id),
                eq(inventoryLots.farmId, farmId),
              ),
            );
          const [balanceUsage] = await transaction
            .select({ value: count() })
            .from(inventoryBalances)
            .where(
              and(
                eq(inventoryBalances.itemId, id),
                eq(inventoryBalances.farmId, farmId),
              ),
            );

          if (
            Number(lotUsage?.value ?? 0) > 0 ||
            Number(balanceUsage?.value ?? 0) > 0
          ) {
            throw new ConflictException(
              'Tracking mode cannot change after inventory data exists',
            );
          }
        }

        const itemChanges: Partial<typeof items.$inferInsert> = {};
        this.assignDefined(itemChanges, 'categoryId', input.categoryId);
        this.assignDefined(itemChanges, 'unitId', input.unitId);
        this.assignDefined(itemChanges, 'code', input.code);
        this.assignDefined(itemChanges, 'name', input.name);
        this.assignDefined(itemChanges, 'description', input.description);
        this.assignDefined(itemChanges, 'trackingMode', input.trackingMode);
        this.assignDefined(itemChanges, 'minStockLevel', input.minStockLevel);
        this.assignDefined(itemChanges, 'barcode', input.barcode);
        this.assignDefined(itemChanges, 'imageUrl', input.imageUrl);
        this.assignDefined(itemChanges, 'sourceUrl', input.sourceUrl);
        this.assignDefined(itemChanges, 'status', input.status);

        if (Object.keys(itemChanges).length > 0) {
          itemChanges.updatedAt = new Date().toISOString();
          await transaction
            .update(items)
            .set(itemChanges)
            .where(and(eq(items.id, id), eq(items.farmId, farmId)));
        }

        const profileChanges: Partial<typeof materialProfiles.$inferInsert> =
          {};
        this.assignDefined(profileChanges, 'kind', input.kind);
        this.assignDefined(
          profileChanges,
          'requiresExpiryTracking',
          input.requiresExpiryTracking,
        );
        this.assignDefined(
          profileChanges,
          'expiryWarningDays',
          input.expiryWarningDays,
        );
        this.assignDefined(
          profileChanges,
          'defaultShelfLifeDays',
          input.defaultShelfLifeDays,
        );
        this.assignDefined(
          profileChanges,
          'storageInstructions',
          input.storageInstructions,
        );
        this.assignDefined(profileChanges, 'safetyNotes', input.safetyNotes);

        if (current.profile) {
          if (Object.keys(profileChanges).length > 0) {
            profileChanges.updatedAt = new Date().toISOString();
            await transaction
              .update(materialProfiles)
              .set(profileChanges)
              .where(eq(materialProfiles.itemId, id));
          }
        } else {
          await transaction.insert(materialProfiles).values({
            farmId,
            itemId: id,
            kind: input.kind ?? 'CONSUMABLE',
            requiresExpiryTracking: input.requiresExpiryTracking ?? false,
            expiryWarningDays: input.expiryWarningDays ?? 30,
            defaultShelfLifeDays: input.defaultShelfLifeDays,
            storageInstructions: input.storageInstructions,
            safetyNotes: input.safetyNotes,
          });
        }
      });
    } catch (error: unknown) {
      this.throwMappedDatabaseError(error);
    }

    return this.getMaterial(id, farmId);
  }

  async listMaterials(filters: MaterialListFilters) {
    const predicates: SQL[] = [
      eq(items.farmId, filters.farmId),
      eq(items.itemType, 'MATERIAL'),
    ];

    if (filters.search) {
      predicates.push(
        or(
          ilike(items.code, `%${filters.search}%`),
          ilike(items.name, `%${filters.search}%`),
          ilike(items.barcode, `%${filters.search}%`),
        )!,
      );
    }
    if (filters.kind) {
      predicates.push(eq(materialProfiles.kind, filters.kind));
    }
    if (filters.trackingMode) {
      predicates.push(eq(items.trackingMode, filters.trackingMode));
    }
    if (filters.status) {
      predicates.push(eq(items.status, filters.status));
    }
    if (filters.categoryId) {
      predicates.push(eq(items.categoryId, filters.categoryId));
    }

    const where = and(...predicates);
    const quantityOnHand = sql<string>`COALESCE((
      SELECT SUM(${inventoryBalances.quantityOnHand})
      FROM ${inventoryBalances}
      WHERE ${inventoryBalances.itemId} = ${items.id}
        AND ${inventoryBalances.farmId} = ${items.farmId}
    ), 0)::text`;
    const [data, totalRows] = await Promise.all([
      this.databaseService.db
        .select({
          item: items,
          profile: materialProfiles,
          categoryName: categories.name,
          unitName: units.name,
          unitSymbol: units.symbol,
          quantityOnHand,
        })
        .from(items)
        .leftJoin(materialProfiles, eq(materialProfiles.itemId, items.id))
        .innerJoin(categories, eq(items.categoryId, categories.id))
        .innerJoin(units, eq(items.unitId, units.id))
        .where(where)
        .orderBy(asc(items.name))
        .limit(filters.pageSize)
        .offset(filters.offset),
      this.databaseService.db
        .select({ value: count() })
        .from(items)
        .leftJoin(materialProfiles, eq(materialProfiles.itemId, items.id))
        .where(where),
    ]);

    const totalItems = Number(totalRows[0]?.value ?? 0);

    return {
      data,
      page: {
        number: filters.page,
        size: filters.pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / filters.pageSize),
      },
    };
  }

  async getMaterial(id: string, farmId: string) {
    const [material] = await this.databaseService.db
      .select({
        item: items,
        profile: materialProfiles,
        categoryName: categories.name,
        unitName: units.name,
        unitSymbol: units.symbol,
      })
      .from(items)
      .leftJoin(materialProfiles, eq(materialProfiles.itemId, items.id))
      .innerJoin(categories, eq(items.categoryId, categories.id))
      .innerJoin(units, eq(items.unitId, units.id))
      .where(
        and(
          eq(items.id, id),
          eq(items.farmId, farmId),
          eq(items.itemType, 'MATERIAL'),
        ),
      )
      .limit(1);

    if (!material) {
      throw new NotFoundException('Material not found');
    }

    return material;
  }

  async listMaterialLots(id: string, farmId: string) {
    await this.getMaterial(id, farmId);

    const data = await this.databaseService.db
      .select({
        lot: inventoryLots,
        quantityOnHand: sql<string>`COALESCE(SUM(${inventoryBalances.quantityOnHand}), 0)::text`,
      })
      .from(inventoryLots)
      .leftJoin(
        inventoryBalances,
        and(
          eq(inventoryBalances.lotId, inventoryLots.id),
          eq(inventoryBalances.farmId, farmId),
        ),
      )
      .where(
        and(eq(inventoryLots.itemId, id), eq(inventoryLots.farmId, farmId)),
      )
      .groupBy(inventoryLots.id)
      .orderBy(sql`${inventoryLots.expiryDate} ASC NULLS LAST`);

    return { data };
  }

  async listExpiringMaterials(farmId: string, days: number) {
    const data = await this.databaseService.db
      .select({
        itemId: items.id,
        itemCode: items.code,
        itemName: items.name,
        expiryWarningDays: materialProfiles.expiryWarningDays,
        lot: inventoryLots,
        quantityOnHand: sql<string>`COALESCE(SUM(${inventoryBalances.quantityOnHand}), 0)::text`,
      })
      .from(inventoryLots)
      .innerJoin(items, eq(inventoryLots.itemId, items.id))
      .leftJoin(materialProfiles, eq(materialProfiles.itemId, items.id))
      .leftJoin(
        inventoryBalances,
        and(
          eq(inventoryBalances.lotId, inventoryLots.id),
          eq(inventoryBalances.farmId, farmId),
        ),
      )
      .where(
        and(
          eq(items.farmId, farmId),
          eq(items.itemType, 'MATERIAL'),
          eq(items.trackingMode, 'LOT'),
          isNotNull(inventoryLots.expiryDate),
          gte(inventoryLots.expiryDate, sql`CURRENT_DATE`),
          lte(
            inventoryLots.expiryDate,
            sql`CURRENT_DATE + (${days} * INTERVAL '1 day')`,
          ),
        ),
      )
      .groupBy(items.id, materialProfiles.id, inventoryLots.id)
      .orderBy(asc(inventoryLots.expiryDate));

    return { data, days };
  }

  private validateExpiryTracking(
    trackingMode: 'QUANTITY' | 'LOT',
    requiresExpiryTracking: boolean,
  ): void {
    if (requiresExpiryTracking && trackingMode !== 'LOT') {
      throw new BadRequestException(
        'Expiry-tracked material must use LOT tracking mode',
      );
    }
  }

  private async validateReferences(
    transaction: Parameters<
      Parameters<typeof this.databaseService.db.transaction>[0]
    >[0],
    categoryId: string,
    unitId: string,
  ): Promise<void> {
    const [category] = await transaction
      .select({ id: categories.id, status: categories.status })
      .from(categories)
      .where(eq(categories.id, categoryId))
      .limit(1);
    const [unit] = await transaction
      .select({ id: units.id, status: units.status })
      .from(units)
      .where(eq(units.id, unitId))
      .limit(1);

    if (!category || category.status !== 'ACTIVE') {
      throw new BadRequestException('Category does not exist or is inactive');
    }
    if (!unit || unit.status !== 'ACTIVE') {
      throw new BadRequestException('Unit does not exist or is inactive');
    }
  }

  private hasDefinedValue(value: object): boolean {
    return Object.values(value).some((field) => field !== undefined);
  }

  private assignDefined<T extends object, K extends keyof T>(
    target: T,
    key: K,
    value: T[K] | undefined,
  ): void {
    if (value !== undefined) {
      target[key] = value;
    }
  }

  private throwMappedDatabaseError(error: unknown): never {
    if (error instanceof HttpException) {
      throw error;
    }

    const databaseError = this.unwrapDatabaseError(error);

    if (!databaseError) {
      throw error;
    }

    if (databaseError.code === '23505') {
      throw new ConflictException({
        code: 'DUPLICATE_MATERIAL',
        message: 'Material code, barcode, or profile already exists',
        constraint: databaseError.constraint,
      });
    }
    if (
      databaseError.code === '23503' ||
      databaseError.code === '23514' ||
      databaseError.code === 'P0001'
    ) {
      throw new BadRequestException({
        code: 'INVALID_MATERIAL_DATA',
        message: databaseError.message ?? 'Material data is invalid',
        constraint: databaseError.constraint,
      });
    }

    throw error;
  }

  private unwrapDatabaseError(error: unknown):
    | {
        code?: string;
        constraint?: string;
        message?: string;
      }
    | undefined {
    let current: unknown = error;

    while (current && typeof current === 'object') {
      const candidate = current as {
        code?: string;
        constraint?: string;
        message?: string;
        cause?: unknown;
      };

      if (candidate.code) {
        return candidate;
      }

      current = candidate.cause;
    }

    return undefined;
  }
}

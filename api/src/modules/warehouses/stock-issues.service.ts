import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  and,
  asc,
  count,
  desc,
  eq,
  getTableColumns,
  gte,
  isNull,
  lte,
  or,
  sql,
  SQL,
} from 'drizzle-orm';
import { PaginationParams } from '../../common/query-params';
import { DatabaseService } from '../../db/database.service';
import {
  assets,
  farmMembers,
  inventoryBalances,
  inventoryLots,
  inventoryTransactions,
  items,
  locations,
  maintenanceRecords,
  stockIssueItems,
  stockIssues,
  storeOrders,
  storeOrderItems,
  storeWarrantyRequests,
  units,
  users,
  warehouses,
} from '../../db/schema';
import { CreateStockIssueDto } from './dto/create-stock-issue.dto';
import { UpdateStockIssueDto } from './dto/update-stock-issue.dto';
import { assertInScope, inScope, scopeCondition } from './warehouse-scope';
import { assertOwnDocument, WarehousesService } from './warehouses.service';
import { auditStockDocument } from './stock-document-audit';
import {
  confirmationCode,
  ignoreLegacyCode,
  numberingOptionChanges,
  rethrowCodeConflict,
} from './stock-document-code';
import {
  notifyDocumentCreator,
  notifyFarmApprovers,
} from '../notifications/notification-events';
import { quantityMillis } from '../store-orders/store-order.rules';
import {
  hasAnyRole,
  WAREHOUSE_MANAGE_ROLES,
} from '../auth/farm-access/farm-role-groups';
import { activeMaintenanceCondition } from '../maintenance/maintenance-state';
import { assertHoldsStillCovered } from './stock-holds';

type Filters = PaginationParams & {
  farmId: string;
  clerkUserId: string;
  status?: typeof stockIssues.$inferSelect.status;
  dateFrom?: string;
  dateTo?: string;
};
type Db = DatabaseService['db'];
type Transaction = Parameters<Parameters<Db['transaction']>[0]>[0];

@Injectable()
export class StockIssuesService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly warehousesService: WarehousesService,
  ) {}

  async list(filters: Filters) {
    const {
      memberId: readMemberId,
      viewerId,
      scope,
    } = await this.warehousesService.documentReadScope(
      filters.farmId,
      filters.clerkUserId,
    );

    const conditions: SQL[] = [eq(stockIssues.farmId, filters.farmId)];
    const own = and(
      scopeCondition(stockIssues.warehouseId, scope),
      readMemberId
        ? eq(stockIssues.createdByMemberId, readMemberId)
        : undefined,
    );
    // The recipient always sees the issues handed to them.
    if (own)
      conditions.push(or(own, eq(stockIssues.recipientMemberId, viewerId))!);

    if (filters.status) conditions.push(eq(stockIssues.status, filters.status));
    if (filters.dateFrom)
      conditions.push(gte(stockIssues.issueDate, filters.dateFrom));
    if (filters.dateTo)
      conditions.push(lte(stockIssues.issueDate, filters.dateTo));

    const where = and(...conditions);
    const [data, totals] = await Promise.all([
      this.databaseService.db
        .select({
          ...getTableColumns(stockIssues),
          warehouseCode: warehouses.code,
          warehouseName: warehouses.name,
        })
        .from(stockIssues)
        .leftJoin(
          warehouses,
          and(
            eq(warehouses.id, stockIssues.warehouseId),
            eq(warehouses.farmId, stockIssues.farmId),
          ),
        )
        .where(where)
        .orderBy(desc(stockIssues.createdAt), desc(stockIssues.id))
        .limit(filters.pageSize)
        .offset(filters.offset),

      this.databaseService.db
        .select({ value: count() })
        .from(stockIssues)
        .where(where),
    ]);
    const totalItems = Number(totals[0]?.value ?? 0);
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

  async get(id: string, farmId: string, clerkUserId: string) {
    const {
      memberId: readMemberId,
      viewerId,
      scope,
    } = await this.warehousesService.documentReadScope(farmId, clerkUserId);
    const result = await this.withItems(id, farmId);
    if (
      result.issue.recipientMemberId !== viewerId &&
      ((readMemberId && result.issue.createdByMemberId !== readMemberId) ||
        !inScope(scope, result.issue.warehouseId))
    )
      throw new NotFoundException('Stock issue not found');
    return result;
  }

  async create(
    farmId: string,
    clerkUserId: string,
    input: CreateStockIssueDto,
  ) {
    const writer = await this.warehousesService.assertDocumentWriter(
      farmId,
      clerkUserId,
    );
    assertInScope(writer.scope, input.warehouseId);
    const { memberId } = writer;
    const numbering = numberingOptionChanges(input, writer);
    this.validateItems(input.items);
    const issueType = input.issueType ?? 'CONSUMPTION';
    if (issueType === 'SALE')
      throw new BadRequestException('SALE issues are created through orders');

    await this.validateMaintenance(
      farmId,
      issueType,
      input.maintenanceRecordId,
    );

    const id = await this.databaseService.db
      .transaction(async (tx) => {
        await this.assertWarehouse(tx, farmId, input.warehouseId);
        await this.validateLines(tx, farmId, input.items, issueType);
        if (input.recipientMemberId)
          await this.assertRecipient(tx, farmId, input.recipientMemberId);
        ignoreLegacyCode('issueCode', input.issueCode);
        const [issue] = await tx
          .insert(stockIssues)
          .values({
            ...numbering,
            farmId,
            warehouseId: input.warehouseId,
            issueDate: input.issueDate,
            issueType,
            maintenanceRecordId: input.maintenanceRecordId,
            recipientMemberId: input.recipientMemberId,
            reason: input.reason,
            note: input.note,
            createdByMemberId: memberId,
          })
          .returning();
        await tx.insert(stockIssueItems).values(
          input.items.map((line) => ({
            stockIssueId: issue.id,
            itemId: line.itemId,
            lotId: line.lotId,
            assetId: line.assetId,
            quantity: line.quantity,
            note: line.note,
          })),
        );
        await auditStockDocument(
          tx,
          memberId,
          'STOCK_ISSUE',
          'CREATE',
          null,
          issue,
          {
            after: input.items,
          },
        );
        return issue.id;
      })
      .catch((error: unknown) => this.throwDuplicateCode(error));
    return this.withItems(id, farmId);
  }

  async update(
    id: string,
    farmId: string,
    clerkUserId: string,
    input: UpdateStockIssueDto,
  ) {
    const writer = await this.warehousesService.assertDocumentWriter(
      farmId,
      clerkUserId,
    );
    const numbering = numberingOptionChanges(input, writer);
    await this.databaseService.db
      .transaction(async (tx) => {
        const current = await this.getOnly(id, farmId, tx, true);
        assertOwnDocument(
          writer,
          current.createdByMemberId,
          current.warehouseId,
        );
        if (input.warehouseId) assertInScope(writer.scope, input.warehouseId);
        if (current.status !== 'DRAFT')
          throw new ConflictException('Only DRAFT issues can be edited');
        const issueType = input.issueType ?? current.issueType;
        await this.validateMaintenance(
          farmId,
          issueType,
          input.maintenanceRecordId === undefined
            ? current.maintenanceRecordId
            : input.maintenanceRecordId,
          tx,
        );
        const lines =
          input.items ??
          (await tx
            .select()
            .from(stockIssueItems)
            .where(eq(stockIssueItems.stockIssueId, id)));
        if (current.orderId) {
          if (
            (input.warehouseId && input.warehouseId !== current.warehouseId) ||
            (input.issueType && input.issueType !== 'SALE')
          )
            throw new ConflictException(
              'Order issue warehouse and type cannot change',
            );
          await this.assertOrderLines(tx, current.orderId, lines);
        } else if (current.warrantyRequestId) {
          if (
            (input.warehouseId && input.warehouseId !== current.warehouseId) ||
            (input.issueType && input.issueType !== 'OTHER')
          )
            throw new ConflictException(
              'Warranty exchange issue warehouse and type cannot change',
            );
          await this.assertWarrantyLines(
            tx,
            current.warrantyRequestId,
            current.warehouseId,
            lines,
          );
        } else if (issueType === 'SALE') {
          throw new ConflictException('SALE issues must be linked to an order');
        }
        await this.validateLines(tx, farmId, lines, issueType);
        let previousLines: (typeof stockIssueItems.$inferSelect)[] | undefined;
        if (input.items) {
          this.validateItems(input.items);
          previousLines = await tx
            .select()
            .from(stockIssueItems)
            .where(eq(stockIssueItems.stockIssueId, id));
          await tx
            .delete(stockIssueItems)
            .where(eq(stockIssueItems.stockIssueId, id));
          await tx.insert(stockIssueItems).values(
            input.items.map((line) => ({
              stockIssueId: id,
              itemId: line.itemId,
              lotId: line.lotId,
              assetId: line.assetId,
              quantity: line.quantity,
              note: line.note,
            })),
          );
          // A held issue edited onto other lots/assets must be covered there too.
          if (current.orderId || current.warrantyRequestId)
            await this.assertEditedHold(
              tx,
              farmId,
              current.warehouseId,
              id,
              input.items,
            );
        }
        if (input.warehouseId)
          await this.assertWarehouse(tx, farmId, input.warehouseId);
        if (input.recipientMemberId)
          await this.assertRecipient(tx, farmId, input.recipientMemberId);
        const changes: Partial<typeof stockIssues.$inferInsert> = {};
        for (const key of [
          'warehouseId',
          'issueDate',
          'issueType',
          'maintenanceRecordId',
          'recipientMemberId',
          'reason',
          'note',
        ] as const)
          if (input[key] !== undefined) changes[key] = input[key] as never;
        changes.updatedAt = new Date().toISOString();
        Object.assign(changes, numbering);
        ignoreLegacyCode('issueCode', input.issueCode);
        if (Object.keys(changes).length)
          await tx
            .update(stockIssues)
            .set(changes)
            .where(eq(stockIssues.id, id));
        await auditStockDocument(
          tx,
          writer.memberId,
          'STOCK_ISSUE',
          'UPDATE',
          current,
          { ...current, ...changes },
          input.items ? { before: previousLines, after: input.items } : {},
        );
      })
      .catch((error: unknown) => this.throwDuplicateCode(error));
    return this.withItems(id, farmId);
  }

  async cancel(id: string, farmId: string, clerkUserId: string) {
    const writer = await this.warehousesService.assertDocumentWriter(
      farmId,
      clerkUserId,
    );
    await this.databaseService.db.transaction(async (tx) => {
      const issue = await this.getOnly(id, farmId, tx, true);
      assertOwnDocument(writer, issue.createdByMemberId, issue.warehouseId);
      if (issue.orderId)
        throw new ConflictException('Cancel the linked order instead');
      if (issue.status !== 'DRAFT')
        throw new ConflictException('Only DRAFT issues can be cancelled');
      await tx
        .update(stockIssues)
        .set({
          status: 'CANCELLED',
          cancelledAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(stockIssues.id, id));
      await auditStockDocument(
        tx,
        writer.memberId,
        'STOCK_ISSUE',
        'CANCEL',
        issue,
        {
          ...issue,
          status: 'CANCELLED',
        },
      );
    });
    return this.withItems(id, farmId);
  }

  async submit(id: string, farmId: string, clerkUserId: string) {
    const writer = await this.warehousesService.assertDocumentWriter(
      farmId,
      clerkUserId,
    );
    await this.databaseService.db.transaction(async (tx) => {
      const issue = await this.getOnly(id, farmId, tx, true);
      assertOwnDocument(writer, issue.createdByMemberId, issue.warehouseId);
      if (issue.status !== 'DRAFT')
        throw new ConflictException('Only DRAFT issues can be submitted');
      const [line] = await tx
        .select({ id: stockIssueItems.id })
        .from(stockIssueItems)
        .where(eq(stockIssueItems.stockIssueId, id))
        .limit(1);
      if (!line)
        throw new BadRequestException('Issue must contain at least one item');
      await tx
        .update(stockIssues)
        .set({
          status: 'PENDING_APPROVAL',
          updatedAt: new Date().toISOString(),
        })
        .where(eq(stockIssues.id, id));
      await auditStockDocument(
        tx,
        writer.memberId,
        'STOCK_ISSUE',
        'SUBMIT',
        issue,
        {
          ...issue,
          status: 'PENDING_APPROVAL',
        },
      );
      await notifyFarmApprovers(
        tx,
        this.notification(issue, 'PENDING_APPROVAL'),
        writer.memberId,
        issue.warehouseId,
      );
    });
    return this.withItems(id, farmId);
  }

  async reject(
    id: string,
    farmId: string,
    clerkUserId: string,
    rejectionReason: string,
  ) {
    const { memberId, scope } = await this.warehousesService.assertScopedAccess(
      farmId,
      clerkUserId,
      true,
      WAREHOUSE_MANAGE_ROLES,
    );
    const reason = rejectionReason.trim();
    if (!reason) throw new BadRequestException('Rejection reason is required');
    await this.databaseService.db.transaction(async (tx) => {
      const issue = await this.getOnly(id, farmId, tx, true);
      assertInScope(scope, issue.warehouseId);
      if (issue.orderId)
        throw new ConflictException('Cancel the linked order instead');
      if (issue.status !== 'PENDING_APPROVAL')
        throw new ConflictException(
          'Only PENDING_APPROVAL issues can be rejected',
        );
      const now = new Date().toISOString();
      await tx
        .update(stockIssues)
        .set({
          status: 'REJECTED',
          rejectionReason: reason,
          rejectedByMemberId: memberId,
          rejectedAt: now,
          updatedAt: now,
        })
        .where(eq(stockIssues.id, id));
      await auditStockDocument(tx, memberId, 'STOCK_ISSUE', 'REJECT', issue, {
        ...issue,
        status: 'REJECTED',
        rejectionReason: reason,
      });
      if (issue.createdByMemberId !== memberId)
        await notifyDocumentCreator(
          tx,
          { ...this.notification(issue, 'REJECTED'), rejectionReason: reason },
          issue.createdByMemberId,
        );
    });
    return this.withItems(id, farmId);
  }

  async confirm(id: string, farmId: string, clerkUserId: string) {
    const { memberId, scope } = await this.warehousesService.assertScopedAccess(
      farmId,
      clerkUserId,
      true,
      WAREHOUSE_MANAGE_ROLES,
    );
    const confirmation = this.databaseService.db.transaction(async (tx) => {
      const issue = await this.getOnly(id, farmId, tx, true);
      assertInScope(scope, issue.warehouseId);
      // A repeated confirmation returns the confirmed issue unchanged.
      if (issue.status === 'CONFIRMED') return;
      if (!['DRAFT', 'PENDING_APPROVAL'].includes(issue.status))
        throw new ConflictException(
          'Only DRAFT or PENDING_APPROVAL issues can be confirmed',
        );
      await this.assertWarehouse(tx, farmId, issue.warehouseId);
      if (issue.maintenanceRecordId) {
        const [maintenance] = await tx
          .select({ status: maintenanceRecords.status })
          .from(maintenanceRecords)
          .where(
            and(
              eq(maintenanceRecords.id, issue.maintenanceRecordId),
              eq(maintenanceRecords.farmId, farmId),
            ),
          )
          .for('update');
        if (!maintenance)
          throw new NotFoundException('Maintenance record not found');
        if (!['SCHEDULED', 'IN_PROGRESS'].includes(maintenance.status))
          throw new ConflictException(
            'Maintenance record must be SCHEDULED or IN_PROGRESS',
          );
      }
      const lines = await tx
        .select()
        .from(stockIssueItems)
        .where(eq(stockIssueItems.stockIssueId, id))
        .orderBy(
          asc(stockIssueItems.itemId),
          asc(stockIssueItems.lotId),
          asc(stockIssueItems.assetId),
        );
      if (!lines.length)
        throw new BadRequestException('Issue must contain at least one item');
      // Bank transfers must be PAID before the goods leave, not only before delivery.
      if (
        issue.orderPayment?.method === 'BANK_TRANSFER' &&
        issue.orderPayment.status !== 'PAID'
      )
        throw new ConflictException({
          code: 'PAYMENT_NOT_VERIFIED',
          message: 'A bank transfer order must be PAID before it is issued',
        });
      if (issue.orderId) await this.assertOrderLines(tx, issue.orderId, lines);
      else if (issue.warrantyRequestId)
        await this.assertWarrantyLines(
          tx,
          issue.warrantyRequestId,
          issue.warehouseId,
          lines,
          issue.issueType,
        );
      else if (issue.issueType === 'SALE')
        throw new ConflictException('SALE issues must be linked to an order');
      if (lines.some((line) => line.assetId))
        this.assertAssetIssueType(issue.issueType, true);
      for (const line of lines) {
        const [item] = await tx
          .select({ trackingMode: items.trackingMode })
          .from(items)
          .where(and(eq(items.id, line.itemId), eq(items.farmId, farmId)));
        if (!item) throw new NotFoundException('Issue item not found');
        this.validateTracking(item.trackingMode, line);
        if (line.lotId) {
          const [lot] = await tx
            .select({ expiryDate: inventoryLots.expiryDate })
            .from(inventoryLots)
            .where(
              and(
                eq(inventoryLots.id, line.lotId),
                eq(inventoryLots.farmId, farmId),
                eq(inventoryLots.itemId, line.itemId),
              ),
            )
            .limit(1);
          if (
            !lot ||
            (lot.expiryDate &&
              lot.expiryDate < new Date().toISOString().slice(0, 10))
          )
            throw new ConflictException('LOT is missing or expired');
        }
        // Lock the shared balance before individual assets, including for multi-asset issues.
        const [balance] = await tx
          .update(inventoryBalances)
          .set({
            quantityOnHand: sql`${inventoryBalances.quantityOnHand} - ${line.quantity}`,
            updatedAt: new Date().toISOString(),
          })
          .where(
            and(
              eq(inventoryBalances.farmId, farmId),
              eq(inventoryBalances.warehouseId, issue.warehouseId),
              eq(inventoryBalances.itemId, line.itemId),
              line.lotId
                ? eq(inventoryBalances.lotId, line.lotId)
                : isNull(inventoryBalances.lotId),
              gte(inventoryBalances.quantityOnHand, line.quantity),
            ),
          )
          .returning({ id: inventoryBalances.id });
        if (!balance) throw new ConflictException('Insufficient inventory');
        await assertHoldsStillCovered(tx, balance.id, {
          issueId: id,
          assetId: line.assetId,
        });
        if (line.assetId) {
          const [asset] = await tx
            .select()
            .from(assets)
            .where(
              and(
                eq(assets.id, line.assetId),
                eq(assets.farmId, farmId),
                eq(assets.itemId, line.itemId),
              ),
            )
            .for('update');
          if (!asset || asset.status !== 'AVAILABLE')
            throw new ConflictException('ASSET is missing or unavailable');
          const [maintenance] = await tx
            .select({ id: maintenanceRecords.id })
            .from(maintenanceRecords)
            .where(
              and(
                eq(maintenanceRecords.farmId, farmId),
                eq(maintenanceRecords.assetId, asset.id),
                activeMaintenanceCondition,
              ),
            )
            .limit(1);
          if (maintenance)
            throw new ConflictException(
              'Asset has active maintenance; use the asset maintenance workflow',
            );
          const [location] = asset.currentLocationId
            ? await tx
                .select({ id: locations.id })
                .from(locations)
                .where(
                  and(
                    eq(locations.id, asset.currentLocationId),
                    eq(locations.farmId, farmId),
                    eq(locations.warehouseId, issue.warehouseId),
                    eq(locations.status, 'ACTIVE'),
                  ),
                )
                .for('share')
            : [];
          if (!location)
            throw new ConflictException(
              'ASSET must be located in the source warehouse',
            );
          await tx
            .update(assets)
            .set({
              status: ['DISPOSAL', 'SALE'].includes(issue.issueType)
                ? 'RETIRED'
                : 'IN_USE',
              ...(issue.issueType === 'SALE'
                ? { currentLocationId: null }
                : {}),
              updatedAt: new Date().toISOString(),
            })
            .where(eq(assets.id, line.assetId));
        }
        await tx.insert(inventoryTransactions).values({
          farmId,
          warehouseId: issue.warehouseId,
          itemId: line.itemId,
          lotId: line.lotId,
          assetId: line.assetId,
          transactionType:
            issue.issueType === 'MAINTENANCE' ? 'MAINTENANCE_ISSUE' : 'ISSUE',
          quantityChange: `-${line.quantity}`,
          sourceType: 'STOCK_ISSUE',
          sourceId: id,
          performedByMemberId: memberId,
        });
      }
      const confirmedAt = new Date();
      const { code: issueCode, codeSource } = await confirmationCode(
        tx,
        farmId,
        'PX',
        { code: issue.issueCode, requestedCode: issue.requestedCode },
        confirmedAt,
      );
      await tx
        .update(stockIssues)
        .set({
          status: 'CONFIRMED',
          issueCode,
          codeSource,
          confirmedByMemberId: memberId,
          confirmedAt: confirmedAt.toISOString(),
          updatedAt: confirmedAt.toISOString(),
        })
        .where(eq(stockIssues.id, id));
      const confirmed = {
        ...issue,
        issueCode,
        codeSource: codeSource ?? issue.codeSource,
        status: 'CONFIRMED' as const,
      };
      await auditStockDocument(
        tx,
        memberId,
        'STOCK_ISSUE',
        'CONFIRM',
        issue,
        confirmed,
      );
      if (issue.createdByMemberId !== memberId)
        await notifyDocumentCreator(
          tx,
          this.notification(confirmed, 'CONFIRMED'),
          issue.createdByMemberId,
        );
    });
    await confirmation.catch(rethrowCodeConflict);
    return this.withItems(id, farmId);
  }

  private notification(
    issue: typeof stockIssues.$inferSelect,
    status: 'PENDING_APPROVAL' | 'CONFIRMED' | 'REJECTED',
  ) {
    return {
      farmId: issue.farmId,
      entityType: 'STOCK_ISSUE',
      entityId: issue.id,
      documentCode: issue.issueCode,
      documentKind: 'Phiếu xuất kho',
      status,
    };
  }

  private throwDuplicateCode(error: unknown): never {
    const databaseError = error as {
      code?: string;
      constraint?: string;
      cause?: { code?: string; constraint?: string };
    };
    const code = databaseError?.code ?? databaseError?.cause?.code;
    const constraint =
      databaseError?.constraint ?? databaseError?.cause?.constraint;
    if (code === '23505' && constraint === 'uq_issue_code_per_farm') {
      throw new ConflictException('Issue code already exists for this farm');
    }
    throw error;
  }

  /** NV02: the recipient confirms they got the confirmed issue; a manager may record it for them with a note. Never touches stock. */
  async acknowledge(
    id: string,
    farmId: string,
    clerkUserId: string,
    note?: string | null,
  ) {
    const { memberId, roleCodes } =
      await this.warehousesService.getActiveMembership(farmId, clerkUserId);
    const receiptNote = note?.trim() || null;
    await this.databaseService.db.transaction(async (tx) => {
      const [issue] = await tx
        .select()
        .from(stockIssues)
        .where(and(eq(stockIssues.id, id), eq(stockIssues.farmId, farmId)))
        .for('update')
        .limit(1);
      if (!issue) throw new NotFoundException('Stock issue not found');
      const isRecipient = issue.recipientMemberId === memberId;
      if (!isRecipient) {
        const scope = await this.warehousesService.warehouseScope(
          farmId,
          clerkUserId,
        );
        if (
          !hasAnyRole(roleCodes, WAREHOUSE_MANAGE_ROLES) ||
          !inScope(scope, issue.warehouseId)
        )
          throw new NotFoundException('Stock issue not found');
      }
      if (issue.status !== 'CONFIRMED')
        throw new ConflictException('Only CONFIRMED issues can be received');
      if (!issue.recipientMemberId)
        throw new ConflictException('This issue has no recipient');
      // Retried acknowledgement: already recorded, nothing changes.
      if (issue.receivedAt) return;
      if (!isRecipient && !receiptNote)
        throw new BadRequestException(
          'A note is required when recording receipt for the recipient',
        );
      const now = new Date().toISOString();
      const [updated] = await tx
        .update(stockIssues)
        .set({
          receivedAt: now,
          receivedRecordedByMemberId: memberId,
          receiptNote,
          updatedAt: now,
        })
        .where(eq(stockIssues.id, id))
        .returning();
      await auditStockDocument(
        tx,
        memberId,
        'STOCK_ISSUE',
        'ACKNOWLEDGE',
        issue,
        updated,
      );
    });
    return this.withItems(id, farmId);
  }

  private async assertRecipient(
    tx: Transaction,
    farmId: string,
    memberId: string,
  ) {
    const [member] = await tx
      .select({ id: farmMembers.id })
      .from(farmMembers)
      .where(
        and(
          eq(farmMembers.id, memberId),
          eq(farmMembers.farmId, farmId),
          eq(farmMembers.status, 'ACTIVE'),
        ),
      )
      .limit(1);
    if (!member)
      throw new BadRequestException('Recipient must be an active farm member');
  }

  private async getOnly(
    id: string,
    farmId: string,
    db: Db | Transaction = this.databaseService.db,
    forUpdate = false,
  ) {
    // Every linked operation locks the order before its issue, including approval.
    const orderQuery = db
      .select()
      .from(storeOrders)
      .where(
        and(eq(storeOrders.stockIssueId, id), eq(storeOrders.farmId, farmId)),
      );
    const [order] = forUpdate
      ? await orderQuery.for('update')
      : await orderQuery;
    if (forUpdate && order && order.status !== 'CONFIRMED')
      throw new ConflictException('The linked order must be CONFIRMED');
    const query = db
      .select()
      .from(stockIssues)
      .where(and(eq(stockIssues.id, id), eq(stockIssues.farmId, farmId)))
      .limit(1);
    const warrantyQuery = db
      .select({ id: storeWarrantyRequests.id })
      .from(storeWarrantyRequests)
      .where(
        and(
          eq(storeWarrantyRequests.exchangeIssueId, id),
          eq(storeWarrantyRequests.farmId, farmId),
        ),
      );
    // A warranty exchange issue is locked through its request, before the issue.
    const [warranty] = order
      ? []
      : forUpdate
        ? await warrantyQuery.for('update')
        : await warrantyQuery;
    const [issue] = forUpdate ? await query.for('update') : await query;
    if (!issue) throw new NotFoundException('Stock issue not found');
    return {
      ...issue,
      orderId: order?.id ?? null,
      orderPayment: order
        ? { method: order.paymentMethod, status: order.paymentStatus }
        : null,
      warrantyRequestId: warranty?.id ?? null,
    };
  }

  private async withItems(id: string, farmId: string) {
    const [issue] = await this.databaseService.db
      .select({
        ...getTableColumns(stockIssues),
        warehouseCode: warehouses.code,
        warehouseName: warehouses.name,
        recipientName: sql<
          string | null
        >`coalesce(${users.fullName}, ${users.email})`,
      })
      .from(stockIssues)
      .leftJoin(
        warehouses,
        and(
          eq(warehouses.id, stockIssues.warehouseId),
          eq(warehouses.farmId, stockIssues.farmId),
        ),
      )
      .leftJoin(farmMembers, eq(farmMembers.id, stockIssues.recipientMemberId))
      .leftJoin(users, eq(users.id, farmMembers.userId))
      .where(and(eq(stockIssues.id, id), eq(stockIssues.farmId, farmId)))
      .limit(1);
    if (!issue) throw new NotFoundException('Stock issue not found');
    const lines = await this.databaseService.db
      .select({
        ...getTableColumns(stockIssueItems),
        itemCode: items.code,
        itemName: items.name,
        trackingMode: items.trackingMode,
        unitName: units.name,
        unitSymbol: units.symbol,
        lotCode: inventoryLots.lotCode,
        lotSupplierLotNumber: inventoryLots.supplierLotNumber,
        lotNumber: inventoryLots.lotCode, // deprecated alias of lotCode
        lotExpiryDate: inventoryLots.expiryDate,
        assetCode: assets.assetCode,
        serialNumber: assets.serialNumber,
      })
      .from(stockIssueItems)
      .leftJoin(
        items,
        and(eq(items.id, stockIssueItems.itemId), eq(items.farmId, farmId)),
      )
      .leftJoin(units, eq(units.id, items.unitId))
      .leftJoin(
        inventoryLots,
        and(
          eq(inventoryLots.id, stockIssueItems.lotId),
          eq(inventoryLots.farmId, farmId),
          eq(inventoryLots.itemId, items.id),
        ),
      )
      .leftJoin(
        assets,
        and(
          eq(assets.id, stockIssueItems.assetId),
          eq(assets.farmId, farmId),
          eq(assets.itemId, items.id),
        ),
      )
      .where(eq(stockIssueItems.stockIssueId, id))
      .orderBy(asc(stockIssueItems.createdAt), asc(stockIssueItems.id));
    const [order] = await this.databaseService.db
      .select({ id: storeOrders.id })
      .from(storeOrders)
      .where(
        and(eq(storeOrders.stockIssueId, id), eq(storeOrders.farmId, farmId)),
      )
      .limit(1);
    return { issue: { ...issue, orderId: order?.id ?? null }, items: lines };
  }

  private async assertOrderLines(
    db: Db | Transaction,
    orderId: string,
    lines: CreateStockIssueDto['items'],
  ) {
    const expected = await db
      .select()
      .from(storeOrderItems)
      .where(eq(storeOrderItems.orderId, orderId));
    const totals = new Map<string, bigint>();
    for (const line of lines)
      totals.set(
        line.itemId,
        (totals.get(line.itemId) ?? 0n) + quantityMillis(line.quantity),
      );
    if (
      totals.size !== expected.length ||
      expected.some(
        (line) =>
          totals.get(line.itemId) !== quantityMillis(line.stockQuantity),
      )
    )
      throw new ConflictException(
        'Issue items and stock quantities must match the linked order',
      );
  }

  private async assertEditedHold(
    tx: Transaction,
    farmId: string,
    warehouseId: string,
    issueId: string,
    lines: CreateStockIssueDto['items'],
  ) {
    // Same lock order as order confirmation: balances by item then lot.
    const ordered = [...lines].sort(
      (a, b) =>
        a.itemId.localeCompare(b.itemId) ||
        (a.lotId ?? '').localeCompare(b.lotId ?? ''),
    );
    for (const line of ordered) {
      const [balance] = await tx
        .select({ id: inventoryBalances.id })
        .from(inventoryBalances)
        .where(
          and(
            eq(inventoryBalances.farmId, farmId),
            eq(inventoryBalances.warehouseId, warehouseId),
            eq(inventoryBalances.itemId, line.itemId),
            line.lotId
              ? eq(inventoryBalances.lotId, line.lotId)
              : isNull(inventoryBalances.lotId),
          ),
        )
        .for('update');
      if (!balance) throw new ConflictException('Insufficient inventory');
      await assertHoldsStillCovered(tx, balance.id, {
        ownIssueId: issueId,
        assetId: line.assetId,
      });
    }
  }

  /** A warranty exchange issue ships exactly what the request approved, from the order's warehouse. */
  private async assertWarrantyLines(
    db: Db | Transaction,
    requestId: string,
    warehouseId: string,
    lines: CreateStockIssueDto['items'],
    confirmingType?: string,
  ) {
    const [row] = await db
      .select({
        status: storeWarrantyRequests.status,
        quantity: storeWarrantyRequests.quantity,
        warehouseId: storeOrders.warehouseId,
        itemId: storeOrderItems.itemId,
        stockQuantity: storeOrderItems.stockQuantity,
        orderQuantity: storeOrderItems.quantity,
      })
      .from(storeWarrantyRequests)
      .innerJoin(storeOrders, eq(storeOrders.id, storeWarrantyRequests.orderId))
      .innerJoin(
        storeOrderItems,
        eq(storeOrderItems.id, storeWarrantyRequests.orderItemId),
      )
      .where(eq(storeWarrantyRequests.id, requestId));
    if (confirmingType !== undefined && row?.status !== 'EXCHANGING')
      throw new ConflictException(
        'The warranty request is no longer waiting for this exchange issue',
      );
    // Drafts changed to another type before the update guard existed.
    if (confirmingType !== undefined && confirmingType !== 'OTHER')
      throw new ConflictException(
        'Warranty exchange issue warehouse and type cannot change',
      );
    // Same stock-per-unit arithmetic as when the issue was drafted.
    const expected =
      row &&
      (quantityMillis(row.stockQuantity) * BigInt(row.quantity)) /
        BigInt(row.orderQuantity);
    const total = lines.reduce(
      (sum, line) => sum + quantityMillis(line.quantity),
      0n,
    );
    if (
      !row ||
      row.warehouseId !== warehouseId ||
      total !== expected ||
      lines.some((line) => line.itemId !== row.itemId)
    )
      throw new ConflictException(
        'Exchange issue must match the item, quantity and warehouse of the warranty request',
      );
  }

  private validateItems(lines: CreateStockIssueDto['items']) {
    if (!lines?.length)
      throw new BadRequestException('Issue must contain at least one item');
  }

  private async assertWarehouse(
    db: Db | Transaction,
    farmId: string,
    warehouseId: string,
  ) {
    const [warehouse] = await db
      .select({ id: warehouses.id })
      .from(warehouses)
      .where(
        and(
          eq(warehouses.id, warehouseId),
          eq(warehouses.farmId, farmId),
          eq(warehouses.status, 'ACTIVE'),
        ),
      );
    if (!warehouse)
      throw new ConflictException('Warehouse must exist and be ACTIVE');
  }

  private async validateMaintenance(
    farmId: string,
    issueType: string,
    maintenanceRecordId?: string | null,
    db: Db | Transaction = this.databaseService.db,
  ) {
    if (issueType === 'MAINTENANCE' && !maintenanceRecordId)
      throw new BadRequestException(
        'MAINTENANCE issues require maintenanceRecordId',
      );
    if (issueType !== 'MAINTENANCE' && maintenanceRecordId)
      throw new BadRequestException(
        'maintenanceRecordId is only valid for MAINTENANCE issues',
      );
    if (maintenanceRecordId) {
      const [record] = await db
        .select({ id: maintenanceRecords.id })
        .from(maintenanceRecords)
        .where(
          and(
            eq(maintenanceRecords.id, maintenanceRecordId),
            eq(maintenanceRecords.farmId, farmId),
          ),
        );
      if (!record) throw new NotFoundException('Maintenance record not found');
    }
  }

  private validateTracking(
    mode: typeof items.$inferSelect.trackingMode,
    line: CreateStockIssueDto['items'][number],
  ) {
    if (!(Number(line.quantity) > 0))
      throw new BadRequestException('quantity must be greater than zero');
    if (mode === 'QUANTITY' && (line.lotId || line.assetId))
      throw new BadRequestException(
        'QUANTITY issue lines cannot contain lotId or assetId',
      );
    if (mode === 'LOT' && (!line.lotId || line.assetId))
      throw new BadRequestException(
        'LOT issue lines require lotId and cannot contain assetId',
      );
    if (
      mode === 'ASSET' &&
      (!line.assetId || line.lotId || Number(line.quantity) !== 1)
    )
      throw new BadRequestException(
        'ASSET issue lines require assetId, quantity 1, and cannot contain lotId',
      );
  }

  private async validateLines(
    db: Db | Transaction,
    farmId: string,
    lines: CreateStockIssueDto['items'],
    issueType: string,
  ) {
    for (const line of lines) {
      const [item] = await db
        .select({ trackingMode: items.trackingMode })
        .from(items)
        .where(and(eq(items.id, line.itemId), eq(items.farmId, farmId)));
      if (!item) throw new NotFoundException('Issue item not found');
      this.validateTracking(item.trackingMode, line);
      if (item.trackingMode === 'ASSET') this.assertAssetIssueType(issueType);
      if (line.lotId) {
        const [lot] = await db
          .select({ id: inventoryLots.id })
          .from(inventoryLots)
          .where(
            and(
              eq(inventoryLots.id, line.lotId),
              eq(inventoryLots.farmId, farmId),
              eq(inventoryLots.itemId, line.itemId),
            ),
          )
          .limit(1);
        if (!lot) throw new NotFoundException('LOT not found');
      }
      if (line.assetId) {
        const [asset] = await db
          .select({ id: assets.id })
          .from(assets)
          .where(
            and(
              eq(assets.id, line.assetId),
              eq(assets.farmId, farmId),
              eq(assets.itemId, line.itemId),
            ),
          );
        if (!asset) throw new NotFoundException('ASSET not found');
      }
    }
  }

  private assertAssetIssueType(issueType: string, confirming = false) {
    if (issueType === 'DAMAGE' || issueType === 'MAINTENANCE') {
      const Exception = confirming ? ConflictException : BadRequestException;
      throw new Exception(
        'ASSET damage and maintenance must use the asset lifecycle workflow; issue only QUANTITY or LOT materials',
      );
    }
  }
}

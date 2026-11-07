import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, count, desc, eq, inArray, sql, SQL } from 'drizzle-orm';
import { PaginationParams } from '../../common/query-params';
import { DatabaseService } from '../../db/database.service';
import {
  assets,
  auditLogs,
  items,
  stockIssues,
  storeOrderItems,
  storeOrders,
  storeWarrantyRequests,
} from '../../db/schema';
import {
  CreateStoreWarrantyDto,
  StoreWarrantyActionDto,
} from './dto/store-warranty.dto';
import { orderCode } from './store-order.rules';
import { StoreOrdersService } from './store-orders.service';

type Db = DatabaseService['db'];
type Transaction = Parameters<Parameters<Db['transaction']>[0]>[0];
type Request = typeof storeWarrantyRequests.$inferSelect;
type Status = Request['status'];

const OPEN: Status[] = [
  'RECEIVED',
  'AT_PARTNER',
  'AWAITING_CUSTOMER',
  'IN_REPAIR',
  'BACK_FROM_PARTNER',
  'EXCHANGING',
];

export const warrantyCode = (number: number) =>
  `BH${String(number).padStart(6, '0')}`;

export interface WarrantyFilters extends PaginationParams {
  status?: Status;
  orderId?: string;
}

/**
 * NV06 after-sales warranty and paid repair of delivered equipment/tools.
 * Sales staff record each step; the repair partner and the customer act
 * outside the system. Defective goods never return to sellable stock.
 */
@Injectable()
export class StoreWarrantiesService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly orders: StoreOrdersService,
  ) {}

  async list(farmId: string, clerkUserId: string, filters: WarrantyFilters) {
    await this.orders.staffMember(farmId, clerkUserId);
    const conditions: SQL[] = [eq(storeWarrantyRequests.farmId, farmId)];
    if (filters.status)
      conditions.push(eq(storeWarrantyRequests.status, filters.status));
    if (filters.orderId)
      conditions.push(eq(storeWarrantyRequests.orderId, filters.orderId));
    const where = and(...conditions);
    const db = this.databaseService.db;
    const [rows, [{ total }]] = await Promise.all([
      this.rows(db, where)
        .orderBy(desc(storeWarrantyRequests.createdAt))
        .limit(filters.pageSize)
        .offset(filters.offset),
      db.select({ total: count() }).from(storeWarrantyRequests).where(where),
    ]);
    return {
      data: rows.map((row) => this.present(row)),
      page: {
        number: filters.page,
        size: filters.pageSize,
        totalItems: total,
        totalPages: Math.ceil(total / filters.pageSize),
      },
    };
  }

  async get(farmId: string, clerkUserId: string, id: string) {
    await this.orders.staffMember(farmId, clerkUserId);
    const [row] = await this.rows(
      this.databaseService.db,
      and(
        eq(storeWarrantyRequests.id, id),
        eq(storeWarrantyRequests.farmId, farmId),
      ),
    );
    if (!row) throw new NotFoundException('Warranty request not found');
    return this.present(row);
  }

  async create(
    farmId: string,
    clerkUserId: string,
    input: CreateStoreWarrantyDto,
  ) {
    const memberId = await this.orders.staffMember(farmId, clerkUserId);
    // Postgres prints uuids in lower case; @IsUUID also accepts upper case.
    const assetId = input.assetId?.toLowerCase();
    const id = await this.databaseService.db
      .transaction(async (tx) => {
        // AC22: only this farm's delivered orders; other farms' orders stay hidden.
        const [order] = await tx
          .select()
          .from(storeOrders)
          .where(
            and(
              eq(storeOrders.id, input.orderId),
              eq(storeOrders.farmId, farmId),
            ),
          );
        if (!order) throw new NotFoundException('Order not found');
        if (order.status !== 'COMPLETED' || !order.completedAt)
          throw new ConflictException({
            code: 'ORDER_NOT_DELIVERED',
            message: 'Only delivered (COMPLETED) orders can be claimed',
          });
        // The line lock serialises claims, so open quantities cannot overrun.
        const [line] = await tx
          .select({
            line: storeOrderItems,
            itemType: items.itemType,
            trackingMode: items.trackingMode,
          })
          .from(storeOrderItems)
          .innerJoin(items, eq(items.id, storeOrderItems.itemId))
          .where(
            and(
              eq(storeOrderItems.id, input.orderItemId),
              eq(storeOrderItems.orderId, order.id),
            ),
          )
          .for('update', { of: storeOrderItems });
        if (!line) throw new BadRequestException('Order line not found');
        if (line.itemType === 'MATERIAL')
          throw new BadRequestException({
            code: 'WARRANTY_NOT_APPLICABLE',
            message: 'Materials are not covered by warranty or repair',
          });
        // A serialised unit is claimed by itself, and only one the order handed over.
        if (line.trackingMode === 'ASSET') {
          if (!assetId || input.quantity !== 1)
            throw new BadRequestException({
              code: 'WARRANTY_ASSET_REQUIRED',
              message: 'Choose the delivered asset; one claim covers one unit',
            });
          const delivered = await this.orders.deliveredAssets(tx, order.id);
          if (
            !delivered.some(
              (asset) =>
                asset.id === assetId && asset.itemId === line.line.itemId,
            )
          )
            throw new BadRequestException({
              code: 'WARRANTY_ASSET_NOT_DELIVERED',
              message: 'This asset was not delivered with this order line',
            });
          // Before the line quantity: a full line would hide the real reason.
          const [claimed] = await tx
            .select({ id: storeWarrantyRequests.id })
            .from(storeWarrantyRequests)
            .where(
              and(
                eq(storeWarrantyRequests.assetId, assetId),
                inArray(storeWarrantyRequests.status, OPEN),
              ),
            )
            .limit(1);
          if (claimed) throw this.assetOpen();
        } else if (input.assetId)
          throw new BadRequestException(
            'Only asset-tracked lines are claimed by asset',
          );
        const [{ open }] = await tx
          .select({
            open: sql<number>`COALESCE(SUM(${storeWarrantyRequests.quantity}), 0)::int`,
          })
          .from(storeWarrantyRequests)
          .where(
            and(
              eq(storeWarrantyRequests.orderItemId, line.line.id),
              inArray(storeWarrantyRequests.status, OPEN),
            ),
          );
        if (open + input.quantity > line.line.quantity)
          throw new BadRequestException({
            code: 'WARRANTY_QUANTITY_EXCEEDED',
            message: `At most ${line.line.quantity - open} more of this line can be claimed`,
          });
        if (
          input.kind === 'WARRANTY' &&
          !this.inWarranty(order.completedAt, line.line.warrantyMonths)
        )
          throw new BadRequestException({
            code: 'WARRANTY_EXPIRED',
            message: 'Out of warranty: only a paid repair can be requested',
          });
        const [request] = await tx
          .insert(storeWarrantyRequests)
          .values({
            farmId,
            orderId: order.id,
            orderItemId: line.line.id,
            quantity: input.quantity,
            assetId: assetId ?? null,
            kind: input.kind,
            issueDescription: input.issueDescription,
            intakeNote: input.intakeNote ?? null,
            createdByMemberId: memberId,
            handledByMemberId: memberId,
          })
          .returning();
        await this.audit(tx, request, memberId, 'WARRANTY_CREATE', {
          order: orderCode(order.orderNumber),
          quantity: request.quantity,
          assetId: request.assetId,
          kind: request.kind,
        });
        return request.id;
      })
      .catch((error: unknown) => {
        const cause = error as {
          code?: string;
          constraint?: string;
          cause?: { code?: string; constraint?: string };
        };
        if (
          (cause.constraint ?? cause.cause?.constraint) ===
          'uq_store_warranty_open_asset'
        )
          throw this.assetOpen();
        throw error;
      });
    return this.get(farmId, clerkUserId, id);
  }

  async act(
    farmId: string,
    clerkUserId: string,
    id: string,
    input: StoreWarrantyActionDto,
  ) {
    const memberId = await this.orders.staffMember(farmId, clerkUserId);
    await this.databaseService.db.transaction(async (tx) => {
      const [request] = await tx
        .select()
        .from(storeWarrantyRequests)
        .where(
          and(
            eq(storeWarrantyRequests.id, id),
            eq(storeWarrantyRequests.farmId, farmId),
          ),
        )
        .for('update');
      if (!request) throw new NotFoundException('Warranty request not found');
      const now = new Date().toISOString();
      const from = (...allowed: Status[]) => {
        if (!allowed.includes(request.status))
          throw new ConflictException({
            code: 'WARRANTY_STEP_NOT_ALLOWED',
            message: `Cannot ${input.action} a ${request.status} request`,
          });
      };
      const required = <T>(value: T | undefined, field: string): T => {
        if (value === undefined)
          throw new BadRequestException(
            `${field} is required for ${input.action}`,
          );
        return value;
      };
      let changes: Partial<typeof storeWarrantyRequests.$inferInsert>;
      switch (input.action) {
        case 'send':
          from('RECEIVED');
          changes = {
            status: 'AT_PARTNER',
            partnerName: required(input.partnerName, 'partnerName'),
            sentAt: now,
          };
          break;
        case 'quote':
          // A partner may also find a warranty claim not covered: it becomes paid.
          from('AT_PARTNER');
          changes = {
            status: 'AWAITING_CUSTOMER',
            kind: 'PAID_REPAIR',
            quoteAmount: required(input.quoteAmount, 'quoteAmount'),
            customerApproved: null,
            customerDecidedAt: null,
          };
          break;
        case 'decide':
          from('AWAITING_CUSTOMER');
          changes = {
            status: 'AT_PARTNER',
            customerApproved: required(input.approved, 'approved'),
            customerDecisionNote: input.note ?? null,
            customerDecidedAt: now,
          };
          break;
        case 'start-repair':
          from('AT_PARTNER');
          // AC23: never repair at a cost the customer has not agreed to.
          if (
            request.kind === 'PAID_REPAIR' &&
            request.customerApproved !== true
          )
            throw new ConflictException({
              code: 'CUSTOMER_CONSENT_REQUIRED',
              message:
                'Record the customer agreeing to the quote before repairing',
            });
          changes = { status: 'IN_REPAIR', repairStartedAt: now };
          break;
        case 'back':
          from('AT_PARTNER', 'IN_REPAIR');
          if (input.actualCost !== undefined && !request.repairStartedAt)
            throw new BadRequestException(
              'A cost applies only to a repair that was carried out',
            );
          changes = {
            status: 'BACK_FROM_PARTNER',
            result: required(input.result, 'result'),
            actualCost: input.actualCost ?? null,
            backAt: now,
          };
          break;
        case 'return':
          from('RECEIVED', 'BACK_FROM_PARTNER');
          changes = { status: 'CLOSED', resolution: 'RETURN', closedAt: now };
          break;
        case 'exchange':
          changes = await this.exchange(tx, request, memberId);
          break;
        case 'close': {
          from('EXCHANGING');
          const issue = await this.exchangeIssue(tx, request);
          // AC24: closed only once the warehouse has actually issued the replacement.
          if (issue?.status !== 'CONFIRMED')
            throw new ConflictException({
              code: 'EXCHANGE_NOT_ISSUED',
              message: 'The replacement stock issue is not confirmed yet',
            });
          changes = { status: 'CLOSED', resolution: 'EXCHANGE', closedAt: now };
          break;
        }
        case 'cancel':
          from('RECEIVED');
          changes = {
            status: 'CANCELLED',
            cancelReason: required(input.note, 'note'),
          };
          break;
      }
      await tx
        .update(storeWarrantyRequests)
        .set({ ...changes, handledByMemberId: memberId, updatedAt: now })
        .where(eq(storeWarrantyRequests.id, id));
      await this.audit(
        tx,
        request,
        memberId,
        `WARRANTY_${input.action.toUpperCase().replace('-', '_')}`,
        { from: request.status, ...changes, note: input.note },
      );
    });
    return this.get(farmId, clerkUserId, id);
  }

  /** Customer view of their own order's requests: no staff or stock references. */
  async forCustomerOrder(orderId: string) {
    const rows = await this.rows(
      this.databaseService.db,
      eq(storeWarrantyRequests.orderId, orderId),
    ).orderBy(desc(storeWarrantyRequests.createdAt));
    return rows.map((row) => {
      const p = this.present(row);
      return {
        id: p.id,
        code: p.code,
        productName: p.productName,
        variantName: p.variantName,
        quantity: p.quantity,
        kind: p.kind,
        status: p.status,
        result: p.result,
        quoteAmount: p.quoteAmount,
        resolution: p.resolution,
        receivedAt: p.receivedAt,
        closedAt: p.closedAt,
      };
    });
  }

  private async exchange(tx: Transaction, request: Request, memberId: string) {
    if (request.status === 'EXCHANGING') {
      // Retry only after the warehouse turned the previous issue down.
      const issue = await this.exchangeIssue(tx, request);
      if (issue && !['REJECTED', 'CANCELLED'].includes(issue.status))
        throw new ConflictException({
          code: 'EXCHANGE_PENDING',
          message: 'A replacement stock issue is already open',
        });
    } else if (!['RECEIVED', 'BACK_FROM_PARTNER'].includes(request.status))
      throw new ConflictException({
        code: 'WARRANTY_STEP_NOT_ALLOWED',
        message: `Cannot exchange a ${request.status} request`,
      });
    const [order] = await tx
      .select()
      .from(storeOrders)
      .where(eq(storeOrders.id, request.orderId))
      .for('update');
    const [line] = await tx
      .select()
      .from(storeOrderItems)
      .where(eq(storeOrderItems.id, request.orderItemId));
    const issueId = await this.orders.draftExchangeIssue(
      tx,
      order,
      line,
      request.quantity,
      memberId,
      `Đổi hàng bảo hành ${warrantyCode(request.requestNumber)} (đơn ${orderCode(order.orderNumber)})`,
    );
    return { status: 'EXCHANGING' as const, exchangeIssueId: issueId };
  }

  private async exchangeIssue(tx: Transaction, request: Request) {
    if (!request.exchangeIssueId) return undefined;
    const [issue] = await tx
      .select({ status: stockIssues.status })
      .from(stockIssues)
      .where(eq(stockIssues.id, request.exchangeIssueId));
    return issue;
  }

  /** Lines ordered before T09 carry no policy (null): staff decide. */
  private assetOpen() {
    return new ConflictException({
      code: 'WARRANTY_ASSET_OPEN',
      message: 'This asset already has an open warranty request',
    });
  }

  private inWarranty(completedAt: string, months: number | null) {
    if (months === null) return true;
    const end = new Date(completedAt);
    end.setMonth(end.getMonth() + months);
    return months > 0 && end.getTime() >= Date.now();
  }

  private rows(db: Pick<Db, 'select'>, where: SQL | undefined) {
    return db
      .select({
        request: storeWarrantyRequests,
        orderNumber: storeOrders.orderNumber,
        completedAt: storeOrders.completedAt,
        productName: storeOrderItems.productName,
        variantName: storeOrderItems.variantName,
        purchased: storeOrderItems.quantity,
        warrantyMonths: storeOrderItems.warrantyMonths,
        assetCode: assets.assetCode,
        assetSerialNumber: assets.serialNumber,
        exchangeIssue: {
          id: stockIssues.id,
          issueCode: stockIssues.issueCode,
          status: stockIssues.status,
        },
      })
      .from(storeWarrantyRequests)
      .innerJoin(storeOrders, eq(storeOrders.id, storeWarrantyRequests.orderId))
      .innerJoin(
        storeOrderItems,
        eq(storeOrderItems.id, storeWarrantyRequests.orderItemId),
      )
      .leftJoin(
        stockIssues,
        eq(stockIssues.id, storeWarrantyRequests.exchangeIssueId),
      )
      .leftJoin(assets, eq(assets.id, storeWarrantyRequests.assetId))
      .where(where)
      .$dynamic();
  }

  private present(
    row: Awaited<ReturnType<StoreWarrantiesService['rows']>>[number],
  ) {
    const { request, exchangeIssue, ...rest } = row;
    return {
      ...request,
      ...rest,
      code: warrantyCode(request.requestNumber),
      orderCode: orderCode(row.orderNumber),
      exchangeIssue: exchangeIssue?.id ? exchangeIssue : null,
    };
  }

  private async audit(
    tx: Transaction,
    request: Request,
    memberId: string,
    action: string,
    data: Record<string, unknown>,
  ) {
    await tx.insert(auditLogs).values({
      farmId: request.farmId,
      userId: sql`(SELECT user_id FROM farm_members WHERE id = ${memberId})`,
      action,
      entityType: 'STORE_WARRANTY',
      entityId: request.id,
      newData: { code: warrantyCode(request.requestNumber), ...data },
      createdAt: sql`clock_timestamp()`,
    });
  }
}

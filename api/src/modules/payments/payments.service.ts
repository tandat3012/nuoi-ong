import { randomUUID } from 'node:crypto';
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, count, desc, eq, SQL } from 'drizzle-orm';
import { PaginationParams } from '../../common/query-params';
import { DatabaseService } from '../../db/database.service';
import {
  auditLogs,
  farmMembers,
  paymentTransactions,
  storeOrders,
} from '../../db/schema';
import { CommerceService } from '../commerce/commerce.service';
import {
  STORE_MANAGE_ROLES,
  hasAnyRole,
} from '../auth/farm-access/farm-role-groups';
import { WarehousesService } from '../warehouses/warehouses.service';
import { orderCode } from '../store-orders/store-order.rules';
import { paymentSimulatorEnabled, storeBankAccount } from './bank-account';
import { SepayWebhookDto, SimulatePaymentDto } from './dto/payment.dto';

type Db = DatabaseService['db'];
type Transaction = Parameters<Parameters<Db['transaction']>[0]>[0];
type PaymentTransaction = typeof paymentTransactions.$inferSelect;
type Provider = PaymentTransaction['provider'];
type Result = PaymentTransaction['result'];

export type IncomingTransfer = {
  providerTxId: string;
  accountNumber: string;
  amount: string;
  content: string;
  transactionAt: string;
  rawPayload: Record<string, unknown>;
  createdByMemberId?: string;
};

export interface PaymentFilters extends PaginationParams {
  result?: Result;
}

/** Finds the canonical order code (DH + at least 6 digits) in a bank transfer note. */
export function orderNumberFromContent(content: string) {
  for (const [, digits] of content.matchAll(/DH(\d{6,})/gi)) {
    const number = Number(digits);
    if (Number.isSafeInteger(number) && orderCode(number) === `DH${digits}`)
      return number;
  }
  return null;
}

@Injectable()
export class PaymentsService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly commerce: CommerceService,
    private readonly warehousesService: WarehousesService,
  ) {}

  /** Outgoing transfers are acknowledged but not recorded. */
  sepay(input: SepayWebhookDto) {
    if (input.transferType !== 'in') return Promise.resolve(null);
    return this.ingest('SEPAY', {
      providerTxId: String(input.id),
      accountNumber: input.accountNumber,
      amount: String(input.transferAmount),
      content: input.content,
      // SePay reports Vietnam local time without an offset.
      transactionAt: new Date(
        `${input.transactionDate.replace(' ', 'T')}+07:00`,
      ).toISOString(),
      rawPayload: { ...input },
    });
  }

  async simulate(
    farmId: string,
    clerkUserId: string,
    input: SimulatePaymentDto,
  ) {
    if (!paymentSimulatorEnabled())
      throw new NotFoundException('Payment simulator is disabled');
    const memberId = await this.staffMember(farmId, clerkUserId);
    const accountNumber =
      input.accountNumber ?? storeBankAccount()?.accountNumber ?? '';
    return this.ingest('SIMULATOR', {
      providerTxId: input.providerTxId ?? `sim-${randomUUID()}`,
      accountNumber,
      amount: input.amount,
      content: input.content,
      transactionAt: new Date().toISOString(),
      rawPayload: { ...input, accountNumber },
      createdByMemberId: memberId,
    });
  }

  /**
   * Records a bank transfer and pays its order only when every check passes.
   * The order row lock serializes transfers for one order; the provider id
   * unique constraint makes redelivery a no-op. Recording, the order update
   * and the audit rows commit or roll back together.
   */
  async ingest(provider: Provider, transfer: IncomingTransfer) {
    return this.databaseService.db.transaction(async (tx) => {
      const store = await this.commerce.getStoreWarehouse(tx);
      const number = orderNumberFromContent(transfer.content);
      const [order] = number
        ? await tx
            .select()
            .from(storeOrders)
            .where(eq(storeOrders.orderNumber, number))
            .for('update')
        : [];
      const result = this.verify(transfer, order);
      const [recorded] = await tx
        .insert(paymentTransactions)
        .values({
          farmId: order?.farmId ?? store.farmId,
          provider,
          providerTxId: transfer.providerTxId,
          accountNumber: transfer.accountNumber,
          amount: transfer.amount,
          content: transfer.content,
          transactionAt: transfer.transactionAt,
          orderId: order?.id ?? null,
          result,
          rawPayload: transfer.rawPayload,
          createdByMemberId: transfer.createdByMemberId ?? null,
        })
        .onConflictDoNothing({
          target: [
            paymentTransactions.provider,
            paymentTransactions.providerTxId,
          ],
        })
        .returning();
      if (!recorded) {
        const [existing] = await tx
          .select()
          .from(paymentTransactions)
          .where(
            and(
              eq(paymentTransactions.provider, provider),
              eq(paymentTransactions.providerTxId, transfer.providerTxId),
            ),
          );
        return { transaction: this.present(existing, order), duplicate: true };
      }
      const userId = await this.memberUser(tx, transfer.createdByMemberId);
      await tx.insert(auditLogs).values({
        farmId: recorded.farmId,
        userId,
        action: 'RECEIVE',
        entityType: 'PAYMENT_TRANSACTION',
        entityId: recorded.id,
        newData: {
          provider,
          providerTxId: recorded.providerTxId,
          amount: recorded.amount,
          result,
          orderId: recorded.orderId,
          createdByMemberId: recorded.createdByMemberId,
        },
      });
      if (order && result === 'MATCHED') {
        const now = new Date().toISOString();
        await tx
          .update(storeOrders)
          .set({
            paymentStatus: 'PAID',
            paidAt: transfer.transactionAt,
            paymentTransactionId: recorded.id,
            updatedAt: now,
          })
          .where(eq(storeOrders.id, order.id));
        await tx.insert(auditLogs).values({
          farmId: order.farmId,
          userId,
          action: 'PAY',
          entityType: 'STORE_ORDER',
          entityId: order.id,
          oldData: { paymentStatus: order.paymentStatus },
          newData: {
            paymentStatus: 'PAID',
            paidAt: transfer.transactionAt,
            paymentTransactionId: recorded.id,
            createdByMemberId: recorded.createdByMemberId,
          },
        });
      }
      return { transaction: this.present(recorded, order), duplicate: false };
    });
  }

  async list(farmId: string, filters: PaymentFilters) {
    const conditions: SQL[] = [eq(paymentTransactions.farmId, farmId)];
    if (filters.result)
      conditions.push(eq(paymentTransactions.result, filters.result));
    const where = and(...conditions);
    const db = this.databaseService.db;
    const [rows, [total]] = await Promise.all([
      db
        .select({
          transaction: paymentTransactions,
          orderNumber: storeOrders.orderNumber,
        })
        .from(paymentTransactions)
        .leftJoin(storeOrders, eq(storeOrders.id, paymentTransactions.orderId))
        .where(where)
        .orderBy(
          desc(paymentTransactions.createdAt),
          desc(paymentTransactions.id),
        )
        .limit(filters.pageSize)
        .offset(filters.offset),
      db.select({ value: count() }).from(paymentTransactions).where(where),
    ]);
    return {
      data: rows.map((row) =>
        this.present(
          row.transaction,
          row.orderNumber === null
            ? undefined
            : { orderNumber: row.orderNumber },
        ),
      ),
      page: {
        number: filters.page,
        size: filters.pageSize,
        totalItems: total.value,
        totalPages: Math.ceil(total.value / filters.pageSize),
      },
    };
  }

  async simulator(farmId: string, clerkUserId: string) {
    await this.staffMember(farmId, clerkUserId);
    return {
      enabled: paymentSimulatorEnabled(),
      accountNumber: storeBankAccount()?.accountNumber ?? null,
    };
  }

  private verify(
    transfer: IncomingTransfer,
    order: typeof storeOrders.$inferSelect | undefined,
  ): Result {
    const account = storeBankAccount();
    if (!account || transfer.accountNumber !== account.accountNumber)
      return 'WRONG_ACCOUNT';
    if (!order) return 'ORDER_NOT_FOUND';
    if (order.paymentStatus === 'PAID') return 'ALREADY_PAID';
    if (order.status === 'CANCELLED' || order.paymentMethod !== 'BANK_TRANSFER')
      return 'ORDER_NOT_PAYABLE';
    if (BigInt(transfer.amount) !== BigInt(order.total))
      return 'AMOUNT_MISMATCH';
    return 'MATCHED';
  }

  private present(
    transaction: PaymentTransaction,
    order: { orderNumber: number } | undefined,
  ) {
    const { rawPayload, ...data } = transaction;
    void rawPayload;
    return {
      ...data,
      orderCode:
        order && transaction.orderId ? orderCode(order.orderNumber) : null,
    };
  }

  private async memberUser(tx: Transaction, memberId?: string) {
    if (!memberId) return null;
    const [member] = await tx
      .select({ userId: farmMembers.userId })
      .from(farmMembers)
      .where(eq(farmMembers.id, memberId));
    return member?.userId ?? null;
  }

  /** Only staff of the farm that runs the store may read or simulate its payments. */
  private async staffMember(farmId: string, clerkUserId: string) {
    const store = await this.commerce.getStoreWarehouse();
    if (store.farmId !== farmId)
      throw new ForbiddenException('Store belongs to another farm');
    const { memberId, roleCodes } =
      await this.warehousesService.getActiveMembership(farmId, clerkUserId);
    if (!hasAnyRole(roleCodes, STORE_MANAGE_ROLES))
      throw new ForbiddenException('Store payment permission is required');
    return memberId;
  }
}

import { Injectable } from '@nestjs/common';
import type { DatabaseService } from '../../db/database.service';

type Transaction = Parameters<
  Parameters<DatabaseService['db']['transaction']>[0]
>[0];

/** Lets other modules react to a transfer inside its own transaction. */
export interface StockTransferHook {
  /** Runs before the transfer row is locked, so callers can lock their rows first. */
  lock(tx: Transaction, transferId: string): Promise<void>;
  confirmed(
    tx: Transaction,
    transferId: string,
    memberId: string,
  ): Promise<void>;
  rejected(
    tx: Transaction,
    transferId: string,
    memberId: string,
  ): Promise<void>;
}

@Injectable()
export class StockTransferHooks {
  private readonly hooks: StockTransferHook[] = [];

  register(hook: StockTransferHook) {
    this.hooks.push(hook);
  }

  async run<K extends keyof StockTransferHook>(
    event: K,
    ...args: Parameters<StockTransferHook[K]>
  ) {
    for (const hook of this.hooks)
      await (hook[event] as (...a: typeof args) => Promise<void>).apply(
        hook,
        args,
      );
  }
}

/** The same events for stock receipts (e.g. goods back from a failed delivery). */
@Injectable()
export class StockReceiptHooks extends StockTransferHooks {}

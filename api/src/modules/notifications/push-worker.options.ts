export const PUSH_WORKER_OPTIONS = Symbol('PUSH_WORKER_OPTIONS');

export interface PushWorkerOptions {
  enabled: boolean;
  pollMs: number;
  batchSize: number;
  concurrency: number;
  requestTimeoutMs: number;
  leaseMs: number;
  maxSendAttempts: number;
  retryBaseMs: number;
  receiptDelayMs: number;
  receiptPollMs: number;
  accessToken?: string;
}

export function pushWorkerOptions(env = process.env): PushWorkerOptions {
  const receiptDelay = Number(env.PUSH_RECEIPT_DELAY_MS ?? 900_000);
  return {
    enabled: env.PUSH_WORKER_ENABLED === 'true',
    pollMs: 5000,
    batchSize: 12,
    concurrency: 3,
    requestTimeoutMs: 8000,
    leaseMs: 60_000,
    maxSendAttempts: 5,
    retryBaseMs: 15_000,
    receiptDelayMs:
      Number.isFinite(receiptDelay) &&
      receiptDelay >= 5000 &&
      receiptDelay <= 900_000
        ? receiptDelay
        : 900_000,
    receiptPollMs: 60_000,
    accessToken: env.EXPO_ACCESS_TOKEN?.trim() || undefined,
  };
}

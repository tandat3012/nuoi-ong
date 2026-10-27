import { Inject, Injectable } from '@nestjs/common';
import {
  PUSH_WORKER_OPTIONS,
  type PushWorkerOptions,
} from './push-worker.options';

export type ExpoPushMessage = {
  to: string;
  title: string;
  body: string;
  sound: 'default';
  priority: 'high';
  channelId: 'stock-documents';
  tag: string;
  expiration: number;
  data: {
    version: 1;
    notificationId: string;
    recipientUserId: string;
    farmId: string;
    entityType: string;
    entityId: string;
    type: string;
  };
};

export type ExpoDeliveryResult =
  { status: 'ok' } | { status: 'error'; code: string };
export type ExpoTicket =
  { status: 'ok'; id: string } | { status: 'error'; code: string };

export class ExpoPushFailure extends Error {
  constructor(
    readonly code: string,
    readonly retryable: boolean,
  ) {
    super(code);
  }
}

const knownErrors = new Set([
  'DeviceNotRegistered',
  'MessageTooBig',
  'MessageRateExceeded',
  'MismatchSenderId',
  'InvalidCredentials',
  'UNAUTHORIZED',
  'TOO_MANY_REQUESTS',
  'PUSH_TOO_MANY_EXPERIENCE_IDS',
  'PUSH_TOO_MANY_NOTIFICATIONS',
  'PUSH_TOO_MANY_RECEIPTS',
]);
const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

function providerResult(value: unknown): ExpoDeliveryResult {
  if (!object(value)) throw new ExpoPushFailure('EXPO_INVALID_RESPONSE', true);
  if (value.status === 'ok') return { status: 'ok' };
  if (value.status !== 'error')
    throw new ExpoPushFailure('EXPO_INVALID_RESPONSE', true);
  const error = object(value.details) ? value.details.error : undefined;
  // Never store vendor message/details: they can contain the full push token.
  return {
    status: 'error',
    code:
      typeof error === 'string' && knownErrors.has(error)
        ? error
        : 'EXPO_UNKNOWN_ERROR',
  };
}

@Injectable()
export class ExpoPushClient {
  constructor(
    @Inject(PUSH_WORKER_OPTIONS) private readonly options: PushWorkerOptions,
  ) {}

  private async post(
    path: 'send' | 'getReceipts',
    body: unknown,
    shutdown?: AbortSignal,
  ): Promise<Record<string, unknown>> {
    const timeout = AbortSignal.timeout(this.options.requestTimeoutMs);
    const signal = shutdown ? AbortSignal.any([timeout, shutdown]) : timeout;
    try {
      const response = await fetch(`https://exp.host/--/api/v2/push/${path}`, {
        method: 'POST',
        signal,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...(this.options.accessToken
            ? { Authorization: `Bearer ${this.options.accessToken}` }
            : {}),
        },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        // Release the HTTP connection without reading/logging a token-bearing body.
        await response.body?.cancel().catch(() => undefined);
        throw new ExpoPushFailure(
          `EXPO_HTTP_${response.status}`,
          response.status === 429 || response.status >= 500,
        );
      }
      const result: unknown = await response.json();
      if (!object(result))
        throw new ExpoPushFailure('EXPO_INVALID_RESPONSE', true);
      if (Array.isArray(result.errors) && result.errors.length) {
        const first: unknown = result.errors[0];
        const code =
          object(first) &&
          typeof first.code === 'string' &&
          knownErrors.has(first.code)
            ? first.code
            : 'EXPO_REQUEST_ERROR';
        throw new ExpoPushFailure(code, code === 'TOO_MANY_REQUESTS');
      }
      return result;
    } catch (error: unknown) {
      if (error instanceof ExpoPushFailure) throw error;
      throw new ExpoPushFailure(
        signal.aborted ? 'EXPO_REQUEST_ABORTED' : 'EXPO_NETWORK_ERROR',
        true,
      );
    }
  }

  async send(
    message: ExpoPushMessage,
    signal?: AbortSignal,
  ): Promise<ExpoTicket> {
    if (Buffer.byteLength(JSON.stringify(message), 'utf8') > 3500)
      throw new ExpoPushFailure('PUSH_PAYLOAD_TOO_LARGE', false);
    const response = await this.post('send', message, signal);
    const ticket: unknown = Array.isArray(response.data)
      ? response.data.length === 1
        ? response.data[0]
        : null
      : response.data;
    const result = providerResult(ticket);
    if (result.status === 'error') return result;
    if (
      !object(ticket) ||
      typeof ticket.id !== 'string' ||
      !ticket.id.trim() ||
      ticket.id.length > 255
    )
      throw new ExpoPushFailure('EXPO_INVALID_TICKET', true);
    return { status: 'ok', id: ticket.id };
  }

  async receipt(
    id: string,
    signal?: AbortSignal,
  ): Promise<ExpoDeliveryResult | null> {
    const response = await this.post('getReceipts', { ids: [id] }, signal);
    if (!object(response.data))
      throw new ExpoPushFailure('EXPO_INVALID_RESPONSE', true);
    if (!Object.prototype.hasOwnProperty.call(response.data, id)) return null;
    return providerResult(response.data[id]);
  }
}

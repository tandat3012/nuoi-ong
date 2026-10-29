import { notificationRoute } from './api';

const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const documentTypes = new Set([
  'STOCK_RECEIPT',
  'STOCK_ISSUE',
  'STOCK_TRANSFER',
  'STOCK_COUNT',
  'MAINTENANCE_REQUEST',
]);

const statuses = ['PENDING_APPROVAL', 'CONFIRMED', 'REJECTED'] as const;

export type PushResponsePayload = {
  version: 1;
  notificationId: string;
  recipientUserId: string;
  farmId: string;
  entityType: string;
  entityId: string;
  type: string;
};

export type PushResponseResolution =
  | { status: 'ready'; payload: PushResponsePayload; route: string }
  | { status: 'invalid-payload' }
  | { status: 'recipient-mismatch' }
  | { status: 'farm-unavailable' }
  | { status: 'unsupported-route' };

export function parsePushResponsePayload(value: unknown): PushResponsePayload | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const payload = value as Record<string, unknown>;
  if (
    payload.version !== 1 ||
    typeof payload.notificationId !== 'string' ||
    !uuid.test(payload.notificationId) ||
    typeof payload.recipientUserId !== 'string' ||
    !uuid.test(payload.recipientUserId) ||
    typeof payload.farmId !== 'string' ||
    !uuid.test(payload.farmId) ||
    typeof payload.entityId !== 'string' ||
    !uuid.test(payload.entityId) ||
    typeof payload.entityType !== 'string' ||
    !documentTypes.has(payload.entityType) ||
    typeof payload.type !== 'string' ||
    !statuses.some((status) => payload.type === `${payload.entityType}_${status}`)
  ) {
    return null;
  }

  return payload as PushResponsePayload;
}

export function resolvePushResponse(
  value: unknown,
  account: {
    dbUserId: string;
    clerkUserId: string;
    signedInClerkUserId: string | null;
    activeFarmIds: string[];
  },
): PushResponseResolution {
  const payload = parsePushResponsePayload(value);
  if (!payload) return { status: 'invalid-payload' };
  if (
    account.signedInClerkUserId !== account.clerkUserId ||
    payload.recipientUserId !== account.dbUserId
  ) {
    return { status: 'recipient-mismatch' };
  }
  if (!account.activeFarmIds.includes(payload.farmId)) {
    return { status: 'farm-unavailable' };
  }

  const route = notificationRoute({
    id: payload.notificationId,
    farmId: payload.farmId,
    type: payload.type,
    title: '',
    body: '',
    data: null,
    entityType: payload.entityType,
    entityId: payload.entityId,
    readAt: null,
    createdAt: '',
  });
  if (!route) return { status: 'unsupported-route' };
  return { status: 'ready', payload, route };
}

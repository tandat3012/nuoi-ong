import { describe, expect, it } from '@jest/globals';
import { parsePushResponsePayload, resolvePushResponse } from './push-response';

const validPayload = {
  version: 1,
  notificationId: '16b496d3-cc4c-45e6-bde0-a9b50de142ad',
  recipientUserId: '80309345-bab2-428e-bfe0-9cb7d9ba1e7d',
  farmId: '59e1ddf2-b7f8-4f13-91e9-1ff50364446c',
  entityType: 'STOCK_RECEIPT',
  entityId: 'c6d4b2e7-1f9d-4c12-a501-bdc0666a18d2',
  type: 'STOCK_RECEIPT_PENDING_APPROVAL',
};

const account = {
  dbUserId: validPayload.recipientUserId,
  clerkUserId: 'user_current',
  signedInClerkUserId: 'user_current',
  activeFarmIds: [validPayload.farmId],
};

describe('push response routing', () => {
  it('accepts a supported payload and maps it to the allowlisted receipt route', () => {
    expect(parsePushResponsePayload(validPayload)).toEqual(validPayload);
    expect(resolvePushResponse(validPayload, account)).toEqual({
      status: 'ready',
      payload: validPayload,
      route: `/receipts/${validPayload.entityId}?type=receipt`,
    });
  });

  it('rejects malformed identifiers, unsupported entities, and mismatched statuses', () => {
    expect(parsePushResponsePayload({ ...validPayload, entityId: '/dashboard' })).toBeNull();
    expect(parsePushResponsePayload({ ...validPayload, entityType: 'UNTRUSTED_ROUTE' })).toBeNull();
    expect(parsePushResponsePayload({ ...validPayload, type: 'STOCK_ISSUE_CONFIRMED' })).toBeNull();
  });

  it('does not route a push for another signed-in account', () => {
    expect(resolvePushResponse(validPayload, {
      ...account,
      dbUserId: '4e34e326-30be-433e-967d-b784478cdfa1',
    })).toEqual({ status: 'recipient-mismatch' });
    expect(resolvePushResponse(validPayload, {
      ...account,
      signedInClerkUserId: 'user_other',
    })).toEqual({ status: 'recipient-mismatch' });
  });

  it('does not route or mark read when the user no longer belongs to the farm', () => {
    expect(resolvePushResponse(validPayload, {
      ...account,
      activeFarmIds: [],
    })).toEqual({ status: 'farm-unavailable' });
  });

  it('routes all supported document types through fixed route mappings', () => {
    const cases = [
      ['STOCK_ISSUE', 'STOCK_ISSUE_REJECTED', `/receipts/${validPayload.entityId}?type=issue`],
      ['STOCK_COUNT', 'STOCK_COUNT_CONFIRMED', `/counts/${validPayload.entityId}`],
      ['STOCK_TRANSFER', 'STOCK_TRANSFER_PENDING_APPROVAL', `/transfers/${validPayload.entityId}`],
      ['MAINTENANCE_REQUEST', 'MAINTENANCE_REQUEST_REJECTED', `/maintenance/requests/${validPayload.entityId}`],
    ] as const;
    for (const [entityType, type, route] of cases) {
      expect(resolvePushResponse({ ...validPayload, entityType, type }, account)).toMatchObject({
        status: 'ready',
        route,
      });
    }
  });
});

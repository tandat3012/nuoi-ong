import { describe, expect, it } from '@jest/globals';
import { foregroundPushBehavior } from './foreground-push';

const id = '80309345-bab2-428e-bfe0-9cb7d9ba1e7d';
const recipientUserId = '4e34e326-30be-433e-967d-b784478cdfa1';
const farmId = '59e1ddf2-b7f8-4f13-91e9-1ff50364446c';
const data = {
  version: 1,
  notificationId: id,
  recipientUserId,
  farmId,
  entityId: id,
  entityType: 'STOCK_ISSUE',
  type: 'STOCK_ISSUE_CONFIRMED',
};
const audience = { userId: recipientUserId, farmIds: [farmId] };
describe('foreground push presentation', () => {
  it('presents an authorized own-account notification without setting a guessed unread badge', () => {
    expect(foregroundPushBehavior(data, audience)).toEqual({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    });
  });
  it.each([
    { ...data, recipientUserId: 'another-user' },
    { ...data, farmId: '4e34e326-30be-433e-967d-b784478cdfa1' },
    { ...data, entityId: 'invalid' },
    { ...data, entityType: 'UNKNOWN' },
    { ...data, type: 'STOCK_ISSUE_DRAFT' },
    {},
    null,
  ])(
    'suppresses payloads outside the signed-in audience or document contract',
    (payload) => {
      expect(foregroundPushBehavior(payload, audience).shouldShowBanner).toBe(
        false,
      );
    },
  );
  it('suppresses notifications after logout', () => {
    expect(
      foregroundPushBehavior(data, { userId: null, farmIds: [] })
        .shouldShowBanner,
    ).toBe(false);
  });
});

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  getNotifications, markAllNotificationsRead, markNotificationRead,
} from './notifications.api.ts';

test('notification lists send the farm, unread filter and ten-row server pagination', async () => {
  const response = { data: [], unreadCount: 103, page: { number: 3, size: 10, totalItems: 103, totalPages: 11 } };
  for (const unreadOnly of [true, false]) {
    const result = await getNotifications(async (path, options) => {
      assert.equal(path, '/notifications');
      assert.deepEqual(options, {
        method: 'GET', params: { farmId: 'farm-a', unreadOnly, page: 3, pageSize: 10 },
      });
      return response;
    }, 'farm-a', { page: 3, unreadOnly });
    assert.equal(result, response);
  }
});

test('mark read encodes the ID and PATCHes only within the selected farm', async () => {
  for (const response of [{ data: { id: 'a/b' } }, { data: { id: 'a/b' }, alreadyRead: true }]) {
    assert.equal(await markNotificationRead(async (path, options) => {
      assert.equal(path, '/notifications/a%2Fb/read');
      assert.deepEqual(options, { method: 'PATCH', params: { farmId: 'farm-b' } });
      return response;
    }, 'farm-b', 'a/b'), response);
  }
});

test('mark all read uses its dedicated PATCH path and selected farm', async () => {
  const response = { updatedCount: 12 };
  assert.equal(await markAllNotificationsRead(async (path, options) => {
    assert.equal(path, '/notifications/read-all');
    assert.deepEqual(options, { method: 'PATCH', params: { farmId: 'farm-c' } });
    return response;
  }, 'farm-c'), response);
});

test('API failures reach the caller for error handling and navigation after a failed mark', async () => {
  const failure = new Error('request failed');
  const request = async () => { throw failure; };
  await assert.rejects(getNotifications(request, 'farm-a', { page: 1, unreadOnly: false }), (error) => error === failure);
  await assert.rejects(markNotificationRead(request, 'farm-a', 'id'), (error) => error === failure);
  await assert.rejects(markAllNotificationsRead(request, 'farm-a'), (error) => error === failure);
});

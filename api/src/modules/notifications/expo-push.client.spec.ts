import {
  ExpoPushClient,
  ExpoPushFailure,
  type ExpoPushMessage,
} from './expo-push.client';
import { pushWorkerOptions } from './push-worker.options';

describe('Expo push HTTP client', () => {
  const message: ExpoPushMessage = {
    to: 'ExponentPushToken[private_test_token]',
    title: 'Phiếu',
    body: 'Cần duyệt',
    sound: 'default',
    priority: 'high',
    channelId: 'stock-documents',
    tag: 'notice',
    expiration: 9999999999,
    data: {
      version: 1,
      notificationId: 'notice',
      recipientUserId: 'user',
      farmId: 'farm',
      entityType: 'STOCK_ISSUE',
      entityId: 'document',
      type: 'STOCK_ISSUE_PENDING_APPROVAL',
    },
  };
  const client = new ExpoPushClient({
    ...pushWorkerOptions({}),
    accessToken: 'test_expo_access_token',
    requestTimeoutMs: 100,
  });
  let fetchMock: jest.SpyInstance<
    ReturnType<typeof fetch>,
    Parameters<typeof fetch>
  >;
  beforeEach(() => {
    fetchMock = jest.spyOn(globalThis, 'fetch');
  });
  afterEach(() => jest.restoreAllMocks());
  const reply = (body: unknown, status = 200) =>
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

  it('posts the channel/payload with optional enhanced-security credentials and parses a ticket', async () => {
    reply({ data: { status: 'ok', id: 'ticket-1' } });
    await expect(client.send(message)).resolves.toEqual({
      status: 'ok',
      id: 'ticket-1',
    });
    const [url, request] = fetchMock.mock.calls[0];
    expect(url).toBe('https://exp.host/--/api/v2/push/send');
    expect(request?.method).toBe('POST');
    expect(new Headers(request?.headers).get('Authorization')).toBe(
      'Bearer test_expo_access_token',
    );
    expect(request?.body).toBe(JSON.stringify(message));
  });
  it('accepts a one-element ticket array but rejects an ambiguous response', async () => {
    reply({ data: [{ status: 'ok', id: 'ticket-1' }] });
    await expect(client.send(message)).resolves.toMatchObject({
      id: 'ticket-1',
    });
    reply({
      data: [
        { status: 'ok', id: '1' },
        { status: 'ok', id: '2' },
      ],
    });
    await expect(client.send(message)).rejects.toMatchObject({
      code: 'EXPO_INVALID_RESPONSE',
      retryable: true,
    });
  });
  it('looks up the saved ticket and distinguishes a missing receipt', async () => {
    reply({ data: {} });
    await expect(client.receipt('ticket-1')).resolves.toBeNull();
    reply({ data: { 'ticket-1': { status: 'ok' } } });
    await expect(client.receipt('ticket-1')).resolves.toEqual({ status: 'ok' });
    expect(fetchMock).toHaveBeenLastCalledWith(
      'https://exp.host/--/api/v2/push/getReceipts',
      expect.objectContaining({ body: JSON.stringify({ ids: ['ticket-1'] }) }),
    );
  });
  it('keeps only known error codes, never provider text containing a private token', async () => {
    reply({
      data: {
        status: 'error',
        message: message.to,
        details: { error: 'DeviceNotRegistered' },
      },
    });
    await expect(client.send(message)).resolves.toEqual({
      status: 'error',
      code: 'DeviceNotRegistered',
    });
    reply({
      data: {
        status: 'error',
        message: message.to,
        details: { error: message.to },
      },
    });
    await expect(client.send(message)).resolves.toEqual({
      status: 'error',
      code: 'EXPO_UNKNOWN_ERROR',
    });
  });
  it.each([429, 500, 503])(
    'retries HTTP %i without persisting a potentially sensitive response body',
    async (status) => {
      reply({ token: message.to }, status);
      await expect(client.send(message)).rejects.toMatchObject({
        code: `EXPO_HTTP_${status}`,
        retryable: true,
      });
    },
  );
  it.each([400, 401, 403])(
    'does not retry permanent HTTP %i errors',
    async (status) => {
      reply({}, status);
      await expect(client.send(message)).rejects.toMatchObject({
        code: `EXPO_HTTP_${status}`,
        retryable: false,
      });
    },
  );
  it('handles top-level throttling and unexpected JSON as transport failures', async () => {
    reply({ errors: [{ code: 'TOO_MANY_REQUESTS', message: message.to }] });
    await expect(client.send(message)).rejects.toMatchObject({
      code: 'TOO_MANY_REQUESTS',
      retryable: true,
    });
    fetchMock.mockResolvedValueOnce(new Response('invalid-json'));
    await expect(client.send(message)).rejects.toBeInstanceOf(ExpoPushFailure);
  });
  it('classifies a network failure and a cancelled request without leaking their messages', async () => {
    fetchMock.mockRejectedValueOnce(new Error(message.to));
    await expect(client.send(message)).rejects.toMatchObject({
      code: 'EXPO_NETWORK_ERROR',
      retryable: true,
    });
    const controller = new AbortController();
    controller.abort();
    fetchMock.mockRejectedValueOnce(new Error(message.to));
    await expect(client.send(message, controller.signal)).rejects.toMatchObject(
      { code: 'EXPO_REQUEST_ABORTED', retryable: true },
    );
  });
  it('rejects an oversized payload before any HTTP request', async () => {
    await expect(
      client.send({ ...message, body: 'x'.repeat(4000) }),
    ).rejects.toMatchObject({
      code: 'PUSH_PAYLOAD_TOO_LARGE',
      retryable: false,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

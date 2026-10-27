import { BadRequestException } from '@nestjs/common';
import { AuditLogsController } from './audit-logs.controller';
import type { AuditLogsService } from './audit-logs.service';

describe('AuditLogsController', () => {
  const id = 'c796d96d-7260-4763-a9fe-8fe08a444165';
  const farmId = '6a8ac800-8daa-4e25-9ef8-57af547f8784';
  const service = { get: jest.fn() };
  const controller = new AuditLogsController(
    service as unknown as AuditLogsService,
  );
  beforeEach(() => jest.resetAllMocks());
  it('validates IDs before requesting a detail', async () => {
    await expect(
      controller.get({ clerkUserId: 'user' }, 'bad-id', farmId),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      controller.get({ clerkUserId: 'user' }, id),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(service.get).not.toHaveBeenCalled();
  });
  it('passes the authenticated user and farm to the service', async () => {
    service.get.mockResolvedValue({ id });
    await expect(
      controller.get({ clerkUserId: 'user' }, id, farmId),
    ).resolves.toEqual({ data: { id } });
    expect(service.get).toHaveBeenCalledWith(id, farmId, 'user');
  });
});

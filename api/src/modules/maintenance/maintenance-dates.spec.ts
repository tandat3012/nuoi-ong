import { maintenanceNextDate, maintenanceAlert } from './maintenance-dates';
describe('maintenance dates in Vietnam', () => {
  it('counts from actual local return, clamps end of month and leap years', () => {
    expect(maintenanceNextDate('2026-11-10T17:30:00Z', 3)).toBe('2027-02-11');
    expect(maintenanceNextDate('2027-01-31T01:00:00Z', 1)).toBe('2027-02-28');
    expect(maintenanceNextDate('2028-01-31T01:00:00Z', 1)).toBe('2028-02-29');
  });
  it('distinguishes overdue service from overdue return at local midnight', () => {
    const r = {
      status: 'SCHEDULED',
      scheduledAt: '2026-11-10T03:00:00Z',
      expectedReturnAt: '2026-11-12T03:00:00Z',
    };
    expect(maintenanceAlert(r, new Date('2026-11-09T17:00:00Z'))).toBe(
      'Đến hạn bảo trì hôm nay',
    );
    expect(maintenanceAlert(r, new Date('2026-11-10T17:00:00Z'))).toBe(
      'Quá hạn bảo trì 1 ngày',
    );
    expect(
      maintenanceAlert(
        { ...r, status: 'IN_PROGRESS' },
        new Date('2026-11-12T17:00:00Z'),
      ),
    ).toBe('Trễ hẹn trả 1 ngày');
    expect(
      maintenanceAlert(
        { ...r, status: 'RECEIVED' },
        new Date('2026-11-12T17:00:00Z'),
      ),
    ).toBeNull();
  });
});

import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CompleteMaintenanceRecordDto } from './dto/maintenance.dto';
it('rejects legacy completion and invalid intervals at API boundary', () => {
  const errors = (body: object) =>
    validateSync(plainToInstance(CompleteMaintenanceRecordDto, body), {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
  expect(errors({ resultNote: 'legacy' }).length).toBeGreaterThan(0);
  expect(
    errors({ outcome: 'PASSED', resultNote: 'pass', intervalMonths: 1.5 })
      .length,
  ).toBeGreaterThan(0);
  expect(
    errors({ outcome: 'PASSED', resultNote: 'pass', intervalMonths: 121 })
      .length,
  ).toBeGreaterThan(0);
  expect(
    errors({ outcome: 'PASSED', resultNote: 'pass', intervalMonths: 3 }),
  ).toHaveLength(0);
});

import { describe, expect, it } from '@jest/globals';
import {
  awaitsFinalDecision,
  canApproveMaintenanceRequest,
  canDecideMaintenance,
  finalDecisionLabel,
  finalDecisionTone,
} from './maintenance.logic';

describe('maintenance.logic', () => {
  it('identifies farm owners and admins who can make final decisions', () => {
    expect(canDecideMaintenance(['ADMIN'])).toBe(true);
    expect(canDecideMaintenance(['FARM_OWNER'])).toBe(true);
    expect(canDecideMaintenance(['WAREHOUSE_MANAGER'])).toBe(false);
    expect(canDecideMaintenance(['EMPLOYEE'])).toBe(false);
    expect(canDecideMaintenance([])).toBe(false);
  });

  it('restricts maintenance request approval to farm admins and owners', () => {
    expect(canApproveMaintenanceRequest(['FARM_OWNER'])).toBe(true);
    expect(canApproveMaintenanceRequest(['ADMIN'])).toBe(true);
    expect(canApproveMaintenanceRequest(['WAREHOUSE_MANAGER'])).toBe(false);
    expect(canApproveMaintenanceRequest(['MAINTENANCE_STAFF'])).toBe(false);
  });

  it('detects when a maintenance record is awaiting final decision from farm owner', () => {
    expect(
      awaitsFinalDecision({
        status: 'COMPLETED',
        returnStatus: 'CONFIRMED',
        finalDecision: null,
      }),
    ).toBe(true);

    // Not awaiting decision if return is not confirmed
    expect(
      awaitsFinalDecision({
        status: 'COMPLETED',
        returnStatus: 'PENDING_APPROVAL',
        finalDecision: null,
      }),
    ).toBe(false);

    // Not awaiting decision if already decided
    expect(
      awaitsFinalDecision({
        status: 'COMPLETED',
        returnStatus: 'CONFIRMED',
        finalDecision: 'REUSE',
      }),
    ).toBe(false);

    expect(
      awaitsFinalDecision({
        status: 'COMPLETED',
        returnStatus: 'CONFIRMED',
        finalDecision: 'HOLD',
      }),
    ).toBe(false);

    // Not awaiting decision if status is still IN_PROGRESS
    expect(
      awaitsFinalDecision({
        status: 'IN_PROGRESS',
        returnStatus: 'CONFIRMED',
        finalDecision: null,
      }),
    ).toBe(false);
  });

  it('formats final decision labels and tones correctly', () => {
    expect(finalDecisionLabel('REUSE')).toBe('Cho phép sử dụng lại');
    expect(finalDecisionTone('REUSE')).toBe('success');

    expect(finalDecisionLabel('HOLD')).toBe('Tạm giữ, chờ xử lý');
    expect(finalDecisionTone('HOLD')).toBe('danger');

    expect(finalDecisionLabel(null)).toBe('');
    expect(finalDecisionTone(null)).toBe('neutral');
  });
});

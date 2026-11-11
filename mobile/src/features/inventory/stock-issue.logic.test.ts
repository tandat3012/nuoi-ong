import { describe, expect, it } from '@jest/globals';
import { issueReceiptAction } from './stock-issue.logic';

describe('issueReceiptAction', () => {
  const issue = { status: 'CONFIRMED', recipientMemberId: 'm1', receivedAt: null };

  it('allows the recipient to acknowledge receipt themselves', () => {
    expect(issueReceiptAction({ roles: ['EMPLOYEE'], memberId: 'm1' }, issue)).toBe('self');
  });

  it('allows warehouse managers and farm admins to record receipt on behalf of recipient', () => {
    expect(issueReceiptAction({ roles: ['WAREHOUSE_MANAGER'], memberId: 'm2' }, issue)).toBe('onBehalf');
    expect(issueReceiptAction({ roles: ['FARM_OWNER'], memberId: 'm2' }, issue)).toBe('onBehalf');
    expect(issueReceiptAction({ roles: ['ADMIN'], memberId: 'm2' }, issue)).toBe('onBehalf');
  });

  it('denies employees who are not the recipient', () => {
    expect(issueReceiptAction({ roles: ['EMPLOYEE'], memberId: 'm2' }, issue)).toBeNull();
  });

  it('returns null if issue is not CONFIRMED, has no recipient, or is already received', () => {
    expect(issueReceiptAction({ roles: ['ADMIN'], memberId: 'm1' }, { ...issue, status: 'PENDING_APPROVAL' })).toBeNull();
    expect(issueReceiptAction({ roles: ['ADMIN'], memberId: 'm1' }, { ...issue, status: 'DRAFT' })).toBeNull();
    expect(issueReceiptAction({ roles: ['ADMIN'], memberId: 'm1' }, { ...issue, recipientMemberId: null })).toBeNull();
    expect(issueReceiptAction({ roles: ['ADMIN'], memberId: 'm1' }, { ...issue, receivedAt: '2026-11-08T10:00:00Z' })).toBeNull();
  });
});

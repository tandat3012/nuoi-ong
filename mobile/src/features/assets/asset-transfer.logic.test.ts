import { describe, expect, it } from '@jest/globals';
import {
  canManageAssetTransfer,
  canReceiveTransfer,
  canReviewTransfer,
  extractScannedAssetCode,
  transferRequestStatusLabel,
  transferRequestStatusTone,
  validateTransferReceive,
} from './asset-transfer.logic';

describe('asset-transfer.logic', () => {
  it('checks if a user role can manage asset transfers', () => {
    expect(canManageAssetTransfer(['ADMIN'])).toBe(true);
    expect(canManageAssetTransfer(['FARM_OWNER'])).toBe(true);
    expect(canManageAssetTransfer(['WAREHOUSE_MANAGER'])).toBe(true);
    expect(canManageAssetTransfer(['EMPLOYEE'])).toBe(false);
    expect(canManageAssetTransfer([])).toBe(false);
  });

  it('determines if user can review pending transfer', () => {
    expect(canReviewTransfer(['WAREHOUSE_MANAGER'], 'PENDING_APPROVAL')).toBe(true);
    expect(canReviewTransfer(['EMPLOYEE'], 'PENDING_APPROVAL')).toBe(false);
    expect(canReviewTransfer(['WAREHOUSE_MANAGER'], 'IN_TRANSIT')).toBe(false);
  });

  it('determines if user can receive IN_TRANSIT transfer at destination', () => {
    expect(canReceiveTransfer(['WAREHOUSE_MANAGER'], 'IN_TRANSIT')).toBe(true);
    expect(canReceiveTransfer(['ADMIN'], 'IN_TRANSIT')).toBe(true);
    expect(canReceiveTransfer(['EMPLOYEE'], 'IN_TRANSIT')).toBe(false);
    expect(canReceiveTransfer(['WAREHOUSE_MANAGER'], 'CONFIRMED')).toBe(false);
  });

  it('provides Vietnamese labels and appropriate tones for transfer request statuses', () => {
    expect(transferRequestStatusLabel('IN_TRANSIT')).toBe('Đang chuyển, chờ kho đích nhận');
    expect(transferRequestStatusTone('IN_TRANSIT')).toBe('amber');

    expect(transferRequestStatusLabel('CONFIRMED')).toBe('Đã hoàn tất');
    expect(transferRequestStatusTone('CONFIRMED')).toBe('success');

    expect(transferRequestStatusLabel('REJECTED')).toBe('Đã từ chối');
    expect(transferRequestStatusTone('REJECTED')).toBe('danger');
  });

  it('validates destination transfer receive input', () => {
    // Missing asset code
    expect(
      validateTransferReceive({
        assetCode: '',
        expectedAssetCode: 'TS-001',
        condition: 'GOOD',
      }),
    ).toBe('Vui lòng nhập hoặc quét mã tài sản nhận.');

    // Mismatched asset code
    expect(
      validateTransferReceive({
        assetCode: 'TS-999',
        expectedAssetCode: 'TS-001',
        condition: 'GOOD',
      }),
    ).toBe('Mã tài sản không khớp với yêu cầu điều chuyển (ASSET_MISMATCH).');

    // Matching asset code, condition GOOD
    expect(
      validateTransferReceive({
        assetCode: 'ts-001',
        expectedAssetCode: 'TS-001',
        condition: 'GOOD',
      }),
    ).toBeNull();

    // Condition DAMAGED without note
    expect(
      validateTransferReceive({
        assetCode: 'TS-001',
        expectedAssetCode: 'TS-001',
        condition: 'DAMAGED',
        note: '',
      }),
    ).toBe('Cần ghi chú tình trạng khi nhận tài sản hỏng.');

    // Condition DAMAGED with note
    expect(
      validateTransferReceive({
        assetCode: 'TS-001',
        expectedAssetCode: 'TS-001',
        condition: 'DAMAGED',
        note: 'Vỡ vỏ ngoài trong lúc vận chuyển',
      }),
    ).toBeNull();
  });

  it('extracts scanned asset code from raw token or scan URI', () => {
    expect(extractScannedAssetCode('TS-001')).toBe('TS-001');
    expect(extractScannedAssetCode('  TS-002  ')).toBe('TS-002');
    expect(extractScannedAssetCode('https://nuoiong.vn/scan/TS-003')).toBe('TS-003');
    expect(extractScannedAssetCode('/scan/TS%20004?param=1')).toBe('TS 004');
  });
});

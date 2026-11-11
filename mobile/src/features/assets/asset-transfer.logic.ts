export const WAREHOUSE_MANAGE_ROLES = ['ADMIN', 'FARM_OWNER', 'WAREHOUSE_MANAGER'] as const;

export function canManageAssetTransfer(roles: readonly string[] = []): boolean {
  return roles.some((role) => (WAREHOUSE_MANAGE_ROLES as readonly string[]).includes(role));
}

export function canReviewTransfer(roles: readonly string[] = [], status: string): boolean {
  return status === 'PENDING_APPROVAL' && canManageAssetTransfer(roles);
}

export function canReceiveTransfer(roles: readonly string[] = [], status: string): boolean {
  return status === 'IN_TRANSIT' && canManageAssetTransfer(roles);
}

export function transferRequestStatusLabel(status: string): string {
  switch (status) {
    case 'PENDING_APPROVAL':
      return 'Chờ duyệt';
    case 'IN_TRANSIT':
      return 'Đang chuyển, chờ kho đích nhận';
    case 'CONFIRMED':
      return 'Đã hoàn tất';
    case 'REJECTED':
      return 'Đã từ chối';
    default:
      return status;
  }
}

export function transferRequestStatusTone(status: string): 'amber' | 'success' | 'danger' | 'neutral' {
  switch (status) {
    case 'PENDING_APPROVAL':
    case 'IN_TRANSIT':
      return 'amber';
    case 'CONFIRMED':
      return 'success';
    case 'REJECTED':
      return 'danger';
    default:
      return 'neutral';
  }
}

export interface ReceiveTransferValidationInput {
  assetCode: string;
  expectedAssetCode?: string;
  condition: 'GOOD' | 'DAMAGED';
  note?: string | null;
}

export function validateTransferReceive(input: ReceiveTransferValidationInput): string | null {
  if (!input.assetCode?.trim()) {
    return 'Vui lòng nhập hoặc quét mã tài sản nhận.';
  }
  if (
    input.expectedAssetCode &&
    input.assetCode.trim().toUpperCase() !== input.expectedAssetCode.trim().toUpperCase()
  ) {
    return 'Mã tài sản không khớp với yêu cầu điều chuyển (ASSET_MISMATCH).';
  }
  if (input.condition === 'DAMAGED' && !input.note?.trim()) {
    return 'Cần ghi chú tình trạng khi nhận tài sản hỏng.';
  }
  return null;
}

export function extractScannedAssetCode(value: string): string {
  const trimmed = value.trim();
  const routeMatch = trimmed.match(/\/scan\/([^/?#]+)/i);
  if (routeMatch?.[1]) {
    try {
      return decodeURIComponent(routeMatch[1]).trim();
    } catch {
      return routeMatch[1].trim();
    }
  }
  return trimmed;
}

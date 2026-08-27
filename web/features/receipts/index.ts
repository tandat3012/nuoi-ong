import type { ModuleDefinition } from '@/shared/types/module';

export const receiptsModule: ModuleDefinition = {
  title: 'Phiếu nhập kho',
  description:
    'Tạo phiếu nháp, thêm chi tiết và xác nhận nhập để cập nhật LOT, asset, tồn kho và ledger.',
  status: 'ready-for-api',
  capabilities: [
    'Tạo và chỉnh sửa phiếu ở trạng thái DRAFT',
    'Nhập item theo số lượng, LOT hoặc asset cụ thể',
    'Confirm phiếu theo transaction và lưu người thực hiện',
  ],
  primaryAction: 'Tạo phiếu nhập',
};

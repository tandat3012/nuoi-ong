import type { ModuleDefinition } from '@/shared/types/module';

export const inventoryModule: ModuleDefinition = {
  title: 'Kho và tồn kho',
  description:
    'Theo dõi tồn hiện tại theo kho và item, lô hàng, hạn sử dụng và toàn bộ ledger biến động.',
  status: 'ready-for-api',
  capabilities: [
    'Tồn kho hiện tại theo warehouse và item',
    'LOT, số lượng còn lại và hạn sử dụng',
    'Lịch sử inventory transaction có chứng từ nguồn',
  ],
  primaryAction: 'Kiểm kê kho',
};

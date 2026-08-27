import type { ModuleDefinition } from '@/shared/types/module';

export const issuesModule: ModuleDefinition = {
  title: 'Phiếu xuất kho',
  description:
    'Lập phiếu xuất, kiểm tra tồn khả dụng và ghi nhận biến động giảm theo LOT hoặc asset.',
  status: 'ready-for-api',
  capabilities: [
    'Tạo phiếu xuất DRAFT theo kho và mục đích sử dụng',
    'Kiểm tra tồn, LOT và trạng thái asset trước khi confirm',
    'Ghi transaction âm và cập nhật trạng thái tài sản',
  ],
  primaryAction: 'Tạo phiếu xuất',
};

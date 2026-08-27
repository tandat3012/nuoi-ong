import type { ModuleDefinition } from '@/shared/types/module';

export const catalogModule: ModuleDefinition = {
  title: 'Danh mục dùng chung',
  description:
    'Quản lý cây danh mục, đơn vị tính, thiết bị, dụng cụ, vật tư và nhà cung cấp.',
  status: 'ready-for-api',
  capabilities: [
    'Category phân cấp và phân loại EQUIPMENT / TOOL / MATERIAL',
    'Đơn vị tính và thông số kỹ thuật linh hoạt của item',
    'Hồ sơ nhà cung cấp và nguồn dữ liệu sản phẩm',
  ],
  primaryAction: 'Thêm item',
};

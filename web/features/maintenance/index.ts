import type { ModuleDefinition } from '@/shared/types/module';

export const maintenanceModule: ModuleDefinition = {
  title: 'Bảo trì và sửa chữa',
  description:
    'Quản lý lịch, quá trình xử lý, kết quả, chi phí và ngày bảo trì tiếp theo cho từng asset.',
  status: 'ready-for-api',
  capabilities: [
    'Luồng SCHEDULED → IN_PROGRESS → COMPLETED',
    'Nội dung sửa chữa, chi phí và kết quả thực hiện',
    'Cảnh báo đến hạn và khóa cấp phát asset đang bảo trì',
  ],
  primaryAction: 'Lập lịch bảo trì',
};

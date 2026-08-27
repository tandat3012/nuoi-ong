import type { ModuleDefinition } from '@/shared/types/module';

export const assetsModule: ModuleDefinition = {
  title: 'Tài sản định danh',
  description:
    'Theo dõi từng thiết bị cần truy vết theo mã asset, serial, QR, trạng thái và người đang giữ.',
  status: 'ready-for-api',
  capabilities: [
    'Mã asset, serial và QR duy nhất',
    'Vị trí, người sử dụng và vòng đời trạng thái',
    'Liên kết lịch sử nhập, cấp phát và bảo trì',
  ],
  primaryAction: 'Thêm tài sản',
};

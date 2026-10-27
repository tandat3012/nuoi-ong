import type { ModuleDefinition } from '@/shared/types/module';
import { QrAssetLookup } from './components/qr-asset-lookup';

export const qrModule: ModuleDefinition = {
  title: 'Tra cứu QR',
  description:
    'Mở nhanh hồ sơ tài sản bằng mã hoặc URL trong QR và luôn lấy trạng thái mới nhất từ API.',
  status: 'ready-for-api',
  capabilities: [
    'Quét QR hoặc nhập mã asset để tra cứu',
    'Hiển thị hồ sơ theo vai trò và phạm vi được cấp',
    'Đi tới báo hỏng, cấp phát hoặc bảo trì từ hồ sơ asset',
  ],
  primaryAction: 'Mở máy quét',
};

export { QrAssetLookup };

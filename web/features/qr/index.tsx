import type { ModuleDefinition } from '@/shared/types/module';

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

export function QrAssetLookup({ assetCode }: { assetCode: string }) {
  return (
    <section className="rounded-2xl border bg-card p-5 shadow-sm sm:p-7">
      <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground">
        QR Asset
      </span>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">Tra cứu tài sản</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Mã nhận được: <strong className="font-mono text-foreground">{assetCode}</strong>
      </p>
      <div className="mt-6 rounded-xl border border-dashed bg-muted/40 p-6 text-center">
        <p className="font-medium">Chờ API hồ sơ tài sản</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Mã QR đã được đọc từ URL; dữ liệu chi tiết sẽ được tải sau khi endpoint asset hoàn tất.
        </p>
      </div>
    </section>
  );
}

import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '@/src/core/theme/tokens';
import { useAuthContext } from '@/src/features/auth/context/AuthContext';
import NotificationBell from '@/src/features/notifications/presentation/NotificationBell';
import { apiRequest, MobileApiError } from '@/src/shared/api/client';
import { AppShell, Card, PageHeader, Pill } from '@/src/shared/ui/MobileShell';

type RequestDetail = { data: {
  id: string;
  assetId: string;
  assetCode: string;
  itemName: string;
  maintenanceType: string;
  description: string;
  status: string;
  rejectionReason: string | null;
  createdAt: string;
  requestedByName: string | null;
  requestedByEmail: string;
  reviewedAt: string | null;
  reviewedByName: string | null;
  reviewedByEmail: string | null;
  maintenanceRecordId: string | null;
  maintenanceScheduledAt: string | null;
  maintenanceRecordStatus: string | null;
  maintenanceStartedAt: string | null;
  maintenanceReceivedAt: string | null;
  maintenanceCompletedAt: string | null;
  maintenanceResultNote: string | null;
  maintenanceLaborCost: string | null;
  maintenanceMaterialCost: string | null;
  maintenanceOtherCost: string | null;
  maintenanceReturnStatus: string | null;
  maintenanceReturnRejectionReason: string | null;
  maintenanceFinalDecision: string | null;
  maintenanceFinalDecisionNote: string | null;
  maintenanceNextDueDate: string | null;
} };

function formatDateTime(value: string | null | undefined) {
  if (!value) return 'Chưa có';
  const normalized = value.trim()
    .replace(' ', 'T')
    .replace(/(\.\d{3})\d+/, '$1')
    .replace(/([+-]\d{2})$/, '$1:00');
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('vi-VN', { dateStyle: 'medium', timeStyle: 'short' });
}

function statusLabel(status: string) {
  return ({ PENDING_APPROVAL: 'Chờ duyệt', CONFIRMED: 'Đã duyệt', REJECTED: 'Đã từ chối' } as Record<string, string>)[status] ?? status;
}

function maintenanceStatusLabel(status: string | null) {
  if (!status) return 'Chưa lập lịch';
  return ({ SCHEDULED: 'Đã lên lịch', IN_PROGRESS: 'Đang bảo trì', RECEIVED: 'Đã nhận về · chờ nghiệm thu', COMPLETED: 'Đã nghiệm thu đạt', FAILED: 'Bảo trì không đạt', CANCELLED: 'Lịch đã hủy' } as Record<string, string>)[status] ?? status;
}

function currentStatusLabel(request: RequestDetail['data']) {
  if (request.status !== 'CONFIRMED' || !request.maintenanceRecordStatus) return statusLabel(request.status);
  if (request.maintenanceReturnStatus === 'PENDING_APPROVAL') return 'Chờ quản lý kho duyệt nhập lại';
  if (request.maintenanceReturnStatus === 'REJECTED') return 'Phiếu nhập lại bị từ chối · cần gửi lại';
  if (request.maintenanceReturnStatus === 'CONFIRMED') {
    if (request.maintenanceRecordStatus === 'FAILED') return 'Đã nhập kho · bảo trì không đạt, chưa được sử dụng';
    if (request.maintenanceFinalDecision === 'REUSE') return 'Hoàn tất · được sử dụng lại';
    if (request.maintenanceFinalDecision === 'HOLD') return 'Đã nhập kho · tạm giữ';
    if (request.maintenanceRecordStatus === 'COMPLETED') return 'Đã nhập kho · chờ quyết định cho dùng lại';
  }
  return maintenanceStatusLabel(request.maintenanceRecordStatus);
}

function reviewerLabel(request: RequestDetail['data']) {
  const name = request.reviewedByName?.trim();
  const email = request.reviewedByEmail?.trim();
  return name || email || (request.status === 'PENDING_APPROVAL' ? 'Đang chờ người có quyền duyệt' : 'Chưa có thông tin người duyệt');
}

export default function MaintenanceRequestDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { currentFarmId, getAccessToken } = useAuthContext();
  const [request, setRequest] = useState<RequestDetail['data'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    if (!currentFarmId || !id) return;
    const token = await getAccessToken();
    if (!token) throw new MobileApiError('Phiên đăng nhập đã hết hạn.', 401);
    const response = await apiRequest<RequestDetail>(`/maintenance-requests/${encodeURIComponent(id)}`, { token, params: { farmId: currentFarmId }, skipCache: true });
    setRequest(response.data);
  }
  useFocusEffect(useCallback(() => {
    let cancelled = false;
    if (!currentFarmId || !id) { setLoading(false); setError('Thiếu farm hoặc mã yêu cầu.'); return; }
    setLoading(true);
    void reload().catch((cause: unknown) => { if (!cancelled) setError(cause instanceof Error ? cause.message : 'Không thể tải yêu cầu.'); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [currentFarmId, getAccessToken, id]));

  return <AppShell active="receipts">
    <PageHeader title="Yêu cầu bảo trì" subtitle="Theo dõi sự cố tài sản" onBack={() => router.back()} action={<NotificationBell />} />
    {loading ? <Card><Text style={styles.muted}>Đang tải yêu cầu…</Text></Card> : error ? <Card><Text style={styles.error}>{error}</Text></Card> : request ? <>
      <Card style={styles.card}>
        <View style={styles.assetHeader}>
          <Text style={styles.asset}>{request.itemName}</Text>
          <Pill
            tone={request.status === 'REJECTED' || request.maintenanceRecordStatus === 'FAILED' ? 'danger' : request.status === 'CONFIRMED' && request.maintenanceRecordStatus === 'COMPLETED' && request.maintenanceFinalDecision === 'REUSE' ? 'success' : 'amber'}
          >
            <Text style={styles.status}>{currentStatusLabel(request)}</Text>
          </Pill>
        </View>
        <Text style={styles.code}>Mã phiếu: MNT-{request.id.slice(0, 8)}</Text>
        <Text style={styles.code}>Mã tài sản: {request.assetCode}</Text>
        <Text style={styles.label}>Loại yêu cầu</Text><Text style={styles.value}>{request.maintenanceType === 'CORRECTIVE' ? 'Sửa chữa đột xuất' : request.maintenanceType === 'INSPECTION' ? 'Kiểm tra thiết bị' : request.maintenanceType}</Text>
        <Text style={styles.label}>Mô tả sự cố</Text><Text style={styles.value}>{request.description}</Text>
      </Card>
      <Card style={styles.card}>
        <Text style={styles.section}>Thông tin gửi yêu cầu</Text>
        <Text style={styles.label}>Người gửi</Text>
        <Text style={styles.value}>{request.requestedByName?.trim() || 'Chưa có tên'}</Text>
        <Text style={styles.email} selectable>{request.requestedByEmail}</Text>
        <Text style={styles.label}>Thời gian gửi</Text><Text style={styles.value}>{formatDateTime(request.createdAt)}</Text>
      </Card>
      <Card style={styles.card}>
        <Text style={styles.section}>Kết quả xử lý</Text>
        <Text style={styles.label}>Người duyệt</Text><Text style={styles.value}>{reviewerLabel(request)}</Text>
        <Text style={styles.label}>Thời gian duyệt</Text><Text style={styles.value}>{formatDateTime(request.reviewedAt)}</Text>
        {request.rejectionReason ? <><Text style={styles.label}>Lý do từ chối</Text><Text style={styles.error}>{request.rejectionReason}</Text></> : null}
        {request.maintenanceRecordId ? <>
          <Text style={styles.label}>Tình trạng bảo trì</Text><Text style={styles.value}>{maintenanceStatusLabel(request.maintenanceRecordStatus)}</Text>
          <Text style={styles.label}>Lịch bảo trì</Text><Text style={styles.value}>{formatDateTime(request.maintenanceScheduledAt)}</Text>
          <Text style={styles.label}>Thời gian bắt đầu / nhận lại / nghiệm thu</Text><Text style={styles.value}>{formatDateTime(request.maintenanceStartedAt)} · {formatDateTime(request.maintenanceReceivedAt)} · {formatDateTime(request.maintenanceCompletedAt)}</Text>
          {request.maintenanceResultNote ? <><Text style={styles.label}>Kết quả bảo trì</Text><Text style={styles.value}>{request.maintenanceResultNote}</Text></> : null}
          {request.maintenanceReturnStatus ? <><Text style={styles.label}>Nhập lại kho</Text><Text style={styles.value}>{request.maintenanceReturnStatus === 'PENDING_APPROVAL' ? 'Chờ duyệt' : request.maintenanceReturnStatus === 'CONFIRMED' ? 'Đã duyệt' : 'Bị từ chối'}</Text></> : null}
          {request.maintenanceReturnRejectionReason ? <><Text style={styles.label}>Lý do từ chối nhập lại</Text><Text style={styles.error}>{request.maintenanceReturnRejectionReason}</Text></> : null}
          {request.maintenanceFinalDecision ? <><Text style={styles.label}>Quyết định cuối</Text><Text style={styles.value}>{request.maintenanceFinalDecision === 'REUSE' ? 'Cho phép sử dụng lại' : 'Tạm giữ, chưa sử dụng'}</Text></> : null}
          {request.maintenanceNextDueDate ? <><Text style={styles.label}>Kỳ bảo trì tiếp theo</Text><Text style={styles.value}>{request.maintenanceNextDueDate}</Text></> : null}
        </> : null}
      </Card>
    </> : <Card><Text style={styles.muted}>Không tìm thấy yêu cầu này trong trang trại đang chọn.</Text></Card>}
  </AppShell>;
}

const styles = StyleSheet.create({
  card: { gap: spacing.spaceSm, backgroundColor: colors.surfaceContainerLowest },
  assetHeader: { alignItems: 'flex-start', gap: spacing.spaceSm, minWidth: 0 },
  asset: { ...typography.headlineMd, color: colors.deepAmberStrong, width: '100%', flexShrink: 1 },
  code: { ...typography.labelMd, color: colors.primary, flexShrink: 1 },
  label: { ...typography.labelSm, color: colors.onSurfaceVariant, marginTop: spacing.spaceXs },
  value: { ...typography.bodyMd, color: colors.onSurface, minWidth: 0, flexShrink: 1 },
  email: { ...typography.bodySm, color: colors.onSurfaceVariant, minWidth: 0, flexShrink: 1 },
  status: { ...typography.labelSm, color: colors.onSurfaceVariant, flexShrink: 1 },
  section: { ...typography.headlineSm, color: colors.deepAmberStrong },
  muted: { ...typography.bodyMd, color: colors.onSurfaceVariant },
  error: { ...typography.bodyMd, color: colors.error, minWidth: 0, flexShrink: 1 },
});

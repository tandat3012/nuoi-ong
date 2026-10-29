import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, radius, spacing, typography } from '@/src/core/theme/tokens';
import { useAuthContext } from '@/src/features/auth/context/AuthContext';
import NotificationBell from '@/src/features/notifications/presentation/NotificationBell';
import { apiRequest, MobileApiError } from '@/src/shared/api/client';
import { AppShell, Card, Icon, PageHeader, Pill, PrimaryButton } from '@/src/shared/ui/MobileShell';

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
  return ({ SCHEDULED: 'Đã lên lịch', IN_PROGRESS: 'Đang bảo trì', COMPLETED: 'Đã hoàn tất', CANCELLED: 'Đã hủy' } as Record<string, string>)[status] ?? status;
}

function reviewerLabel(request: RequestDetail['data']) {
  const name = request.reviewedByName?.trim();
  const email = request.reviewedByEmail?.trim();
  return name || email || (request.status === 'PENDING_APPROVAL' ? 'Đang chờ người có quyền duyệt' : 'Chưa có thông tin người duyệt');
}

export default function MaintenanceRequestDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { data: auth, currentFarmId, getAccessToken } = useAuthContext();
  const membership = auth?.memberships.find(({ farm }) => farm.id === currentFarmId);
  const canApprove = membership?.roles.some((role) => role === 'ADMIN' || role === 'FARM_OWNER') ?? false;
  const [request, setRequest] = useState<RequestDetail['data'] | null>(null);
  const [scheduledAt, setScheduledAt] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    if (!currentFarmId || !id) return;
    const token = await getAccessToken();
    if (!token) throw new MobileApiError('Phiên đăng nhập đã hết hạn.', 401);
    const response = await apiRequest<RequestDetail>(`/maintenance-requests/${encodeURIComponent(id)}`, { token, params: { farmId: currentFarmId }, skipCache: true });
    setRequest(response.data);
  }
  useEffect(() => {
    let cancelled = false;
    if (!currentFarmId || !id) { setLoading(false); setError('Thiếu farm hoặc mã yêu cầu.'); return; }
    void reload().catch((cause: unknown) => { if (!cancelled) setError(cause instanceof Error ? cause.message : 'Không thể tải yêu cầu.'); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [currentFarmId, getAccessToken, id]);

  async function decide(action: 'approve' | 'reject') {
    if (!currentFarmId || !id) return;
    if (action === 'approve' && !scheduledAt.trim()) { Alert.alert('Thiếu lịch', 'Nhập thời gian bảo trì dự kiến theo ISO, ví dụ 2026-11-02T09:00:00.000Z.'); return; }
    if (action === 'reject' && reason.trim().length < 3) { Alert.alert('Thiếu lý do', 'Nhập lý do từ chối (ít nhất 3 ký tự).'); return; }
    setSaving(true);
    try {
      const token = await getAccessToken();
      if (!token) throw new MobileApiError('Phiên đăng nhập đã hết hạn.', 401);
      await apiRequest(`/maintenance-requests/${encodeURIComponent(id)}/${action}`, { method: 'POST', token, params: { farmId: currentFarmId }, body: action === 'approve' ? { scheduledAt: new Date(scheduledAt).toISOString() } : { rejectionReason: reason.trim() } });
      await reload();
      Alert.alert(action === 'approve' ? 'Đã duyệt' : 'Đã từ chối', action === 'approve' ? 'Đã tạo hồ sơ bảo trì theo lịch đã chọn.' : 'Yêu cầu đã được trả về người gửi.');
    } catch (cause) { Alert.alert('Không thể xử lý', cause instanceof Error ? cause.message : 'API trả về lỗi.'); }
    finally { setSaving(false); }
  }

  return <AppShell active="receipts">
    <PageHeader title="Yêu cầu bảo trì" subtitle="Theo dõi và duyệt sự cố tài sản" onBack={() => router.back()} action={<NotificationBell />} />
    {loading ? <Card><Text style={styles.muted}>Đang tải yêu cầu…</Text></Card> : error ? <Card><Text style={styles.error}>{error}</Text></Card> : request ? <>
      <Card style={styles.card}>
        <View style={styles.row}><Text style={styles.asset}>{request.itemName}</Text><Pill tone={request.status === 'CONFIRMED' ? 'success' : request.status === 'REJECTED' ? 'danger' : 'amber'}><Text style={styles.status}>{statusLabel(request.status)}</Text></Pill></View>
        <Text style={styles.code}>Mã tài sản: {request.assetCode}</Text>
        <Text style={styles.muted}>Mã yêu cầu: {request.id.slice(0, 8)}</Text>
        <Text style={styles.label}>Loại yêu cầu</Text><Text style={styles.value}>{request.maintenanceType === 'CORRECTIVE' ? 'Sửa chữa đột xuất' : request.maintenanceType === 'INSPECTION' ? 'Kiểm tra thiết bị' : request.maintenanceType}</Text>
        <Text style={styles.label}>Mô tả sự cố</Text><Text style={styles.value}>{request.description}</Text>
      </Card>
      <Card style={styles.card}>
        <Text style={styles.section}>Thông tin gửi yêu cầu</Text>
        <Text style={styles.label}>Người gửi</Text><Text style={styles.value}>{request.requestedByName?.trim() || 'Chưa có tên'} · {request.requestedByEmail}</Text>
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
          <Text style={styles.label}>Mã hồ sơ bảo trì</Text><Text style={styles.value}>{request.maintenanceRecordId}</Text>
        </> : null}
      </Card>
      {canApprove && request.status === 'PENDING_APPROVAL' ? <Card style={styles.card}><Text style={styles.section}>Xử lý yêu cầu</Text><Text style={styles.label}>Lịch bảo trì khi duyệt</Text><TextInput value={scheduledAt} onChangeText={setScheduledAt} placeholder="2026-11-02T09:00:00.000Z" placeholderTextColor={colors.outline} style={styles.input} autoCapitalize="none" /><PrimaryButton label={saving ? 'Đang lưu…' : 'Duyệt và lập lịch'} icon="check" onPress={() => void decide('approve')} /><Text style={styles.label}>Lý do nếu từ chối</Text><TextInput value={reason} onChangeText={setReason} placeholder="Nhập lý do rõ ràng" placeholderTextColor={colors.outline} style={[styles.input, styles.multiline]} multiline /><Pressable disabled={saving} onPress={() => void decide('reject')} style={styles.reject}><Icon name="close" color={colors.error} /><Text style={styles.rejectText}>Từ chối yêu cầu</Text></Pressable></Card> : null}
    </> : <Card><Text style={styles.muted}>Không tìm thấy yêu cầu này trong farm đang chọn.</Text></Card>}
  </AppShell>;
}

const styles = StyleSheet.create({ card: { gap: spacing.spaceSm, backgroundColor: colors.surfaceContainerLowest }, row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.spaceSm }, asset: { ...typography.headlineMd, color: colors.deepAmberStrong, flex: 1 }, code: { ...typography.labelMd, color: colors.primary }, label: { ...typography.labelSm, color: colors.onSurfaceVariant, marginTop: spacing.spaceXs }, value: { ...typography.bodyMd, color: colors.onSurface }, status: { ...typography.labelSm, color: colors.onSurfaceVariant }, section: { ...typography.headlineSm, color: colors.deepAmberStrong }, muted: { ...typography.bodyMd, color: colors.onSurfaceVariant }, error: { ...typography.bodyMd, color: colors.error }, input: { minHeight: 48, borderWidth: 1, borderColor: colors.outlineVariant, borderRadius: radius.default, paddingHorizontal: spacing.spaceMd, color: colors.onSurface, backgroundColor: colors.surface }, multiline: { minHeight: 84, textAlignVertical: 'top', paddingTop: spacing.spaceSm }, reject: { minHeight: 44, borderWidth: 1, borderColor: colors.error, borderRadius: radius.default, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: spacing.spaceSm }, rejectText: { ...typography.labelMd, color: colors.error } });

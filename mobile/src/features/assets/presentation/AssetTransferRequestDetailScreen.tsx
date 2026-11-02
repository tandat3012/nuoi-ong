import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuthContext } from '@/src/features/auth/context/AuthContext';
import NotificationBell from '@/src/features/notifications/presentation/NotificationBell';
import { apiRequest, MobileApiError } from '@/src/shared/api/client';
import { formatApiDateTime } from '@/src/shared/format-date-time';
import { AppShell, Card, Icon, PageHeader, Pill } from '@/src/shared/ui/MobileShell';
import { colors, spacing, typography } from '@/src/core/theme/tokens';

type RequestDetail = { data: {
  id: string;
  assetId: string;
  assetCode: string;
  itemName: string;
  fromLocationName: string | null;
  fromLocationCode: string | null;
  toWarehouseName: string | null;
  toWarehouseCode: string | null;
  toLocationName: string | null;
  toLocationCode: string | null;
  note: string | null;
  status: string;
  rejectionReason: string | null;
  createdAt: string;
  reviewedAt: string | null;
  reviewedByName: string | null;
  reviewedByEmail: string | null;
} };

const statusLabels: Record<string, string> = {
  PENDING_APPROVAL: 'Chờ duyệt', CONFIRMED: 'Đã duyệt', REJECTED: 'Đã từ chối',
};

export default function AssetTransferRequestDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { currentFarmId, getAccessToken } = useAuthContext();
  const [request, setRequest] = useState<RequestDetail['data'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!currentFarmId || !id) { setError('Thiếu trang trại hoặc mã yêu cầu.'); setLoading(false); return; }
    setLoading(true);
    try {
      const token = await getAccessToken();
      if (!token) throw new MobileApiError('Phiên đăng nhập đã hết hạn.', 401);
      const response = await apiRequest<RequestDetail>(`/asset-transfer-requests/${encodeURIComponent(id)}`, {
        token, params: { farmId: currentFarmId }, skipCache: true,
      });
      setRequest(response.data);
      setError(null);
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'Không thể tải yêu cầu chuyển tài sản.');
    } finally { setLoading(false); }
  }, [currentFarmId, getAccessToken, id]);

  useFocusEffect(useCallback(() => { void reload(); }, [reload]));

  return <AppShell active="scan">
    <PageHeader title="Yêu cầu chuyển tài sản" subtitle="Theo dõi kết quả xử lý" onBack={() => router.back()} action={<NotificationBell />} />
    {loading ? <Card><Text style={styles.muted}>Đang tải yêu cầu...</Text></Card> : error ? <Card><Text style={styles.error}>{error}</Text></Card> : request ? <>
      <Card style={styles.card}>
        <View style={styles.row}><Text style={styles.heading}>{request.itemName}</Text><Pill tone={request.status === 'CONFIRMED' ? 'success' : request.status === 'REJECTED' ? 'danger' : 'amber'}><Text style={styles.status}>{statusLabels[request.status] ?? request.status}</Text></Pill></View>
        <Text style={styles.value}>Mã tài sản: {request.assetCode}</Text>
        <Text style={styles.muted}>Mã yêu cầu: {request.id.slice(0, 8)}</Text>
      </Card>
      <Card style={styles.card}>
        <Text style={styles.heading}>Lộ trình chuyển</Text>
        <Info label="Vị trí nguồn" value={[request.fromLocationCode, request.fromLocationName].filter(Boolean).join(' · ')} />
        <Info label="Kho đích" value={[request.toWarehouseCode, request.toWarehouseName].filter(Boolean).join(' · ')} />
        <Info label="Vị trí đích" value={[request.toLocationCode, request.toLocationName].filter(Boolean).join(' · ')} />
        {request.note ? <Info label="Ghi chú" value={request.note} /> : null}
      </Card>
      <Card style={styles.card}>
        <Text style={styles.heading}>Kết quả xử lý</Text>
        <Info label="Thời gian gửi" value={formatApiDateTime(request.createdAt)} />
        <Info label="Người duyệt" value={request.reviewedByName?.trim() || request.reviewedByEmail || 'Đang chờ duyệt'} />
        <Info label="Thời gian xử lý" value={formatApiDateTime(request.reviewedAt)} />
        {request.rejectionReason ? <Text style={styles.error}>Lý do từ chối: {request.rejectionReason}</Text> : null}
        {request.status === 'PENDING_APPROVAL' ? <Text style={styles.muted}>Tài sản đang chờ chuyển; chỉ khi duyệt mới cập nhật vị trí và tồn kho.</Text> : null}
      </Card>
      <Pressable accessibilityRole="button" onPress={() => void reload()} style={styles.reload}><Icon name="sync" color={colors.primary} /><Text style={styles.reloadText}>Cập nhật trạng thái</Text></Pressable>
    </> : <Card><Text style={styles.muted}>Không tìm thấy yêu cầu trong trang trại này.</Text></Card>}
  </AppShell>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <View style={styles.info}><Text style={styles.label}>{label}</Text><Text style={styles.value}>{value || 'Chưa có dữ liệu'}</Text></View>;
}

const styles = StyleSheet.create({
  card: { gap: spacing.spaceSm, backgroundColor: colors.surfaceContainerLowest },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.spaceSm, justifyContent: 'space-between' },
  heading: { ...typography.headlineSm, color: colors.deepAmberStrong, flex: 1 },
  status: { ...typography.labelSm, color: colors.onSurfaceVariant },
  info: { gap: 2 },
  label: { ...typography.labelSm, color: colors.onSurfaceVariant },
  value: { ...typography.bodyMd, color: colors.onSurface },
  muted: { ...typography.bodySm, color: colors.onSurfaceVariant },
  error: { ...typography.bodyMd, color: colors.error },
  reload: { minHeight: 48, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spacing.spaceSm },
  reloadText: { ...typography.labelLg, color: colors.primary },
});

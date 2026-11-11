import { useFocusEffect, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { Animated, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useCallback, useRef, useState } from 'react';

import { colors, radius, spacing, typography } from '@/src/core/theme/tokens';
import { formatQuantity } from '@/src/shared/format-quantity';
import { formatApiDateTime } from '@/src/shared/format-date-time';
import { useAuthContext } from '@/src/features/auth/context/AuthContext';
import { documentCodeLabel, formatDate, statusLabel, type Paginated, type Warehouse } from '@/src/features/inventory/api';
import { navigateToReceiptList } from '@/src/features/inventory/receipt-list.logic';
import { apiRequest, clearApiCache, MobileApiError } from '@/src/shared/api/client';
import { OperationResultDialog } from '@/src/shared/ui/OperationResultDialog';
import { AppShell, Card, HoneycombDecor, Icon, PageHeader, Pill, PrimaryButton, SectionTitle } from '@/src/shared/ui/MobileShell';
import NotificationBell from './NotificationBell';

type TransferDetail = {
  transfer: {
    id: string; transferCode: string | null; status: string; fromWarehouseId: string; toWarehouseId: string;
    note?: string | null; rejectionReason?: string | null; createdAt?: string; transferDate?: string | null;
    confirmedAt?: string | null; dispatchedAt?: string | null; dispatchedByMemberId?: string | null; createdByMemberId: string;
  };
  items: {
    id: string; itemId: string; itemCode?: string | null; itemName?: string | null;
    quantity: string; receivedQuantity?: string | null; discrepancyReason?: string | null; unitSymbol?: string | null; unitName?: string | null;
    lotId?: string | null; lotCode?: string | null; lotSupplierLotNumber?: string | null; lotExpiryDate?: string | null; note?: string | null;
  }[];
};

function statusTone(status: string): 'success' | 'amber' | 'danger' | 'cream' {
  if (status === 'CONFIRMED') return 'success';
  if (status === 'REJECTED' || status === 'CANCELLED') return 'danger';
  if (status === 'PENDING_APPROVAL' || status === 'IN_TRANSIT') return 'amber';
  return 'cream';
}

export default function TransferNotificationDetailScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { data, currentFarmId, getAccessToken } = useAuthContext();
  const [detail, setDetail] = useState<TransferDetail | null>(null);
  const [warehouses, setWarehouses] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const syncRotation = useRef(new Animated.Value(0)).current;
  const submittingRef = useRef(false);

  const reload = useCallback(async () => {
    if (!currentFarmId || !id) { setError('Thiếu trang trại hoặc mã phiếu.'); setLoading(false); return; }
    setLoading(true);
    try {
      const token = await getAccessToken();
      if (!token) throw new MobileApiError('Phiên đăng nhập đã hết hạn.', 401);
      const [response, warehousePage] = await Promise.all([
        apiRequest<{ data: TransferDetail }>(`/stock-transfers/${encodeURIComponent(id)}`, { token, params: { farmId: currentFarmId }, skipCache: true }),
        apiRequest<Paginated<Warehouse>>('/warehouses', { token, params: { farmId: currentFarmId, destination: 'true', page: 1, pageSize: 100 } }),
      ]);
      setDetail(response.data);
      setWarehouses(new Map(warehousePage.data.filter((row) => row.farmId === currentFarmId).map((row) => [row.id, `${row.code} · ${row.name}`])));
      setError(null);
    } catch (cause: unknown) {
      setDetail(null);
      setError(cause instanceof Error ? cause.message : 'Không thể tải chi tiết phiếu điều chuyển.');
    } finally { setLoading(false); }
  }, [currentFarmId, getAccessToken, id]);

  useFocusEffect(useCallback(() => { void reload(); }, [reload]));

  function sync() {
    clearApiCache();
    syncRotation.setValue(0);
    Animated.timing(syncRotation, { toValue: 1, duration: 700, useNativeDriver: true }).start();
    void reload();
  }

  async function submit() {
    if (submittingRef.current || !currentFarmId || !id || !detail || detail.transfer.status !== 'DRAFT') return;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      const token = await getAccessToken();
      if (!token) throw new MobileApiError('Phiên đăng nhập đã hết hạn.', 401);
      await apiRequest(`/stock-transfers/${encodeURIComponent(id)}/submit`, { method: 'POST', token, params: { farmId: currentFarmId } });
      clearApiCache();
      await reload();
      setSubmitted(true);
    } catch (cause: unknown) {
      Alert.alert('Không thể gửi duyệt', cause instanceof Error ? cause.message : 'Vui lòng thử lại.');
      if (cause instanceof MobileApiError && cause.status === 409) void reload();
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  const transfer = detail?.transfer;
  const member = data?.memberships.find(({ farm }) => farm.id === currentFarmId);
  const canSubmit = Boolean(transfer && transfer.status === 'DRAFT' && transfer.createdByMemberId === member?.memberId && member.roles.includes('EMPLOYEE'));
  const source = transfer ? warehouses.get(transfer.fromWarehouseId) ?? transfer.fromWarehouseId : '';
  const destination = transfer ? warehouses.get(transfer.toWarehouseId) ?? transfer.toWarehouseId : '';
  const syncTransform = { transform: [{ rotate: syncRotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] };

  return <>
    <AppShell active="receipts">
      <PageHeader title="Phiếu điều chuyển" subtitle={member?.farm.name ?? 'Nhật ký kho vận'} onBack={() => router.back()} action={<View style={styles.headerActions}><NotificationBell /><Pressable accessibilityLabel="Làm mới phiếu" onPress={sync} style={styles.sync}><Animated.View style={syncTransform}><Icon name="sync" color={colors.primary} /></Animated.View></Pressable></View>} />
      {loading ? <Card><Text style={styles.message}>Đang tải phiếu điều chuyển...</Text></Card> : error ? <Card><Text style={styles.error}>{error}</Text></Card> : transfer ? <>
        <Card style={[styles.hero, transfer.status === 'DRAFT' && styles.draft]}>
          <HoneycombDecor tone={statusTone(transfer.status) === 'success' ? 'green' : 'amber'} />
          <View style={styles.heroContent}>
            <Text style={styles.eyebrow}>CHUYỂN VẬT TƯ GIỮA CÁC KHO</Text>
            <View style={styles.heroHead}><View style={styles.heroTitle}><Text style={styles.code}>{documentCodeLabel(transfer.transferCode, transfer.id, 'CK')}</Text><Text style={styles.muted}>Tạo lúc {formatApiDateTime(transfer.createdAt)}</Text></View><Pill tone={statusTone(transfer.status)}><Text style={styles.status}>{transfer.status === 'CONFIRMED' ? 'ĐÃ NHẬN' : statusLabel(transfer.status)}</Text></Pill></View>
            <View style={styles.route}><Icon name="warehouse" color={colors.primary} /><View style={styles.routeCopy}><Text style={styles.routeLabel}>Kho nguồn</Text><Text style={styles.routeName}>{source}</Text></View></View>
            <View style={styles.routeArrow}><Icon name="south" size={19} color={colors.secondary} /></View>
            <View style={styles.route}><Icon name="warehouse" color={colors.statusSuccessStrong} /><View style={styles.routeCopy}><Text style={styles.routeLabel}>Kho đích</Text><Text style={styles.routeName}>{destination}</Text></View></View>
          </View>
        </Card>
        <Card style={styles.card}>
          <SectionTitle title="Thông tin phiếu" />
          <Info label="Ngày điều chuyển" value={formatDate(transfer.transferDate)} />
          {transfer.dispatchedAt ? <Info label="Thời gian kho nguồn xuất" value={formatApiDateTime(transfer.dispatchedAt)} /> : null}
          {transfer.confirmedAt ? <Info label={transfer.dispatchedAt ? 'Thời gian kho đích nhận' : 'Thời gian xác nhận'} value={formatApiDateTime(transfer.confirmedAt)} /> : null}
          <Info label="Ghi chú" value={transfer.note || 'Không có ghi chú'} />
          {transfer.rejectionReason ? <Text style={styles.rejection}>Lý do từ chối: {transfer.rejectionReason}</Text> : null}
        </Card>
        <SectionTitle title="Vật tư điều chuyển" count={`${detail.items.length} mục`} />
        {detail.items.map((line) => <Card key={line.id} style={styles.lineCard}>
          <View style={styles.lineHead}><View style={styles.lineIcon}><Icon name="inventory-2" color={colors.primary} /></View><View style={styles.lineCopy}><Text style={styles.lineName}>{line.itemName || 'Vật tư'}</Text><Text style={styles.muted}>{line.itemCode || line.itemId}</Text></View><Pill tone="cream"><Text style={styles.quantity}>{formatQuantity(line.quantity)} {line.unitSymbol || line.unitName || ''}</Text></Pill></View>
          {line.receivedQuantity != null ? <Info label="Đã xuất / Thực nhận" value={`${formatQuantity(line.quantity)} / ${formatQuantity(line.receivedQuantity)} ${line.unitSymbol || line.unitName || ''}`.trim()} /> : null}
          {line.discrepancyReason ? <Info label="Lý do lệch" value={line.discrepancyReason} /> : null}
          {line.lotId ? <Info label="Mã lô nội bộ" value={line.lotCode || line.lotId} /> : null}
          {line.lotSupplierLotNumber ? <Info label="Số lô trên hàng" value={line.lotSupplierLotNumber} /> : null}
          {line.lotExpiryDate ? <Info label="Hạn sử dụng" value={formatDate(line.lotExpiryDate)} /> : null}
          {line.note ? <Info label="Ghi chú dòng hàng" value={line.note} /> : null}
        </Card>)}
        <Card style={styles.notice}><Icon name="info-outline" color={colors.primary} /><Text style={styles.noticeText}>{transfer.status === 'DRAFT' ? 'Phiếu nháp chưa được gửi duyệt. Tồn kho chưa thay đổi.' : transfer.status === 'PENDING_APPROVAL' ? 'Phiếu đang chờ quản lý kho nguồn xác nhận xuất. Tồn kho chưa thay đổi.' : transfer.status === 'IN_TRANSIT' ? 'Kho nguồn đã xuất hàng (đã trừ tồn kho nguồn). Đang chờ kho đích xác nhận nhận hàng.' : transfer.status === 'CONFIRMED' ? 'Kho đích đã nhận hàng và tồn kho đã được cập nhật.' : 'Phiếu đã kết thúc; tồn kho không thay đổi.'}</Text></Card>
        {canSubmit ? <PrimaryButton label={submitting ? 'Đang gửi...' : 'Gửi duyệt'} icon="send" loading={submitting} onPress={() => void submit()} /> : null}
      </> : <Card><Text style={styles.message}>Không tìm thấy phiếu điều chuyển trong trang trại này.</Text></Card>}
    </AppShell>
    <OperationResultDialog
      visible={submitted}
      title="Phiếu điều chuyển đã gửi duyệt"
      details={[
        { label: 'Mã phiếu', value: documentCodeLabel(transfer?.transferCode, transfer?.id ?? '', 'CK') },
        { label: 'Kho nguồn', value: source },
        { label: 'Kho đích', value: destination },
        { label: 'Ngày điều chuyển', value: transfer?.transferDate ? formatDate(transfer.transferDate) : '—' },
      ]}
      items={detail?.items.map((line) => ({
        name: line.itemName || 'Vật tư',
        quantity: `${formatQuantity(line.quantity)} ${line.unitSymbol || line.unitName || ''}`,
      }))}
      actionLabel="Về danh sách phiếu"
      onAction={() => {
        setSubmitted(false);
        navigateToReceiptList(router, navigation, 'TRANSFER');
      }}
    />
  </>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <View style={styles.info}><Text style={styles.label}>{label}</Text><Text style={styles.value}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  sync: { width: 36, height: 36, borderRadius: radius.full, backgroundColor: colors.parchment, borderWidth: 1, borderColor: colors.outlineVariant, alignItems: 'center', justifyContent: 'center' },
  hero: { position: 'relative', overflow: 'hidden', backgroundColor: colors.parchmentWarm },
  draft: { borderStyle: 'dashed' },
  heroContent: { position: 'relative', zIndex: 1, gap: spacing.spaceMd },
  eyebrow: { ...typography.labelSm, color: colors.secondary },
  heroHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.spaceSm, flexWrap: 'wrap' },
  heroTitle: { flex: 1, minWidth: 0 },
  code: { ...typography.headlineMd, color: colors.deepAmberStrong },
  status: { ...typography.labelSm, color: colors.onSurfaceVariant },
  muted: { ...typography.bodySm, color: colors.onSurfaceVariant },
  route: { flexDirection: 'row', alignItems: 'center', gap: spacing.spaceSm },
  routeCopy: { flex: 1, minWidth: 0 },
  routeLabel: { ...typography.labelSm, color: colors.onSurfaceVariant },
  routeName: { ...typography.labelLg, color: colors.onSurface, flexShrink: 1 },
  routeArrow: { paddingLeft: spacing.spaceXs },
  card: { gap: spacing.spaceSm, backgroundColor: colors.surfaceContainerLowest },
  info: { gap: 2 },
  label: { ...typography.labelSm, color: colors.onSurfaceVariant },
  value: { ...typography.bodyMd, color: colors.onSurface },
  rejection: { ...typography.bodySm, color: colors.error, backgroundColor: colors.errorContainer, borderRadius: radius.default, padding: spacing.spaceSm },
  lineCard: { gap: spacing.spaceSm, backgroundColor: colors.surfaceContainerLowest },
  lineHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.spaceSm, flexWrap: 'wrap' },
  lineIcon: { width: 38, height: 38, borderRadius: radius.default, backgroundColor: colors.honeyChip, alignItems: 'center', justifyContent: 'center' },
  lineCopy: { flex: 1, minWidth: 0 },
  lineName: { ...typography.labelLg, color: colors.deepAmberStrong },
  quantity: { ...typography.labelSm, color: colors.primary },
  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.spaceSm, backgroundColor: colors.parchmentWarm },
  noticeText: { ...typography.bodySm, color: colors.onSurfaceVariant, flex: 1 },
  message: { ...typography.bodyMd, color: colors.onSurfaceVariant },
  error: { ...typography.bodyMd, color: colors.error },
});

import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppShell, Card, Icon, PageHeader, Pill } from '@/src/shared/ui/MobileShell';
import { colors, radius, spacing, typography } from '@/src/core/theme/tokens';
import NotificationBell from '@/src/features/notifications/presentation/NotificationBell';
import { useAuthContext } from '@/src/features/auth/context/AuthContext';
import { apiRequest, MobileApiError } from '@/src/shared/api/client';

type MaintenanceRecord = {
  id: string;
  assetId: string;
  maintenanceType: string;
  scheduledAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  status: string;
  description: string | null;
  resultNote: string | null;
  performedByMemberId: string | null;
  supplierId: string | null;
  laborCost: string;
  materialCost: string;
  otherCost: string;
  totalCost?: string | null;
  createdAt: string;
};
type MaintenanceList = { data: MaintenanceRecord[]; page: { totalPages: number } };

export default function MaintenanceHistoryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ assetId?: string; assetCode?: string; itemName?: string }>();
  const { currentFarmId, getAccessToken } = useAuthContext();
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentFarmId || !params.assetId) {
      setRecords([]);
      setLoading(false);
      setError('Thiếu farm hoặc mã tài sản để tải lịch sử bảo dưỡng.');
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void getAccessToken().then(async (token) => {
      if (!token) throw new MobileApiError('Phiên đăng nhập đã hết hạn.', 401);
      const pageSize = 100;
      const first = await apiRequest<MaintenanceList>('/maintenance-records', {
        token,
        params: { farmId: currentFarmId, assetId: params.assetId, page: 1, pageSize },
        skipCache: true,
      });
      const allRecords = [...first.data];
      for (let page = 2; page <= first.page.totalPages; page += 1) {
        const next = await apiRequest<MaintenanceList>('/maintenance-records', {
          token,
          params: { farmId: currentFarmId, assetId: params.assetId, page, pageSize },
          skipCache: true,
        });
        allRecords.push(...next.data);
      }
      return allRecords;
    }).then((rows) => {
      if (!cancelled) setRecords(rows.filter((record) => record.assetId === params.assetId));
    }).catch((cause: unknown) => {
      if (!cancelled) setError(cause instanceof Error ? cause.message : 'Không thể tải lịch sử bảo dưỡng.');
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [currentFarmId, getAccessToken, params.assetId]);

  const counts = records.reduce<Record<string, number>>((all, record) => {
    all[record.status] = (all[record.status] ?? 0) + 1;
    return all;
  }, {});

  return <AppShell active="scan">
    <PageHeader title="Lịch sử bảo dưỡng" subtitle={`${params.assetCode ?? 'Tài sản'} • ${params.itemName ?? 'Theo dõi từ API'}`} onBack={() => router.back()} action={<NotificationBell />} />
    <Card style={styles.assetCard}>
      <View style={styles.assetIcon}><Icon name="build" color={colors.primary} /></View>
      <View style={styles.assetCopy}>
        <Text style={styles.eyebrow}>TÀI SẢN ĐỊNH DANH</Text>
        <Text style={styles.assetName}>{params.itemName ?? 'Chi tiết tài sản'}</Text>
        <Text style={styles.assetCode}>{params.assetCode ?? params.assetId ?? 'Chưa có mã tài sản'}</Text>
      </View>
    </Card>
    <View style={styles.heading}><View style={styles.headingCopy}><Text style={styles.title}>Toàn bộ hồ sơ</Text><Text style={styles.subtitle}>{loading ? 'Đang tải từ cơ sở dữ liệu…' : `${records.length} hồ sơ bảo dưỡng`}</Text></View><Pill tone="amber"><Text style={styles.countText}>{records.length}</Text></Pill></View>
    {!loading && !error && records.length > 0 ? <View style={styles.summaryRow}>
      <Summary label="Đã lên lịch" value={counts.SCHEDULED ?? 0} tone="amber" />
      <Summary label="Đang làm" value={counts.IN_PROGRESS ?? 0} tone="success" />
      <Summary label="Hoàn tất" value={counts.COMPLETED ?? 0} tone="neutral" />
    </View> : null}
    {loading ? <Card style={styles.stateCard}><Icon name="sync" color={colors.primary} /><Text style={styles.stateText}>Đang tải tất cả hồ sơ bảo dưỡng của tài sản…</Text></Card> : null}
    {error ? <Card style={styles.errorCard}><Icon name="error-outline" color={colors.error} /><Text style={styles.errorText}>{error}</Text><Pressable onPress={() => router.back()}><Text style={styles.backText}>Quay lại tài sản</Text></Pressable></Card> : null}
    {!loading && !error && records.length === 0 ? <Card style={styles.stateCard}><Icon name="event-note" color={colors.outline} /><Text style={styles.stateText}>Tài sản này chưa có hồ sơ bảo dưỡng trong DB.</Text></Card> : null}
    {records.map((record, index) => <Card key={record.id} style={styles.recordCard}>
      <View style={styles.recordTop}>
        <View style={styles.recordIcon}><Icon name={record.status === 'COMPLETED' ? 'check-circle' : record.status === 'CANCELLED' ? 'cancel' : 'build'} color={record.status === 'COMPLETED' ? colors.statusSuccessStrong : colors.primary} /></View>
        <View style={styles.recordCopy}><Text style={styles.recordTitle}>{maintenanceTypeLabel(record.maintenanceType)}</Text><Text style={styles.recordNumber}>Lần {records.length - index} • Tạo {formatDate(record.createdAt)}</Text></View>
        <Pill tone={statusTone(record.status)}><Text style={styles.statusText}>{statusLabel(record.status)}</Text></Pill>
      </View>
      {record.description ? <Detail label="Nội dung" value={record.description} /> : null}
      <View style={styles.dateGrid}>
        <DateCell label="Dự kiến" value={record.scheduledAt} />
        <DateCell label="Bắt đầu" value={record.startedAt} />
        <DateCell label="Hoàn tất" value={record.completedAt} />
      </View>
      {record.resultNote ? <Detail label="Kết quả / ghi chú" value={record.resultNote} /> : null}
      <View style={styles.costRow}>
        <Text style={styles.costLabel}>Chi phí</Text>
        <Text style={styles.costValue}>{formatMoney(record.totalCost ?? sumCosts(record))} ₫</Text>
      </View>
      {record.performedByMemberId ? <Detail label="Người thực hiện (member)" value={record.performedByMemberId} /> : null}
      {record.supplierId ? <Detail label="Nhà cung cấp" value={record.supplierId} /> : null}
    </Card>)}
    <Pressable onPress={() => router.replace('/scan' as never)} style={({ pressed }) => [styles.rescan, pressed && styles.pressed]}>
      <Icon name="qr-code-scanner" color={colors.statusSuccessStrong} /><Text style={styles.rescanText}>Quét QR tiếp theo</Text>
    </Pressable>
  </AppShell>;
}

function Summary({ label, value, tone }: { label: string; value: number; tone: 'amber' | 'success' | 'neutral' }) {
  return <Card style={styles.summaryCard}><Text style={styles.summaryValue}>{value}</Text><Text style={[styles.summaryLabel, tone === 'success' && styles.summarySuccess, tone === 'amber' && styles.summaryAmber]}>{label}</Text></Card>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return <View style={styles.detail}><Text style={styles.detailLabel}>{label}</Text><Text style={styles.detailValue}>{value}</Text></View>;
}

function DateCell({ label, value }: { label: string; value: string | null }) {
  return <View style={styles.dateCell}><Text style={styles.detailLabel}>{label}</Text><Text style={styles.dateValue}>{value ? formatDate(value) : '—'}</Text></View>;
}

function maintenanceTypeLabel(value: string) {
  return value === 'PREVENTIVE' ? 'Bảo dưỡng định kỳ' : value === 'CORRECTIVE' ? 'Sửa chữa' : value === 'INSPECTION' ? 'Kiểm tra / vệ sinh' : value;
}

function statusLabel(value: string) {
  return value === 'SCHEDULED' ? 'Đã lên lịch' : value === 'IN_PROGRESS' ? 'Đang thực hiện' : value === 'COMPLETED' ? 'Hoàn tất' : value === 'CANCELLED' ? 'Đã hủy' : value;
}

function statusTone(value: string): 'amber' | 'success' | 'neutral' | 'danger' {
  return value === 'SCHEDULED' ? 'amber' : value === 'IN_PROGRESS' ? 'success' : value === 'CANCELLED' ? 'danger' : 'neutral';
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('vi-VN', { dateStyle: 'medium', timeStyle: 'short' });
}

function sumCosts(record: MaintenanceRecord) {
  return [record.laborCost, record.materialCost, record.otherCost].reduce((total, value) => total + (Number(value) || 0), 0).toFixed(2);
}

function formatMoney(value: string) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount.toLocaleString('vi-VN', { maximumFractionDigits: 0 }) : value;
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.82, transform: [{ scale: 0.98 }] },
  assetCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.spaceMd },
  assetIcon: { width: 48, height: 48, borderRadius: radius.default, backgroundColor: colors.honeyChip, alignItems: 'center', justifyContent: 'center' },
  assetCopy: { flex: 1, minWidth: 0, gap: 2 },
  eyebrow: { ...typography.labelSm, color: colors.secondary },
  assetName: { ...typography.headlineSm, color: colors.deepAmber },
  assetCode: { ...typography.bodySm, color: colors.onSurfaceVariant },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.spaceSm },
  headingCopy: { flex: 1, minWidth: 0 },
  title: { ...typography.headlineMd, color: colors.deepAmber },
  subtitle: { ...typography.bodySm, color: colors.onSurfaceVariant },
  countText: { ...typography.labelMd, color: colors.deepAmber },
  summaryRow: { flexDirection: 'row', gap: spacing.spaceSm },
  summaryCard: { flex: 1, minWidth: 0, alignItems: 'center', gap: 2, paddingVertical: spacing.spaceSm },
  summaryValue: { ...typography.headlineSm, color: colors.deepAmber },
  summaryLabel: { ...typography.labelSm, color: colors.onSurfaceVariant, textAlign: 'center' },
  summarySuccess: { color: colors.statusSuccessStrong },
  summaryAmber: { color: colors.secondary },
  stateCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.spaceSm },
  stateText: { ...typography.bodyMd, color: colors.onSurfaceVariant, flex: 1 },
  errorCard: { gap: spacing.spaceSm, backgroundColor: colors.errorContainer, borderColor: colors.error },
  errorText: { ...typography.bodyMd, color: colors.error },
  backText: { ...typography.labelLg, color: colors.primary },
  recordCard: { gap: spacing.spaceSm },
  recordTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.spaceSm },
  recordIcon: { width: 38, height: 38, borderRadius: radius.full, backgroundColor: colors.surfaceContainer, alignItems: 'center', justifyContent: 'center' },
  recordCopy: { flex: 1, minWidth: 0, gap: 2 },
  recordTitle: { ...typography.labelLg, color: colors.deepAmber },
  recordNumber: { ...typography.bodySm, color: colors.onSurfaceVariant },
  statusText: { ...typography.labelSm, color: colors.deepAmber },
  detail: { gap: 2, paddingTop: spacing.spaceXs },
  detailLabel: { ...typography.labelSm, color: colors.onSurfaceVariant },
  detailValue: { ...typography.bodyMd, color: colors.onSurface },
  dateGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.spaceSm, padding: spacing.spaceSm, borderRadius: radius.default, backgroundColor: colors.surfaceContainerLow },
  dateCell: { flex: 1, minWidth: 90, gap: 2 },
  dateValue: { ...typography.bodySm, color: colors.onSurface },
  costRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.spaceSm, paddingTop: spacing.spaceSm, borderTopWidth: 1, borderTopColor: colors.outlineVariant },
  costLabel: { ...typography.labelSm, color: colors.onSurfaceVariant },
  costValue: { ...typography.labelMd, color: colors.deepAmber },
  rescan: { minHeight: 48, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.statusSuccessBorder, backgroundColor: colors.statusSuccessSurface, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.spaceSm },
  rescanText: { ...typography.labelLg, color: colors.statusSuccessStrong },
});

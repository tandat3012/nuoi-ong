import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '@/src/core/theme/tokens';
import { useAuthContext } from '@/src/features/auth/context/AuthContext';
import { clearApiCache, MobileApiError } from '@/src/shared/api/client';
import { AppShell, Card, HoneycombDecor, Icon, PageHeader, Pill, PrimaryButton, SectionTitle } from '@/src/shared/ui/MobileShell';
import { getAuditLog, type AuditLog } from '../api';
import NotificationBell from '@/src/features/notifications/presentation/NotificationBell';
import { actionLabel, entityLabel, formatDateTime, formatIdentifier, formatValue, getStatus, recordLabel, relatedRecordRoute, snapshotChanges, snapshotEntries, snapshotField, statusLabel, statusTone } from '../model';

export default function ActivityDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data, currentFarmId, getAccessToken } = useAuthContext();
  const farm = data?.memberships.find((membership) => membership.farm.id === currentFarmId)?.farm;
  const [result, setResult] = useState<{ farmId: string; log: AuditLog } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadNonce, setReloadNonce] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setResult(null);
    setError(null);
    setLoading(true);
    void (async () => {
      if (!currentFarmId) throw new Error('Chọn trang trại để xem chi tiết lịch sử.');
      if (!id) throw new Error('Thiếu mã lịch sử.');
      const token = await getAccessToken();
      if (!token) throw new Error('Phiên đăng nhập đã hết hạn.');
      const log = await getAuditLog(token, currentFarmId, id);
      if (!cancelled) setResult({ farmId: currentFarmId, log });
    })().catch((cause: unknown) => {
      if (!cancelled) setError(cause instanceof MobileApiError && cause.status === 404
        ? 'Bản ghi lịch sử không tồn tại trong trang trại hiện tại.'
        : cause instanceof Error ? cause.message : 'Không thể tải chi tiết lịch sử.');
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [currentFarmId, getAccessToken, id, reloadNonce]);
  const log = result?.farmId === currentFarmId && result?.log.id === id ? result?.log : null;
  const status = log ? getStatus(log.newData) ?? getStatus(log.oldData) : null;
  const changes = log ? snapshotChanges(log.oldData, log.newData) : null;
  const rejectionReason = log ? snapshotField(log.newData, 'rejectionReason') ?? snapshotField(log.oldData, 'rejectionReason') : null;
  const relatedRoute = log ? relatedRecordRoute(log) : null;
  function reload() {
    clearApiCache();
    setReloadNonce((value) => value + 1);
  }

  return <AppShell active="dashboard">
    <PageHeader title={farm?.name ?? 'Chưa chọn trang trại'} subtitle="Chi tiết lịch sử thao tác" onBack={() => router.back()} action={<View style={{ flexDirection: 'row', alignItems: 'center' }}><NotificationBell /><Pressable accessibilityRole="button" accessibilityLabel="Làm mới chi tiết lịch sử" onPress={reload} style={styles.retry}><Icon name="sync" color={colors.primary} /></Pressable></View>} />
    {loading ? <Card><Text style={styles.body}>Đang tải chi tiết thao tác...</Text></Card> : error ? <Card><Text style={styles.error}>{error}</Text><Pressable accessibilityRole="button" onPress={reload} style={styles.retry}><Text style={styles.link}>Thử lại</Text></Pressable></Card> : log ? <>
      <Card style={styles.summary}>
        <HoneycombDecor muted size={38} />
        <View style={styles.heading}><Icon name="history" color={colors.primary} /><Text style={styles.title}>{actionLabel(log.action)}</Text><Pill tone={statusTone(status)}><Text style={styles.status}>{statusLabel(status)}</Text></Pill></View>
        <Text selectable style={styles.record}>{entityLabel(log.entityType)} • {recordLabel(log)}</Text>
        <Info label="Trang trại" value={farm?.name ?? 'Chưa chọn trang trại'} />
        <Info label="Người thực hiện" value={log.actor?.name ?? log.actor?.email ?? 'Không có thông tin người thực hiện'} />
        {log.actor?.email && log.actor.name ? <Info label="Email" value={log.actor.email} /> : null}
        <Info label="Thời gian" value={formatDateTime(log.createdAt)} />
        <Info label="Mã lịch sử" value={formatIdentifier(log.id)} />
        {log.entityId ? <Info label="ID phiếu / đối tượng" value={formatIdentifier(log.entityId)} /> : null}
      </Card>
      {typeof rejectionReason === 'string' && rejectionReason.trim() ? <Card style={styles.rejection}><Text style={styles.errorTitle}>Lý do từ chối</Text><Text selectable style={styles.error}>{rejectionReason}</Text></Card> : null}
      <SectionTitle title="Nội dung thay đổi" />
      <Card style={styles.block}>{changes === null ? <Text style={styles.body}>{['CREATE', 'INSERT'].includes(log.action.toUpperCase()) && log.oldData == null ? 'Đối tượng được tạo mới nên chưa có dữ liệu trước thao tác. Nội dung đã tạo được hiển thị bên dưới.' : 'Bản ghi không lưu đủ dữ liệu trước và sau để đối chiếu. Các dữ liệu đã lưu được hiển thị bên dưới.'}</Text> : changes.length === 0 ? <Text style={styles.body}>Không có khác biệt giữa dữ liệu trước và sau đã lưu.</Text> : changes.map((change) => <View key={change.path} style={styles.change}><Text style={styles.label}>{change.label}</Text><View style={styles.values}><View style={styles.valueColumn}><Text style={styles.caption}>TRƯỚC</Text><Text selectable style={styles.body}>{formatValue(change.before, change.path, farm)}</Text></View><View style={[styles.valueColumn, styles.after]}><Text style={styles.caption}>SAU</Text><Text selectable style={styles.body}>{formatValue(change.after, change.path, farm)}</Text></View></View></View>)}</Card>
      <Snapshot title="Dữ liệu trước thao tác" value={log.oldData} farm={farm} />
      <Snapshot title="Dữ liệu sau thao tác" value={log.newData} farm={farm} />
      {relatedRoute ? <><Text style={styles.body}>Mở đối tượng để xem dữ liệu hiện tại. Dữ liệu này có thể khác thời điểm ghi lịch sử.</Text><PrimaryButton label={`Mở ${entityLabel(log.entityType).toLowerCase()}`} icon="open-in-new" onPress={() => router.push(relatedRoute as never)} /></> : <Card><Text style={styles.body}>{log.action.toUpperCase() === 'DELETE' ? 'Đối tượng đã được ghi nhận là bị xóa. Bạn vẫn có thể xem dữ liệu đã lưu trong lịch sử.' : 'Đối tượng này chưa có màn hình chi tiết tương ứng hoặc bản ghi chưa lưu mã đối tượng.'}</Text></Card>}
    </> : null}
  </AppShell>;
}

export function Snapshot({ title, value, farm }: { title: string; value: unknown; farm?: { id: string; name: string } }) {
  const entries = snapshotEntries(value);
  return <><SectionTitle title={title} /><Card style={styles.block}>{entries.length === 0 ? <Text style={styles.body}>Không có dữ liệu được lưu.</Text> : entries.map((entry) => <Info key={entry.path} label={entry.label} value={formatValue(entry.value, entry.path, farm)} />)}</Card></>;
}
function Info({ label, value }: { label: string; value: string }) {
  return <View style={styles.info}><Text style={styles.label}>{label}</Text><Text selectable style={styles.body}>{value}</Text></View>;
}
const styles = StyleSheet.create({
  summary: { backgroundColor: colors.parchmentWarm, gap: spacing.spaceSm, overflow: 'hidden' },
  heading: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.spaceSm },
  title: { ...typography.headlineMd, color: colors.deepAmber, flexShrink: 1 },
  record: { ...typography.labelLg, color: colors.deepAmber, flexShrink: 1 },
  status: { ...typography.labelSm, color: colors.deepAmber },
  block: { gap: spacing.spaceMd },
  info: { gap: spacing.spaceXs },
  label: { ...typography.labelLg, color: colors.onSurfaceVariant },
  body: { ...typography.bodySm, color: colors.onSurface, flexShrink: 1 },
  change: { gap: spacing.spaceSm },
  values: { flexDirection: 'row', gap: spacing.spaceSm, flexWrap: 'wrap' },
  valueColumn: { flex: 1, flexBasis: 120, minWidth: 0, padding: spacing.spaceSm, borderRadius: radius.sm, backgroundColor: colors.surfaceContainerLow, gap: spacing.spaceXs },
  after: { backgroundColor: colors.statusSuccessSurface },
  caption: { ...typography.labelSm, color: colors.primary },
  rejection: { backgroundColor: colors.errorContainer, gap: spacing.spaceSm },
  errorTitle: { ...typography.labelLg, color: colors.error },
  error: { ...typography.bodyMd, color: colors.error },
  retry: { paddingVertical: spacing.spaceSm },
  link: { ...typography.labelLg, color: colors.primary },
});

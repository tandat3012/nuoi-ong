import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, dimensions, radius, spacing, typography } from '@/src/core/theme/tokens';
import { useAuthContext } from '@/src/features/auth/context/AuthContext';
import { clearApiCache } from '@/src/shared/api/client';
import { listAuditLogs, type AuditLog, type AuditLogPage } from '@/src/features/activity/api';
import NotificationBell from '@/src/features/notifications/presentation/NotificationBell';
import { actionLabel, actionLabels, entityLabel, entityLabels, formatDateTime, getStatus, recordLabel, statusLabel, statusTone } from '../model';
import { AppShell, Card, Icon, PageHeader, Pill } from '@/src/shared/ui/MobileShell';

export default function ActivityScreen() {
  const router = useRouter();
  const { data, currentFarmId, selectFarm, getAccessToken } = useAuthContext();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [pagination, setPagination] = useState<AuditLogPage['page'] | null>(null);
  const [action, setAction] = useState('');
  const [entityType, setEntityType] = useState('');
  const [loadedKey, setLoadedKey] = useState('');
  const [scope, setScope] = useState<AuditLogPage['scope'] | null>(null);
  const [farmPickerOpen, setFarmPickerOpen] = useState(false);
  const [pendingFarmId, setPendingFarmId] = useState<string | null>(currentFarmId);
  const requestKey = `${currentFarmId}:${pageNumber}:${action}:${entityType}:${reloadNonce}`;
  const farmName = data?.memberships.find(({ farm }) => farm.id === currentFarmId)?.farm.name
    ?? (data?.memberships.length === 1 ? data.memberships[0]?.farm.name : undefined)
    ?? 'Chưa chọn trang trại';

  useEffect(() => {
    if (!currentFarmId) {
      setLogs([]);
      setPagination(null);
      setLoading(false);
      setError('Chưa chọn trang trại để xem lịch sử.');
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setScope(null);
    void getAccessToken()
      .then((token) => {
        if (!token) throw new Error('Phiên đăng nhập đã hết hạn.');
        return listAuditLogs(token, currentFarmId, 20, { page: pageNumber, action, entityType });
      })
      .then((response) => {
        if (cancelled) return;
        setLogs(response.data);
        setPagination(response.page);
        setScope(response.scope);
        setError(null);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Không thể tải lịch sử thao tác.');
      })
      .finally(() => {
        if (!cancelled) { setLoadedKey(requestKey); setLoading(false); }
      });
    return () => {
      cancelled = true;
    };
  }, [currentFarmId, getAccessToken, requestKey, pageNumber, action, entityType]);

  useEffect(() => { setPageNumber(1); }, [currentFarmId]);

  function reload() {
    clearApiCache();
    setPageNumber(1);
    setReloadNonce((value) => value + 1);
  }

  function openFarmPicker() {
    setPendingFarmId(currentFarmId);
    setFarmPickerOpen(true);
  }

  async function confirmFarmSelection() {
    if (!pendingFarmId) return;
    try {
      await selectFarm(pendingFarmId);
      setFarmPickerOpen(false);
    } catch (cause) {
      Alert.alert('Không thể chuyển farm', cause instanceof Error ? cause.message : 'Vui lòng thử lại.');
    }
  }

  return <AppShell active="dashboard">
    <PageHeader
      title={farmName}
      subtitle="● Lịch sử thao tác"
      onBack={() => router.back()}
      action={<View style={{ flexDirection: 'row', alignItems: 'center' }}><NotificationBell /><Pressable onPress={reload} style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]} accessibilityLabel="Làm mới lịch sử"><Icon name="sync" color={colors.primary} /></Pressable></View>}
    />
    <View style={styles.heading}><View style={styles.headingCopy}><Text style={styles.eyebrow}>LỊCH SỬ</Text><Text style={styles.title}>Hoạt động gần đây</Text><Text style={styles.subtitle}>Chạm vào thao tác để xem nội dung thay đổi.</Text></View>{(data?.memberships.length ?? 0) > 1 ? <Pressable accessibilityRole="button" onPress={openFarmPicker} style={({ pressed }) => [styles.farmButton, pressed && styles.pressed]}><Icon name="hive" color={colors.primary} size={16} /><Text style={styles.farmButtonText}>Đổi trại</Text></Pressable> : null}</View>
    {scope ? <Card style={styles.scopeCard}><Icon name={scope === 'FARM' ? 'groups' : 'person'} size={17} color={colors.primary} /><Text style={styles.scopeText}>{scope === 'FARM' ? `Toàn bộ lịch sử của ${farmName}` : 'Phiếu do bạn tạo và các lần xử lý liên quan'}</Text></Card> : null}
    <Filter label="Thao tác" value={action} options={actionLabels} onChange={(value) => { setAction(value); setPageNumber(1); }} />
    <Filter label="Đối tượng" value={entityType} options={entityLabels} onChange={(value) => { setEntityType(value); setPageNumber(1); }} />
    {!currentFarmId ? <Card><Text style={styles.message}>Chọn trang trại để xem lịch sử.</Text></Card> : loading || loadedKey !== requestKey ? <Card style={styles.messageCard}><Icon name="sync" color={colors.primary} /><Text style={styles.message}>Đang tải lịch sử thao tác...</Text></Card> : error ? <Card style={styles.errorCard}><Icon name="error-outline" color={colors.error} /><View style={styles.copy}><Text style={styles.errorTitle}>Không tải được lịch sử</Text><Text style={styles.errorText}>{error}</Text></View><Pressable onPress={reload} style={({ pressed }) => [styles.retry, pressed && styles.pressed]}><Text style={styles.retryText}>Thử lại</Text></Pressable></Card> : <>
      {logs.length === 0 ? <Card style={styles.emptyCard}><Icon name="history" color={colors.primary} /><View style={styles.copy}><Text style={styles.emptyTitle}>Chưa có lịch sử phù hợp</Text><Text style={styles.emptyText}>{scope === 'FARM' ? 'Thử đổi bộ lọc hoặc làm mới lịch sử của farm.' : 'Farm này chưa có phiếu do bạn tạo. Thử đổi farm hoặc làm mới.'}</Text></View></Card> : <View style={styles.list}>{logs.map((log) => <AuditCard key={log.id} log={log} onPress={() => router.push(`/activity/${encodeURIComponent(log.id)}` as never)} />)}</View>}
      {pagination ? <View style={styles.pagination}><Text style={styles.meta}>{pagination.totalItems} thao tác • Trang {pagination.number}/{Math.max(pagination.totalPages, 1)}</Text><View style={styles.pageActions}><Pressable accessibilityRole="button" disabled={pageNumber <= 1} onPress={() => setPageNumber((page) => page - 1)} style={[styles.pageButton, pageNumber <= 1 && styles.disabled]}><Text style={styles.link}>Trang trước</Text></Pressable><Pressable accessibilityRole="button" disabled={pageNumber >= pagination.totalPages} onPress={() => setPageNumber((page) => page + 1)} style={[styles.pageButton, pageNumber >= pagination.totalPages && styles.disabled]}><Text style={styles.link}>Trang tiếp</Text></Pressable></View></View> : null}
    </>}
    <Modal visible={farmPickerOpen} transparent animationType="slide" onRequestClose={() => setFarmPickerOpen(false)}><View style={styles.modalBackdrop}><View style={styles.modalSheet}><View style={styles.modalHead}><Text style={styles.modalTitle}>Chọn farm cần xem</Text><Pressable accessibilityRole="button" accessibilityLabel="Đóng" onPress={() => setFarmPickerOpen(false)} style={styles.modalClose}><Icon name="close" color={colors.onSurfaceVariant} /></Pressable></View><ScrollView>{(data?.memberships ?? []).map(({ farm }) => <Pressable key={farm.id} accessibilityRole="radio" accessibilityState={{ checked: pendingFarmId === farm.id }} onPress={() => setPendingFarmId(farm.id)} style={[styles.farmOption, pendingFarmId === farm.id && styles.farmOptionActive]}><Icon name={pendingFarmId === farm.id ? 'radio-button-checked' : 'radio-button-unchecked'} color={pendingFarmId === farm.id ? colors.primary : colors.outline} /><View style={styles.copy}><Text style={styles.farmName}>{farm.name}</Text><Text style={styles.meta}>{farm.code}</Text></View></Pressable>)}</ScrollView><Pressable accessibilityRole="button" disabled={!pendingFarmId} onPress={() => void confirmFarmSelection()} style={({ pressed }) => [styles.confirmFarm, !pendingFarmId && styles.disabled, pressed && styles.pressed]}><Text style={styles.confirmFarmText}>Xác nhận farm</Text></Pressable></View></View></Modal>
  </AppShell>;
}

function AuditCard({ log, onPress }: { log: AuditLog; onPress: () => void }) {
  const status = getStatus(log.newData) ?? getStatus(log.oldData);
  return <Pressable accessibilityRole="button" accessibilityLabel={`Xem chi tiết ${actionLabel(log.action)} ${entityLabel(log.entityType)}`} onPress={onPress} style={({ pressed }) => pressed && styles.pressed}><Card style={styles.auditCard}>
    <View style={styles.auditHead}><View style={styles.iconBox}><Icon name={iconForEntity(log.entityType.toUpperCase())} color={colors.primary} /></View><View style={styles.copy}><Text style={styles.action}>{actionLabel(log.action)}</Text><Text style={styles.target}>{entityLabel(log.entityType)}</Text></View><Pill tone={statusTone(status)}><Text style={styles.status}>{statusLabel(status)}</Text></Pill></View>
    <Text selectable style={styles.target}>{recordLabel(log)}</Text>
    <View style={styles.auditMeta}><Text style={styles.meta}>{log.actor?.name ?? log.actor?.email ?? 'Chưa có thông tin người thực hiện'}</Text><Text style={styles.meta}>{formatDateTime(log.createdAt)}</Text></View>
    <View style={styles.detailAction}><Text style={styles.link}>Xem chi tiết</Text><Icon name="chevron-right" color={colors.primary} size={18} /></View>
  </Card></Pressable>;
}

function Filter({ label, value, options, onChange }: { label: string; value: string; options: Record<string, string>; onChange: (value: string) => void }) {
  return <View style={styles.filter}><Text style={styles.meta}>{label}</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterOptions}>{[['', 'Tất cả'], ...Object.entries(options)].map(([key, title]) => <Pressable key={key} accessibilityRole="button" accessibilityState={{ selected: value === key }} onPress={() => onChange(key)} style={[styles.filterButton, value === key && styles.selectedFilter]}><Text style={styles.link}>{title}</Text></Pressable>)}</ScrollView></View>;
}

function iconForEntity(entityType: string): Parameters<typeof Icon>[0]['name'] {
  if (entityType.includes('STOCK') || entityType === 'INVENTORY') return 'inventory-2';
  if (entityType === 'ASSET') return 'build';
  if (entityType === 'MAINTENANCE') return 'build';
  return 'history';
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.82, transform: [{ scale: 0.98 }] },
  headerButton: { width: dimensions.iconButton, height: dimensions.iconButton, borderRadius: radius.full, backgroundColor: colors.parchment, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.outlineVariant },
  heading: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.spaceSm },
  headingCopy: { flex: 1, minWidth: 0, gap: 3 },
  farmButton: { minHeight: 40, paddingHorizontal: spacing.spaceSm, borderRadius: radius.full, borderWidth: 1, borderColor: colors.outlineVariant, backgroundColor: colors.parchment, flexDirection: 'row', alignItems: 'center', gap: spacing.spaceXs },
  farmButtonText: { ...typography.labelSm, color: colors.primary },
  scopeCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.spaceSm, backgroundColor: colors.parchmentWarm },
  scopeText: { ...typography.bodySm, color: colors.onSurfaceVariant, flex: 1 },
  eyebrow: { ...typography.labelSm, color: colors.primary, letterSpacing: 1.5 },
  title: { ...typography.headlineMd, color: colors.deepAmber },
  subtitle: { ...typography.bodySm, color: colors.onSurfaceVariant },
  messageCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.spaceSm },
  message: { ...typography.bodyMd, color: colors.onSurfaceVariant, flex: 1 },
  errorCard: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.spaceSm, backgroundColor: colors.errorContainer, borderColor: colors.error },
  copy: { flex: 1, minWidth: 0, gap: 3 },
  errorTitle: { ...typography.labelLg, color: colors.error },
  errorText: { ...typography.bodySm, color: colors.error },
  retry: { minHeight: 36, paddingHorizontal: spacing.spaceSm, borderRadius: radius.full, borderWidth: 1, borderColor: colors.error, justifyContent: 'center' },
  retryText: { ...typography.labelSm, color: colors.error },
  emptyCard: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.spaceSm, backgroundColor: colors.parchment },
  emptyTitle: { ...typography.labelLg, color: colors.deepAmber },
  emptyText: { ...typography.bodySm, color: colors.onSurfaceVariant },
  list: { gap: spacing.spaceSm },
  auditCard: { gap: spacing.spaceSm, backgroundColor: colors.surfaceContainerLowest },
  auditHead: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.spaceSm },
  iconBox: { width: 40, height: 40, borderRadius: radius.default, backgroundColor: colors.honeyChip, alignItems: 'center', justifyContent: 'center' },
  action: { ...typography.labelLg, color: colors.deepAmber },
  target: { ...typography.bodySm, color: colors.onSurfaceVariant },
  status: { ...typography.labelSm, color: colors.deepAmber },
  auditMeta: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.spaceSm, paddingTop: spacing.spaceSm, borderTopWidth: 1, borderTopColor: colors.outlineVariant },
  meta: { ...typography.bodySm, color: colors.onSurfaceVariant, flexShrink: 1 },
  detailAction: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: spacing.spaceXs },
  link: { ...typography.labelMd, color: colors.primary },
  filter: { gap: spacing.spaceXs },
  filterOptions: { gap: spacing.spaceSm },
  filterButton: { minHeight: 40, paddingHorizontal: spacing.spaceSm, justifyContent: 'center', borderRadius: radius.full, backgroundColor: colors.parchment, borderWidth: 1, borderColor: colors.outlineVariant },
  selectedFilter: { backgroundColor: colors.honeyChip, borderColor: colors.primary },
  pagination: { gap: spacing.spaceSm },
  pageActions: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.spaceSm },
  pageButton: { minHeight: 44, padding: spacing.spaceSm, justifyContent: 'center', borderWidth: 1, borderColor: colors.outlineVariant, borderRadius: radius.default },
  disabled: { opacity: 0.4 },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.modalOverlay },
  modalSheet: { maxHeight: '75%', padding: spacing.spaceMd, gap: spacing.spaceSm, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, backgroundColor: colors.surface },
  modalHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.spaceSm },
  modalTitle: { ...typography.headlineSm, color: colors.deepAmber, flex: 1 },
  modalClose: { width: 40, height: 40, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceContainer },
  farmOption: { minHeight: 56, paddingHorizontal: spacing.spaceSm, borderRadius: radius.default, borderWidth: 1, borderColor: colors.outlineVariant, flexDirection: 'row', alignItems: 'center', gap: spacing.spaceSm },
  farmOptionActive: { borderColor: colors.primary, backgroundColor: colors.honeyChip },
  farmName: { ...typography.labelLg, color: colors.onSurface },
  confirmFarm: { minHeight: 48, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primaryContainer },
  confirmFarmText: { ...typography.labelLg, color: colors.onPrimary },
});

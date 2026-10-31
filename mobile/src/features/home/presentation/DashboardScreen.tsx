import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Alert, Animated, Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useEffect, useRef, useState } from 'react';

import { AppShell, Card, Icon, PageHeader, Pill, SectionTitle } from '@/src/shared/ui/MobileShell';
import { colors, dimensions, radius, spacing, typography } from '@/src/core/theme/tokens';
import NotificationBell from '@/src/features/notifications/presentation/NotificationBell';
import { formatQuantity } from '@/src/shared/format-quantity';
import { formatApiDateTime as formatDateTime } from '@/src/shared/format-date-time';
import { useAuthContext } from '@/src/features/auth/context/AuthContext';
import { apiRequest, clearApiCache, MobileApiError } from '@/src/shared/api/client';
import { listBalances, listWarehouses, type Paginated, type StockIssue, type StockReceipt } from '@/src/features/inventory/api';
import { listAuditLogs, type AuditLog } from '@/src/features/activity/api';

const honeyImage = 'https://lh3.googleusercontent.com/aida-public/AB6AXuBcFTg3NHhZT19Pgto7IjhPfrsqK7lAsHctJe-0YtEaBDDigmmrx8Lxtt17FslOR8ksf7XQCeEjtqMzDJoaWsi1jZ43c6SBfYE10cgNAYRixQzSa0Jh3i9t1N4hQWj6ZA1N0XvwHyj-kRho2h2L2a6_mwaqcszJI-_KgHpcym0A-6foeyTQFanrB3CRTQkTbB02LiKrcRrQhVkqeiDoAEqHvUOqaE93PofHmRMHoTEoanwHHjSqSK7m1Q';
const warehouseImage = 'https://lh3.googleusercontent.com/aida-public/AB6AXuA0ssHRhDE29HtefOBLT_h8b7BV0zqL9eroB8E2SN1qFZwHiwpMX8_0AZtEqjMFvv7fbZbNb1ICdPIeOFY3CmyCBpWvCWFxYL9jWzIypEtoqqXInBaTdjmvQrvw9lHpUFvTM2cE2-zR2aYkXx85HOsIf4akGkTtdRflbUJPHpuskzlQ12lMygdsXvSV-_B1IWrDlj7NXb8xt_gBSZVVFNnBTVBRGOC7Z6uIqQqWtsld7SWgOKoQruXavg';

export default function DashboardScreen() {
  const router = useRouter();
  const { data, currentFarmId, selectFarm, getAccessToken } = useAuthContext();
  const [farmSheetOpen, setFarmSheetOpen] = useState(false);
  const [pendingFarmId, setPendingFarmId] = useState<string | null>(currentFarmId);
  const [summary, setSummary] = useState({ warehouseCount: 0, itemCount: 0, balanceCount: 0, totalQuantity: 0, pendingCount: 0, activities: [] as Array<{ code: string; status: string; title: string; detail: string; quantity: string; createdAt: string; tone: 'amber' | 'success' | 'danger' }> });
  const [auditActivities, setAuditActivities] = useState<Array<{ code: string; status: string; title: string; detail: string; quantity: string; createdAt: string; tone: 'amber' | 'success' | 'danger' }>>([]);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);
  const syncRotation = useRef(new Animated.Value(0)).current;

  function sync() {
    clearApiCache();
    syncRotation.setValue(0);
    Animated.timing(syncRotation, { toValue: 1, duration: 700, useNativeDriver: true }).start();
    setReloadNonce((value) => value + 1);
  }

  const syncTransform = { transform: [{ rotate: syncRotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] };
  const selectedMembership = data?.memberships.find(({ farm: candidate }) => candidate.id === currentFarmId);
  const membership = selectedMembership ?? (data?.memberships.length === 1 ? data.memberships[0] : undefined);
  const farm = membership?.farm;
  const role = membership?.roles[0] ?? 'GUEST';
  const roleLabel = { ADMIN: 'Quản trị viên', FARM_OWNER: 'Chủ trại', EMPLOYEE: 'Nhân viên', GUEST: 'Khách' }[role] ?? role;
  const userName = data?.user.fullName?.trim() || 'Người dùng';
  const initials = userName.trim().split(/\s+/).slice(-2).map((part) => part[0]).join('').toUpperCase();
  useEffect(() => {
    if ((data?.memberships.length ?? 0) > 1 && !currentFarmId) {
      setPendingFarmId(null);
      setFarmSheetOpen(true);
    }
  }, [currentFarmId, data?.memberships.length]);

  function openFarmSelector() {
    setPendingFarmId(currentFarmId);
    setFarmSheetOpen(true);
  }

  async function confirmFarmSelection() {
    if (!pendingFarmId) {
      Alert.alert('Chưa chọn trang trại', 'Vui lòng chọn một trang trại trước khi xác nhận.');
      return;
    }
    try {
      await selectFarm(pendingFarmId);
      setFarmSheetOpen(false);
    } catch (cause) {
      Alert.alert('Không thể chọn trang trại', cause instanceof Error ? cause.message : 'Vui lòng thử lại.');
    }
  }

  useEffect(() => {
    if (!currentFarmId) { setSummary({ warehouseCount: 0, itemCount: 0, balanceCount: 0, totalQuantity: 0, pendingCount: 0, activities: [] }); return; }
    let cancelled = false;
    void getAccessToken().then((token) => {
      if (!token) throw new MobileApiError('Phiên đăng nhập đã hết hạn.', 401);
      return Promise.all([
        listWarehouses(token, currentFarmId),
        listBalances(token, currentFarmId, undefined, true),
        apiRequest<Paginated<StockReceipt>>('/stock-receipts', { token, params: { farmId: currentFarmId, page: 1, pageSize: 5 } }),
        apiRequest<Paginated<StockIssue>>('/stock-issues', { token, params: { farmId: currentFarmId, page: 1, pageSize: 5 } }),
      ]);
    }).then(([warehouses, balances, receipts, issues]) => {
      if (cancelled) return;
      const positiveItemIds = new Set<string>();
      const totalQuantity = balances.data.reduce((total, row) => {
        const quantity = Number(row.balance.quantityOnHand);
        if (!Number.isFinite(quantity) || quantity <= 0) return total;
        positiveItemIds.add(row.balance.itemId);
        return total + quantity;
      }, 0);
      const docs = [...receipts.data.map((row) => ({ code: row.receiptCode, status: row.status, title: row.note || 'Phiếu nhập kho', detail: `Kho: ${row.warehouseId}`, quantity: '', createdAt: row.createdAt ?? '', tone: row.status === 'CONFIRMED' ? 'success' as const : row.status === 'REJECTED' ? 'danger' as const : 'amber' as const })), ...issues.data.map((row) => ({ code: row.issueCode, status: row.status, title: row.reason || 'Phiếu xuất kho', detail: `Kho: ${row.warehouseId}`, quantity: '', createdAt: row.createdAt ?? '', tone: row.status === 'CONFIRMED' ? 'success' as const : row.status === 'REJECTED' ? 'danger' as const : 'amber' as const }))];
      setSummary({ warehouseCount: warehouses.data.length, itemCount: positiveItemIds.size, balanceCount: positiveItemIds.size, totalQuantity, pendingCount: docs.filter((row) => row.status === 'DRAFT' || row.status === 'PENDING_APPROVAL').length, activities: docs.slice(0, 3) });
      setSummaryError(null);
    }).catch((cause: unknown) => { if (!cancelled) setSummaryError(cause instanceof Error ? cause.message : 'Không thể tải tổng quan.'); });
    return () => { cancelled = true; };
  }, [currentFarmId, getAccessToken, reloadNonce]);
  useEffect(() => {
    if (!currentFarmId) { setAuditActivities([]); setAuditError(null); return; }
    let cancelled = false;
    void getAccessToken().then((token) => {
      if (!token) throw new MobileApiError('Phiên đăng nhập đã hết hạn.', 401);
      return listAuditLogs(token, currentFarmId, 5);
    }).then((response) => {
      if (cancelled) return;
      setAuditActivities(response.data.map(toAuditActivity));
      setAuditError(null);
    }).catch((cause: unknown) => {
      if (!cancelled) setAuditError(cause instanceof Error ? cause.message : 'Không thể tải lịch sử thao tác.');
    });
    return () => { cancelled = true; };
  }, [currentFarmId, getAccessToken, reloadNonce]);
  return <AppShell active="dashboard">
    <PageHeader title={farm?.name ?? 'Chưa chọn trang trại'} subtitle="● Hệ thống quản lý trại • Trực tuyến" action={<View style={{ flexDirection: 'row', alignItems: 'center' }}><NotificationBell /><Pressable onPress={sync} android_ripple={{ color: colors.primaryFixed }} style={({ pressed }) => [styles.sync, pressed && styles.pressed]}><Animated.View style={syncTransform}><Icon name="sync" color={colors.primary} /></Animated.View></Pressable></View>} />
    <Card style={styles.farmCard}>
      <HoneyCardArtwork />
      <View style={styles.farmTop}>
        <View style={styles.farmHeading}>
          <View style={styles.farmIcon}><Icon name="hive" size={23} color={colors.honey} /></View>
          <Text style={styles.farmLabel}>Trang trại hiện tại</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Đổi trang trại" onPress={openFarmSelector} android_ripple={{ color: colors.primaryFixed }} style={({ pressed }) => [styles.switch, pressed && styles.pressed]}>
          <Text style={styles.switchText}>Đổi</Text><Icon name="unfold-more" size={16} color={colors.primary} />
        </Pressable>
      </View>
      <Text style={styles.farmTitle}>{farm?.name ?? 'Vui lòng chọn trang trại'}</Text>
      <View style={[styles.farmCodeBadge, !farm && styles.farmCodeBadgeEmpty]}>
        <View style={[styles.farmCodeDot, !farm && styles.farmCodeDotEmpty]} />
        <Text style={[styles.farmCode, !farm && styles.farmCodeEmpty]}>{farm?.code ?? 'CHƯA CHỌN'}</Text>
      </View>
    </Card>
    <Pressable accessibilityRole="button" accessibilityLabel={`Tài khoản và cài đặt của ${userName}, ${roleLabel}`} onPress={() => router.push('/account' as never)} style={({ pressed }) => pressed && styles.pressed}>
      <Card style={styles.profile}>
        <HoneyCardArtwork />
        <View style={styles.avatar}><Text style={styles.avatarText}>{initials || 'U'}</Text></View>
        <View style={styles.profileCopy}>
          <Text style={styles.profileName}>{userName}</Text>
          <View style={styles.profileRole}><Icon name="verified-user" size={13} color={colors.statusSuccess} filled /><Text style={styles.role}>{roleLabel}</Text></View>
        </View>
        <View style={styles.profileSettings}><Icon name="settings" size={19} color={colors.primary} /></View>
      </Card>
    </Pressable>
    <Card style={styles.shift}><View style={styles.shiftHead}><View style={styles.shiftTitle}><Icon name="bar-chart" color={colors.primary} /><Text style={styles.shiftName} numberOfLines={3}>Tổng quan vận hành</Text></View><Pill tone={summaryError ? 'danger' : 'success'}><Text style={styles.quality} numberOfLines={2}>{summaryError ? 'Lỗi API' : 'DB trực tuyến'}</Text></Pill></View><View style={styles.shiftStats}><MiniStat label="Mục tồn kho" value={String(summary.balanceCount)} icon="inventory-2" /><MiniStat label="Phiếu chờ duyệt" value={String(summary.pendingCount)} icon="description" tone="amber" badge="Từ DB" /><MiniStat label="Kho đang hoạt động" value={String(summary.warehouseCount)} icon="warehouse" tone="normal" badge="Từ DB" /></View></Card>
    <SectionTitle title="Tác vụ hiện trường" count={`${summary.itemCount} MỤC DB`} />
    <Pressable onPress={() => router.push('/scan' as never)} android_ripple={{ color: colors.primary }} style={({ pressed }) => [styles.scanAction, pressed && styles.pressed]}><LinearGradient colors={[colors.primary, colors.primaryContainer, colors.secondary]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.scanGradient}><View style={styles.scanIcon}><Icon name="qr-code-scanner" size={25} color={colors.onPrimary} /></View><View style={styles.scanCopy}><View style={styles.scanTitleRow}><Text style={styles.scanTitle} numberOfLines={2}>Quét QR Thùng ong & Thiết bị</Text><Pill tone="cream"><Text style={styles.aiScan}>AI SCAN</Text></Pill></View><Text style={styles.scanMeta} numberOfLines={2}>Tra cứu nhật ký đàn, tầng kế & vị trí đặt</Text></View><View style={styles.scanArrow}><Icon name="arrow-forward" size={21} color={colors.onPrimary} /></View></LinearGradient></Pressable>
    <View style={styles.actionGrid}><Action icon="inventory-2" title="Tra cứu tồn kho" sub={`${summary.warehouseCount} kho từ DB`} onPress={() => router.push('/inventory' as never)} /><Action icon="input" title="Tạo phiếu nhập" sub={`${summary.pendingCount} phiếu chờ duyệt`} onPress={() => router.push('/receipts/new' as never)} /><Action icon="output" title="Tạo phiếu xuất" sub="Xuất trại / Bảo trì" onPress={() => router.push('/receipts/new' as never)} /><Action icon="checklist" title="Kiểm kê thực tế" sub="Mở danh sách phiếu DB" onPress={() => router.push('/receipts' as never)} /><Action icon="build" title="Tạo phiếu bảo trì" sub="Thiết bị hiện trường" onPress={() => router.push('/receipts' as never)} /><Action icon="warehouse" title="Quản lý kho" sub={`${summary.itemCount} mục từ DB`} onPress={() => router.push('/inventory' as never)} /></View>
    <Pressable onPress={() => router.push('/receipts' as never)} android_ripple={{ color: colors.primaryFixed }} style={({ pressed }) => [styles.maintenance, pressed && styles.pressed]}><View style={styles.maintenanceIcon}><Icon name="build" color={colors.error} /></View><View style={styles.maintenanceCopy}><Text style={styles.maintenanceTitle} numberOfLines={3}>Bảo trì thiết bị hiện trường</Text><Text style={styles.maintenanceMeta} numberOfLines={2}>{summary.itemCount} mục tồn kho từ DB</Text></View><Icon name="chevron-right" color={colors.outline} /></Pressable>
    <SectionTitle title="Hoạt động hiện trường" action={<Pressable onPress={() => router.push('/receipts' as never)}><Text style={styles.link}>Xem tất cả →</Text></Pressable>} />
    {summary.activities.length === 0 ? <Text style={styles.emptyText}>{summaryError ?? 'Chưa có hoạt động từ DB.'}</Text> : summary.activities.map((activity) => <Activity key={activity.code} {...activity} />)}
    <SectionTitle title="Lịch sử thao tác" action={<Pressable onPress={() => router.push('/activity' as never)}><Text style={styles.link}>Xem tất cả →</Text></Pressable>} />
    {auditActivities.length === 0 ? <Text style={styles.emptyText}>{auditError ?? 'Chưa có thao tác được ghi nhận.'}</Text> : auditActivities.map((activity) => <Pressable key={activity.code} accessibilityRole="button" accessibilityLabel="Xem chi tiết thao tác" onPress={() => router.push(`/activity/${encodeURIComponent(activity.code.split(':')[0])}` as never)} style={({ pressed }) => pressed && styles.pressed}><Activity {...activity} /></Pressable>)}
    <Card style={styles.warehouse}><Image source={{ uri: warehouseImage }} style={styles.warehouseImage} /><View style={styles.warehouseCopy}><Text style={styles.warehouseName} numberOfLines={2}>{summary.warehouseCount ? `Đã kết nối ${summary.warehouseCount} kho trong farm` : 'Chưa có kho trong farm'}</Text><Text style={styles.warehouseMeta} numberOfLines={2}>Tồn kho: {summary.balanceCount} sản phẩm • {formatQuantity(summary.totalQuantity)} đơn vị</Text></View><View style={styles.warehouseStatus}><Pill tone={summaryError ? 'danger' : 'success'}><Text style={styles.online}>{summaryError ? 'ERROR' : 'ONLINE'}</Text></Pill><Text style={styles.warehouseUpdated}>API</Text></View></Card>
    <Modal visible={farmSheetOpen} transparent animationType="slide" onRequestClose={() => setFarmSheetOpen(false)}><View style={styles.sheetBackdrop}><View style={styles.sheet}><View style={styles.sheetHead}><Text style={styles.sheetTitle}>Chọn trại đang làm việc</Text><Pressable onPress={() => setFarmSheetOpen(false)} android_ripple={{ color: colors.primaryFixed }} style={({ pressed }) => [styles.iconOnly, pressed && styles.pressed]}><Icon name="close" color={colors.onSurfaceVariant} /></Pressable></View>{(data?.memberships ?? []).map(({ farm: candidate }) => <Pressable key={candidate.id} onPress={() => setPendingFarmId(candidate.id)} android_ripple={{ color: colors.primaryFixed }} style={({ pressed }) => [styles.farmOption, pendingFarmId === candidate.id && styles.farmOptionActive, pressed && styles.pressed]}><Icon name={pendingFarmId === candidate.id ? 'radio-button-checked' : 'radio-button-unchecked'} color={pendingFarmId === candidate.id ? colors.primary : colors.outline} /><View style={styles.farmOptionCopy}><Text style={styles.farmOptionName}>{candidate.name}</Text><Text style={styles.farmOptionCode}>{candidate.code}</Text></View></Pressable>)}<PrimaryAction label="Xác nhận chuyển trại" onPress={() => void confirmFarmSelection()} /></View></View></Modal>
  </AppShell>;
}

function HoneyCardArtwork() {
  return <Image
    pointerEvents="none"
    accessible={false}
    source={require('../../../../app/assets/honey-card-artwork.png')}
    resizeMode="stretch"
    style={styles.honeyCardArtwork}
  />;
}

function PrimaryAction({ label, onPress }: { label: string; onPress: () => void }) { return <Pressable onPress={onPress} android_ripple={{ color: colors.primary }} style={({ pressed }) => [styles.sheetButton, pressed && styles.pressed]}><Icon name="check" color={colors.onPrimary} /><Text style={styles.sheetButtonText}>{label}</Text></Pressable>; }

function MiniStat({ label, value, icon, tone = 'normal', progress, badge }: { label: string; value: string; icon: Parameters<typeof Icon>[0]['name']; tone?: 'normal' | 'amber' | 'danger'; progress?: number; badge?: string }) { const tint = tone === 'danger' ? colors.error : tone === 'amber' ? colors.honey : colors.primary; return <View style={styles.miniStat}><View style={styles.miniStatHead}><Text numberOfLines={2} style={styles.miniLabel}>{label}</Text><View style={[styles.miniIcon, { backgroundColor: tone === 'danger' ? colors.errorContainer : tone === 'amber' ? colors.honeyChip : colors.surfaceContainerLow }]}><Icon name={icon} size={18} color={tint} /></View></View><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72} style={[styles.miniValue, { color: tint }]}>{value}</Text>{progress !== undefined ? <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%`, backgroundColor: colors.secondary }]} /></View> : <View style={[styles.miniBadge, { backgroundColor: tone === 'danger' ? colors.errorContainer : colors.honeyChip }]}><Text numberOfLines={1} style={[styles.miniBadgeText, { color: tint }]}>{badge}</Text></View>}</View>; }
function Action({ icon, title, sub, onPress }: { icon: Parameters<typeof Icon>[0]['name']; title: string; sub: string; onPress: () => void }) { return <Pressable onPress={onPress} android_ripple={{ color: colors.primaryFixed }} style={({ pressed }) => [styles.action, pressed && styles.pressed]}><View style={styles.actionIcon}><Icon name={icon} color={colors.primary} /></View><Text style={styles.actionTitle}>{title}</Text><Text style={styles.actionSub}>{sub}</Text></Pressable>; }
  function Activity({ code, status, title, detail, quantity, createdAt, tone }: { code: string; status: string; title: string; detail: string; quantity: string; createdAt: string; tone: 'amber' | 'success' | 'danger' }) { return <Card style={[styles.activity, tone === 'success' && styles.activitySuccess, tone === 'danger' && styles.activityDanger]}><View style={styles.activityHead}><Pill tone="cream"><Text numberOfLines={1} style={styles.activityCode}>{code}</Text></Pill><Text numberOfLines={1} style={styles.activityTime}>◷ {formatDateTime(createdAt)}</Text><Pill tone={tone === 'amber' ? 'amber' : tone === 'success' ? 'success' : 'danger'}><Text numberOfLines={1} style={styles.activityStatus}>{status}</Text></Pill></View><Text numberOfLines={2} style={styles.activityTitle}>{title}</Text><Text numberOfLines={3} style={styles.activityDetail}>{detail}</Text>{quantity ? <View style={styles.activityBottom}><Text numberOfLines={2} style={styles.activityQuantity}>{quantity}</Text></View> : null}</Card>; }

function toAuditActivity(log: AuditLog) {
  const status = getAuditStatus(log.newData) ?? getAuditStatus(log.oldData) ?? 'ĐÃ GHI';
  const tone = status === 'CONFIRMED' ? 'success' as const : status === 'REJECTED' || status === 'CANCELLED' ? 'danger' as const : 'amber' as const;
  return {
    code: `${log.id}:${log.entityId ?? log.entityType}`,
    status,
    title: `${auditActionLabel(log.action)} • ${auditEntityLabel(log.entityType)}`,
    detail: log.actor?.name ?? log.actor?.email ?? 'Người dùng hệ thống',
    quantity: '',
    createdAt: log.createdAt,
    tone,
  };
}

function getAuditStatus(value: unknown) {
  if (!value || typeof value !== 'object' || !('status' in value)) return null;
  return typeof value.status === 'string' ? value.status : null;
}

function auditActionLabel(action: string) {
  const labels: Record<string, string> = { CREATE: 'Tạo mới', UPDATE: 'Cập nhật', SUBMIT: 'Gửi duyệt', CONFIRM: 'Xác nhận', REJECT: 'Từ chối', CANCEL: 'Hủy', DELETE: 'Xóa' };
  return labels[action.toUpperCase()] ?? action;
}

function auditEntityLabel(entityType: string) {
  const labels: Record<string, string> = { STOCK_RECEIPT: 'phiếu nhập', STOCK_ISSUE: 'phiếu xuất', STOCK_COUNT: 'phiếu kiểm kê', STOCK_TRANSFER: 'phiếu điều chuyển', INVENTORY: 'tồn kho', ITEM: 'vật tư', ASSET: 'tài sản', MAINTENANCE: 'bảo trì' };
  return labels[entityType.toUpperCase()] ?? entityType;
}

const styles = StyleSheet.create({
  sync: { width: dimensions.iconButton, height: dimensions.iconButton, borderRadius: radius.default, backgroundColor: colors.parchment, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.outlineVariant },
  pressed: { opacity: 0.82, transform: [{ scale: 0.98 }] },
  farmCard: { position: 'relative', overflow: 'hidden', padding: 18, gap: spacing.spaceSm, borderRadius: 20, borderColor: colors.borderAmberGlow, backgroundColor: colors.parchmentWarm },
  honeyCardArtwork: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, width: '100%', height: '100%', opacity: 0.28 },
  farmTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.spaceSm },
  farmHeading: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: spacing.spaceSm },
  farmIcon: { width: 36, height: 36, flexShrink: 0, borderRadius: 10, backgroundColor: colors.honeyChip, alignItems: 'center', justifyContent: 'center' },
  farmLabel: { ...typography.labelSm, color: colors.onSurfaceVariant, flexShrink: 1, textTransform: 'uppercase' },
  farmTitle: { ...typography.headlineMd, fontSize: 25, lineHeight: 32, color: colors.deepAmberStrong, marginTop: spacing.spaceXs },
  farmCodeBadge: { alignSelf: 'flex-start', maxWidth: '100%', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.statusSuccessBorder, backgroundColor: colors.statusSuccessSurface },
  farmCodeDot: { width: 6, height: 6, borderRadius: radius.full, flexShrink: 0, backgroundColor: colors.statusSuccess },
  farmCode: { ...typography.labelMd, color: colors.statusSuccess, letterSpacing: 0.5, flexShrink: 1 },
  farmCodeBadgeEmpty: { borderColor: colors.outlineVariant, backgroundColor: colors.surfaceContainerLow },
  farmCodeDotEmpty: { backgroundColor: colors.outline },
  farmCodeEmpty: { color: colors.onSurfaceVariant },
  switch: { minHeight: 44, paddingHorizontal: 11, borderRadius: 10, backgroundColor: colors.parchment, borderWidth: 1, borderColor: colors.borderAmberGlow, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.spaceXs, flexShrink: 0 },
  switchText: { ...typography.labelMd, color: colors.primary },
  profile: { position: 'relative', overflow: 'hidden', flexDirection: 'row', alignItems: 'center', padding: 18, gap: 12, borderRadius: 20, borderColor: colors.borderAmberGlow, backgroundColor: colors.parchment },
  avatar: { width: 46, height: 46, flexShrink: 0, borderRadius: 14, backgroundColor: colors.honeyChip, borderWidth: 1, borderColor: colors.borderAmberGlow, alignItems: 'center', justifyContent: 'center' },
  avatarText: { ...typography.labelLg, fontSize: 18, lineHeight: 26, color: colors.deepAmber },
  profileCopy: { flex: 1, minWidth: 0, gap: spacing.spaceXs },
  profileName: { ...typography.labelLg, fontSize: 16, lineHeight: 23, letterSpacing: 0, color: colors.deepAmberStrong },
  profileRole: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', maxWidth: '100%', gap: spacing.spaceXs, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 7, backgroundColor: colors.statusSuccessSurface },
  role: { ...typography.labelMd, color: colors.statusSuccess, flexShrink: 1 },
  profileSettings: { width: 44, height: 44, flexShrink: 0, borderRadius: 10, borderWidth: 1, borderColor: colors.borderAmberGlow, alignItems: 'center', justifyContent: 'center' },
  shift: { borderColor: colors.secondaryContainer, backgroundColor: colors.parchment },
  shiftHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.spaceSm, flexWrap: 'wrap' },
  shiftTitle: { flex: 1, minWidth: 130, flexDirection: 'row', alignItems: 'center', gap: spacing.spaceSm },
  shiftName: { ...typography.headlineSm, color: colors.deepAmber, flexShrink: 1 },
  quality: { ...typography.labelSm, color: colors.deepAmber, flexShrink: 1 },
  time: { padding: spacing.spaceSm, borderRadius: radius.default, backgroundColor: colors.surfaceContainerLow },
  timeText: { ...typography.bodySm, color: colors.onSurfaceVariant },
  shiftStats: { flexDirection: 'row', gap: spacing.spaceSm, marginTop: spacing.spaceMd },
  miniStat: { flex: 1, minWidth: 0, minHeight: 116, padding: spacing.spaceSm, borderRadius: radius.lg, backgroundColor: colors.surfaceContainerLow, borderWidth: 1, borderColor: colors.outlineVariant, alignItems: 'center' },
  miniStatHead: { width: '100%', flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.spaceXs },
  miniIcon: { width: 32, height: 32, borderRadius: radius.default, alignItems: 'center', justifyContent: 'center' },
  miniLabel: { ...typography.labelSm, color: colors.onSurfaceVariant, marginTop: spacing.spaceSm, flexShrink: 1, flex: 1 },
  miniValue: { ...typography.headlineMd, fontSize: 24, lineHeight: 30, marginTop: spacing.spaceXs, flexShrink: 1, textAlign: 'center' },
  progressTrack: { width: '100%', height: 6, marginTop: spacing.spaceSm, borderRadius: radius.full, backgroundColor: colors.outlineVariant, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: radius.full },
  miniBadge: { maxWidth: '100%', marginTop: spacing.spaceSm, paddingHorizontal: spacing.spaceSm, paddingVertical: 3, borderRadius: radius.full },
  miniBadgeText: { ...typography.labelSm, fontSize: 9, lineHeight: 13, flexShrink: 1 },
  scanAction: { minHeight: 64, borderRadius: radius.lg, overflow: 'hidden', shadowColor: colors.deepAmber, shadowOpacity: 0.18, shadowRadius: 10, elevation: 3 },
  scanGradient: { minHeight: 64, padding: spacing.spaceMd, flexDirection: 'row', alignItems: 'center', gap: spacing.spaceSm },
  scanIcon: { width: 44, height: 44, borderRadius: radius.full, borderWidth: 1, borderColor: colors.primaryFixed, alignItems: 'center', justifyContent: 'center' },
  scanCopy: { flex: 1 },
  scanTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.spaceXs, flexWrap: 'wrap' },
  scanTitle: { ...typography.headlineSm, color: colors.onPrimary },
  aiScan: { ...typography.labelSm, color: colors.deepAmber, fontSize: 8 },
  scanMeta: { ...typography.bodySm, color: colors.onPrimaryContainer, marginTop: spacing.spaceXs },
  scanArrow: { width: 32, height: 32, borderRadius: radius.full, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.spaceSm },
  action: { flexGrow: 1, flexBasis: '46%', minWidth: 0, minHeight: 64, padding: spacing.spaceMd, borderRadius: radius.lg, backgroundColor: colors.parchment, borderWidth: 1, borderColor: colors.secondaryContainer },
  actionIcon: { width: 32, height: 32, borderRadius: radius.default, backgroundColor: colors.honeyChip, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.spaceSm },
  actionTitle: { ...typography.labelLg, color: colors.deepAmber, flexShrink: 1 },
  actionSub: { ...typography.bodySm, color: colors.onSurfaceVariant, marginTop: 2, flexShrink: 1 },
  maintenance: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.spaceSm, padding: spacing.spaceSm, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.secondaryContainer, backgroundColor: colors.parchment },
  maintenanceIcon: { width: 38, height: 38, borderRadius: radius.default, backgroundColor: colors.errorContainer, alignItems: 'center', justifyContent: 'center' },
  maintenanceCopy: { flex: 1, minWidth: 0 },
  maintenanceTitle: { ...typography.labelLg, color: colors.onSurface, flexShrink: 1, minWidth: 0 },
  maintenanceMeta: { ...typography.bodySm, color: colors.onSurfaceVariant, flexShrink: 1, minWidth: 0 },
  link: { ...typography.labelLg, color: colors.secondary },
  emptyText: { ...typography.bodyMd, color: colors.onSurfaceVariant, textAlign: 'center', paddingVertical: spacing.spaceLg },
  activity: { borderLeftWidth: 4, borderLeftColor: colors.honey, marginBottom: spacing.spaceSm, gap: spacing.spaceSm },
  activitySuccess: { borderLeftColor: colors.statusSuccess },
  activityDanger: { borderLeftColor: colors.error },
  activityHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.spaceSm, flexWrap: 'wrap' },
  activityCode: { ...typography.labelSm, color: colors.primary },
  activityTime: { ...typography.bodySm, color: colors.onSurfaceVariant, flex: 1 },
  activityStatus: { ...typography.labelSm, color: colors.deepAmber },
  activityTitle: { ...typography.headlineSm, color: colors.deepAmber, flexShrink: 1 },
  activityDetail: { ...typography.bodySm, color: colors.onSurfaceVariant, flexShrink: 1 },
  activityBottom: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: spacing.spaceSm, paddingTop: spacing.spaceSm, borderTopWidth: 1, borderTopColor: colors.outlineVariant },
  activityQuantity: { ...typography.bodySm, color: colors.onSurface, flexShrink: 1 },
  activityOwner: { ...typography.bodySm, color: colors.onSurfaceVariant, flexShrink: 1 },
  warehouse: { flexDirection: 'row', alignItems: 'center', gap: spacing.spaceSm },
  warehouseImage: { width: 48, height: 48, borderRadius: radius.default },
  warehouseCopy: { flex: 1, minWidth: 0 },
  warehouseName: { ...typography.labelLg, color: colors.deepAmber, flexShrink: 1 },
  warehouseMeta: { ...typography.bodySm, color: colors.onSurfaceVariant, flexShrink: 1 },
  online: { ...typography.labelSm, color: colors.statusSuccess },
  warehouseStatus: { alignItems: 'flex-end', flexShrink: 0, gap: 2 },
  warehouseUpdated: { ...typography.labelSm, color: colors.onSurfaceVariant },
  sheetBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.modalOverlay },
  sheet: { padding: spacing.spaceLg, paddingBottom: spacing.spaceXl, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, backgroundColor: colors.parchment, gap: spacing.spaceSm },
  sheetHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.spaceSm },
  iconOnly: { width: dimensions.iconButton, height: dimensions.iconButton, alignItems: 'center', justifyContent: 'center', borderRadius: radius.full },
  sheetTitle: { ...typography.headlineSm, color: colors.deepAmber },
  farmOption: { minHeight: 60, padding: spacing.spaceSm, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.outlineVariant, flexDirection: 'row', alignItems: 'center', gap: spacing.spaceSm },
  farmOptionActive: { borderColor: colors.primary, backgroundColor: colors.honeyChip },
  farmOptionCopy: { flex: 1, minWidth: 0 },
  farmOptionName: { ...typography.labelLg, color: colors.onSurface, flexShrink: 1 },
  farmOptionCode: { ...typography.bodySm, color: colors.onSurfaceVariant, marginTop: 2, flexShrink: 1 },
  sheetButton: { minHeight: dimensions.actionHeight, marginTop: spacing.spaceSm, borderRadius: radius.full, backgroundColor: colors.primaryContainer, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.spaceSm },
  sheetButtonText: { ...typography.labelLg, color: colors.onPrimary },
});

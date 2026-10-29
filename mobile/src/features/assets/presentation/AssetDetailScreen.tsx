import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useEffect, useRef, useState } from 'react';

import { AppShell, Card, Icon, PageHeader, Pill } from '@/src/shared/ui/MobileShell';
import { colors, dimensions, radius, shadows, spacing, typography } from '@/src/core/theme/tokens';
import NotificationBell from '@/src/features/notifications/presentation/NotificationBell';
import { useAuthContext } from '@/src/features/auth/context/AuthContext';
import { apiRequest, clearApiCache, MobileApiError } from '@/src/shared/api/client';

type AssetLookup = {
  data: {
    asset: {
      id: string;
      assetCode: string;
      qrToken: string;
      status: string;
      purchaseDate: string | null;
      warrantyExpiryDate: string | null;
      lastMaintenanceDate: string | null;
      nextMaintenanceDate: string | null;
      note: string | null;
    };
    itemCode: string;
    itemName: string;
    locationCode: string | null;
    locationName: string | null;
    locationWarehouseId: string | null;
  };
};

type MaintenanceRecord = {
  id: string;
  maintenanceType: string;
  scheduledAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  status: string;
  description: string | null;
  resultNote: string | null;
};
type MaintenanceRequestPage = { data: Array<{ id: string; status: string }> };

export default function AssetDetailScreen() {
  const router = useRouter();
  const { qrToken } = useLocalSearchParams<{ qrToken: string }>();
  const token = decodeQrToken(qrToken);
  const { data, currentFarmId, getAccessToken } = useAuthContext();
  const [lookup, setLookup] = useState<AssetLookup['data'] | null>(null);
  const [maintenanceRecords, setMaintenanceRecords] = useState<MaintenanceRecord[]>([]);
  const [hasPendingMaintenanceRequest, setHasPendingMaintenanceRequest] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);
  const syncRotation = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!currentFarmId || !token) return;
    let cancelled = false;
    setLookup(null);
    setMaintenanceRecords([]);
    setLookupError(null);
    void getAccessToken()
      .then((accessToken) => {
        if (!accessToken) throw new MobileApiError('Phiên đăng nhập đã hết hạn.', 401);
        return apiRequest<AssetLookup>(`/assets/by-code/${encodeURIComponent(token)}`, {
          token: accessToken,
          params: { farmId: currentFarmId },
        }).then(async (assetResponse) => {
          const maintenanceResponse = await apiRequest<{ data: MaintenanceRecord[] }>('/maintenance-records', {
            token: accessToken,
            params: { farmId: currentFarmId, assetId: assetResponse.data.asset.id, page: 1, pageSize: 100 },
          });
          const requestResponse = await apiRequest<MaintenanceRequestPage>('/maintenance-requests', {
            token: accessToken,
            params: { farmId: currentFarmId, assetId: assetResponse.data.asset.id, page: 1, pageSize: 1, status: 'PENDING_APPROVAL' },
            skipCache: true,
          });
          return { assetResponse, maintenanceResponse, requestResponse };
        });
      })
      .then(({ assetResponse, maintenanceResponse, requestResponse }) => {
        if (!cancelled) {
          setLookup(assetResponse.data);
          setMaintenanceRecords(maintenanceResponse.data);
          setHasPendingMaintenanceRequest(requestResponse.data.some((request) => request.status === 'PENDING_APPROVAL'));
          setLookupError(null);
        }
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setLookupError(
          cause instanceof MobileApiError && cause.status === 404
            ? 'Asset không còn tồn tại'
            : cause instanceof Error
              ? cause.message
              : 'Không thể tải thông tin asset.',
        );
      });
    return () => {
      cancelled = true;
    };
  }, [currentFarmId, getAccessToken, reloadNonce, token]);
  function sync() {
    clearApiCache();
    syncRotation.setValue(0);
    Animated.timing(syncRotation, { toValue: 1, duration: 700, useNativeDriver: true }).start();
    setReloadNonce((value) => value + 1);
  }
  const latestMaintenance = maintenanceRecords[0];
  const currentMembership = data?.memberships.find(({ farm }) => farm.id === currentFarmId);
  const hasActiveMaintenance = maintenanceRecords.some((record) => ['SCHEDULED', 'IN_PROGRESS'].includes(record.status));
  const canManageMaintenance = Boolean(currentMembership?.roles.some((role) => role === 'ADMIN' || role === 'FARM_OWNER'))
    && !['MAINTENANCE', 'LOST', 'RETIRED'].includes(lookup?.asset.status ?? '')
    && !hasActiveMaintenance;
  const canRequestMaintenance = Boolean(currentMembership?.roles.includes('EMPLOYEE'))
    && ['AVAILABLE', 'ASSIGNED', 'IN_USE'].includes(lookup?.asset.status ?? '')
    && !hasActiveMaintenance
    && !hasPendingMaintenanceRequest;
  // shortcut: dev forbids ASSET in stock transfers; hidden until the app uses asset-transfer-requests.
  const canTransferAsset = false;
  const canReturnAsset = Boolean(currentMembership?.roles.some((role) => role === 'ADMIN' || role === 'FARM_OWNER'))
    && ['ASSIGNED', 'IN_USE'].includes(lookup?.asset.status ?? '');
  const nextMaintenance = maintenanceRecords.find((record) => record.status === 'SCHEDULED');
  const purchaseDate = lookup?.asset.purchaseDate ? formatDate(lookup.asset.purchaseDate) : 'Chưa có dữ liệu';
  const warrantyExpiry = lookup?.asset.warrantyExpiryDate ? formatDate(lookup.asset.warrantyExpiryDate) : 'Chưa có dữ liệu';
  const maintenanceSummary = maintenanceRecords.length ? `${maintenanceRecords.length} bản ghi` : 'Chưa có bản ghi';
  const syncTransform = { transform: [{ rotate: syncRotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] };
  return <AppShell active="scan">
    <PageHeader title={data?.memberships.find(({ farm }) => farm.id === currentFarmId)?.farm.name ?? (data?.memberships.length === 1 ? data.memberships[0]?.farm.name : undefined) ?? 'Chưa chọn trang trại'} subtitle="● Hệ thống quản lý trại • Trực tuyến" onBack={() => router.back()} action={<View style={{ flexDirection: 'row', alignItems: 'center' }}><NotificationBell /><Pressable onPress={sync} android_ripple={{ color: colors.primaryFixed }} style={({ pressed }) => [styles.sync, pressed && styles.pressed]} accessibilityLabel="Đồng bộ tài sản"><Animated.View style={syncTransform}><Icon name="sync" color={colors.primary} /></Animated.View></Pressable></View>} />
    {lookupError ? <Card style={styles.errorCard}><Icon name="error-outline" color={colors.error} /><View style={styles.errorCopy}><Text style={styles.invalidTitle}>QR không hợp lệ</Text><Text style={styles.errorText}>{lookupError}</Text></View><Pressable onPress={() => router.replace('/scan' as never)} android_ripple={{ color: colors.errorContainer }} style={({ pressed }) => [styles.invalidRescan, pressed && styles.pressed]}><Text style={styles.invalidRescanText}>Quét lại</Text></Pressable></Card> : lookup ? <Card style={styles.verified}><View style={styles.verifiedIcon}><Icon name="check-circle" color={colors.statusSuccessStrong} size={22} /></View><View style={styles.verifiedCopy}><Text style={styles.verifiedTitle} numberOfLines={2}>Mã QR / Token hợp lệ! <Text style={styles.ok}>API OK</Text></Text><Text style={styles.verifiedText} numberOfLines={3}>Đã xác thực bằng phiên đăng nhập và tải dữ liệu asset theo farm hiện tại.</Text></View><Pressable onPress={() => router.replace('/scan' as never)} android_ripple={{ color: colors.primaryFixed }} style={({ pressed }) => [styles.rescan, pressed && styles.pressed]}><Icon name="qr-code-scanner" size={15} color={colors.statusSuccessStrong} /><Text style={styles.rescanText}>Quét lại</Text></Pressable></Card> : <Card style={styles.loadingCard}><Icon name="qr-code-2" color={colors.primary} /><View style={styles.errorCopy}><Text style={styles.loadingTitle}>Đang kiểm tra QR...</Text><Text style={styles.loadingText}>Đang xác thực mã với dữ liệu từ API.</Text></View></Card>}
    <View style={styles.tabs}><Pressable onPress={() => router.replace('/scan' as never)} android_ripple={{ color: colors.primaryFixed }} style={({ pressed }) => [styles.tab, pressed && styles.pressed]}><Icon name="qr-code-scanner" size={17} color={colors.deepAmber} /><Text style={styles.tabText} numberOfLines={2}>Phase 1: Quét mã</Text></Pressable><View style={styles.activeTab}><Icon name="assignment" size={17} color={colors.onPrimary} /><Text style={styles.activeTabText} numberOfLines={2}>Phase 2: Kết quả</Text><Pill tone="cream"><Text style={styles.percent}>100%</Text></Pill></View></View>
    {lookup ? <>
    <Card style={styles.assetCard}><LinearGradient colors={[colors.honeyChip, colors.surfaceContainerLow, colors.surfaceContainer]} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={styles.assetHero}><View style={styles.assetHead}><View style={styles.statusPill}><Pill tone="success"><Text style={styles.success} numberOfLines={2}>● {lookup.asset.status}</Text></Pill></View><View style={styles.statusPill}><Pill tone="amber"><Text style={styles.codeText} numberOfLines={2}>{lookup.itemCode}</Text></Pill></View></View><View style={styles.assetEmblem}><View style={styles.assetIconWash} /><View style={styles.assetIconGlow}><Icon name="whatshot" size={42} color={colors.primaryContainer} /></View><View style={styles.assetSeal}><Icon name="verified" size={18} color={colors.onPrimary} /></View></View><View style={styles.assetCode}><Text style={styles.assetCodeText} numberOfLines={3}>Mã tài sản: {lookup.asset.assetCode}</Text></View><Text style={styles.assetName} numberOfLines={4}>{lookup.itemName}</Text><View style={styles.uuidRow}><Icon name="fingerprint" size={13} color={colors.outline} /><Text style={styles.uuid} numberOfLines={3}>UUID: {lookup.asset.id}</Text></View></LinearGradient></Card>
    <Card style={[styles.sectionCard, styles.locationCard]}><SectionHeading icon="warehouse" title="VỊ TRÍ & SỞ HỮU HIỆN TẠI" action="Khớp GPS\nTrại" /><InfoRow icon="storefront" label="Kho lưu trữ" value={lookup?.locationName ?? 'Chưa có vị trí từ API'} /><InfoRow icon="shelves" label="Vị trí chi tiết" value={lookup?.locationCode ?? 'Chưa có vị trí chi tiết từ API'} /><InfoRow icon="verified-user" label="Tình trạng sở hữu" value={data?.memberships.find(({ farm }) => farm.id === currentFarmId)?.farm.name ?? (data?.memberships.length === 1 ? data.memberships[0]?.farm.name : undefined) ?? 'Chưa chọn trang trại'} valueTone="success" /></Card>
    <Card style={[styles.sectionCard, styles.historyCard]}><SectionHeading icon="manage-history" title="LỊCH SỬ KỸ THUẬT & BẢO DƯỠNG" action={maintenanceSummary} /><View style={styles.ownerAndUse}><View style={[styles.owner, styles.ownerCard]}><Icon name="badge" color={colors.primary} /><View style={styles.ownerCopy}><Text numberOfLines={1} style={styles.metaLabel}>NGƯỜI THỰC HIỆN GẦN NHẤT</Text><Text numberOfLines={2} style={styles.metaValue}>Chưa có dữ liệu phân công</Text><Text numberOfLines={2} style={styles.metaSub}>Backend chưa trả về người thực hiện</Text></View></View><View style={[styles.owner, styles.ownerCard]}><Icon name="calendar-today" color={colors.primary} /><View style={styles.ownerCopy}><Text numberOfLines={1} style={styles.metaLabel}>NGÀY MUA</Text><Text numberOfLines={1} style={styles.metaValue}>{purchaseDate}</Text><Text numberOfLines={2} style={styles.metaSub}>Hạn bảo hành: {warrantyExpiry}</Text></View></View></View><View style={styles.maintenance}><View style={styles.maintenanceHead}><Text numberOfLines={2} style={styles.maintenanceTitle}>TIẾN TRÌNH BẢO DƯỠNG</Text><Text numberOfLines={2} style={styles.maintenanceSync}>Dữ liệu từ API</Text></View>{maintenanceRecords.length ? maintenanceRecords.slice(0, 2).map((record, index) => <Timeline key={record.id} color={index === 0 ? colors.statusSuccess : colors.secondaryContainer} title={`${record.maintenanceType} • ${formatDate(record.completedAt ?? record.scheduledAt)}`} badge={record.status} detail={record.resultNote ?? record.description ?? 'Chưa có mô tả'} />) : <Text style={styles.emptyText}>Chưa có bản ghi bảo dưỡng từ DB.</Text>}<Pressable onPress={() => router.push(`/maintenance/history?assetId=${encodeURIComponent(lookup.asset.id)}&assetCode=${encodeURIComponent(lookup.asset.assetCode)}&itemName=${encodeURIComponent(lookup.itemName)}` as never)} android_ripple={{ color: colors.primaryFixed }} style={({ pressed }) => [styles.historyAction, pressed && styles.pressed]}><Text style={styles.historyActionText}>Mở toàn bộ lịch sử ({maintenanceRecords.length})</Text><Icon name="chevron-right" size={18} color={colors.primary} /></Pressable></View><View style={styles.log}><Icon name="history-edu" color={colors.secondary} /><View style={styles.logCopy}><Text numberOfLines={2} style={styles.logTitle}>Nhật ký vận hành gần nhất</Text><Text numberOfLines={3} style={styles.logText}>{lookup?.asset.note ?? 'Chưa có ghi chú vận hành từ DB.'}</Text></View></View></Card>
    <View style={styles.operationsHeading}><Icon name="bolt" size={19} color={colors.primary} /><Text style={styles.operationsTitle}>Thông tin vận hành tài sản</Text></View><View style={styles.operations}><Card style={styles.operationCard}><Icon name="badge" color={colors.primary} /><Text numberOfLines={1} style={styles.metaLabel}>NGƯỜI PHỤ TRÁCH</Text><Text numberOfLines={2} style={styles.operationName}>Chưa có dữ liệu phân công</Text><Text numberOfLines={2} style={styles.metaSub}>Thông tin từ API asset</Text><Pill tone="amber"><Text numberOfLines={1} style={styles.operationPill}>{lookup?.asset.status ?? 'Đang tải'}</Text></Pill></Card><Card style={styles.operationCard}><Icon name="event" color={colors.primary} /><Text numberOfLines={1} style={styles.metaLabel}>BẢO DƯỠNG TIẾP THEO</Text><Text numberOfLines={1} style={styles.operationName}>{nextMaintenance?.scheduledAt ? formatDate(nextMaintenance.scheduledAt) : (lookup?.asset.nextMaintenanceDate ? formatDate(lookup.asset.nextMaintenanceDate) : 'Chưa có dữ liệu')}</Text><Text numberOfLines={2} style={styles.metaSub}>{nextMaintenance?.description ?? 'Chưa có lịch bảo dưỡng từ DB'}</Text><Pill tone="success"><Text numberOfLines={1} style={styles.depreciation}>{latestMaintenance?.status ?? 'Chưa có trạng thái'}</Text></Pill></Card></View>
    <View style={styles.actionMatrix}>
      <Text style={styles.actionSectionTitle}>Thao tác khả dụng</Text>
      <View style={styles.actionRow}>
        {canManageMaintenance ? <Pressable onPress={() => router.push(`/receipts?maintenanceAssetId=${encodeURIComponent(lookup.asset.id)}` as never)} android_ripple={{ color: colors.primary }} style={({ pressed }) => [styles.primaryOperationAction, pressed && styles.pressed]}>
          <Icon name="build" size={18} color={colors.onPrimary} /><Text style={styles.primaryOperationText} numberOfLines={2}>Tạo phiếu bảo trì</Text>
        </Pressable> : null}
        {canRequestMaintenance ? <Pressable onPress={() => router.push(`/receipts?maintenanceAssetId=${encodeURIComponent(lookup.asset.id)}` as never)} android_ripple={{ color: colors.primary }} style={({ pressed }) => [styles.primaryOperationAction, pressed && styles.pressed]}>
          <Icon name="report-problem" size={18} color={colors.onPrimary} /><Text style={styles.primaryOperationText} numberOfLines={2}>Báo sự cố cần duyệt</Text>
        </Pressable> : null}
        {canTransferAsset ? <Pressable onPress={() => router.push(`/transfers/new?assetId=${encodeURIComponent(lookup.asset.id)}&sourceWarehouseId=${encodeURIComponent(lookup.locationWarehouseId!)}` as never)} android_ripple={{ color: colors.primaryFixed }} style={({ pressed }) => [styles.secondaryOperationAction, pressed && styles.pressed]}>
          <Icon name="swap-horiz" size={18} color={colors.primary} /><Text style={styles.secondaryOperationText} numberOfLines={2}>Điều chuyển kho</Text>
        </Pressable> : null}
        {canReturnAsset ? <Pressable onPress={() => router.push(`/assets/return?assetId=${encodeURIComponent(lookup.asset.id)}` as never)} android_ripple={{ color: colors.primaryFixed }} style={({ pressed }) => [styles.secondaryOperationAction, pressed && styles.pressed]}>
          <Icon name="keyboard-return" size={18} color={colors.primary} /><Text style={styles.secondaryOperationText} numberOfLines={2}>Trả tài sản về kho</Text>
        </Pressable> : null}
      </View>
      {!canManageMaintenance && !canRequestMaintenance && !canTransferAsset && !canReturnAsset ? <Text style={styles.noActionText}>{hasPendingMaintenanceRequest ? 'Tài sản đã có yêu cầu bảo trì đang chờ duyệt.' : 'Không có thao tác phù hợp với trạng thái tài sản và quyền của tài khoản hiện tại.'}</Text> : null}
      <Pressable onPress={() => router.replace('/scan' as never)} android_ripple={{ color: colors.statusSuccessBorder }} style={({ pressed }) => [styles.nextScanAction, pressed && styles.pressed]}>
        <Icon name="qr-code-scanner" size={16} color={colors.statusSuccessStrong} /><Text style={styles.nextScanText} numberOfLines={2}>Quét mã tiếp theo</Text>
      </Pressable>
    </View>
    <View style={styles.ledger}><Icon name="verified" size={14} color={colors.honey} /><Text style={styles.ledgerText} numberOfLines={2}>Dữ liệu tài sản được truy xuất từ API theo farm hiện tại</Text></View>
    </> : null}
  </AppShell>;
}

function decodeQrToken(value?: string) {
  if (!value) return '';
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'Chưa có dữ liệu';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('vi-VN');
}

function SectionHeading({ icon, title, action }: { icon: Parameters<typeof Icon>[0]['name']; title: string; action: string }) { return <View style={styles.sectionHeading}><View style={styles.sectionHeadingCopy}><Icon name={icon} color={colors.primary} /><Text numberOfLines={2} style={styles.sectionTitle}>{title}</Text></View><Pill tone="success"><Text numberOfLines={2} style={styles.actionText}>{action}</Text></Pill></View>; }
function InfoRow({ icon, label, value, valueTone }: { icon: Parameters<typeof Icon>[0]['name']; label: string; value: string; valueTone?: 'success' }) { return <View style={styles.infoRow}><View style={styles.infoIcon}><Icon name={icon} color={colors.primaryContainer} size={15} /></View><View style={styles.infoCopy}><Text style={styles.metaLabel}>{label}</Text><Text numberOfLines={3} style={[styles.infoValue, valueTone === 'success' && styles.successValue]}>{value}</Text></View></View>; }
function Timeline({ color, title, badge, detail }: { color: string; title: string; badge: string; detail: string }) { return <View style={styles.timeline}><View style={[styles.timelineLine, { backgroundColor: color }]} /><View style={styles.timelineCopy}><View style={styles.timelineHead}><View style={styles.timelineTitleRow}>{color !== colors.statusSuccess ? <Icon name="event" size={15} color={colors.primaryContainer} /> : null}<Text numberOfLines={2} style={styles.timelineTitle}>{title}</Text></View><View style={styles.timelineBadge}><Pill tone={color === colors.statusSuccess ? 'success' : 'amber'}><Text numberOfLines={1} style={styles.actionText}>{badge}</Text></Pill></View></View><Text numberOfLines={4} style={styles.timelineDetail}>{detail}</Text></View></View>; }

const styles = StyleSheet.create({
  pressed: { opacity: 0.82, transform: [{ scale: 0.98 }] },
  errorCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.spaceSm, borderColor: colors.error, backgroundColor: colors.errorContainer },
  errorCopy: { flex: 1, minWidth: 0, gap: 2 },
  invalidTitle: { ...typography.labelLg, color: colors.error, flexShrink: 1 },
  errorText: { ...typography.bodySm, color: colors.error, flex: 1, flexShrink: 1 },
  invalidRescan: { minHeight: 36, paddingHorizontal: spacing.spaceSm, borderRadius: radius.full, borderWidth: 1, borderColor: colors.error, alignItems: 'center', justifyContent: 'center' },
  invalidRescanText: { ...typography.labelSm, color: colors.error },
  loadingCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.spaceSm, borderColor: colors.outlineVariant, backgroundColor: colors.surfaceContainerLow },
  loadingTitle: { ...typography.labelLg, color: colors.primary, flexShrink: 1 },
  loadingText: { ...typography.bodySm, color: colors.onSurfaceVariant, flexShrink: 1 },
  emptyText: { ...typography.bodySm, color: colors.onSurfaceVariant, flexShrink: 1 },
  sync: { width: dimensions.iconButton, height: dimensions.iconButton, borderRadius: radius.full, backgroundColor: colors.parchment, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.outlineVariant },
  tabs: { minHeight: 52, padding: 3, borderRadius: radius.full, backgroundColor: colors.surfaceContainer, borderWidth: 1, borderColor: colors.outlineVariant, flexDirection: 'row', gap: 2 },
  tab: { flex: 1, minWidth: 0, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: spacing.spaceXs, paddingHorizontal: spacing.spaceXs },
  activeTab: { flex: 1.25, minWidth: 0, borderRadius: radius.full, backgroundColor: colors.primaryContainer, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: spacing.spaceXs, paddingHorizontal: spacing.spaceXs, shadowColor: colors.deepAmber, shadowOpacity: 0.14, shadowRadius: 8, elevation: 2 },
  tabText: { ...typography.bodySm, fontSize: 11, lineHeight: 16, color: colors.deepAmber, flexShrink: 1, textAlign: 'center' },
  activeTabText: { ...typography.labelLg, fontSize: 11, lineHeight: 16, color: colors.onPrimary, flexShrink: 1, textAlign: 'center' },
  percent: { ...typography.labelSm, color: colors.deepAmber },
  verified: { flexDirection: 'row', gap: spacing.spaceSm, alignItems: 'center', backgroundColor: colors.statusSuccessSurface, borderColor: colors.statusSuccessBorder },
  verifiedIcon: { width: 28, height: 28, borderRadius: radius.full, backgroundColor: colors.statusSuccessBorder, alignItems: 'center', justifyContent: 'center' },
  verifiedCopy: { flex: 1, minWidth: 0 },
  verifiedTitle: { ...typography.labelLg, color: colors.statusSuccessStrong, flexShrink: 1 },
  ok: { ...typography.labelSm, color: colors.statusSuccess },
  verifiedText: { ...typography.bodySm, color: colors.statusSuccessStrong, marginTop: 2, flexShrink: 1 },
  rescan: { minHeight: 36, paddingHorizontal: spacing.spaceSm, borderRadius: radius.full, borderWidth: 1, borderColor: colors.statusSuccessBorder, flexDirection: 'row', alignItems: 'center', gap: 4 },
  rescanText: { ...typography.labelSm, color: colors.statusSuccessStrong },
  assetCard: { backgroundColor: colors.surfaceContainerLowest, overflow: 'hidden' },
  assetHero: { borderRadius: radius.lg, padding: spacing.spaceMd, gap: spacing.spaceSm, borderWidth: 1, borderColor: colors.outlineVariant },
  assetHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.spaceSm, flexWrap: 'wrap', marginBottom: spacing.spaceSm },
  statusPill: { maxWidth: '100%', flexShrink: 1 },
  success: { ...typography.labelSm, color: colors.statusSuccessStrong },
  codeText: { ...typography.labelSm, color: colors.deepAmber },
  assetEmblem: { alignSelf: 'center', width: 112, height: 112, borderRadius: radius.lg, backgroundColor: colors.surfaceContainerLowest, borderWidth: 1, borderColor: colors.secondaryContainer, alignItems: 'center', justifyContent: 'center', shadowColor: colors.deepAmber, shadowOpacity: 0.08, shadowRadius: 8, elevation: 2, overflow: 'hidden' },
  assetIconWash: { ...StyleSheet.absoluteFill, backgroundColor: colors.honeyChip, opacity: 0.42 },
  assetIconGlow: { width: 64, height: 64, borderRadius: radius.full, backgroundColor: colors.honeyChip, alignItems: 'center', justifyContent: 'center', shadowColor: colors.honey, shadowOpacity: 0.14, shadowRadius: 12, elevation: 2 },
  assetSeal: { position: 'absolute', bottom: -6, right: -6, width: 28, height: 28, borderRadius: radius.full, backgroundColor: colors.primaryContainer, borderWidth: 2, borderColor: colors.parchment, alignItems: 'center', justifyContent: 'center', ...shadows.surface },
  assetCode: { alignSelf: 'center', paddingHorizontal: spacing.spaceMd, paddingVertical: 5, borderRadius: radius.full, backgroundColor: colors.honeyChip },
  assetCodeText: { ...typography.labelSm, color: colors.secondary, flexShrink: 1, textAlign: 'center' },
  assetName: { ...typography.headlineMd, color: colors.onSurface, textAlign: 'center', flexShrink: 1 },
  uuidRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.spaceXs, minWidth: 0 },
  uuid: { ...typography.labelSm, color: colors.onSurfaceVariant, textAlign: 'center', flexShrink: 1 },
  sectionCard: { gap: spacing.spaceMd, backgroundColor: colors.surfaceContainerLowest },
  locationCard: { backgroundColor: colors.surfaceContainerLowest },
  historyCard: { backgroundColor: colors.surfaceContainerLowest },
  sectionHeading: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.spaceSm, paddingBottom: spacing.spaceSm, borderBottomWidth: 1, borderBottomColor: colors.surfaceVariant },
  sectionHeadingCopy: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: spacing.spaceSm },
  sectionTitle: { ...typography.labelLg, color: colors.deepAmber, flexShrink: 1 },
  actionText: { ...typography.labelSm, color: colors.deepAmber, flexShrink: 1, textAlign: 'center' },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.spaceSm },
  infoIcon: { width: 24, height: 24, borderRadius: radius.sm, backgroundColor: colors.honeyChip, alignItems: 'center', justifyContent: 'center' },
  infoCopy: { flex: 1, minWidth: 0 },
  metaLabel: { ...typography.labelSm, color: colors.onSurfaceVariant },
  infoValue: { ...typography.bodyMd, color: colors.onSurface, marginTop: 2, flexShrink: 1 },
  successValue: { color: colors.statusSuccessStrong },
  ownerAndUse: { flexDirection: 'row', gap: spacing.spaceSm, flexWrap: 'wrap' },
  owner: { flex: 1, minWidth: 145, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.spaceSm },
  ownerCard: { padding: spacing.spaceSm, borderRadius: radius.default, borderWidth: 1, borderColor: colors.borderAmberGlow, backgroundColor: colors.surfaceContainerLowest },
  ownerCopy: { flex: 1, minWidth: 0 },
  metaValue: { ...typography.bodyMd, color: colors.onSurface, marginTop: 3, flexShrink: 1 },
  metaSub: { ...typography.bodySm, color: colors.onSurfaceVariant, marginTop: 2, flexShrink: 1 },
  depreciation: { ...typography.labelSm, color: colors.statusSuccessStrong },
  maintenance: { padding: spacing.spaceMd, borderRadius: radius.lg, backgroundColor: colors.parchment, borderWidth: 1, borderColor: colors.outlineVariant, gap: spacing.spaceSm },
  maintenanceHead: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.spaceSm, flexWrap: 'wrap' },
  maintenanceTitle: { ...typography.labelLg, color: colors.onSurface, flexShrink: 1 },
  maintenanceSync: { ...typography.bodySm, color: colors.onSurfaceVariant, flexShrink: 1 },
  historyAction: { minHeight: 40, marginTop: spacing.spaceXs, paddingHorizontal: spacing.spaceSm, borderRadius: radius.default, borderWidth: 1, borderColor: colors.outlineVariant, backgroundColor: colors.surfaceContainerLowest, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.spaceSm },
  historyActionText: { ...typography.labelMd, color: colors.primary, flex: 1 },
  timeline: { flexDirection: 'row', gap: spacing.spaceSm },
  timelineLine: { width: 2, borderRadius: radius.full },
  timelineCopy: { flex: 1, gap: 4 },
  timelineHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.spaceSm, flexWrap: 'wrap' },
  timelineTitleRow: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.spaceXs },
  timelineTitle: { ...typography.bodySm, color: colors.onSurface, flex: 1, minWidth: 0, flexShrink: 1 },
  timelineBadge: { flexShrink: 0, maxWidth: '100%' },
  timelineDetail: { ...typography.bodySm, color: colors.onSurfaceVariant, flexShrink: 1 },
  log: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.spaceSm, padding: spacing.spaceMd, borderRadius: radius.lg, backgroundColor: colors.parchmentWarm, borderWidth: 1, borderColor: colors.secondaryContainer },
  logCopy: { flex: 1, minWidth: 0 },
  logTitle: { ...typography.labelLg, color: colors.deepAmber, flexShrink: 1 },
  logText: { ...typography.bodySm, color: colors.onSurfaceVariant, marginTop: 3, flexShrink: 1 },
  logStrong: { color: colors.deepAmber, fontWeight: '700' },
  operationsHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.spaceXs, paddingHorizontal: spacing.spaceXs, paddingTop: spacing.spaceXs },
  operationsTitle: { ...typography.headlineSm, fontSize: 17, lineHeight: 23, color: colors.deepAmberStrong, flexShrink: 1 },
  operations: { flexDirection: 'row', gap: spacing.spaceSm, alignItems: 'stretch', flexWrap: 'wrap' },
  operationCard: { flex: 1, minWidth: 145, gap: spacing.spaceSm, backgroundColor: colors.surfaceContainerLowest, borderColor: colors.borderAmberGlow },
  operationName: { ...typography.bodyMd, color: colors.onSurface, fontWeight: '700', flexShrink: 1 },
  operationPill: { ...typography.labelSm, color: colors.deepAmber },
  actionMatrix: { gap: spacing.spaceSm, paddingTop: spacing.spaceXs, borderTopWidth: 1, borderTopColor: colors.outlineVariant },
  actionSectionTitle: { ...typography.labelLg, color: colors.deepAmber },
  noActionText: { ...typography.bodySm, color: colors.onSurfaceVariant, padding: spacing.spaceSm, borderRadius: radius.default, backgroundColor: colors.surfaceContainerLow },
  actionRow: { flexDirection: 'row', gap: spacing.spaceSm },
  primaryOperationAction: { flex: 1, minWidth: 0, minHeight: 44, paddingHorizontal: spacing.spaceSm, paddingVertical: spacing.spaceSm, borderRadius: radius.default, backgroundColor: colors.primaryContainer, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.spaceXs, shadowColor: colors.deepAmber, shadowOpacity: 0.12, shadowRadius: 6, elevation: 2 },
  secondaryOperationAction: { flex: 1, minWidth: 0, minHeight: 44, paddingHorizontal: spacing.spaceSm, paddingVertical: spacing.spaceSm, borderRadius: radius.default, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.outlineVariant, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.spaceXs },
  tertiaryOperationAction: { flex: 1, minWidth: 0, minHeight: 40, paddingHorizontal: spacing.spaceSm, paddingVertical: spacing.spaceSm, borderRadius: radius.default, backgroundColor: colors.surfaceContainerLow, borderWidth: 1, borderColor: colors.outlineVariant, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.spaceXs },
  nextScanAction: { flex: 1, minWidth: 0, minHeight: 40, paddingHorizontal: spacing.spaceSm, paddingVertical: spacing.spaceSm, borderRadius: radius.default, backgroundColor: colors.statusSuccessSurface, borderWidth: 1, borderColor: colors.statusSuccessBorder, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.spaceXs },
  primaryOperationText: { ...typography.labelSm, color: colors.onPrimary, textAlign: 'center', flexShrink: 1 },
  secondaryOperationText: { ...typography.labelSm, color: colors.onSurface, textAlign: 'center', flexShrink: 1 },
  tertiaryOperationText: { ...typography.labelSm, color: colors.onSurfaceVariant, textAlign: 'center', flexShrink: 1 },
  nextScanText: { ...typography.labelSm, color: colors.statusSuccessStrong, textAlign: 'center', flexShrink: 1 },
  ledger: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.spaceXs, borderWidth: 1, borderColor: colors.outlineVariant, borderRadius: radius.full, paddingVertical: spacing.spaceSm, paddingHorizontal: spacing.spaceMd },
  ledgerText: { ...typography.bodySm, color: colors.onSurfaceVariant, textAlign: 'center', flexShrink: 1 },
});

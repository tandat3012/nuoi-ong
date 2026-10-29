import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppShell, Card, Icon, PageHeader, Pill, PrimaryButton } from '@/src/shared/ui/MobileShell';
import { colors, radius, spacing, typography } from '@/src/core/theme/tokens';
import NotificationBell from '@/src/features/notifications/presentation/NotificationBell';
import { useAuthContext } from '@/src/features/auth/context/AuthContext';
import { apiRequest, MobileApiError } from '@/src/shared/api/client';
import { formatQuantity } from '@/src/shared/format-quantity';

type InventoryQrResponse = {
  data: {
    balanceId: string;
    balance: {
      itemId: string;
      warehouseId: string;
      lotId: string | null;
      quantityOnHand: string;
    };
    itemCode: string;
    itemName: string;
    itemType: string;
    trackingMode: string;
    warehouseCode: string;
    warehouseName: string;
    lotNumber: string | null;
  };
};

export default function InventoryQrResultScreen() {
  const router = useRouter();
  const { balanceId } = useLocalSearchParams<{ balanceId?: string }>();
  const { data, currentFarmId, getAccessToken } = useAuthContext();
  const [result, setResult] = useState<InventoryQrResponse['data'] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const farmName = data?.memberships.find(({ farm }) => farm.id === currentFarmId)?.farm.name
    ?? (data?.memberships.length === 1 ? data.memberships[0]?.farm.name : undefined)
    ?? 'Chưa chọn trang trại';
  const hasPositiveBalance = Number(result?.balance.quantityOnHand) > 0;

  useEffect(() => {
    if (!currentFarmId || !balanceId) {
      setLoading(false);
      setError('Thiếu mã tồn kho hoặc chưa chọn trang trại.');
      return;
    }
    let cancelled = false;
    setLoading(true);
    void getAccessToken()
      .then((token) => {
        if (!token) throw new MobileApiError('Phiên đăng nhập đã hết hạn.', 401);
        return apiRequest<InventoryQrResponse>(`/inventory/${encodeURIComponent(balanceId)}/qr`, {
          token,
          params: { farmId: currentFarmId },
        });
      })
      .then((response) => {
        if (!cancelled) {
          setResult(response.data);
          setError(null);
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Không thể xác thực mã tồn kho.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [balanceId, currentFarmId, getAccessToken]);

  function startNewScan() {
    router.replace('/scan' as never);
  }

  return <AppShell active="scan">
    <PageHeader title={farmName} subtitle="● Kết quả QR tồn kho • Dữ liệu từ API" onBack={startNewScan} action={<View style={{ flexDirection: 'row', alignItems: 'center' }}><NotificationBell /><Pressable onPress={startNewScan} style={({ pressed }) => [styles.headerAction, pressed && styles.pressed]}><Icon name="qr-code-scanner" color={colors.primary} /></Pressable></View>} />
    {loading ? <Card style={styles.messageCard}><Icon name="sync" color={colors.primary} /><Text style={styles.message}>Đang xác thực mã tồn kho...</Text></Card> : error ? <Card style={styles.errorCard}><Icon name="error-outline" color={colors.error} /><View style={styles.copy}><Text style={styles.errorTitle}>QR tồn kho không hợp lệ</Text><Text style={styles.errorText}>{error}</Text></View><Pressable onPress={startNewScan} style={({ pressed }) => [styles.errorAction, pressed && styles.pressed]}><Text style={styles.errorActionText}>Quét lại</Text></Pressable></Card> : result ? <Card style={styles.successCard}><View style={styles.successIcon}><Icon name="check-circle" size={28} color={colors.statusSuccessStrong} /></View><View style={styles.copy}><Text style={styles.eyebrow}>KẾT QUẢ QUÉT QR</Text><Text style={styles.title}>Mã tồn kho hợp lệ</Text><Text style={styles.subtitle}>Dữ liệu đã được đối chiếu theo farm hiện tại.</Text></View><Pill tone="success"><Text style={styles.successLabel}>API OK</Text></Pill><Pressable onPress={startNewScan} style={({ pressed }) => [styles.successRescan, pressed && styles.pressed]}><Icon name="qr-code-scanner" size={15} color={colors.statusSuccessStrong} /><Text style={styles.successRescanText}>Quét lại</Text></Pressable></Card> : null}
    <View style={styles.tabs}><Pressable onPress={startNewScan} android_ripple={{ color: colors.primaryFixed }} style={({ pressed }) => [styles.tab, pressed && styles.pressed]}><Icon name="qr-code-scanner" size={17} color={colors.deepAmber} /><Text style={styles.tabText} numberOfLines={2}>Phase 1: Quét mã</Text></Pressable><View style={styles.activeTab}><Icon name="assignment" size={17} color={colors.onPrimary} /><Text style={styles.activeTabText} numberOfLines={2}>Phase 2: Kết quả</Text><Pill tone="cream"><Text style={styles.percent}>100%</Text></Pill></View></View>
    {result ? <>
      <Card style={styles.detailCard}><View style={styles.detailHeader}><View style={styles.iconBox}><Icon name={result.trackingMode === 'LOT' ? 'hive' : 'inventory-2'} size={28} color={colors.primary} /></View><View style={styles.copy}><Text style={styles.itemName}>{result.itemName}</Text><Text style={styles.itemCode}>{result.itemCode}</Text></View></View><Info label="Kho lưu trữ" value={`${result.warehouseCode} - ${result.warehouseName}`} /><Info label="Mã lô" value={result.lotNumber ?? 'Không theo lô'} /><Info label="Số lượng tồn" value={`${formatQuantity(result.balance.quantityOnHand)} ${result.itemType}`} strong /><Info label="Theo dõi" value={result.trackingMode} /></Card>
      <View style={styles.actions}>
        <PrimaryButton label="Mở chi tiết tồn kho" icon="inventory-2" onPress={() => router.push(`/inventory-detail?itemId=${encodeURIComponent(result.balance.itemId)}&warehouseId=${encodeURIComponent(result.balance.warehouseId)}${result.balance.lotId ? `&lotId=${encodeURIComponent(result.balance.lotId)}` : ''}` as never)} />
        <View style={styles.actionRow}>
          <Pressable onPress={() => router.push(`/receipts/new?type=receipt&itemId=${encodeURIComponent(result.balance.itemId)}&warehouseId=${encodeURIComponent(result.balance.warehouseId)}${result.balance.lotId ? `&lotId=${encodeURIComponent(result.balance.lotId)}` : ''}` as never)} style={({ pressed }) => [styles.operationAction, pressed && styles.pressed]}>
            <Icon name="input" color={colors.primary} /><Text style={styles.operationText}>Tạo phiếu nhập</Text>
          </Pressable>
          {hasPositiveBalance ? <Pressable onPress={() => router.push(`/receipts/new?type=issue&itemId=${encodeURIComponent(result.balance.itemId)}&warehouseId=${encodeURIComponent(result.balance.warehouseId)}${result.balance.lotId ? `&lotId=${encodeURIComponent(result.balance.lotId)}` : ''}` as never)} style={({ pressed }) => [styles.operationAction, pressed && styles.pressed]}>
            <Icon name="output" color={colors.primary} /><Text style={styles.operationText}>Tạo phiếu xuất</Text>
          </Pressable> : null}
        </View>
        {hasPositiveBalance && result?.trackingMode !== 'ASSET' ? <Pressable onPress={() => router.push(`/transfers/new?sourceWarehouseId=${encodeURIComponent(result.balance.warehouseId)}&itemId=${encodeURIComponent(result.balance.itemId)}${result.balance.lotId ? `&lotId=${encodeURIComponent(result.balance.lotId)}` : ''}` as never)} style={({ pressed }) => [styles.operationAction, pressed && styles.pressed]}>
          <Icon name="swap-horiz" color={colors.primary} /><Text style={styles.operationText}>Tạo phiếu điều chuyển</Text>
        </Pressable> : null}
        <Pressable onPress={startNewScan} style={({ pressed }) => [styles.secondaryAction, pressed && styles.pressed]}><Icon name="qr-code-scanner" color={colors.deepAmber} /><Text style={styles.secondaryText}>Quét mã tiếp theo</Text></Pressable>
      </View>
    </> : null}
  </AppShell>;
}

function Info({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return <View style={styles.infoRow}><Text style={styles.infoLabel}>{label}</Text><Text style={[styles.infoValue, strong && styles.infoStrong]}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.82, transform: [{ scale: 0.98 }] },
  headerAction: { width: 36, height: 36, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  messageCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.spaceSm },
  message: { ...typography.bodyMd, color: colors.onSurfaceVariant, flex: 1 },
  errorCard: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.spaceSm, backgroundColor: colors.errorContainer, borderColor: colors.error },
  copy: { flex: 1, minWidth: 0, gap: 3 },
  errorTitle: { ...typography.labelLg, color: colors.error },
  errorText: { ...typography.bodySm, color: colors.error, flexShrink: 1 },
  errorAction: { minHeight: 36, paddingHorizontal: spacing.spaceSm, borderRadius: radius.full, borderWidth: 1, borderColor: colors.error, alignItems: 'center', justifyContent: 'center' },
  errorActionText: { ...typography.labelSm, color: colors.error },
  successRescan: { minHeight: 36, marginLeft: 'auto', paddingHorizontal: spacing.spaceSm, borderRadius: radius.full, borderWidth: 1, borderColor: colors.statusSuccessBorder, flexDirection: 'row', alignItems: 'center', gap: 4 },
  successRescanText: { ...typography.labelSm, color: colors.statusSuccessStrong },
  successCard: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.spaceSm, backgroundColor: colors.statusSuccessSurface, borderColor: colors.statusSuccessBorder },
  successIcon: { width: 42, height: 42, borderRadius: radius.full, backgroundColor: colors.statusSuccessBorder, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { ...typography.labelSm, color: colors.statusSuccessStrong },
  title: { ...typography.headlineSm, color: colors.deepAmber },
  subtitle: { ...typography.bodySm, color: colors.statusSuccessStrong },
  successLabel: { ...typography.labelSm, color: colors.statusSuccessStrong },
  detailCard: { gap: spacing.spaceSm },
  tabs: { minHeight: 52, padding: 3, borderRadius: radius.full, backgroundColor: colors.surfaceContainer, borderWidth: 1, borderColor: colors.outlineVariant, flexDirection: 'row', gap: 2 },
  tab: { flex: 1, minWidth: 0, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: spacing.spaceXs, paddingHorizontal: spacing.spaceXs },
  activeTab: { flex: 1.25, minWidth: 0, borderRadius: radius.full, backgroundColor: colors.primaryContainer, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: spacing.spaceXs, paddingHorizontal: spacing.spaceXs, shadowColor: colors.deepAmber, shadowOpacity: 0.14, shadowRadius: 8, elevation: 2 },
  tabText: { ...typography.bodySm, fontSize: 11, lineHeight: 16, color: colors.deepAmber, flexShrink: 1, textAlign: 'center' },
  activeTabText: { ...typography.labelLg, fontSize: 11, lineHeight: 16, color: colors.onPrimary, flexShrink: 1, textAlign: 'center' },
  percent: { ...typography.labelSm, color: colors.deepAmber },
  detailHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.spaceMd, paddingBottom: spacing.spaceSm, borderBottomWidth: 1, borderBottomColor: colors.outlineVariant },
  iconBox: { width: 58, height: 58, borderRadius: radius.default, backgroundColor: colors.honeyChip, alignItems: 'center', justifyContent: 'center' },
  itemName: { ...typography.headlineMd, color: colors.deepAmber },
  itemCode: { ...typography.bodySm, color: colors.onSurfaceVariant },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.spaceMd, paddingVertical: spacing.spaceSm, borderBottomWidth: 1, borderBottomColor: colors.outlineVariant },
  infoLabel: { ...typography.bodySm, color: colors.onSurfaceVariant, flex: 1 },
  infoValue: { ...typography.labelMd, color: colors.onSurface, flex: 1, textAlign: 'right' },
  infoStrong: { color: colors.primary, fontSize: 17 },
  actions: { gap: spacing.spaceSm },
  actionRow: { flexDirection: 'row', gap: spacing.spaceSm },
  operationAction: { flex: 1, minHeight: 48, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.outlineVariant, backgroundColor: colors.surfaceContainerLow, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.spaceXs, paddingHorizontal: spacing.spaceXs },
  operationText: { ...typography.labelMd, color: colors.deepAmber, textAlign: 'center', flexShrink: 1 },
  secondaryAction: { minHeight: 48, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.outlineVariant, backgroundColor: colors.parchment, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.spaceSm },
  secondaryText: { ...typography.labelLg, color: colors.deepAmber },
});

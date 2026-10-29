import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppShell, Card, Icon, PageHeader, Pill, PrimaryButton } from '@/src/shared/ui/MobileShell';
import { colors, radius, spacing, typography } from '@/src/core/theme/tokens';
import NotificationBell from '@/src/features/notifications/presentation/NotificationBell';
import { useAuthContext } from '@/src/features/auth/context/AuthContext';
import { apiRequest, MobileApiError } from '@/src/shared/api/client';
import { balanceMatchesTrackingMode, filterAvailableAssetsForScope, filterPositiveBalancesForScope, listAvailableAssets, listBalances, listItems } from '@/src/features/inventory/api';

type ItemQrResponse = { data: { itemId: string; itemCode: string; itemName: string; qrUrl: string; format: string } };

export default function ItemQrResultScreen() {
  const router = useRouter();
  const { itemId, warehouseId } = useLocalSearchParams<{ itemId?: string; warehouseId?: string }>();
  const { data, currentFarmId, getAccessToken } = useAuthContext();
  const [result, setResult] = useState<ItemQrResponse['data'] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasPositiveStockInScope, setHasPositiveStockInScope] = useState(false);
  const [isAsset, setIsAsset] = useState(false);
  const farmName = data?.memberships.find(({ farm }) => farm.id === currentFarmId)?.farm.name
    ?? (data?.memberships.length === 1 ? data.memberships[0]?.farm.name : undefined)
    ?? 'Chưa chọn trang trại';

  useEffect(() => {
    if (!currentFarmId || !itemId) {
      setResult(null);
      setHasPositiveStockInScope(false);
      setLoading(false);
      setError('Thiếu mã vật tư hoặc chưa chọn trang trại.');
      return;
    }
    let cancelled = false;
    setLoading(true);
    setResult(null);
    setHasPositiveStockInScope(false);
    setError(null);
    void getAccessToken()
      .then((token) => {
        if (!token) throw new MobileApiError('Phiên đăng nhập đã hết hạn.', 401);
        return apiRequest<ItemQrResponse>(`/items/${encodeURIComponent(itemId)}/qr`, {
          token,
          params: { farmId: currentFarmId },
        }).then(async (qrResponse) => {
          if (!warehouseId) return { qrResponse, hasPositiveStock: false };
          const [balanceResponse, itemResponse] = await Promise.all([
            listBalances(token, currentFarmId, warehouseId, true, true),
            listItems(token, currentFarmId),
          ]);
          const item = itemResponse.data.find((entry) => entry.id === itemId && entry.farmId === currentFarmId);
          if (!item) return { qrResponse, hasPositiveStock: false };
          if (item.trackingMode === 'ASSET') {
            const availableAssets = await listAvailableAssets(token, currentFarmId, warehouseId);
            return {
              qrResponse,
              isAsset: true,
              hasPositiveStock: filterAvailableAssetsForScope(availableAssets, currentFarmId, warehouseId)
                .some(({ asset }) => asset.itemId === itemId),
            };
          }
          return {
            qrResponse,
            hasPositiveStock: filterPositiveBalancesForScope(balanceResponse.data, currentFarmId, warehouseId)
              .some(({ balance, trackingMode }) => balance.itemId === itemId
                && balanceMatchesTrackingMode(balance, item.trackingMode)
                && trackingMode === item.trackingMode),
          };
        });
      })
      .then(({ qrResponse, hasPositiveStock, isAsset }) => {
        if (!cancelled) {
          setResult(qrResponse.data);
          setIsAsset(Boolean(isAsset));
          setHasPositiveStockInScope(hasPositiveStock);
          setError(null);
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Không thể xác thực mã vật tư.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [currentFarmId, getAccessToken, itemId, warehouseId]);

  function startNewScan() {
    router.replace('/scan' as never);
  }

  return <AppShell active="scan">
    <PageHeader title={farmName} subtitle="● Kết quả QR vật tư • Dữ liệu từ API" onBack={startNewScan} action={<View style={{ flexDirection: 'row', alignItems: 'center' }}><NotificationBell /><Pressable onPress={startNewScan} style={({ pressed }) => [styles.headerAction, pressed && styles.pressed]}><Icon name="qr-code-scanner" color={colors.primary} /></Pressable></View>} />
    {loading ? <Card style={styles.messageCard}><Icon name="sync" color={colors.primary} /><Text style={styles.message}>Đang xác thực mã vật tư...</Text></Card> : error ? <Card style={styles.errorCard}><Icon name="error-outline" color={colors.error} /><View style={styles.copy}><Text style={styles.errorTitle}>QR vật tư không hợp lệ</Text><Text style={styles.errorText}>{error}</Text></View><Pressable onPress={startNewScan} style={({ pressed }) => [styles.errorAction, pressed && styles.pressed]}><Text style={styles.errorActionText}>Quét lại</Text></Pressable></Card> : result ? <>
      <Card style={styles.successCard}><View style={styles.successIcon}><Icon name="check-circle" size={28} color={colors.statusSuccessStrong} /></View><View style={styles.copy}><Text style={styles.eyebrow}>KẾT QUẢ QUÉT QR</Text><Text style={styles.title}>Mã vật tư hợp lệ</Text><Text style={styles.subtitle}>Đây là mã của danh mục vật tư, không gắn riêng với kho hoặc lô.</Text></View><Pill tone="success"><Text style={styles.successLabel}>API OK</Text></Pill></Card>
      <Card style={styles.detailCard}><View style={styles.iconBox}><Icon name="inventory-2" size={32} color={colors.primary} /></View><Text style={styles.itemName}>{result.itemName}</Text><View style={styles.codeBox}><Text style={styles.codeLabel}>Mã vật tư</Text><Text style={styles.codeValue}>{result.itemCode}</Text></View><Info label="Loại mã" value="ITEM MASTER" /><Info label="QR URL" value={result.qrUrl} /></Card>
      <View style={styles.actions}>
        <PrimaryButton label="Mở tồn kho vật tư" icon="inventory-2" onPress={() => router.push(`/inventory-detail?itemId=${encodeURIComponent(result.itemId)}${warehouseId ? `&warehouseId=${encodeURIComponent(warehouseId)}` : ''}` as never)} />
        <View style={styles.actionRow}>
          <Pressable onPress={() => router.push(`/receipts/new?type=receipt&itemId=${encodeURIComponent(result.itemId)}${warehouseId ? `&warehouseId=${encodeURIComponent(warehouseId)}` : ''}` as never)} style={({ pressed }) => [styles.operationAction, pressed && styles.pressed]}>
            <Icon name="input" color={colors.primary} /><Text style={styles.operationText}>Tạo phiếu nhập</Text>
          </Pressable>
          {hasPositiveStockInScope ? <Pressable onPress={() => router.push(`/receipts/new?type=issue&itemId=${encodeURIComponent(result.itemId)}&warehouseId=${encodeURIComponent(warehouseId!)}` as never)} style={({ pressed }) => [styles.operationAction, pressed && styles.pressed]}>
            <Icon name="output" color={colors.primary} /><Text style={styles.operationText}>Tạo phiếu xuất</Text>
          </Pressable> : null}
        </View>
        {hasPositiveStockInScope && warehouseId && !isAsset ? <Pressable onPress={() => router.push(`/transfers/new?itemId=${encodeURIComponent(result.itemId)}&sourceWarehouseId=${encodeURIComponent(warehouseId)}` as never)} style={({ pressed }) => [styles.operationAction, pressed && styles.pressed]}>
          <Icon name="swap-horiz" color={colors.primary} /><Text style={styles.operationText}>Tạo phiếu điều chuyển</Text>
        </Pressable> : null}
        {warehouseId && !hasPositiveStockInScope ? <Text style={styles.noStockNotice}>Kho đang chọn chưa có tồn dương của vật tư này; chỉ có thể tạo phiếu nhập.</Text> : null}
        <Pressable onPress={startNewScan} style={({ pressed }) => [styles.secondaryAction, pressed && styles.pressed]}><Icon name="qr-code-scanner" color={colors.deepAmber} /><Text style={styles.secondaryText}>Quét mã tiếp theo</Text></Pressable>
      </View>
    </> : null}
  </AppShell>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <View style={styles.infoRow}><Text style={styles.infoLabel}>{label}</Text><Text style={styles.infoValue}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.82, transform: [{ scale: 0.98 }] },
  headerAction: { width: 36, height: 36, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  messageCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.spaceSm },
  message: { ...typography.bodyMd, color: colors.onSurfaceVariant, flex: 1 },
  errorCard: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.spaceSm, backgroundColor: colors.errorContainer, borderColor: colors.error },
  copy: { flex: 1, minWidth: 0, gap: 3 },
  errorTitle: { ...typography.labelLg, color: colors.error },
  errorText: { ...typography.bodySm, color: colors.error },
  errorAction: { minHeight: 36, paddingHorizontal: spacing.spaceSm, borderRadius: radius.full, borderWidth: 1, borderColor: colors.error, alignItems: 'center', justifyContent: 'center' },
  errorActionText: { ...typography.labelSm, color: colors.error },
  successCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.spaceSm, backgroundColor: colors.statusSuccessSurface, borderColor: colors.statusSuccessBorder },
  successIcon: { width: 42, height: 42, borderRadius: radius.full, backgroundColor: colors.statusSuccessBorder, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { ...typography.labelSm, color: colors.statusSuccessStrong },
  title: { ...typography.headlineSm, color: colors.deepAmber },
  subtitle: { ...typography.bodySm, color: colors.statusSuccessStrong },
  successLabel: { ...typography.labelSm, color: colors.statusSuccessStrong },
  detailCard: { gap: spacing.spaceSm },
  iconBox: { width: 74, height: 74, borderRadius: radius.lg, backgroundColor: colors.honeyChip, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  itemName: { ...typography.headlineMd, color: colors.deepAmber, textAlign: 'center' },
  codeBox: { minHeight: 40, paddingHorizontal: spacing.spaceMd, borderRadius: radius.default, backgroundColor: colors.surfaceContainerLow, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.spaceSm },
  codeLabel: { ...typography.bodySm, color: colors.onSurfaceVariant },
  codeValue: { ...typography.labelMd, color: colors.deepAmber, flex: 1, textAlign: 'right' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.spaceMd, paddingVertical: spacing.spaceSm, borderBottomWidth: 1, borderBottomColor: colors.outlineVariant },
  infoLabel: { ...typography.bodySm, color: colors.onSurfaceVariant, flex: 1 },
  infoValue: { ...typography.labelSm, color: colors.onSurface, flex: 1, textAlign: 'right' },
  actions: { gap: spacing.spaceSm },
  actionRow: { flexDirection: 'row', gap: spacing.spaceSm },
  operationAction: { flex: 1, minHeight: 48, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.outlineVariant, backgroundColor: colors.surfaceContainerLow, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.spaceXs, paddingHorizontal: spacing.spaceXs },
  operationText: { ...typography.labelMd, color: colors.deepAmber, textAlign: 'center', flexShrink: 1 },
  noStockNotice: { ...typography.bodySm, color: colors.onSurfaceVariant, textAlign: 'center', padding: spacing.spaceSm, borderRadius: radius.default, backgroundColor: colors.surfaceContainerLow },
  secondaryAction: { minHeight: 48, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.outlineVariant, backgroundColor: colors.parchment, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.spaceSm },
  secondaryText: { ...typography.labelLg, color: colors.deepAmber },
});

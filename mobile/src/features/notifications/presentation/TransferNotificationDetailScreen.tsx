import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '@/src/core/theme/tokens';
import { formatQuantity } from '@/src/shared/format-quantity';
import { useAuthContext } from '@/src/features/auth/context/AuthContext';
import { documentCodeLabel, listItems, listWarehouses, unwrap } from '@/src/features/inventory/api';
import { apiRequest, MobileApiError } from '@/src/shared/api/client';
import NotificationBell from './NotificationBell';
import { AppShell, Card, Icon, Pill, SectionTitle } from '@/src/shared/ui/MobileShell';

type TransferDetail = {
  transfer: { id: string; transferCode: string | null; status: string; fromWarehouseId: string; toWarehouseId: string; note?: string | null; rejectionReason?: string | null; createdAt?: string; transferDate?: string | null };
  items: { id: string; itemId: string; quantity: string; lotId?: string | null; assetId?: string | null; note?: string | null }[];
};

export default function TransferNotificationDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const { currentFarmId, getAccessToken } = useAuthContext();
  const [detail, setDetail] = useState<TransferDetail | null>(null);
  const [labels, setLabels] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentFarmId || !params.id) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    void getAccessToken().then((token) => {
      if (!token) throw new MobileApiError('Phiên đăng nhập đã hết hạn.', 401);
      return Promise.all([
        apiRequest<{ data: TransferDetail }>(`/stock-transfers/${encodeURIComponent(params.id!)}`, { token, params: { farmId: currentFarmId }, skipCache: true }),
        listWarehouses(token, currentFarmId),
        listItems(token, currentFarmId),
      ]);
    }).then(([response, warehouses, items]) => {
      if (cancelled) return;
      const transferDetail = unwrap(response);
      setDetail(transferDetail);
      const nextLabels = new Map<string, string>();
      warehouses.data.filter((row) => row.farmId === currentFarmId).forEach((row) => nextLabels.set(row.id, `${row.code} · ${row.name}`));
      items.data.filter((row) => row.farmId === currentFarmId).forEach((row) => nextLabels.set(row.id, `${row.code} · ${row.name}`));
      setLabels(nextLabels);
      setError(null);
    }).catch((cause: unknown) => { if (!cancelled) setError(cause instanceof Error ? cause.message : 'Không thể tải chi tiết phiếu chuyển kho.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [currentFarmId, getAccessToken, params.id]);

  const transfer = detail?.transfer;
  return <AppShell active="receipts">
    <View style={styles.top}><Pressable onPress={() => router.back()} style={styles.back}><Icon name="arrow-back" color={colors.primary} /></Pressable><View style={styles.titleCopy}><Text style={styles.eyebrow}>CHI TIẾT PHIẾU</Text><Text style={styles.title}>Chuyển kho</Text></View><NotificationBell /></View>
    {loading ? <Text style={styles.message}>Đang tải chi tiết phiếu...</Text> : error ? <Text style={styles.error}>{error}</Text> : transfer ? <>
      <Card style={styles.card}>
        <SectionTitle title="Thông tin phiếu" />
        <View style={styles.codeRow}><Text style={styles.code}>{documentCodeLabel(transfer.transferCode, transfer.id)}</Text><Pill tone={transfer.status === 'CONFIRMED' ? 'success' : transfer.status === 'REJECTED' ? 'danger' : 'amber'}><Text style={styles.status}>{transfer.status}</Text></Pill></View>
        <Text style={styles.label}>Thời gian</Text><Text style={styles.value}>{new Date(transfer.transferDate ?? transfer.createdAt ?? '').toLocaleString('vi-VN')}</Text>
      </Card>
      <Card style={styles.card}>
        <SectionTitle title="Lộ trình điều chuyển" />
        <Text style={styles.label}>Từ kho</Text><Text style={styles.value}>{labels.get(transfer.fromWarehouseId) ?? 'Kho không xác định'}</Text>
        <Text style={styles.label}>Đến kho</Text><Text style={styles.value}>{labels.get(transfer.toWarehouseId) ?? 'Kho không xác định'}</Text>
        {transfer.note ? <><Text style={styles.label}>Ghi chú</Text><Text style={styles.value}>{transfer.note}</Text></> : null}
        {transfer.rejectionReason ? <Text style={styles.rejection}>Lý do từ chối: {transfer.rejectionReason}</Text> : null}
      </Card>
      <Card style={styles.card}>
        <SectionTitle title="Vật tư chuyển" count={`${detail.items.length} mục`} />
        {detail.items.map((line) => <View key={line.id} style={styles.line}>
          <Text style={styles.value}>{labels.get(line.itemId) ?? 'Vật tư'}</Text>
          <Text style={styles.quantity}>Số lượng: {formatQuantity(line.quantity)}</Text>
          {line.lotId ? <Text style={styles.label}>Mã lô: {line.lotId}</Text> : null}
          {line.assetId ? <Text style={styles.label}>Asset ID: {line.assetId}</Text> : null}
        </View>)}
      </Card>
    </> : <Text style={styles.message}>Không tìm thấy phiếu chuyển kho.</Text>}
  </AppShell>;
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.spaceSm },
  back: { width: 40, height: 40, borderRadius: radius.full, backgroundColor: colors.surfaceContainer, alignItems: 'center', justifyContent: 'center' },
  titleCopy: { flex: 1 },
  eyebrow: { ...typography.labelSm, color: colors.secondary },
  title: { ...typography.headlineMd, color: colors.deepAmberStrong },
  card: { gap: spacing.spaceXs, backgroundColor: colors.parchmentWarm },
  codeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.spaceSm, marginBottom: spacing.spaceSm },
  code: { ...typography.labelLg, color: colors.primary },
  status: { ...typography.labelSm, color: colors.onSurfaceVariant },
  label: { ...typography.bodySm, color: colors.onSurfaceVariant, marginTop: spacing.spaceXs },
  value: { ...typography.labelLg, color: colors.onSurface },
  line: { gap: spacing.spaceXs, paddingVertical: spacing.spaceSm, borderBottomWidth: 1, borderBottomColor: colors.outlineVariant },
  quantity: { ...typography.bodyMd, color: colors.primary },
  message: { ...typography.bodyMd, color: colors.onSurfaceVariant, textAlign: 'center', paddingVertical: spacing.spaceLg },
  error: { ...typography.bodyMd, color: colors.error, paddingVertical: spacing.spaceLg },
  rejection: { ...typography.bodyMd, color: colors.error, marginTop: spacing.spaceSm },
});

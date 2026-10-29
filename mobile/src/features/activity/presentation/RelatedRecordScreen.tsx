import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, spacing, typography } from '@/src/core/theme/tokens';
import { useAuthContext } from '@/src/features/auth/context/AuthContext';
import { apiRequest, clearApiCache, MobileApiError } from '@/src/shared/api/client';
import { AppShell, Card, PageHeader } from '@/src/shared/ui/MobileShell';
import { entityLabel, normalizeEntity } from '../model';
import NotificationBell from '@/src/features/notifications/presentation/NotificationBell';
import { Snapshot } from './ActivityDetailScreen';

const endpoints: Record<string, string> = {
  STOCK_TRANSFER: 'stock-transfers', MAINTENANCE: 'maintenance-records',
  MAINTENANCE_RECORD: 'maintenance-records', ASSET: 'assets', ITEM: 'items',
};

export default function RelatedRecordScreen() {
  const { type, id } = useLocalSearchParams<{ type: string; id: string }>();
  const router = useRouter();
  const { data, currentFarmId, getAccessToken } = useAuthContext();
  const farm = data?.memberships.find((membership) => membership.farm.id === currentFarmId)?.farm;
  const [result, setResult] = useState<{ key: string; value: unknown } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadNonce, setReloadNonce] = useState(0);
  const key = `${currentFarmId}:${type}:${id}`;
  function reload() {
    clearApiCache();
    setReloadNonce((value) => value + 1);
  }
  useEffect(() => {
    let cancelled = false;
    setResult(null);
    setLoading(true);
    setError(null);
    void (async () => {
      if (!currentFarmId) throw new Error('Chọn trang trại để xem đối tượng.');
      const endpoint = endpoints[normalizeEntity(type ?? '')];
      if (!endpoint || !id) throw new Error('Không có màn hình cho đối tượng này.');
      const token = await getAccessToken();
      if (!token) throw new Error('Phiên đăng nhập đã hết hạn.');
      const response = await apiRequest<{ data: unknown }>(`/${endpoint}/${encodeURIComponent(id)}`, {
        token, params: { farmId: currentFarmId },
      });
      if (!cancelled) setResult({ key, value: response.data });
    })().catch((cause: unknown) => {
      if (!cancelled) setError(cause instanceof MobileApiError && cause.status === 404
        ? 'Đối tượng không còn tồn tại trong trại hiện tại. Bạn vẫn có thể xem snapshot trong lịch sử.'
        : cause instanceof Error ? cause.message : 'Không thể tải đối tượng.');
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [currentFarmId, getAccessToken, id, type, key, reloadNonce]);
  return <AppShell active="dashboard">
    <PageHeader title={farm?.name ?? 'Chưa chọn trang trại'} subtitle={`Chi tiết ${entityLabel(type ?? '').toLowerCase()}`} onBack={() => router.back()} action={<NotificationBell />} />
    {loading ? <Card><Text style={styles.body}>Đang tải chi tiết...</Text></Card> : error ? <Card><Text style={styles.error}>{error}</Text><Pressable accessibilityRole="button" onPress={reload} style={styles.retry}><Text style={styles.link}>Thử lại</Text></Pressable></Card> : result?.key === key ? <><Text style={styles.body}>Dữ liệu hiện tại của {entityLabel(type).toLowerCase()}, chỉ xem. Nội dung tại thời điểm thao tác nằm trong lịch sử.</Text><Snapshot title={entityLabel(type)} value={result.value} farm={farm} /></> : null}
  </AppShell>;
}
const styles = StyleSheet.create({
  body: { ...typography.bodyMd, color: colors.onSurfaceVariant },
  error: { ...typography.bodyMd, color: colors.error },
  retry: { paddingVertical: spacing.spaceSm },
  link: { ...typography.labelLg, color: colors.primary },
});

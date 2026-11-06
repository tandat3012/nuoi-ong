import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { useAuthContext } from '@/src/features/auth/context/AuthContext';
import NotificationBell from '@/src/features/notifications/presentation/NotificationBell';
import { type Paginated, type Warehouse } from '@/src/features/inventory/api';
import { apiRequest, clearApiCache, MobileApiError } from '@/src/shared/api/client';
import { OperationResultDialog } from '@/src/shared/ui/OperationResultDialog';
import { AppShell, Card, Icon, PageHeader, PrimaryButton } from '@/src/shared/ui/MobileShell';
import { colors, radius, spacing, typography } from '@/src/core/theme/tokens';

type Location = { id: string; warehouseId: string; code: string; name: string; status: string };
type AssetLookup = { data: {
  asset: { id: string; assetCode: string; status: string; currentLocationId: string | null };
  itemName: string;
  locationName: string | null;
  locationWarehouseId: string | null;
} };
type CreatedRequest = { data: { id: string } };

async function activeWarehouses(token: string, farmId: string) {
  const warehouses: Warehouse[] = [];
  let page = 1;
  let totalPages = 1;
  do {
    const response = await apiRequest<Paginated<Warehouse>>('/warehouses', {
      token, params: { farmId, status: 'ACTIVE', page, pageSize: 100 }, skipCache: true,
    });
    warehouses.push(...response.data.filter((row) => row.farmId === farmId && row.status === 'ACTIVE'));
    totalPages = response.page.totalPages;
    page += 1;
  } while (page <= totalPages);
  return warehouses;
}

async function activeLocations(token: string, farmId: string, warehouseId: string) {
  const locations: Location[] = [];
  let page = 1;
  let totalPages = 1;
  do {
    const response = await apiRequest<Paginated<Location>>('/locations', {
      token, params: { farmId, warehouseId, status: 'ACTIVE', page, pageSize: 100 }, skipCache: true,
    });
    locations.push(...response.data.filter((row) => row.warehouseId === warehouseId && row.status === 'ACTIVE'));
    totalPages = response.page.totalPages;
    page += 1;
  } while (page <= totalPages);
  return locations;
}

export default function AssetTransferRequestScreen() {
  const router = useRouter();
  const { assetCode } = useLocalSearchParams<{ assetCode?: string }>();
  const { data, currentFarmId, getAccessToken } = useAuthContext();
  const employee = data?.memberships.find(({ farm }) => farm.id === currentFarmId)?.roles.includes('EMPLOYEE') ?? false;
  const [asset, setAsset] = useState<AssetLookup['data'] | null>(null);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [warehouseId, setWarehouseId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [note, setNote] = useState('');
  const [picker, setPicker] = useState<'warehouse' | 'location' | null>(null);
  const [loading, setLoading] = useState(true);
  const [locationLoading, setLocationLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const submittingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    setAsset(null);
    setWarehouses([]);
    setWarehouseId('');
    setLocationId('');
    setLoading(true);
    setError(null);
    if (!currentFarmId || !assetCode || !employee) {
      setError('Cần chọn trang trại và đăng nhập với vai trò nhân viên.');
      setLoading(false);
      return;
    }
    void getAccessToken().then(async (token) => {
      if (!token) throw new MobileApiError('Phiên đăng nhập đã hết hạn.', 401);
      return Promise.all([
        apiRequest<AssetLookup>(`/assets/by-code/${encodeURIComponent(assetCode)}`, { token, params: { farmId: currentFarmId }, skipCache: true }),
        activeWarehouses(token, currentFarmId),
      ]);
    }).then(([assetResponse, warehouseRows]) => {
      if (cancelled) return;
      setAsset(assetResponse.data);
      setWarehouses(warehouseRows);
    }).catch((cause: unknown) => {
      if (!cancelled) setError(cause instanceof Error ? cause.message : 'Không thể tải tài sản và kho.');
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [assetCode, currentFarmId, employee, getAccessToken]);

  useEffect(() => {
    let cancelled = false;
    setLocations([]);
    setLocationId('');
    if (!currentFarmId || !warehouseId) { setLocationLoading(false); return; }
    setLocationLoading(true);
    void getAccessToken().then((token) => {
      if (!token) throw new MobileApiError('Phiên đăng nhập đã hết hạn.', 401);
      return activeLocations(token, currentFarmId, warehouseId);
    }).then((rows) => { if (!cancelled) setLocations(rows); })
      .catch((cause: unknown) => { if (!cancelled) Alert.alert('Không thể tải vị trí', cause instanceof Error ? cause.message : 'Vui lòng thử lại.'); })
      .finally(() => { if (!cancelled) setLocationLoading(false); });
    return () => { cancelled = true; };
  }, [currentFarmId, getAccessToken, warehouseId]);

  const warehouse = warehouses.find((row) => row.id === warehouseId);
  const location = locations.find((row) => row.id === locationId);
  const available = employee && asset?.asset.status === 'AVAILABLE' && Boolean(asset.asset.currentLocationId) && Boolean(asset.locationWarehouseId);

  async function sendRequest() {
    if (submittingRef.current || !currentFarmId || !asset || !available) return;
    if (!warehouse || !location) { Alert.alert('Thiếu nơi nhận', 'Hãy chọn kho và vị trí đang hoạt động.'); return; }
    if (location.id === asset.asset.currentLocationId) { Alert.alert('Vị trí không hợp lệ', 'Tài sản đã ở vị trí này.'); return; }
    if (note.trim().length > 4000) { Alert.alert('Ghi chú quá dài', 'Ghi chú tối đa 4000 ký tự.'); return; }
    submittingRef.current = true;
    setSubmitting(true);
    try {
      const token = await getAccessToken();
      if (!token) throw new MobileApiError('Phiên đăng nhập đã hết hạn.', 401);
      const response = await apiRequest<CreatedRequest>('/asset-transfer-requests', {
        method: 'POST', token, params: { farmId: currentFarmId },
        body: { assetId: asset.asset.id, warehouseId: warehouse.id, locationId: location.id, note: note.trim() || undefined },
      });
      clearApiCache();
      setCreatedId(response.data.id);
    } catch (cause: unknown) {
      if (cause instanceof MobileApiError && cause.status === 409) {
        clearApiCache();
        Alert.alert('Dữ liệu đã thay đổi', 'Tài sản hoặc vị trí đích không còn hợp lệ. Quay lại chi tiết tài sản, tải mới và thử lại.');
      } else {
        Alert.alert('Không thể gửi yêu cầu', cause instanceof Error ? cause.message : 'Vui lòng thử lại.');
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  return <>
    <AppShell active="scan">
      <PageHeader title="Yêu cầu chuyển tài sản" subtitle="Nhân viên gửi, quản lý duyệt trên web" onBack={() => router.back()} action={<NotificationBell />} />
      {loading ? <Card><Text style={styles.muted}>Đang tải thông tin tài sản...</Text></Card> : error ? <Card><Text style={styles.error}>{error}</Text></Card> : asset ? <>
        <Card style={styles.card}>
          <Text style={styles.heading}>{asset.itemName}</Text>
          <Text style={styles.value}>Mã tài sản: {asset.asset.assetCode}</Text>
          <Text style={styles.muted}>Vị trí hiện tại: {asset.locationName ?? 'Chưa có vị trí'}</Text>
          <Text style={styles.muted}>Trạng thái: {asset.asset.status}</Text>
        </Card>
        {!available ? <Card><Text style={styles.error}>Chỉ tài sản đang khả dụng, có vị trí nguồn, mới gửi được yêu cầu chuyển.</Text></Card> : <>
          <Card style={styles.card}>
            <Text style={styles.heading}>Nơi nhận</Text>
            <Text style={styles.label}>Kho đích *</Text>
            <Pressable accessibilityRole="button" onPress={() => setPicker('warehouse')} style={styles.choice}><Text style={styles.value}>{warehouse ? `${warehouse.code} · ${warehouse.name}` : 'Chọn kho đích'}</Text><Icon name="expand-more" color={colors.primary} /></Pressable>
            <Text style={styles.label}>Vị trí đích *</Text>
            <Pressable accessibilityRole="button" onPress={() => { if (warehouseId && !locationLoading) setPicker('location'); }} style={styles.choice}><Text style={styles.value}>{location ? `${location.code} · ${location.name}` : locationLoading ? 'Đang tải vị trí...' : warehouseId ? 'Chọn vị trí đích' : 'Chọn kho trước'}</Text><Icon name="expand-more" color={colors.primary} /></Pressable>
            {warehouseId && !locationLoading && locations.length === 0 ? <Text style={styles.muted}>Kho này chưa có vị trí đang hoạt động.</Text> : null}
            <Text style={styles.label}>Ghi chú (không bắt buộc)</Text>
            <TextInput value={note} onChangeText={setNote} maxLength={4000} multiline placeholder="Lý do hoặc thông tin bàn giao" placeholderTextColor={colors.outline} style={styles.note} />
          </Card>
          <Card style={styles.notice}><Text style={styles.muted}>Sau khi gửi, tài sản ở trạng thái chờ chuyển. Vị trí và tồn kho chỉ thay đổi khi người có quyền duyệt yêu cầu trên web.</Text></Card>
          <PrimaryButton label={submitting ? 'Đang gửi...' : 'Gửi yêu cầu chuyển'} icon="send" loading={submitting} onPress={() => void sendRequest()} />
        </>}
      </> : null}
    </AppShell>
    <Modal visible={picker !== null} transparent animationType="slide" onRequestClose={() => setPicker(null)}>
      <View style={styles.backdrop}><View style={styles.sheet}>
        <View style={styles.sheetHeader}><Text style={styles.heading}>{picker === 'warehouse' ? 'Chọn kho đích' : 'Chọn vị trí đích'}</Text><Pressable accessibilityLabel="Đóng" onPress={() => setPicker(null)}><Icon name="close" color={colors.primary} /></Pressable></View>
        <ScrollView contentContainerStyle={styles.options}>
          {(picker === 'warehouse' ? warehouses : locations).map((row) => <Pressable key={row.id} accessibilityRole="button" onPress={() => { if (picker === 'warehouse') setWarehouseId(row.id); else setLocationId(row.id); setPicker(null); }} style={styles.option}><Text style={styles.value}>{row.code} · {row.name}</Text></Pressable>)}
          {(picker === 'warehouse' ? warehouses : locations).length === 0 ? <Text style={styles.muted}>Không có lựa chọn đang hoạt động.</Text> : null}
        </ScrollView>
      </View></View>
    </Modal>
    <OperationResultDialog
      visible={Boolean(createdId)}
      title="Đã gửi yêu cầu chuyển tài sản"
      details={[
        { label: 'Mã yêu cầu', value: createdId ? `#${createdId.slice(0, 8)}` : '—' },
        { label: 'Mã tài sản', value: assetCode || '—' },
        { label: 'Kho đích', value: warehouses.find((w) => w.id === warehouseId)?.name ?? '—' },
        { label: 'Vị trí đích', value: locations.find((l) => l.id === locationId)?.name ?? '—' },
      ]}
      actionLabel="Xem yêu cầu"
      onAction={() => {
        if (createdId) router.replace(`/assets/transfer-requests/${encodeURIComponent(createdId)}` as never);
      }}
    />
  </>;
}

const styles = StyleSheet.create({
  card: { gap: spacing.spaceSm, backgroundColor: colors.surfaceContainerLowest },
  heading: { ...typography.headlineSm, color: colors.deepAmberStrong },
  label: { ...typography.labelMd, color: colors.onSurfaceVariant },
  value: { ...typography.bodyMd, color: colors.onSurface, flex: 1 },
  muted: { ...typography.bodySm, color: colors.onSurfaceVariant },
  error: { ...typography.bodyMd, color: colors.error },
  choice: { minHeight: 48, borderWidth: 1, borderColor: colors.outlineVariant, borderRadius: radius.default, paddingHorizontal: spacing.spaceMd, flexDirection: 'row', alignItems: 'center', gap: spacing.spaceSm, backgroundColor: colors.surfaceContainerLow },
  note: { minHeight: 90, textAlignVertical: 'top', borderWidth: 1, borderColor: colors.outlineVariant, borderRadius: radius.default, padding: spacing.spaceMd, backgroundColor: colors.surfaceContainerLow, color: colors.onSurface, ...typography.bodyMd },
  notice: { backgroundColor: colors.parchmentWarm },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.modalOverlay },
  sheet: { maxHeight: '75%', backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.spaceLg, gap: spacing.spaceMd },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  options: { gap: spacing.spaceSm, paddingBottom: spacing.spaceLg },
  option: { minHeight: 48, padding: spacing.spaceMd, borderRadius: radius.default, backgroundColor: colors.surfaceContainerLow },
});

import { useLocalSearchParams, useRouter } from 'expo-router';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuthContext } from '@/src/features/auth/context/AuthContext';
import NotificationBell from '@/src/features/notifications/presentation/NotificationBell';
import { listLocationsPage, listWarehouses, type Warehouse, type WarehouseLocation } from '@/src/features/inventory/api';
import { apiRequest, clearApiCache, isAbortError, MobileApiError } from '@/src/shared/api/client';
import { OperationResultDialog } from '@/src/shared/ui/OperationResultDialog';
import { AppShell, Card, Icon, PageHeader, PrimaryButton } from '@/src/shared/ui/MobileShell';
import { colors, radius, spacing, typography } from '@/src/core/theme/tokens';

type Location = WarehouseLocation;
type AssetLookup = { data: {
  asset: { id: string; assetCode: string; status: string; currentLocationId: string | null };
  itemName: string;
  locationName: string | null;
  locationWarehouseId: string | null;
} };
type CreatedRequest = { data: { id: string } };

const LOCATION_PAGE_SIZE = 20;

const PickerOptionRow = memo(function PickerOptionRow({
  code,
  name,
  selected,
  onPress,
}: {
  code: string;
  name: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[styles.option, selected && styles.optionActive]}>
      <Text style={styles.value}>{code} · {name}</Text>
      {selected ? <Icon name="check-circle" size={18} color={colors.primary} /> : null}
    </Pressable>
  );
});

export default function AssetTransferRequestScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { assetCode } = useLocalSearchParams<{ assetCode?: string }>();
  const { data, currentFarmId, getAccessToken } = useAuthContext();
  const employee = data?.memberships.find(({ farm }) => farm.id === currentFarmId)?.roles.includes('EMPLOYEE') ?? false;
  const [asset, setAsset] = useState<AssetLookup['data'] | null>(null);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [warehouseId, setWarehouseId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [note, setNote] = useState('');
  const [picker, setPicker] = useState<'warehouse' | 'location' | null>(null);
  const [locationSearch, setLocationSearch] = useState('');
  const [debouncedLocationSearch, setDebouncedLocationSearch] = useState('');
  const [locationPage, setLocationPage] = useState(1);
  const [locationTotalPages, setLocationTotalPages] = useState(0);
  const [locationTotalItems, setLocationTotalItems] = useState(0);
  const [loading, setLoading] = useState(true);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationLoadingMore, setLocationLoadingMore] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locationReloadNonce, setLocationReloadNonce] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const submittingRef = useRef(false);
  const loadMoreLocationControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setAsset(null);
    setWarehouses([]);
    setWarehouseId('');
    setLocationId('');
    setSelectedLocation(null);
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
        apiRequest<AssetLookup>(`/assets/by-code/${encodeURIComponent(assetCode)}`, {
          token,
          params: { farmId: currentFarmId },
          skipCache: true,
          signal: controller.signal,
        }),
        listWarehouses(token, currentFarmId, true, controller.signal),
      ]);
    }).then(([assetResponse, warehouseResponse]) => {
      if (controller.signal.aborted) return;
      setAsset(assetResponse.data);
      setWarehouses(warehouseResponse.data.filter((row) => row.farmId === currentFarmId && row.status === 'ACTIVE'));
    }).catch((cause: unknown) => {
      if (isAbortError(cause) || controller.signal.aborted) return;
      setError(cause instanceof Error ? cause.message : 'Không thể tải tài sản và kho.');
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [assetCode, currentFarmId, employee, getAccessToken]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedLocationSearch(locationSearch.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [locationSearch]);

  useEffect(() => {
    loadMoreLocationControllerRef.current?.abort();
    setLocations([]);
    setLocationPage(1);
    setLocationTotalPages(0);
    setLocationTotalItems(0);
    setLocationError(null);
    if (!currentFarmId || !warehouseId) {
      setLocationLoading(false);
      return;
    }
    const controller = new AbortController();
    setLocationLoading(true);
    void getAccessToken().then((token) => {
      if (!token) throw new MobileApiError('Phiên đăng nhập đã hết hạn.', 401);
      return listLocationsPage(
        token,
        currentFarmId,
        {
          warehouseId,
          status: 'ACTIVE',
          search: debouncedLocationSearch,
          page: 1,
          pageSize: LOCATION_PAGE_SIZE,
          skipCache: true,
        },
        controller.signal,
      );
    }).then((response) => {
      if (controller.signal.aborted) return;
      setLocations(response.data.filter((row) => row.warehouseId === warehouseId && row.status === 'ACTIVE'));
      setLocationPage(response.page.number);
      setLocationTotalPages(response.page.totalPages);
      setLocationTotalItems(response.page.totalItems);
    }).catch((cause: unknown) => {
      if (isAbortError(cause) || controller.signal.aborted) return;
      const msg = cause instanceof Error ? cause.message : 'Vui lòng thử lại.';
      setLocationError(msg);
      if (!debouncedLocationSearch) {
        Alert.alert('Không thể tải vị trí', msg);
      }
    }).finally(() => {
      if (!controller.signal.aborted) setLocationLoading(false);
    });
    return () => {
      controller.abort();
      loadMoreLocationControllerRef.current?.abort();
    };
  }, [currentFarmId, debouncedLocationSearch, getAccessToken, locationReloadNonce, warehouseId]);

  const loadMoreLocations = useCallback(async () => {
    if (!currentFarmId || !warehouseId || locationLoading || locationLoadingMore || locationPage >= locationTotalPages) return;
    loadMoreLocationControllerRef.current?.abort();
    const controller = new AbortController();
    loadMoreLocationControllerRef.current = controller;
    setLocationLoadingMore(true);
    try {
      const token = await getAccessToken();
      if (!token) throw new MobileApiError('Phiên đăng nhập đã hết hạn.', 401);
      const response = await listLocationsPage(
        token,
        currentFarmId,
        {
          warehouseId,
          status: 'ACTIVE',
          search: debouncedLocationSearch,
          page: locationPage + 1,
          pageSize: LOCATION_PAGE_SIZE,
          skipCache: true,
        },
        controller.signal,
      );
      if (controller.signal.aborted) return;
      const incoming = response.data.filter((row) => row.warehouseId === warehouseId && row.status === 'ACTIVE');
      setLocations((prev) => {
        const seen = new Set(prev.map((row) => row.id));
        const next = [...prev];
        for (const row of incoming) {
          if (!seen.has(row.id)) next.push(row);
        }
        return next;
      });
      setLocationPage(response.page.number);
      setLocationTotalPages(response.page.totalPages);
      setLocationTotalItems(response.page.totalItems);
    } catch (cause: unknown) {
      if (!isAbortError(cause) && !controller.signal.aborted) {
        Alert.alert('Không thể tải thêm vị trí', cause instanceof Error ? cause.message : 'Vui lòng thử lại.');
      }
    } finally {
      if (!controller.signal.aborted) setLocationLoadingMore(false);
    }
  }, [currentFarmId, debouncedLocationSearch, getAccessToken, locationLoading, locationLoadingMore, locationPage, locationTotalPages, warehouseId]);

  const warehouse = warehouses.find((row) => row.id === warehouseId);
  const location = selectedLocation?.id === locationId ? selectedLocation : locations.find((row) => row.id === locationId);
  const available = employee && asset?.asset.status === 'AVAILABLE' && Boolean(asset.asset.currentLocationId) && Boolean(asset.locationWarehouseId);

  function selectWarehouse(id: string) {
    if (id !== warehouseId) {
      setWarehouseId(id);
      setLocationId('');
      setSelectedLocation(null);
      setLocationSearch('');
      setDebouncedLocationSearch('');
    }
    setPicker(null);
  }

  function selectLocation(loc: Location) {
    setLocationId(loc.id);
    setSelectedLocation(loc);
    setPicker(null);
  }

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
            {warehouseId && !locationLoading && !debouncedLocationSearch && locations.length === 0 ? <Text style={styles.muted}>Kho này chưa có vị trí đang hoạt động.</Text> : null}
            <Text style={styles.label}>Ghi chú (không bắt buộc)</Text>
            <TextInput value={note} onChangeText={setNote} maxLength={4000} multiline placeholder="Lý do hoặc thông tin bàn giao" placeholderTextColor={colors.outline} style={styles.note} />
          </Card>
          <Card style={styles.notice}><Text style={styles.muted}>Sau khi gửi, tài sản ở trạng thái chờ chuyển. Vị trí và tồn kho chỉ thay đổi khi người có quyền duyệt yêu cầu trên web.</Text></Card>
          <PrimaryButton label={submitting ? 'Đang gửi...' : 'Gửi yêu cầu chuyển'} icon="send" loading={submitting} onPress={() => void sendRequest()} />
        </>}
      </> : null}
    </AppShell>
    <Modal visible={picker !== null} transparent animationType="slide" onRequestClose={() => setPicker(null)}>
      <View style={styles.backdrop}><View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.spaceLg) }]}>
        <View style={styles.sheetHeader}><Text style={styles.heading}>{picker === 'warehouse' ? 'Chọn kho đích' : 'Chọn vị trí đích'}</Text><Pressable accessibilityLabel="Đóng" onPress={() => setPicker(null)}><Icon name="close" color={colors.primary} /></Pressable></View>
        {picker === 'location' ? (
          <View style={styles.searchBox}>
            <Icon name="search" size={18} color={colors.primary} />
            <TextInput
              value={locationSearch}
              onChangeText={setLocationSearch}
              placeholder="Tìm mã hoặc tên vị trí..."
              placeholderTextColor={colors.outline}
              style={styles.searchInput}
              returnKeyType="search"
            />
            {locationSearch ? (
              <Pressable onPress={() => setLocationSearch('')} accessibilityLabel="Xóa tìm kiếm">
                <Icon name="close" size={18} color={colors.outline} />
              </Pressable>
            ) : null}
          </View>
        ) : null}
        {picker === 'warehouse' ? (
          <FlatList
            data={warehouses}
            keyExtractor={(row) => row.id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.options}
            renderItem={({ item: row }) => (
              <PickerOptionRow
                code={row.code}
                name={row.name}
                selected={row.id === warehouseId}
                onPress={() => selectWarehouse(row.id)}
              />
            )}
            ListEmptyComponent={<Text style={styles.muted}>Không có lựa chọn đang hoạt động.</Text>}
          />
        ) : (
          <FlatList
            data={locationLoading ? [] : locations}
            keyExtractor={(row) => row.id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.options}
            renderItem={({ item: row }) => (
              <PickerOptionRow
                code={row.code}
                name={row.name}
                selected={row.id === locationId}
                onPress={() => selectLocation(row)}
              />
            )}
            ListEmptyComponent={
              locationLoading ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={styles.muted}>Đang tìm vị trí...</Text>
                </View>
              ) : locationError ? (
                <View style={styles.loadingRow}>
                  <Text style={styles.error}>{locationError}</Text>
                  <Pressable onPress={() => setLocationReloadNonce((n) => n + 1)}>
                    <Text style={styles.retryText}>Thử lại</Text>
                  </Pressable>
                </View>
              ) : (
                <Text style={styles.muted}>
                  {debouncedLocationSearch ? 'Không tìm thấy vị trí khớp từ khóa.' : 'Không có lựa chọn đang hoạt động.'}
                </Text>
              )
            }
            ListFooterComponent={
              !locationLoading && locationPage < locationTotalPages ? (
                <Pressable
                  disabled={locationLoadingMore}
                  onPress={() => void loadMoreLocations()}
                  style={styles.loadMoreButton}
                >
                  {locationLoadingMore ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Icon name="expand-more" size={18} color={colors.primary} />
                  )}
                  <Text style={styles.loadMoreText}>
                    {locationLoadingMore ? 'Đang tải thêm...' : `Tải thêm (${locations.length}/${locationTotalItems})`}
                  </Text>
                </Pressable>
              ) : null
            }
          />
        )}
      </View></View>
    </Modal>
    <OperationResultDialog
      visible={Boolean(createdId)}
      title="Đã gửi yêu cầu chuyển tài sản"
      details={[
        { label: 'Mã yêu cầu', value: createdId ? `ATR-${createdId.slice(0, 8)}` : '—' },
        { label: 'Mã tài sản', value: assetCode || '—' },
        { label: 'Kho đích', value: warehouses.find((w) => w.id === warehouseId)?.name ?? '—' },
        { label: 'Vị trí đích', value: location?.name ?? '—' },
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
  searchBox: { minHeight: 44, paddingHorizontal: spacing.spaceMd, borderRadius: radius.default, borderWidth: 1, borderColor: colors.outlineVariant, backgroundColor: colors.surfaceContainerLow, flexDirection: 'row', alignItems: 'center', gap: spacing.spaceSm },
  searchInput: { flex: 1, minWidth: 0, color: colors.onSurface, ...typography.bodyMd },
  options: { gap: spacing.spaceSm, paddingBottom: spacing.spaceLg },
  option: { minHeight: 48, padding: spacing.spaceMd, borderRadius: radius.default, backgroundColor: colors.surfaceContainerLow, flexDirection: 'row', alignItems: 'center', gap: spacing.spaceSm },
  optionActive: { backgroundColor: colors.honeyChip, borderWidth: 1, borderColor: colors.secondaryContainer },
  loadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.spaceSm, paddingVertical: spacing.spaceMd, flexWrap: 'wrap' },
  retryText: { ...typography.labelLg, color: colors.primary },
  loadMoreButton: { minHeight: 44, marginTop: spacing.spaceXs, borderRadius: radius.full, borderWidth: 1, borderColor: colors.outlineVariant, backgroundColor: colors.parchment, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.spaceXs, paddingHorizontal: spacing.spaceMd },
  loadMoreText: { ...typography.labelMd, color: colors.primary },
});

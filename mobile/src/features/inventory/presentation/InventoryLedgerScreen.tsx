import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '@/src/core/theme/tokens';
import { useAuthContext } from '@/src/features/auth/context/AuthContext';
import { listInventoryTransactions, listWarehouses, type InventoryTransaction, type Page, type Warehouse } from '@/src/features/inventory/api';
import StockDateRangeFilter from '@/src/features/inventory/presentation/StockDateRangeFilter';
import { formatQuantity } from '@/src/shared/format-quantity';
import type { StockDateRange } from '@/src/features/inventory/stock-date-range';
import { MobileApiError } from '@/src/shared/api/client';
import { AppShell, Card, Icon, PageHeader, Pill, SectionTitle } from '@/src/shared/ui/MobileShell';

const PAGE_SIZE = 20;
const TYPES = [
  { value: '', label: 'Tất cả' },
  { value: 'RECEIPT', label: 'Nhập kho' },
  { value: 'ISSUE', label: 'Xuất kho' },
  { value: 'TRANSFER_OUT', label: 'Chuyển đi' },
  { value: 'TRANSFER_IN', label: 'Chuyển đến' },
  { value: 'ADJUSTMENT_IN', label: 'Điều chỉnh tăng' },
  { value: 'ADJUSTMENT_OUT', label: 'Điều chỉnh giảm' },
  { value: 'MAINTENANCE_ISSUE', label: 'Xuất bảo trì' },
  { value: 'ASSIGNMENT_OUT', label: 'Bàn giao' },
  { value: 'RETURN_IN', label: 'Trả tài sản' },
];

function transactionLabel(value: string) { return TYPES.find((type) => type.value === value)?.label ?? value; }

export default function InventoryLedgerScreen() {
  const router = useRouter();
  const { warehouseId: initialWarehouseId } = useLocalSearchParams<{ warehouseId?: string }>();
  const { currentFarmId, getAccessToken } = useAuthContext();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehouseId, setWarehouseId] = useState(initialWarehouseId ?? '');
  const [transactionType, setTransactionType] = useState('');
  const [dates, setDates] = useState<StockDateRange>({});
  const [page, setPage] = useState(1);
  const [pageInfo, setPageInfo] = useState<Page | null>(null);
  const [rows, setRows] = useState<InventoryTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);
  useEffect(() => { setPage(1); }, [currentFarmId]);

  useEffect(() => {
    if (!currentFarmId) { setWarehouses([]); return; }
    let cancelled = false;
    void getAccessToken().then((token) => {
      if (!token) throw new MobileApiError('Phiên đăng nhập đã hết hạn.', 401);
      return listWarehouses(token, currentFarmId);
    }).then((response) => { if (!cancelled) setWarehouses(response.data.filter((warehouse) => warehouse.farmId === currentFarmId)); })
      .catch(() => { if (!cancelled) setWarehouses([]); });
    return () => { cancelled = true; };
  }, [currentFarmId, getAccessToken]);

  useEffect(() => {
    if (!currentFarmId) { setRows([]); setPageInfo(null); return; }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void getAccessToken().then((token) => {
      if (!token) throw new MobileApiError('Phiên đăng nhập đã hết hạn.', 401);
      return listInventoryTransactions(token, currentFarmId, {
        warehouseId: warehouseId || undefined,
        transactionType: transactionType || undefined,
        dateFrom: dates.dateFrom,
        dateTo: dates.dateTo,
        page,
        pageSize: PAGE_SIZE,
      });
    }).then((response) => {
      if (!cancelled) { setRows(response.data); setPageInfo(response.page); }
    }).catch((cause: unknown) => {
      if (!cancelled) { setRows([]); setPageInfo(null); setError(cause instanceof Error ? cause.message : 'Không thể tải lịch sử biến động.'); }
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [currentFarmId, dates.dateFrom, dates.dateTo, getAccessToken, page, reloadNonce, transactionType, warehouseId]);

  const filtered = Boolean(warehouseId || transactionType || dates.dateFrom || dates.dateTo);
  return <AppShell active="inventory">
    <PageHeader title="Lịch sử biến động kho" subtitle="Nhập, xuất, chuyển và điều chỉnh tồn" onBack={() => router.back()} action={<Pressable accessibilityRole="button" accessibilityLabel="Tải lại lịch sử" onPress={() => setReloadNonce((value) => value + 1)}><Icon name="sync" color={colors.primary} /></Pressable>} />
    <Text style={styles.label}>Kho</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
      {[{ id: '', code: '', name: 'Tất cả kho' }, ...warehouses].map((warehouse) => <Pressable key={warehouse.id || 'all'} accessibilityRole="button" accessibilityState={{ selected: warehouseId === warehouse.id }} onPress={() => { setWarehouseId(warehouse.id); setPage(1); }}><Pill tone={warehouseId === warehouse.id ? 'amber' : 'neutral'}><Text style={styles.chipText}>{warehouse.id ? `${warehouse.code} · ${warehouse.name}` : warehouse.name}</Text></Pill></Pressable>)}
    </ScrollView>
    <Text style={styles.label}>Loại biến động</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
      {TYPES.map((type) => <Pressable key={type.value || 'all'} accessibilityRole="button" accessibilityState={{ selected: transactionType === type.value }} onPress={() => { setTransactionType(type.value); setPage(1); }}><Pill tone={transactionType === type.value ? 'amber' : 'neutral'}><Text style={styles.chipText}>{type.label}</Text></Pill></Pressable>)}
    </ScrollView>
    <StockDateRangeFilter value={dates} onApply={(range) => { setDates(range); setPage(1); }} />
    <SectionTitle title="Giao dịch tồn kho" count={`${pageInfo?.totalItems ?? 0} dòng`} />
    {loading ? <Text style={styles.message}>Đang tải lịch sử biến động...</Text> : error ? <Text style={styles.error}>{error}</Text> : rows.length === 0 ? <Text style={styles.message}>{filtered ? 'Không có kết quả phù hợp với bộ lọc.' : 'Chưa có lịch sử biến động.'}</Text> : rows.map((row) => {
      const quantity = Number(row.quantityChange);
      const increasing = Number.isFinite(quantity) && quantity > 0;
      const time = new Date(row.createdAt);
      return <Card key={row.id} style={styles.card}>
        <View style={styles.cardTop}><View style={styles.cardCopy}><Text style={styles.itemName}>{row.item.code} · {row.item.name}</Text><Text style={styles.meta}>{transactionLabel(row.transactionType)} · {row.warehouse.code} · {row.warehouse.name}</Text></View><Text style={[styles.quantity, increasing ? styles.increase : styles.decrease]}>{increasing ? '+' : ''}{formatQuantity(row.quantityChange)} {row.item.unit?.symbol || row.item.unit?.name || ''}</Text></View>
        <Text style={styles.meta}>{Number.isNaN(time.getTime()) ? row.createdAt : time.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</Text>
        {row.lot?.lotCode ? <Text style={styles.meta}>Lô: {row.lot.lotCode}</Text> : null}
        {row.asset?.assetCode ? <Text style={styles.meta}>Tài sản: {row.asset.assetCode}</Text> : null}
        {row.reason ? <Text style={styles.meta}>Lý do: {row.reason}</Text> : null}
      </Card>;
    })}
    {!loading && !error && (pageInfo?.totalPages ?? 0) > 1 ? <View style={styles.pagination}><Pressable disabled={page <= 1} onPress={() => setPage((value) => value - 1)} style={[styles.pageButton, page <= 1 && styles.disabled]}><Text style={styles.pageText}>Trước</Text></Pressable><Text style={styles.pageSummary}>Trang {page}/{pageInfo?.totalPages}</Text><Pressable disabled={page >= (pageInfo?.totalPages ?? 1)} onPress={() => setPage((value) => value + 1)} style={[styles.pageButton, page >= (pageInfo?.totalPages ?? 1) && styles.disabled]}><Text style={styles.pageText}>Sau</Text></Pressable></View> : null}
  </AppShell>;
}

const styles = StyleSheet.create({
  label: { ...typography.labelLg, color: colors.deepAmber, marginTop: spacing.spaceSm },
  chips: { flexDirection: 'row', gap: spacing.spaceSm, paddingVertical: spacing.spaceSm },
  chipText: { ...typography.labelSm, color: colors.deepAmber },
  message: { ...typography.bodyMd, color: colors.onSurfaceVariant, textAlign: 'center', paddingVertical: spacing.spaceLg },
  error: { ...typography.bodyMd, color: colors.error, textAlign: 'center', paddingVertical: spacing.spaceLg },
  card: { gap: spacing.spaceXs, marginBottom: spacing.spaceSm },
  cardTop: { flexDirection: 'row', gap: spacing.spaceSm, alignItems: 'flex-start' },
  cardCopy: { flex: 1, minWidth: 0 },
  itemName: { ...typography.labelLg, color: colors.deepAmber, flexShrink: 1 },
  quantity: { ...typography.labelLg, flexShrink: 1, textAlign: 'right' },
  increase: { color: colors.statusSuccess },
  decrease: { color: colors.error },
  meta: { ...typography.bodySm, color: colors.onSurfaceVariant, flexShrink: 1 },
  pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.spaceSm, paddingVertical: spacing.spaceMd },
  pageButton: { minHeight: 38, justifyContent: 'center', paddingHorizontal: spacing.spaceMd, borderWidth: 1, borderColor: colors.outlineVariant, borderRadius: radius.default },
  pageText: { ...typography.labelMd, color: colors.primary },
  pageSummary: { ...typography.bodySm, color: colors.onSurfaceVariant },
  disabled: { opacity: 0.4 },
});

import { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, spacing, typography } from '@/src/core/theme/tokens';
import { useAuthContext } from '@/src/features/auth/context/AuthContext';
import { listLotsPage, type InventoryLot } from '@/src/features/inventory/api';
import { isAbortError } from '@/src/shared/api/client';
import { Icon } from '@/src/shared/ui/MobileShell';

type Props = {
  visible: boolean;
  farmId: string | null;
  itemId: string | null;
  itemName: string;
  title?: string;
  emptyMessage?: string;
  onSelectLot: (lot: InventoryLot) => void;
  onClose: () => void;
  onSkip?: () => void;
  skipLabel?: string;
};

function todayDateOnly() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function getLotExpiryState(expiryDate?: string | null) {
  if (!expiryDate) {
    return { label: 'Không có hạn sử dụng', expired: false, warning: false };
  }
  const today = todayDateOnly();
  if (expiryDate < today) {
    return { label: 'ĐÃ HẾT HẠN', expired: true, warning: true };
  }
  const days = Math.ceil(
    (Date.parse(`${expiryDate}T00:00:00`) - Date.parse(`${today}T00:00:00`)) / 86_400_000,
  );
  if (days <= 30) {
    return { label: `Sắp hết hạn · còn ${days} ngày`, expired: false, warning: true };
  }
  return { label: 'Còn hạn', expired: false, warning: false };
}

const LotOptionRow = memo(function LotOptionRow({
  lot,
  onPress,
}: {
  lot: InventoryLot;
  onPress: (lot: InventoryLot) => void;
}) {
  const status = getLotExpiryState(lot.expiryDate);
  return (
    <Pressable
      onPress={() => onPress(lot)}
      android_ripple={{ color: colors.primaryFixed }}
      style={({ pressed }) => [
        styles.lotOption,
        status.expired && styles.lotOptionExpired,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.lotCopy}>
        <Text style={styles.lotCode}>{lot.lotCode}</Text>
        <Text style={styles.lotMeta}>
          Số trên hàng: {lot.supplierLotNumber || 'Không có'} · Hạn:{' '}
          {lot.expiryDate || 'Không có hạn'}
        </Text>
        {lot.legacyLotNumber ? (
          <Text style={styles.lotMeta}>Số lô cũ (tham khảo): {lot.legacyLotNumber}</Text>
        ) : null}
        <Text
          style={[
            styles.lotStatus,
            status.expired && styles.lotExpired,
            status.warning && !status.expired && styles.lotExpiring,
          ]}
        >
          {status.label}
          {status.expired ? ' · Chọn sẽ cần xác nhận' : ''}
        </Text>
      </View>
      <Icon name="chevron-right" size={22} color={colors.primary} />
    </Pressable>
  );
});

export const LotPickerModal = memo(function LotPickerModal({
  visible,
  farmId,
  itemId,
  itemName,
  title = 'Chọn lô có sẵn',
  emptyMessage = 'Vật tư này chưa có lô nào.',
  onSelectLot,
  onClose,
  onSkip,
  skipLabel = 'Bỏ qua',
}: Props) {
  const insets = useSafeAreaInsets();
  const { getAccessToken } = useAuthContext();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [lots, setLots] = useState<InventoryLot[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);
  const activeAbortRef = useRef<AbortController | null>(null);
  const wasVisibleRef = useRef(false);

  useEffect(() => {
    const justOpened = visible && !wasVisibleRef.current;
    wasVisibleRef.current = visible;
    if (!visible) {
      activeAbortRef.current?.abort();
      activeAbortRef.current = null;
      return;
    }
    if (justOpened) {
      setSearch('');
      setDebouncedSearch('');
      setLots([]);
      setPage(1);
      setTotalPages(1);
      setError(null);
    }
  }, [visible, itemId]);

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search, visible]);

  const fetchLots = useCallback(
    async (pageNumber: number, append: boolean) => {
      if (!farmId || !itemId) return;
      activeAbortRef.current?.abort();
      const controller = new AbortController();
      activeAbortRef.current = controller;

      if (append) setLoadingMore(true);
      else setLoading(true);
      setError(null);

      try {
        const token = await getAccessToken();
        if (!token) throw new Error('Phiên đăng nhập đã hết hạn.');
        const response = await listLotsPage(
          token,
          farmId,
          {
            itemId,
            search: debouncedSearch || undefined,
            page: pageNumber,
            pageSize: 20,
            skipCache: true,
          },
          controller.signal,
        );
        if (controller.signal.aborted) return;

        setPage(response.page.number);
        setTotalPages(Math.max(1, response.page.totalPages));
        setLots((prev) => {
          if (!append) return response.data;
          const seen = new Set(prev.map((row) => row.id));
          const merged = [...prev];
          for (const row of response.data) {
            if (!seen.has(row.id)) {
              seen.add(row.id);
              merged.push(row);
            }
          }
          return merged;
        });
      } catch (cause: unknown) {
        if (isAbortError(cause) || controller.signal.aborted) return;
        setError(cause instanceof Error ? cause.message : 'Không tải được danh sách lô.');
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [farmId, itemId, debouncedSearch, getAccessToken],
  );

  useEffect(() => {
    if (!visible || !farmId || !itemId) return;
    void fetchLots(1, false);
    return () => {
      activeAbortRef.current?.abort();
    };
  }, [visible, farmId, itemId, fetchLots, reloadNonce]);

  const handleLoadMore = useCallback(() => {
    if (loading || loadingMore || page >= totalPages) return;
    void fetchLots(page + 1, true);
  }, [loading, loadingMore, page, totalPages, fetchLots]);

  const renderLot = useCallback(
    ({ item }: { item: InventoryLot }) => (
      <LotOptionRow lot={item} onPress={onSelectLot} />
    ),
    [onSelectLot],
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.spaceLg) }]}>
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={styles.eyebrow}>LÔ CỦA VẬT TƯ</Text>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.subtitle} numberOfLines={2}>
                {itemName}
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              style={styles.closeButton}
              accessibilityLabel="Đóng danh sách lô"
            >
              <Icon name="close" size={20} color={colors.onSurfaceVariant} />
            </Pressable>
          </View>

          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Tìm theo mã lô hoặc số lô trên hàng"
            placeholderTextColor={colors.onSurfaceVariant}
            style={styles.searchInput}
          />

          <FlatList
            data={lots}
            keyExtractor={(lot) => lot.id}
            renderItem={renderLot}
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator
            keyboardShouldPersistTaps="handled"
            initialNumToRender={10}
            maxToRenderPerBatch={10}
            windowSize={5}
            onEndReachedThreshold={0.4}
            onEndReached={handleLoadMore}
            ListEmptyComponent={
              loading ? (
                <View style={styles.stateBox}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={styles.stateText}>Đang tải danh sách lô...</Text>
                </View>
              ) : error ? (
                <View style={styles.stateBox}>
                  <Text style={styles.errorText}>{error}</Text>
                  <Pressable onPress={() => setReloadNonce((n) => n + 1)} style={styles.retryButton}>
                    <Text style={styles.retryText}>Thử lại</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.stateBox}>
                  <Text style={styles.stateText}>
                    {debouncedSearch ? 'Không có lô khớp từ khóa tìm kiếm.' : emptyMessage}
                  </Text>
                </View>
              )
            }
            ListFooterComponent={
              loadingMore ? (
                <View style={styles.loadingMore}>
                  <ActivityIndicator size="small" color={colors.primary} />
                </View>
              ) : null
            }
          />

          {onSkip ? (
            <Pressable
              onPress={onSkip}
              style={({ pressed }) => [styles.skipButton, pressed && styles.pressed]}
            >
              <Text style={styles.skipText}>{skipLabel}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Modal>
  );
});

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.modalOverlay,
  },
  sheet: {
    maxHeight: '80%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.spaceLg,
    gap: spacing.spaceSm,
  },
  pressed: { opacity: 0.8 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.spaceMd,
  },
  headerCopy: { flex: 1, minWidth: 0 },
  eyebrow: { ...typography.labelSm, color: colors.secondary },
  title: { ...typography.headlineSm, color: colors.deepAmberStrong, marginTop: 2 },
  subtitle: { ...typography.bodySm, color: colors.onSurfaceVariant, marginTop: 2 },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchInput: {
    minHeight: 42,
    paddingHorizontal: spacing.spaceMd,
    borderRadius: radius.default,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.surfaceContainerLow,
    color: colors.onSurface,
    ...typography.bodySm,
  },
  list: { flexShrink: 1 },
  listContent: { gap: spacing.spaceSm, paddingVertical: spacing.spaceXs },
  lotOption: {
    minHeight: 74,
    padding: spacing.spaceSm,
    borderRadius: radius.default,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.parchment,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.spaceSm,
  },
  lotOptionExpired: {
    borderColor: colors.error,
    backgroundColor: colors.errorContainer,
  },
  lotCopy: { flex: 1, minWidth: 0, gap: 2 },
  lotCode: { ...typography.labelLg, color: colors.onSurface },
  lotMeta: { ...typography.bodySm, color: colors.onSurfaceVariant },
  lotStatus: { ...typography.labelSm, color: colors.statusSuccess, marginTop: 2 },
  lotExpired: { color: colors.error },
  lotExpiring: { color: colors.secondary },
  stateBox: {
    paddingVertical: spacing.spaceLg,
    alignItems: 'center',
    gap: spacing.spaceSm,
  },
  stateText: {
    ...typography.bodySm,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
  },
  errorText: {
    ...typography.bodySm,
    color: colors.error,
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: spacing.spaceMd,
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.honeyChip,
  },
  retryText: { ...typography.labelMd, color: colors.primary },
  loadingMore: { paddingVertical: spacing.spaceSm, alignItems: 'center' },
  skipButton: {
    minHeight: 42,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipText: { ...typography.labelMd, color: colors.onSurfaceVariant },
});

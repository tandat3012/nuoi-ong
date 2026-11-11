import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, spacing, typography } from '@/src/core/theme/tokens';
import { useAuthContext } from '@/src/features/auth/context/AuthContext';
import { listCategories, type Category, type Page } from '@/src/features/inventory/api';
import { isAbortError } from '@/src/shared/api/client';
import { toThumbnailUrl } from '@/src/shared/cloudinary-url';
import { formatQuantity } from '@/src/shared/format-quantity';
import { quantityInputNumber } from '@/src/shared/quantity-input';
import { Icon, PrimaryButton } from '@/src/shared/ui/MobileShell';

export type MultiSelectItemOption = {
  id: string;
  itemId: string;
  name: string;
  code: string;
  categoryName?: string | null;
  unit: string;
  trackingMode: 'QUANTITY' | 'LOT' | 'ASSET' | string;
  lotId?: string | null;
  lotCode?: string | null;
  supplierLotNumber?: string | null;
  expiryDate?: string | null;
  assetId?: string | null;
  assetCode?: string | null;
  imageUrl?: string | null;
  availableQuantity?: number;
};

export type MultiSelectLine = {
  id: string;
  itemId: string;
  name: string;
  code: string;
  categoryName?: string | null;
  unit: string;
  trackingMode: string;
  lotId?: string | null;
  lotCode?: string | null;
  supplierLotNumber?: string | null;
  expiryDate?: string | null;
  assetId?: string | null;
  assetCode?: string | null;
  imageUrl?: string | null;
  availableQuantity?: number;
  quantity: string;
};

export type MultiSelectFetchParams = {
  page: number;
  pageSize: number;
  search: string;
  categoryId: string | null;
  trackingMode: string | null;
  signal: AbortSignal;
};

export type MultiSelectFetchResult = {
  items: MultiSelectItemOption[];
  page: Page;
};

export type TrackingFilterOption = {
  key: string;
  label: string;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  hint?: string | null;
  notice?: string | null;
  /** Static list for lightweight client-side pickers (backward compatible). */
  availableItems?: MultiSelectItemOption[];
  /** Server-paginated loader; enables debounced search, category chips & infinite scroll. */
  fetchPage?: (params: MultiSelectFetchParams) => Promise<MultiSelectFetchResult>;
  trackingFilterOptions?: TrackingFilterOption[];
  initialTrackingFilter?: string;
  hideCategoriesWhenTracking?: string[];
  defaultPageSize?: number;
  searchPlaceholder?: string;
  initialSelected?: MultiSelectLine[];
  onConfirm: (selectedLines: MultiSelectLine[]) => void;
};

const TRACKING_LABELS: Record<string, string> = {
  QUANTITY: 'Theo số lượng',
  LOT: 'Theo lô',
  ASSET: 'Tài sản',
};

function todayIsoDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function lotExpiryBadgeState(expiryDate?: string | null): 'expired' | 'expiring' | 'normal' {
  if (!expiryDate) return 'normal';
  const today = todayIsoDate();
  if (expiryDate < today) return 'expired';
  const days = Math.ceil((Date.parse(`${expiryDate}T00:00:00`) - Date.parse(`${today}T00:00:00`)) / 86_400_000);
  return days <= 30 ? 'expiring' : 'normal';
}

type RowProps = {
  item: MultiSelectItemOption;
  currentQty: string | undefined;
  onCardPress: (item: MultiSelectItemOption) => void;
  onIncrement: (item: MultiSelectItemOption) => void;
  onDecrement: (item: MultiSelectItemOption) => void;
  onDirectInput: (item: MultiSelectItemOption, text: string) => void;
  onBlurInput: (id: string) => void;
};

const MultiSelectRow = memo(function MultiSelectRow({
  item,
  currentQty,
  onCardPress,
  onIncrement,
  onDecrement,
  onDirectInput,
  onBlurInput,
}: RowProps) {
  const isSelected = currentQty !== undefined;
  const numQty = quantityInputNumber(currentQty || '0');
  const maxAvailable = item.availableQuantity;
  const isAtMax = maxAvailable !== undefined && numQty >= maxAvailable;
  const thumbUrl = toThumbnailUrl(item.imageUrl, 128);
  const expiryState = lotExpiryBadgeState(item.expiryDate);

  return (
    <View
      collapsable={false}
      style={[styles.itemCard, isSelected && styles.itemCardSelected]}
    >
      <Pressable
        onPress={() => onCardPress(item)}
        android_ripple={{ color: colors.honeyChip }}
        style={({ pressed }) => [
          styles.itemCardMainPressable,
          pressed && styles.pressed,
        ]}
      >
        <View style={styles.itemImageContainer}>
          {thumbUrl ? (
            <Image
              source={{ uri: thumbUrl }}
              style={styles.itemImage}
              resizeMode="cover"
            />
          ) : (
            <Icon
              name={
                item.trackingMode === 'LOT'
                  ? 'layers'
                  : item.trackingMode === 'ASSET'
                  ? 'precision-manufacturing'
                  : 'inventory-2'
              }
              size={22}
              color={colors.primary}
            />
          )}
        </View>

        <View style={styles.itemDetails}>
          <Text style={styles.itemName} numberOfLines={2}>
            {item.name}
          </Text>
          <View style={styles.itemMetaRow}>
            <Text style={styles.itemCode} numberOfLines={1}>
              {item.assetCode ? `${item.assetCode} · ${item.code}` : item.code}
            </Text>
            {item.categoryName ? (
              <Text style={styles.itemCategory} numberOfLines={1}>
                • {item.categoryName}
              </Text>
            ) : null}
          </View>

          {item.lotCode || item.lotId ? (
            <View
              style={[
                styles.lotBadge,
                expiryState === 'expired' && styles.lotBadgeExpired,
                expiryState === 'expiring' && styles.lotBadgeExpiring,
              ]}
            >
              <Icon
                name="bookmark-border"
                size={13}
                color={
                  expiryState === 'expired'
                    ? colors.error
                    : expiryState === 'expiring'
                    ? colors.secondary
                    : colors.primary
                }
              />
              <Text
                style={[
                  styles.lotText,
                  expiryState === 'expired' && styles.lotTextExpired,
                  expiryState === 'expiring' && styles.lotTextExpiring,
                ]}
                numberOfLines={1}
              >
                Lô: {item.lotCode || item.lotId?.slice(0, 8)}
                {item.expiryDate ? ` · HSD ${item.expiryDate}` : ''}
                {expiryState === 'expired' ? ' (Hết hạn)' : ''}
              </Text>
            </View>
          ) : null}

          <View style={styles.stockAndSelectionRow}>
            {maxAvailable !== undefined ? (
              <Text
                style={[
                  styles.stockText,
                  maxAvailable <= 0 && styles.stockEmpty,
                ]}
              >
                Khả dụng: {formatQuantity(maxAvailable)} {item.unit}
              </Text>
            ) : null}
            {isSelected && numQty > 0 ? (
              <View style={styles.selectedPill}>
                <Text style={styles.selectedPillText}>
                  Đã chọn: {formatQuantity(numQty)} {item.unit}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </Pressable>

      <View style={styles.itemAction}>
        {!isSelected ? (
          <Pressable
            onPress={() => onCardPress(item)}
            style={({ pressed }) => [
              styles.selectButton,
              pressed && styles.pressed,
            ]}
          >
            <Icon name="add" size={18} color={colors.primary} />
            <Text style={styles.selectButtonText}>Chọn</Text>
          </Pressable>
        ) : (
          <View style={styles.quantityController}>
            <Pressable
              onPress={() => onDecrement(item)}
              hitSlop={6}
              style={({ pressed }) => [
                styles.qtyStepButton,
                pressed && styles.pressed,
              ]}
            >
              <Icon name="remove" size={16} color={colors.primary} />
            </Pressable>

            <TextInput
              value={currentQty}
              onChangeText={(text) => onDirectInput(item, text)}
              onBlur={() => onBlurInput(item.id)}
              keyboardType="decimal-pad"
              style={styles.qtyInput}
              selectTextOnFocus
            />

            <Pressable
              onPress={() => onIncrement(item)}
              disabled={isAtMax}
              hitSlop={6}
              style={({ pressed }) => [
                styles.qtyStepButton,
                isAtMax && styles.qtyStepButtonDisabled,
                pressed && !isAtMax && styles.pressed,
              ]}
            >
              <Icon
                name="add"
                size={16}
                color={isAtMax ? colors.outlineVariant : colors.primary}
              />
            </Pressable>
            <Text style={styles.unitText}>{item.unit}</Text>
          </View>
        )}
      </View>
    </View>
  );
});

export const ItemMultiSelectModal = memo(function ItemMultiSelectModal({
  visible,
  onClose,
  title = 'Chọn vật tư vào phiếu',
  subtitle,
  hint,
  notice,
  availableItems = [],
  fetchPage,
  trackingFilterOptions,
  initialTrackingFilter = 'ALL',
  hideCategoriesWhenTracking = ['ASSET'],
  defaultPageSize = 20,
  searchPlaceholder = 'Tìm theo tên, mã vật tư, mã lô...',
  initialSelected = [],
  onConfirm,
}: Props) {
  const insets = useSafeAreaInsets();
  const { getAccessToken } = useAuthContext();
  const isServerMode = Boolean(fetchPage);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedTracking, setSelectedTracking] = useState<string>(initialTrackingFilter);
  const [showSelectedOnly, setShowSelectedOnly] = useState(false);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [selectedOptionsMap, setSelectedOptionsMap] = useState<Record<string, MultiSelectItemOption>>({});

  // Server pagination state
  const [categories, setCategories] = useState<Category[]>([]);
  const [serverItems, setServerItems] = useState<MultiSelectItemOption[]>([]);
  const [serverPage, setServerPage] = useState(1);
  const [serverTotalPages, setServerTotalPages] = useState(1);
  const [serverLoading, setServerLoading] = useState(false);
  const [serverLoadingMore, setServerLoadingMore] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);

  const wasVisibleRef = useRef(false);
  const fetchPageRef = useRef(fetchPage);
  fetchPageRef.current = fetchPage;
  const activeAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const justOpened = visible && !wasVisibleRef.current;
    wasVisibleRef.current = visible;

    if (!visible) {
      activeAbortRef.current?.abort();
      activeAbortRef.current = null;
      return;
    }

    if (justOpened) {
      const initialMap: Record<string, string> = {};
      const optionMap: Record<string, MultiSelectItemOption> = {};
      for (const line of initialSelected) {
        if (line.id && line.quantity) {
          initialMap[line.id] = line.quantity;
          optionMap[line.id] = {
            id: line.id,
            itemId: line.itemId,
            name: line.name,
            code: line.code,
            categoryName: line.categoryName,
            unit: line.unit,
            trackingMode: line.trackingMode,
            lotId: line.lotId,
            lotCode: line.lotCode,
            supplierLotNumber: line.supplierLotNumber,
            expiryDate: line.expiryDate,
            assetId: line.assetId,
            assetCode: line.assetCode,
            imageUrl: line.imageUrl,
            availableQuantity: line.availableQuantity,
          };
        }
      }
      setQuantities(initialMap);
      setSelectedOptionsMap(optionMap);
      setSearch('');
      setDebouncedSearch('');
      setSelectedCategory('ALL');
      setSelectedTracking(initialTrackingFilter);
      setShowSelectedOnly(false);
      setServerItems([]);
      setServerPage(1);
      setServerTotalPages(1);
      setServerError(null);
    }
  }, [visible, initialSelected, initialTrackingFilter]);

  useEffect(() => {
    if (!visible || !isServerMode) return;
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search, visible, isServerMode]);

  useEffect(() => {
    if (!visible || !isServerMode || categories.length > 0) return;
    const controller = new AbortController();
    void getAccessToken()
      .then((token) => {
        if (!token) return null;
        return listCategories(token, controller.signal);
      })
      .then((response) => {
        if (!response) return;
        setCategories(response.data.filter((cat) => cat.status === 'ACTIVE'));
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [visible, isServerMode, categories.length, getAccessToken]);

  const loadServerPage = useCallback(
    async (pageNumber: number, append: boolean) => {
      const loader = fetchPageRef.current;
      if (!loader) return;
      activeAbortRef.current?.abort();
      const controller = new AbortController();
      activeAbortRef.current = controller;
      if (append) setServerLoadingMore(true);
      else setServerLoading(true);
      setServerError(null);

      try {
        const result = await loader({
          page: pageNumber,
          pageSize: defaultPageSize,
          search: debouncedSearch,
          categoryId: selectedCategory === 'ALL' ? null : selectedCategory,
          trackingMode: selectedTracking === 'ALL' ? null : selectedTracking,
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;

        setServerPage(result.page.number);
        setServerTotalPages(Math.max(1, result.page.totalPages));
        setServerItems((prev) => {
          if (!append) return result.items;
          const seen = new Set(prev.map((row) => row.id));
          const merged = [...prev];
          for (const row of result.items) {
            if (!seen.has(row.id)) {
              seen.add(row.id);
              merged.push(row);
            }
          }
          return merged;
        });
      } catch (cause: unknown) {
        if (isAbortError(cause) || controller.signal.aborted) return;
        setServerError(
          cause instanceof Error ? cause.message : 'Không thể tải danh sách vật tư.',
        );
      } finally {
        if (!controller.signal.aborted) {
          setServerLoading(false);
          setServerLoadingMore(false);
        }
      }
    },
    [debouncedSearch, defaultPageSize, selectedCategory, selectedTracking],
  );

  useEffect(() => {
    if (!visible || !isServerMode || showSelectedOnly) return;
    void loadServerPage(1, false);
    return () => {
      activeAbortRef.current?.abort();
    };
  }, [visible, isServerMode, showSelectedOnly, loadServerPage, reloadNonce]);

  const categoriesHidden = hideCategoriesWhenTracking.includes(selectedTracking);

  // Client-side category list (when availableItems supplied without fetchPage)
  const categoryOptions = useMemo(() => {
    if (isServerMode) {
      return [
        { key: 'ALL', label: 'Tất cả' },
        ...categories.map((cat) => ({ key: cat.id, label: cat.name })),
      ];
    }
    const counts: Record<string, number> = {};
    for (const item of availableItems) {
      const cat = (item.categoryName?.trim() || 'Khác').toUpperCase();
      counts[cat] = (counts[cat] || 0) + 1;
    }
    const list = Object.entries(counts).map(([name, count]) => ({
      key: name,
      label: `${name} (${count})`,
    }));
    return [
      { key: 'ALL', label: `Tất cả (${availableItems.length})` },
      ...list,
    ];
  }, [isServerMode, categories, availableItems]);

  const trackingOptions = useMemo(() => {
    if (trackingFilterOptions) return trackingFilterOptions;
    if (isServerMode) {
      return [
        { key: 'ALL', label: 'Tất cả' },
        { key: 'QUANTITY', label: TRACKING_LABELS.QUANTITY },
        { key: 'LOT', label: TRACKING_LABELS.LOT },
        { key: 'ASSET', label: TRACKING_LABELS.ASSET },
      ];
    }
    const modes = new Set<string>();
    for (const item of availableItems) {
      if (item.trackingMode) modes.add(item.trackingMode);
    }
    if (modes.size <= 1) return [];
    return [
      { key: 'ALL', label: 'Tất cả' },
      ...Array.from(modes).map((m) => ({
        key: m,
        label: TRACKING_LABELS[m] || m,
      })),
    ];
  }, [trackingFilterOptions, isServerMode, availableItems]);

  const clientFilteredItems = useMemo(() => {
    if (isServerMode) return [];
    const normalizedSearch = search.trim().toLowerCase();
    return availableItems.filter((item) => {
      if (selectedCategory !== 'ALL') {
        const itemCat = (item.categoryName?.trim() || 'Khác').toUpperCase();
        if (itemCat !== selectedCategory) return false;
      }
      if (selectedTracking !== 'ALL' && item.trackingMode !== selectedTracking) {
        return false;
      }
      if (!normalizedSearch) return true;
      const haystack = [
        item.name,
        item.code,
        item.categoryName,
        item.lotCode,
        item.supplierLotNumber,
        item.assetCode,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(normalizedSearch);
    });
  }, [isServerMode, availableItems, search, selectedCategory, selectedTracking]);

  const selectedItemsList = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return Object.values(selectedOptionsMap).filter((item) => {
      if (quantityInputNumber(quantities[item.id] || '0') <= 0) return false;
      if (!normalizedSearch) return true;
      const haystack = [
        item.name,
        item.code,
        item.lotCode,
        item.supplierLotNumber,
        item.assetCode,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(normalizedSearch);
    });
  }, [selectedOptionsMap, quantities, search]);

  const visibleItems = showSelectedOnly
    ? selectedItemsList
    : isServerMode
    ? serverItems
    : clientFilteredItems;

  const selectedLinesCount = useMemo(
    () => Object.values(quantities).filter((qty) => quantityInputNumber(qty) > 0).length,
    [quantities],
  );

  const totalQuantitySum = useMemo(() => {
    let sum = 0;
    for (const qty of Object.values(quantities)) {
      const num = quantityInputNumber(qty);
      if (num > 0) sum += num;
    }
    return sum;
  }, [quantities]);

  const setItemQuantity = useCallback((item: MultiSelectItemOption, value: string) => {
    setSelectedOptionsMap((prev) => (prev[item.id] ? prev : { ...prev, [item.id]: item }));
    setQuantities((prev) => ({ ...prev, [item.id]: value }));
  }, []);

  const handleIncrement = useCallback((item: MultiSelectItemOption) => {
    setSelectedOptionsMap((prev) => (prev[item.id] ? prev : { ...prev, [item.id]: item }));
    setQuantities((prev) => {
      const current = quantityInputNumber(prev[item.id] || '0');
      const max = item.availableQuantity;
      if (max !== undefined && current >= max) return prev;
      const nextVal = current <= 0 ? 1 : current + 1;
      return { ...prev, [item.id]: String(nextVal) };
    });
  }, []);

  const handleCardPress = useCallback(
    (item: MultiSelectItemOption) => {
      setSelectedOptionsMap((prev) => (prev[item.id] ? prev : { ...prev, [item.id]: item }));
      setQuantities((prev) => {
        if (prev[item.id] === undefined) {
          return { ...prev, [item.id]: '1' };
        }
        const current = quantityInputNumber(prev[item.id] || '0');
        const max = item.availableQuantity;
        if (max !== undefined && current >= max) return prev;
        const nextVal = current <= 0 ? 1 : current + 1;
        return { ...prev, [item.id]: String(nextVal) };
      });
    },
    [],
  );

  const handleDecrement = useCallback((item: MultiSelectItemOption) => {
    setQuantities((prev) => {
      const current = quantityInputNumber(prev[item.id] || '0');
      if (current <= 1) {
        const next = { ...prev };
        delete next[item.id];
        return next;
      }
      return { ...prev, [item.id]: String(current - 1) };
    });
  }, []);

  const handleDirectInput = useCallback(
    (item: MultiSelectItemOption, text: string) => {
      const max = item.availableQuantity;
      const num = quantityInputNumber(text);
      if (max !== undefined && Number.isFinite(num) && num > max) {
        setItemQuantity(item, String(max));
        return;
      }
      setItemQuantity(item, text);
    },
    [setItemQuantity],
  );

  const handleBlurInput = useCallback((id: string) => {
    setQuantities((prev) => {
      const val = prev[id];
      if (val === undefined) return prev;
      if (quantityInputNumber(val) <= 0) {
        const next = { ...prev };
        delete next[id];
        return next;
      }
      return prev;
    });
  }, []);

  const handleConfirm = useCallback(() => {
    const fallbackMap = new Map(availableItems.map((item) => [item.id, item]));
    const lines: MultiSelectLine[] = [];
    for (const [id, qtyStr] of Object.entries(quantities)) {
      const qtyNum = quantityInputNumber(qtyStr);
      if (qtyNum <= 0) continue;
      const base = selectedOptionsMap[id] ?? fallbackMap.get(id);
      if (!base) continue;
      lines.push({
        ...base,
        quantity: qtyStr.trim().replace(',', '.'),
      });
    }
    onConfirm(lines);
    onClose();
  }, [availableItems, quantities, selectedOptionsMap, onConfirm, onClose]);

  const handleLoadMore = useCallback(() => {
    if (!isServerMode || showSelectedOnly) return;
    if (serverLoading || serverLoadingMore || serverPage >= serverTotalPages) return;
    void loadServerPage(serverPage + 1, true);
  }, [
    isServerMode,
    showSelectedOnly,
    serverLoading,
    serverLoadingMore,
    serverPage,
    serverTotalPages,
    loadServerPage,
  ]);

  const renderRow = useCallback(
    ({ item }: { item: MultiSelectItemOption }) => (
      <MultiSelectRow
        item={item}
        currentQty={quantities[item.id]}
        onCardPress={handleCardPress}
        onIncrement={handleIncrement}
        onDecrement={handleDecrement}
        onDirectInput={handleDirectInput}
        onBlurInput={handleBlurInput}
      />
    ),
    [
      quantities,
      handleCardPress,
      handleIncrement,
      handleDecrement,
      handleDirectInput,
      handleBlurInput,
    ],
  );

  return (
    <Modal
      visible={visible}
      transparent={false}
      presentationStyle="fullScreen"
      statusBarTranslucent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={[styles.screen, { paddingTop: insets.top }]} collapsable={false}>
        <View style={styles.topBar}>
          <Pressable
            onPress={onClose}
            android_ripple={{ color: colors.primaryFixed }}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Quay lại"
          >
            <Icon name="arrow-back" size={22} color={colors.deepAmberStrong} />
          </Pressable>
          <View style={styles.headerTitles}>
            <Text style={styles.eyebrow}>DANH MỤC VẬT TƯ</Text>
            <Text style={styles.title} numberOfLines={2}>
              {title}
            </Text>
            {subtitle ? (
              <Text style={styles.subtitle} numberOfLines={2}>
                {subtitle}
              </Text>
            ) : null}
          </View>
          {selectedLinesCount > 0 ? (
            <View style={styles.headerCountPill}>
              <Text style={styles.headerCountText}>{selectedLinesCount}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.body} collapsable={false}>
          {notice ? <Text style={styles.noticeBanner}>{notice}</Text> : null}
          {hint ? <Text style={styles.hintBanner}>{hint}</Text> : null}

          <View style={styles.searchBar}>
            <Icon name="search" size={20} color={colors.outline} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder={searchPlaceholder}
              placeholderTextColor={colors.outline}
              style={styles.searchInput}
              returnKeyType="search"
              clearButtonMode="while-editing"
            />
            {search.length > 0 ? (
              <Pressable onPress={() => setSearch('')} style={styles.clearSearch}>
                <Icon name="cancel" size={18} color={colors.outline} />
              </Pressable>
            ) : null}
          </View>

          {!categoriesHidden ? (
            <View style={styles.filtersContainer}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.filterScrollOuter}
                contentContainerStyle={styles.filterScroll}
              >
                <Pressable
                  onPress={() => setShowSelectedOnly((prev) => !prev)}
                  style={({ pressed }) => [
                    styles.filterChip,
                    showSelectedOnly && styles.filterChipActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      showSelectedOnly && styles.filterChipTextActive,
                    ]}
                  >
                    Đã chọn ({selectedLinesCount})
                  </Text>
                </Pressable>
                {categoryOptions.map((cat) => {
                  const active = !showSelectedOnly && selectedCategory === cat.key;
                  return (
                    <Pressable
                      key={cat.key}
                      onPress={() => {
                        setShowSelectedOnly(false);
                        setSelectedCategory(cat.key);
                      }}
                      style={({ pressed }) => [
                        styles.filterChip,
                        active && styles.filterChipActive,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text
                        style={[
                          styles.filterChipText,
                          active && styles.filterChipTextActive,
                        ]}
                      >
                        {cat.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          ) : (
            <View style={styles.filtersContainer}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.filterScrollOuter}
                contentContainerStyle={styles.filterScroll}
              >
                <Pressable
                  onPress={() => setShowSelectedOnly((prev) => !prev)}
                  style={({ pressed }) => [
                    styles.filterChip,
                    showSelectedOnly && styles.filterChipActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      showSelectedOnly && styles.filterChipTextActive,
                    ]}
                  >
                    Đã chọn ({selectedLinesCount})
                  </Text>
                </Pressable>
              </ScrollView>
            </View>
          )}

          {trackingOptions.length > 0 ? (
            <View style={styles.trackingFiltersContainer}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.filterScrollOuter}
                contentContainerStyle={styles.filterScroll}
              >
                {trackingOptions.map((opt) => {
                  const active = !showSelectedOnly && selectedTracking === opt.key;
                  return (
                    <Pressable
                      key={opt.key}
                      onPress={() => {
                        setShowSelectedOnly(false);
                        setSelectedTracking(opt.key);
                      }}
                      style={({ pressed }) => [
                        styles.trackingChip,
                        active && styles.trackingChipActive,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text
                        style={[
                          styles.trackingChipText,
                          active && styles.trackingChipTextActive,
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          ) : null}

          <FlatList
            data={visibleItems}
            keyExtractor={(item) => item.id}
            renderItem={renderRow}
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator
            keyboardShouldPersistTaps="handled"
            initialNumToRender={10}
            maxToRenderPerBatch={10}
            windowSize={5}
            removeClippedSubviews={false}
            onEndReachedThreshold={0.4}
            onEndReached={handleLoadMore}
            ListEmptyComponent={
              serverLoading && !showSelectedOnly ? (
                <View style={styles.emptyContainer}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={styles.emptySubtitle}>Đang tải danh mục vật tư...</Text>
                </View>
              ) : serverError && !showSelectedOnly ? (
                <View style={styles.emptyContainer}>
                  <Icon name="error-outline" size={38} color={colors.error} />
                  <Text style={styles.emptyTitle}>Không tải được danh sách</Text>
                  <Text style={styles.emptySubtitle}>{serverError}</Text>
                  <Pressable
                    onPress={() => setReloadNonce((n) => n + 1)}
                    style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}
                  >
                    <Text style={styles.retryText}>Thử lại</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.emptyContainer}>
                  <Icon name="search-off" size={44} color={colors.outlineVariant} />
                  <Text style={styles.emptyTitle}>
                    {showSelectedOnly
                      ? 'Chưa chọn vật tư nào'
                      : 'Không tìm thấy vật tư phù hợp'}
                  </Text>
                  <Text style={styles.emptySubtitle}>
                    {showSelectedOnly
                      ? 'Nhấn "Chọn" trên vật tư để thêm vào phiếu.'
                      : 'Thử tìm với từ khóa khác hoặc bỏ chọn bộ lọc.'}
                  </Text>
                </View>
              )
            }
            ListFooterComponent={
              serverLoadingMore ? (
                <View style={styles.loadingMore}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={styles.emptySubtitle}>Đang tải thêm...</Text>
                </View>
              ) : null
            }
          />

          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.spaceMd) }]}>
            <View style={styles.footerSummary}>
              <Text style={styles.footerCount}>
                Đã chọn: <Text style={styles.highlight}>{selectedLinesCount}</Text> mặt hàng
              </Text>
              <Text style={styles.footerTotal}>
                Tổng số lượng: {formatQuantity(totalQuantitySum)} đơn vị
              </Text>
            </View>
            <View style={[styles.footerButton, selectedLinesCount === 0 && styles.footerButtonDisabled]}>
              <PrimaryButton
                label={`Xác nhận (${selectedLinesCount})`}
                icon="check"
                onPress={selectedLinesCount > 0 ? handleConfirm : undefined}
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
});

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  body: {
    flex: 1,
    paddingTop: spacing.spaceSm,
    gap: spacing.spaceSm,
  },
  pressed: {
    opacity: 0.8,
  },
  topBar: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.spaceSm,
    paddingHorizontal: spacing.spaceMd,
    paddingVertical: spacing.spaceSm,
    backgroundColor: colors.parchment,
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitles: {
    flex: 1,
    minWidth: 0,
  },
  headerCountPill: {
    minWidth: 28,
    height: 28,
    paddingHorizontal: spacing.spaceSm,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCountText: {
    ...typography.labelMd,
    color: colors.onPrimary,
    fontWeight: '700',
  },
  eyebrow: {
    ...typography.labelSm,
    color: colors.secondary,
    letterSpacing: 0.6,
  },
  title: {
    ...typography.headlineSm,
    color: colors.deepAmberStrong,
    marginTop: 2,
  },
  subtitle: {
    ...typography.bodySm,
    color: colors.onSurfaceVariant,
    marginTop: 2,
  },
  noticeBanner: {
    marginHorizontal: spacing.spaceLg,
    paddingHorizontal: spacing.spaceSm,
    paddingVertical: 6,
    borderRadius: radius.default,
    backgroundColor: colors.honeyChip,
    ...typography.bodySm,
    color: colors.deepAmber,
  },
  hintBanner: {
    marginHorizontal: spacing.spaceLg,
    ...typography.bodySm,
    color: colors.onSurfaceVariant,
  },
  searchBar: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceContainerLow,
    marginHorizontal: spacing.spaceLg,
    paddingHorizontal: spacing.spaceMd,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    height: 44,
    gap: spacing.spaceSm,
  },
  searchInput: {
    flex: 1,
    ...typography.bodySm,
    color: colors.onSurface,
    paddingVertical: 0,
  },
  clearSearch: {
    padding: spacing.spaceXs,
  },
  filtersContainer: {
    flexShrink: 0,
    flexGrow: 0,
    minHeight: 40,
    justifyContent: 'center',
    paddingVertical: spacing.spaceXs,
  },
  filterScrollOuter: {
    flexGrow: 0,
    flexShrink: 0,
  },
  filterScroll: {
    alignItems: 'center',
    paddingHorizontal: spacing.spaceLg,
    gap: spacing.spaceSm,
  },
  filterChip: {
    minHeight: 34,
    paddingHorizontal: spacing.spaceMd,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipText: {
    ...typography.labelMd,
    lineHeight: 18,
    includeFontPadding: false,
    color: colors.onSurfaceVariant,
  },
  filterChipTextActive: {
    color: colors.onPrimary,
    fontWeight: '700',
  },
  trackingFiltersContainer: {
    flexShrink: 0,
    flexGrow: 0,
    paddingBottom: spacing.spaceXs,
  },
  trackingChip: {
    minHeight: 30,
    paddingHorizontal: spacing.spaceSm,
    paddingVertical: 4,
    borderRadius: radius.sm,
    backgroundColor: colors.parchment,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackingChipActive: {
    backgroundColor: colors.honeyChip,
    borderColor: colors.secondaryContainer,
  },
  trackingChipText: {
    ...typography.labelSm,
    lineHeight: 16,
    includeFontPadding: false,
    color: colors.onSurfaceVariant,
  },
  trackingChipTextActive: {
    color: colors.secondary,
    fontWeight: '700',
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: spacing.spaceLg,
    paddingBottom: spacing.spaceLg,
    gap: spacing.spaceSm,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radius.default,
    padding: spacing.spaceSm,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    gap: spacing.spaceSm,
  },
  itemCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceContainerLow,
  },
  itemCardMainPressable: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.spaceSm,
  },
  stockAndSelectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  selectedPill: {
    backgroundColor: colors.honeyChip,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.secondaryContainer,
  },
  selectedPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  itemImageContainer: {
    width: 48,
    height: 48,
    flexShrink: 0,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  itemImage: {
    width: '100%',
    height: '100%',
  },
  itemDetails: {
    flex: 1,
    gap: 2,
  },
  itemName: {
    ...typography.labelLg,
    color: colors.onSurface,
  },
  itemMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexWrap: 'wrap',
  },
  itemCode: {
    ...typography.labelSm,
    color: colors.outline,
  },
  itemCategory: {
    ...typography.labelSm,
    color: colors.secondary,
  },
  lotBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.parchmentWarm,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  lotBadgeExpired: {
    backgroundColor: colors.errorContainer,
  },
  lotBadgeExpiring: {
    backgroundColor: colors.honeyChip,
  },
  lotText: {
    ...typography.labelSm,
    color: colors.primary,
    fontSize: 11,
  },
  lotTextExpired: {
    color: colors.error,
  },
  lotTextExpiring: {
    color: colors.secondary,
  },
  stockText: {
    ...typography.bodySm,
    color: colors.onSurfaceVariant,
    fontSize: 12,
    marginTop: 2,
  },
  stockEmpty: {
    color: colors.error,
  },
  itemAction: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: spacing.spaceSm,
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.honeyChip,
  },
  selectButtonText: {
    ...typography.labelMd,
    color: colors.primary,
  },
  quantityController: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  qtyStepButton: {
    width: 34,
    height: 34,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  qtyStepButtonDisabled: {
    opacity: 0.4,
  },
  qtyInput: {
    minWidth: 52,
    height: 36,
    paddingHorizontal: 6,
    paddingVertical: 0,
    borderRadius: 6,
    backgroundColor: colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: colors.primary,
    textAlign: 'center',
    textAlignVertical: 'center',
    includeFontPadding: false,
    fontSize: 15,
    fontWeight: '700',
    color: colors.onSurface,
  },
  unitText: {
    ...typography.bodySm,
    color: colors.outline,
    fontSize: 11,
    marginLeft: 2,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.spaceXl,
    gap: spacing.spaceSm,
  },
  emptyTitle: {
    ...typography.headlineSm,
    color: colors.onSurfaceVariant,
  },
  emptySubtitle: {
    ...typography.bodySm,
    color: colors.outline,
    textAlign: 'center',
    paddingHorizontal: spacing.spaceLg,
  },
  retryButton: {
    marginTop: spacing.spaceXs,
    paddingHorizontal: spacing.spaceMd,
    paddingVertical: 8,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.honeyChip,
  },
  retryText: {
    ...typography.labelMd,
    color: colors.primary,
  },
  loadingMore: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.spaceSm,
    paddingVertical: spacing.spaceMd,
  },
  footer: {
    flexShrink: 0,
    paddingHorizontal: spacing.spaceLg,
    paddingVertical: spacing.spaceMd,
    borderTopWidth: 1,
    borderTopColor: colors.outlineVariant,
    backgroundColor: colors.surface,
    gap: spacing.spaceSm,
  },
  footerSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerCount: {
    ...typography.bodySm,
    color: colors.onSurfaceVariant,
  },
  highlight: {
    ...typography.labelLg,
    color: colors.primary,
    fontWeight: '700',
  },
  footerTotal: {
    ...typography.bodySm,
    color: colors.outline,
  },
  footerButton: {
    width: '100%',
  },
  footerButtonDisabled: {
    opacity: 0.5,
  },
});

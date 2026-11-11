import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '@/src/core/theme/tokens';
import { useAuthContext } from '@/src/features/auth/context/AuthContext';
import { clearApiCache, MobileApiError } from '@/src/shared/api/client';
import {
  AppShell,
  Card,
  HoneycombDecor,
  Icon,
  PageHeader,
  Pill,
  PrimaryButton,
  SectionTitle,
  type IconName,
} from '@/src/shared/ui/MobileShell';
import NotificationBell from '@/src/features/notifications/presentation/NotificationBell';
import { getAuditLogDetail, type AuditLog } from '../api';
import {
  actionLabel,
  entityLabel,
  formatDateTime,
  formatValue,
  getStatus,
  isStatusFieldPath,
  normalizeEntity,
  presentSnapshot,
  readableChangeLabel,
  recordLabel,
  relatedRecordRoute,
  snapshotChanges,
  snapshotField,
  statusLabel,
  statusTone,
  synthesizeReferences,
  visibleChanges,
} from '../model';

export default function ActivityDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data, currentFarmId, getAccessToken } = useAuthContext();
  const farm = data?.memberships.find((membership) => membership.farm.id === currentFarmId)?.farm;
  const [result, setResult] = useState<{
    farmId: string;
    log: AuditLog;
    references: Record<string, string>;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadNonce, setReloadNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setResult(null);
    setError(null);
    setLoading(true);
    void (async () => {
      if (!currentFarmId) throw new Error('Chọn trang trại để xem chi tiết lịch sử.');
      if (!id) throw new Error('Thiếu mã lịch sử.');
      const token = await getAccessToken();
      if (!token) throw new Error('Phiên đăng nhập đã hết hạn.');
      const detail = await getAuditLogDetail(token, currentFarmId, id);
      if (!cancelled) {
        setResult({
          farmId: currentFarmId,
          log: detail.data,
          references: detail.references,
        });
      }
    })()
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(
            cause instanceof MobileApiError && cause.status === 404
              ? 'Bản ghi lịch sử không tồn tại trong trang trại hiện tại.'
              : cause instanceof Error
                ? cause.message
                : 'Không thể tải chi tiết lịch sử.',
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [currentFarmId, getAccessToken, id, reloadNonce]);

  const log = result?.farmId === currentFarmId && result?.log.id === id ? result.log : null;
  const mergedReferences = log
    ? {
        ...synthesizeReferences(log.oldData, log.newData),
        ...(result?.references ?? {}),
      }
    : {};
  const status = log ? getStatus(log.newData) ?? getStatus(log.oldData) : null;
  const rawChanges = log ? snapshotChanges(log.oldData, log.newData) : null;
  const changes = rawChanges ? visibleChanges(rawChanges) : null;
  const rejectionReason = log
    ? snapshotField(log.newData, 'rejectionReason') ?? snapshotField(log.oldData, 'rejectionReason')
    : null;
  const relatedRoute = log ? relatedRecordRoute(log) : null;
  const formatContext = log
    ? { farm, references: mergedReferences, entityType: log.entityType }
    : { farm };

  function reload() {
    clearApiCache();
    setReloadNonce((value) => value + 1);
  }

  return (
    <AppShell active="dashboard">
      <PageHeader
        title={farm?.name ?? 'Chưa chọn trang trại'}
        subtitle="Chi tiết lịch sử thao tác"
        onBack={() => router.back()}
        action={
          <View style={styles.headerActions}>
            <NotificationBell />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Làm mới chi tiết lịch sử"
              onPress={reload}
              style={styles.refreshBtn}
            >
              <Icon name="sync" color={colors.primary} />
            </Pressable>
          </View>
        }
      />

      {loading ? (
        <Card style={styles.stateCard}>
          <Icon name="sync" color={colors.primary} />
          <Text style={styles.body}>Đang tải chi tiết thao tác...</Text>
        </Card>
      ) : error ? (
        <Card style={styles.errorCard}>
          <Text style={styles.error}>{error}</Text>
          <Pressable accessibilityRole="button" onPress={reload} style={styles.retry}>
            <Text style={styles.link}>Thử lại</Text>
          </Pressable>
        </Card>
      ) : log ? (
        <>
          <Card style={styles.summary}>
            <HoneycombDecor muted size={38} />
            <View style={styles.summaryTop}>
              <View style={styles.entityBadge}>
                <Icon name={iconForEntity(log.entityType)} color={colors.primary} size={22} />
              </View>
              <View style={styles.summaryTitleCol}>
                <Text style={styles.title}>{actionLabel(log.action)}</Text>
                <Text selectable style={styles.record}>
                  {entityLabel(log.entityType)} • {recordLabel(log, mergedReferences)}
                </Text>
              </View>
              <Pill tone={statusTone(status)}>
                <Text style={styles.status}>{statusLabel(status)}</Text>
              </Pill>
            </View>

            <View style={styles.summaryDivider} />

            <View style={styles.summaryMetaList}>
              <SummaryMetaRow
                icon="person"
                label="Người thực hiện"
                value={log.actor?.name ?? log.actor?.email ?? 'Hệ thống tự động'}
                subValue={log.actor?.name && log.actor?.email ? log.actor.email : undefined}
              />
              <SummaryMetaRow
                icon="schedule"
                label="Thời gian"
                value={formatDateTime(log.createdAt)}
              />
              <SummaryMetaRow
                icon="hive"
                label="Trang trại"
                value={farm?.name ?? 'Chưa chọn trang trại'}
              />
            </View>
          </Card>

          {typeof rejectionReason === 'string' && rejectionReason.trim() ? (
            <Card style={styles.rejection}>
              <View style={styles.rejectionHeader}>
                <Icon name="error-outline" size={18} color={colors.error} />
                <Text style={styles.errorTitle}>Lý do từ chối</Text>
              </View>
              <Text selectable style={styles.error}>
                {rejectionReason}
              </Text>
            </Card>
          ) : null}

          <SectionTitle
            title="Nội dung thay đổi"
            count={changes && changes.length > 0 ? `${changes.length} thay đổi` : undefined}
          />
          <Card style={styles.block}>
            {changes === null ? (
              <Text style={styles.mutedBody}>
                {['CREATE', 'INSERT'].includes(log.action.toUpperCase()) && log.oldData == null
                  ? 'Đối tượng được tạo mới nên chưa có dữ liệu trước thao tác. Nội dung đã tạo được hiển thị bên dưới.'
                  : 'Bản ghi không lưu đủ dữ liệu trước và sau để đối chiếu. Các dữ liệu đã lưu được hiển thị bên dưới.'}
              </Text>
            ) : changes.length === 0 ? (
              <Text style={styles.mutedBody}>Không có khác biệt giữa dữ liệu trước và sau đã lưu.</Text>
            ) : (
              changes.map((change, index) => {
                const isStatus = isStatusFieldPath(change.path);
                const beforeText = formatValue(change.before, change.path, formatContext);
                const afterText = formatValue(change.after, change.path, formatContext);
                const beforeStatusTone =
                  isStatus && typeof change.before === 'string' ? statusTone(change.before) : 'cream';
                const afterStatusTone =
                  isStatus && typeof change.after === 'string' ? statusTone(change.after) : 'success';

                return (
                  <View
                    key={change.path}
                    style={[styles.changeItem, index > 0 && styles.fieldDivider]}
                  >
                    <Text style={styles.changeLabel}>
                      {readableChangeLabel(change, log.oldData, log.newData, mergedReferences)}
                    </Text>
                    <View style={styles.valuesRow}>
                      <View style={styles.valueColumn}>
                        <Text style={styles.captionBefore}>TRƯỚC</Text>
                        {isStatus && typeof change.before === 'string' ? (
                          <View style={styles.pillWrap}>
                            <Pill tone={beforeStatusTone}>
                              <Text style={styles.pillText}>{beforeText}</Text>
                            </Pill>
                          </View>
                        ) : (
                          <Text selectable style={styles.beforeText}>
                            {beforeText}
                          </Text>
                        )}
                      </View>

                      <View style={styles.arrowSpacer}>
                        <Icon name="arrow-forward" size={16} color={colors.outline} />
                      </View>

                      <View
                        style={[
                          styles.valueColumn,
                          afterStatusTone === 'danger' ? styles.afterDanger : styles.afterSuccess,
                        ]}
                      >
                        <Text
                          style={[
                            styles.captionAfter,
                            afterStatusTone === 'danger' && styles.captionDanger,
                          ]}
                        >
                          SAU
                        </Text>
                        {isStatus && typeof change.after === 'string' ? (
                          <View style={styles.pillWrap}>
                            <Pill tone={afterStatusTone}>
                              <Text style={styles.pillText}>{afterText}</Text>
                            </Pill>
                          </View>
                        ) : (
                          <Text selectable style={styles.afterText}>
                            {afterText}
                          </Text>
                        )}
                      </View>
                    </View>
                  </View>
                );
              })
            )}
          </Card>

          <Snapshot
            title="Dữ liệu trước thao tác"
            value={log.oldData}
            farm={farm}
            references={mergedReferences}
            emptyMessage={
              ['CREATE', 'INSERT'].includes(log.action.toUpperCase())
                ? 'Chưa có dữ liệu trước đó vì thao tác này tạo mới đối tượng.'
                : 'Không có dữ liệu trước thao tác.'
            }
          />

          <Snapshot
            title="Dữ liệu sau thao tác"
            value={log.newData}
            farm={farm}
            references={mergedReferences}
            emptyMessage={
              log.action.toUpperCase() === 'DELETE'
                ? 'Đối tượng đã bị xóa nên không còn dữ liệu sau thao tác.'
                : 'Không có dữ liệu sau thao tác.'
            }
          />

          {relatedRoute ? (
            <View style={styles.footerAction}>
              <Text style={styles.footerHint}>
                Mở đối tượng để xem dữ liệu hiện tại. Dữ liệu này có thể khác thời điểm ghi lịch sử.
              </Text>
              <PrimaryButton
                label={`Mở ${entityLabel(log.entityType).toLowerCase()}`}
                icon="open-in-new"
                onPress={() => router.push(relatedRoute as never)}
              />
            </View>
          ) : (
            <Card>
              <Text style={styles.mutedBody}>
                {log.action.toUpperCase() === 'DELETE'
                  ? 'Đối tượng đã được ghi nhận là bị xóa. Bạn vẫn có thể xem dữ liệu đã lưu trong lịch sử.'
                  : 'Đối tượng này chưa có màn hình chi tiết tương ứng hoặc chưa có liên kết trực tiếp.'}
              </Text>
            </Card>
          )}
        </>
      ) : null}
    </AppShell>
  );
}

export function Snapshot({
  title,
  value,
  farm,
  references,
  emptyMessage = 'Không có dữ liệu được lưu.',
}: {
  title: string;
  value: unknown;
  farm?: { id: string; name: string };
  references?: Record<string, string>;
  emptyMessage?: string;
}) {
  const presented = presentSnapshot(value, { farm, references });
  const isEmpty =
    !presented.warehouseRoute &&
    presented.fields.length === 0 &&
    presented.items.length === 0;

  return (
    <>
      <SectionTitle
        title={title}
        count={presented.items.length > 0 ? `${presented.items.length} mặt hàng` : undefined}
      />
      <Card style={styles.block}>
        {isEmpty ? (
          <View style={styles.emptySnapshotRow}>
            <Icon name="info-outline" size={18} color={colors.outline} />
            <Text style={styles.mutedBody}>{emptyMessage}</Text>
          </View>
        ) : (
          <>
            {presented.warehouseRoute ? (
              <View style={styles.routeBox}>
                <View style={styles.routeStop}>
                  <Text style={styles.routeCaption}>KHO NGUỒN</Text>
                  <Text selectable style={styles.routeValue}>
                    {presented.warehouseRoute.from}
                  </Text>
                </View>
                <View style={styles.routeArrowWrap}>
                  <Icon name="arrow-downward" size={16} color={colors.primary} />
                </View>
                <View style={styles.routeStop}>
                  <Text style={styles.routeCaption}>KHO ĐÍCH</Text>
                  <Text selectable style={styles.routeValue}>
                    {presented.warehouseRoute.to}
                  </Text>
                </View>
              </View>
            ) : null}

            {presented.fields.map((field, index) => {
              const showDivider = index > 0 || Boolean(presented.warehouseRoute);
              if (field.kind === 'status') {
                return (
                  <View
                    key={field.key}
                    style={[styles.kvRow, showDivider && styles.fieldDivider]}
                  >
                    <Text style={styles.kvLabel}>{field.label}</Text>
                    <Pill tone={field.statusTone ?? 'cream'}>
                      <Text style={styles.pillText}>{field.value}</Text>
                    </Pill>
                  </View>
                );
              }

              const isLongText = field.value.length > 34 || field.value.includes('\n');
              if (isLongText) {
                return (
                  <View
                    key={field.key}
                    style={[styles.stackedRow, showDivider && styles.fieldDivider]}
                  >
                    <Text style={styles.kvLabel}>{field.label}</Text>
                    <Text selectable style={styles.stackedValue}>
                      {field.value}
                    </Text>
                  </View>
                );
              }

              return (
                <View
                  key={field.key}
                  style={[styles.kvRow, showDivider && styles.fieldDivider]}
                >
                  <Text style={styles.kvLabel}>{field.label}</Text>
                  <Text selectable style={styles.kvValue}>
                    {field.value}
                  </Text>
                </View>
              );
            })}

            {presented.items.length > 0 ? (
              <View
                style={[
                  styles.itemsSection,
                  (presented.fields.length > 0 || Boolean(presented.warehouseRoute)) &&
                    styles.fieldDivider,
                ]}
              >
                <View style={styles.itemsHeader}>
                  <Text style={styles.itemsHeaderTitle}>Danh sách vật tư</Text>
                  <Text style={styles.itemsHeaderCount}>{presented.items.length} mặt hàng</Text>
                </View>
                <View style={styles.itemsList}>
                  {presented.items.map((item) => (
                    <View key={item.key} style={styles.lineItemCard}>
                      <View style={styles.lineItemHeader}>
                        <View style={styles.lineItemIndexBadge}>
                          <Text style={styles.lineItemIndexText}>#{item.index}</Text>
                        </View>
                        <Text selectable style={styles.lineItemTitle}>
                          {item.title}
                        </Text>
                      </View>

                      {item.metrics.length > 0 ? (
                        <View style={styles.metricGrid}>
                          {item.metrics.map((metric) => (
                            <View
                              key={metric.label}
                              style={[
                                styles.metricChip,
                                metric.tone === 'amber' && styles.metricChipAmber,
                                metric.tone === 'success' && styles.metricChipSuccess,
                                metric.tone === 'danger' && styles.metricChipDanger,
                              ]}
                            >
                              <Text style={styles.metricLabel}>{metric.label}</Text>
                              <Text
                                style={[
                                  styles.metricValue,
                                  metric.tone === 'success' && styles.metricValueSuccess,
                                  metric.tone === 'danger' && styles.metricValueDanger,
                                ]}
                              >
                                {metric.value}
                              </Text>
                            </View>
                          ))}
                        </View>
                      ) : null}

                      {item.details.length > 0 ? (
                        <View style={styles.lineDetails}>
                          {item.details.map((detail, detailIndex) => (
                            <View key={`${detail.label}-${detailIndex}`} style={styles.lineDetailRow}>
                              <Text style={styles.lineDetailLabel}>{detail.label}</Text>
                              <Text selectable style={styles.lineDetailValue}>
                                {detail.value}
                              </Text>
                            </View>
                          ))}
                        </View>
                      ) : null}
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
          </>
        )}
      </Card>
    </>
  );
}

function SummaryMetaRow({
  icon,
  label,
  value,
  subValue,
}: {
  icon: IconName;
  label: string;
  value: string;
  subValue?: string;
}) {
  return (
    <View style={styles.metaRow}>
      <View style={styles.metaIconWrap}>
        <Icon name={icon} size={16} color={colors.primary} />
      </View>
      <View style={styles.metaCopy}>
        <Text style={styles.metaLabel}>{label}</Text>
        <Text selectable style={styles.metaValue}>
          {value}
        </Text>
        {subValue ? (
          <Text selectable style={styles.metaSubValue}>
            {subValue}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function iconForEntity(entityType: string): IconName {
  const normalized = normalizeEntity(entityType);
  if (normalized === 'STOCK_TRANSFER') return 'swap-horiz';
  if (normalized.includes('STOCK') || normalized === 'INVENTORY' || normalized === 'ITEM') {
    return 'inventory-2';
  }
  if (normalized === 'ASSET' || normalized.includes('MAINTENANCE') || normalized === 'ASSET_TRANSFER_REQUEST') {
    return 'build';
  }
  if (normalized === 'WAREHOUSE') return 'warehouse';
  if (normalized === 'PERSONNEL') return 'groups';
  if (normalized.startsWith('STORE_')) return 'storefront';
  return 'history';
}

const styles = StyleSheet.create({
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.spaceXs },
  refreshBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.parchment,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.spaceSm },
  summary: {
    backgroundColor: colors.parchmentWarm,
    gap: spacing.spaceSm,
    overflow: 'hidden',
  },
  summaryTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.spaceSm,
  },
  entityBadge: {
    width: 42,
    height: 42,
    borderRadius: radius.default,
    backgroundColor: colors.honeyChip,
    borderWidth: 1,
    borderColor: colors.borderAmberGlow,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  summaryTitleCol: { flex: 1, minWidth: 0, gap: 2 },
  title: { ...typography.headlineSm, color: colors.deepAmberStrong, flexShrink: 1 },
  record: { ...typography.labelLg, color: colors.primary, flexShrink: 1 },
  status: { ...typography.labelSm, color: colors.deepAmberStrong },
  summaryDivider: {
    height: 1,
    backgroundColor: colors.borderAmberGlow,
    marginVertical: spacing.spaceXs,
  },
  summaryMetaList: { gap: spacing.spaceSm },
  metaRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.spaceSm },
  metaIconWrap: {
    width: 28,
    height: 28,
    borderRadius: radius.sm,
    backgroundColor: colors.parchment,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  metaCopy: { flex: 1, minWidth: 0, gap: 1 },
  metaLabel: { ...typography.labelSm, color: colors.onSurfaceVariant },
  metaValue: { ...typography.bodySm, fontWeight: '600', color: colors.onSurface },
  metaSubValue: { ...typography.bodySm, fontSize: 12, color: colors.onSurfaceVariant },
  block: { gap: spacing.spaceSm },
  body: { ...typography.bodySm, color: colors.onSurface, flexShrink: 1 },
  mutedBody: { ...typography.bodySm, color: colors.onSurfaceVariant, flex: 1 },
  changeItem: { gap: spacing.spaceSm },
  changeLabel: { ...typography.labelLg, color: colors.deepAmberStrong },
  valuesRow: { flexDirection: 'row', alignItems: 'stretch', gap: spacing.spaceXs },
  valueColumn: {
    flex: 1,
    minWidth: 0,
    padding: spacing.spaceSm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.surfaceContainerLow,
    gap: spacing.spaceXs,
  },
  afterSuccess: {
    backgroundColor: colors.statusSuccessSurface,
    borderColor: colors.statusSuccessBorder,
  },
  afterDanger: {
    backgroundColor: colors.errorContainer,
    borderColor: colors.error,
  },
  arrowSpacer: { justifyContent: 'center', paddingHorizontal: 2 },
  captionBefore: { ...typography.labelSm, color: colors.onSurfaceVariant },
  captionAfter: { ...typography.labelSm, color: colors.statusSuccess },
  captionDanger: { color: colors.error },
  beforeText: { ...typography.bodySm, color: colors.onSurfaceVariant, flexShrink: 1 },
  afterText: { ...typography.bodySm, fontWeight: '600', color: colors.onSurface, flexShrink: 1 },
  pillWrap: { alignSelf: 'flex-start' },
  pillText: { ...typography.labelSm, color: colors.deepAmberStrong },
  emptySnapshotRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.spaceSm },
  routeBox: {
    backgroundColor: colors.parchmentWarm,
    borderRadius: radius.default,
    borderWidth: 1,
    borderColor: colors.borderAmberGlow,
    padding: spacing.spaceSm,
    gap: spacing.spaceXs,
  },
  routeStop: { gap: 2 },
  routeCaption: { ...typography.labelSm, color: colors.primary },
  routeValue: { ...typography.labelLg, color: colors.deepAmberStrong },
  routeArrowWrap: {
    alignSelf: 'flex-start',
    width: 24,
    height: 24,
    borderRadius: radius.full,
    backgroundColor: colors.honeyChip,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 2,
  },
  fieldDivider: {
    paddingTop: spacing.spaceSm,
    borderTopWidth: 1,
    borderTopColor: colors.outlineVariant,
  },
  kvRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.spaceSm,
  },
  kvLabel: { ...typography.bodySm, color: colors.onSurfaceVariant, flexShrink: 1 },
  kvValue: {
    ...typography.bodySm,
    fontWeight: '600',
    color: colors.onSurface,
    flexShrink: 1,
    textAlign: 'right',
  },
  stackedRow: { gap: spacing.spaceXs },
  stackedValue: {
    ...typography.bodySm,
    color: colors.onSurface,
    backgroundColor: colors.surfaceContainerLow,
    padding: spacing.spaceSm,
    borderRadius: radius.sm,
  },
  itemsSection: { gap: spacing.spaceSm },
  itemsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.spaceSm,
  },
  itemsHeaderTitle: { ...typography.labelLg, color: colors.deepAmberStrong },
  itemsHeaderCount: { ...typography.bodySm, color: colors.onSurfaceVariant },
  itemsList: { gap: spacing.spaceSm },
  lineItemCard: {
    backgroundColor: colors.parchment,
    borderRadius: radius.default,
    borderWidth: 1,
    borderColor: colors.borderAmberGlow,
    padding: spacing.spaceSm,
    gap: spacing.spaceSm,
  },
  lineItemHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.spaceSm },
  lineItemIndexBadge: {
    minWidth: 26,
    height: 24,
    paddingHorizontal: 6,
    borderRadius: radius.sm,
    backgroundColor: colors.honeyChip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lineItemIndexText: { ...typography.labelSm, color: colors.deepAmberStrong },
  lineItemTitle: { ...typography.labelLg, color: colors.deepAmberStrong, flex: 1 },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.spaceXs },
  metricChip: {
    paddingHorizontal: spacing.spaceSm,
    paddingVertical: spacing.spaceXs,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    gap: 1,
  },
  metricChipAmber: { backgroundColor: colors.honeyChip, borderColor: colors.secondaryContainer },
  metricChipSuccess: { backgroundColor: colors.statusSuccessSurface, borderColor: colors.statusSuccessBorder },
  metricChipDanger: { backgroundColor: colors.errorContainer, borderColor: colors.error },
  metricLabel: { ...typography.labelSm, fontSize: 9, color: colors.onSurfaceVariant },
  metricValue: { ...typography.labelMd, color: colors.onSurface },
  metricValueSuccess: { color: colors.statusSuccess },
  metricValueDanger: { color: colors.error },
  lineDetails: {
    paddingTop: spacing.spaceXs,
    borderTopWidth: 1,
    borderTopColor: colors.outlineVariant,
    gap: spacing.spaceXs,
  },
  lineDetailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.spaceSm,
  },
  lineDetailLabel: { ...typography.bodySm, fontSize: 12, color: colors.onSurfaceVariant },
  lineDetailValue: {
    ...typography.bodySm,
    fontSize: 12,
    fontWeight: '600',
    color: colors.onSurface,
    flex: 1,
    textAlign: 'right',
  },
  rejection: { backgroundColor: colors.errorContainer, borderColor: colors.error, gap: spacing.spaceXs },
  rejectionHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.spaceXs },
  errorCard: { backgroundColor: colors.errorContainer, borderColor: colors.error, gap: spacing.spaceSm },
  errorTitle: { ...typography.labelLg, color: colors.error },
  error: { ...typography.bodySm, color: colors.error },
  retry: { paddingVertical: spacing.spaceXs, alignSelf: 'flex-start' },
  link: { ...typography.labelLg, color: colors.primary },
  footerAction: { gap: spacing.spaceSm },
  footerHint: { ...typography.bodySm, color: colors.onSurfaceVariant },
});

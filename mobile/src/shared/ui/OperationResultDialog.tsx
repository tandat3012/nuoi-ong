import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, spacing, typography } from '@/src/core/theme/tokens';
import { Icon } from '@/src/shared/ui/MobileShell';

export type DetailRow = { label: string; value: string };
export type ItemSummary = { name: string; quantity: string };

type OperationResultDialogProps = {
  visible: boolean;
  title: string;
  message?: string;
  eyebrow?: string;
  details?: DetailRow[];
  items?: ItemSummary[];
  actionLabel?: string;
  onAction: () => void;
};

export function OperationResultDialog({
  visible,
  title,
  message,
  eyebrow,
  details,
  items,
  actionLabel = 'Hoàn tất',
  onAction,
}: OperationResultDialogProps) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onAction}
    >
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.brandRow}>
            <View style={styles.brandIcon}><Icon name="hive" size={20} color={colors.primary} filled /></View>
            <Text style={styles.brand}>MỘC ONG</Text>
          </View>

          <View style={styles.result} accessibilityRole="alert">
            <View style={styles.iconHalo}>
              <View style={styles.iconWrap}>
                <Icon name="check" size={48} color={colors.onPrimary} />
              </View>
            </View>
            {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
            <Text style={styles.title}>{title}</Text>
            {(message || (details && details.length > 0) || (items && items.length > 0)) && (
              <View style={styles.messageCard}>
                {message ? <Text style={styles.message}>{message}</Text> : null}
                {details && details.length > 0 && (
                  <View style={[styles.detailList, !message && styles.detailListNoMargin]}>
                    {details.map(({ label, value }) => (
                      <View key={label} style={styles.detailRow}>
                        <Text style={styles.detailLabel}>{label}</Text>
                        <Text style={styles.detailValue}>{value}</Text>
                      </View>
                    ))}
                  </View>
                )}
                {items && items.length > 0 && (
                  <View style={[styles.itemsSection, (!message && (!details || details.length === 0)) && styles.itemsSectionNoMargin]}>
                    <View style={styles.itemsHeader}>
                      <Text style={styles.itemsHeaderTitle}>Danh sách vật tư</Text>
                      <Text style={styles.itemsHeaderCount}>{items.length} mặt hàng</Text>
                    </View>
                    <View style={styles.itemsList}>
                      {items.map((item, idx) => (
                        <View key={idx} style={styles.itemRow}>
                          <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
                          <Text style={styles.itemQuantity}>{item.quantity}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            )}
          </View>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.spaceLg) }]}>
          <View style={styles.footerInner}>
            <Pressable
              accessibilityRole="button"
              onPress={onAction}
              android_ripple={{ color: colors.primaryContainer }}
              style={({ pressed }) => [styles.action, pressed && styles.pressed]}
            >
              <Text style={styles.actionText}>{actionLabel}</Text>
              <Icon name="arrow-forward" size={20} color={colors.onPrimary} />
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  scroll: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    paddingHorizontal: spacing.spaceLg,
    paddingTop: spacing.spaceLg,
    paddingBottom: spacing.spaceXl,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: colors.outlineVariant,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.spaceLg,
    paddingTop: spacing.spaceMd,
  },
  footerInner: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.spaceSm,
  },
  brandIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.default,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.honeyChip,
  },
  brand: {
    ...typography.labelMd,
    color: colors.primary,
    letterSpacing: 1.4,
  },
  result: {
    flex: 1,
    minHeight: 320,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.spaceXl,
  },
  iconHalo: {
    width: 132,
    height: 132,
    marginBottom: spacing.spaceLg,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    backgroundColor: colors.honeyChip,
  },
  iconWrap: {
    width: 96,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    backgroundColor: colors.primary,
  },
  eyebrow: {
    ...typography.labelMd,
    color: colors.statusSuccessStrong,
    letterSpacing: 1,
    textAlign: 'center',
  },
  title: {
    marginTop: spacing.spaceSm,
    textAlign: 'center',
    ...typography.headlineMd,
    color: colors.deepAmberStrong,
  },
  messageCard: {
    alignSelf: 'stretch',
    marginTop: spacing.spaceLg,
    padding: spacing.spaceLg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.parchment,
  },
  message: {
    textAlign: 'center',
    ...typography.bodyMd,
    color: colors.onSurfaceVariant,
  },
  action: {
    minHeight: 54,
    paddingHorizontal: spacing.spaceLg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.spaceSm,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    overflow: 'hidden',
  },
  actionText: {
    ...typography.labelLg,
    color: colors.onPrimary,
  },
  pressed: { opacity: 0.82, transform: [{ scale: 0.98 }] },
  detailList: {
    marginTop: spacing.spaceMd,
    borderTopWidth: 1,
    borderTopColor: colors.outlineVariant,
    paddingTop: spacing.spaceMd,
    gap: spacing.spaceSm,
  },
  detailListNoMargin: {
    marginTop: 0,
    borderTopWidth: 0,
    paddingTop: 0,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.spaceSm,
  },
  detailLabel: {
    ...typography.labelSm,
    color: colors.onSurfaceVariant,
    flexShrink: 0,
  },
  detailValue: {
    ...typography.labelSm,
    color: colors.deepAmberStrong,
    textAlign: 'right',
    flexShrink: 1,
  },
  itemsSection: {
    marginTop: spacing.spaceMd,
    borderTopWidth: 1,
    borderTopColor: colors.outlineVariant,
    paddingTop: spacing.spaceMd,
    gap: spacing.spaceSm,
  },
  itemsSectionNoMargin: {
    marginTop: 0,
    borderTopWidth: 0,
    paddingTop: 0,
  },
  itemsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  itemsHeaderTitle: {
    ...typography.labelSm,
    fontWeight: '700',
    color: colors.deepAmberStrong,
  },
  itemsHeaderCount: {
    ...typography.bodySm,
    color: colors.onSurfaceVariant,
  },
  itemsList: {
    gap: spacing.spaceSm,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.spaceSm,
    paddingVertical: 2,
  },
  itemName: {
    ...typography.bodySm,
    color: colors.onSurface,
    flex: 1,
    minWidth: 0,
  },
  itemQuantity: {
    ...typography.labelSm,
    fontWeight: '700',
    color: colors.primary,
    flexShrink: 0,
    textAlign: 'right',
  },
});
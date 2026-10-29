import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, shadows, spacing, typography } from '@/src/core/theme/tokens';
import { Icon } from '@/src/shared/ui/MobileShell';

type OperationResultDialogProps = {
  visible: boolean;
  title: string;
  message: string;
  actionLabel?: string;
  onAction: () => void;
};

export function OperationResultDialog({
  visible,
  title,
  message,
  actionLabel = 'Hoàn tất',
  onAction,
}: OperationResultDialogProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onAction}
    >
      <View style={styles.backdrop}>
        <View style={styles.dialog} accessibilityRole="alert">
          <View style={styles.iconWrap}>
            <Icon name="check-circle" size={34} color={colors.statusSuccessStrong} filled />
          </View>
          <Text style={styles.eyebrow}>HOÀN TẤT</Text>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={onAction}
            android_ripple={{ color: colors.primary }}
            style={({ pressed }) => [styles.action, pressed && styles.pressed]}
          >
            <Text style={styles.actionText}>{actionLabel}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    padding: spacing.spaceLg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.modalOverlay,
  },
  dialog: {
    width: '100%',
    maxWidth: 420,
    padding: spacing.spaceLg,
    alignItems: 'center',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.parchment,
    ...shadows.floating,
  },
  iconWrap: {
    width: 68,
    height: 68,
    marginBottom: spacing.spaceMd,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.statusSuccessBorder,
    backgroundColor: colors.statusSuccessSurface,
  },
  eyebrow: {
    ...typography.labelSm,
    color: colors.statusSuccessStrong,
    letterSpacing: 1,
  },
  title: {
    marginTop: spacing.spaceXs,
    textAlign: 'center',
    ...typography.headlineMd,
    color: colors.deepAmberStrong,
  },
  message: {
    marginTop: spacing.spaceSm,
    textAlign: 'center',
    ...typography.bodyMd,
    color: colors.onSurfaceVariant,
  },
  action: {
    minHeight: 48,
    alignSelf: 'stretch',
    marginTop: spacing.spaceLg,
    paddingHorizontal: spacing.spaceLg,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    overflow: 'hidden',
  },
  actionText: {
    ...typography.labelLg,
    color: colors.onPrimary,
  },
  pressed: { opacity: 0.82, transform: [{ scale: 0.98 }] },
});

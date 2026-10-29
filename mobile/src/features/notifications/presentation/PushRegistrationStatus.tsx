import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors, radius, spacing, typography } from '@/src/core/theme/tokens';
import { Icon } from '@/src/shared/ui/MobileShell';
import { usePushRegistration } from '../context/PushRegistrationProvider';

export default function PushRegistrationStatus() {
  const { state, retry, openSettings } = usePushRegistration();
  const registered = state.status === 'registered';
  const showAction = state.status === 'error' || state.status === 'denied';
  const settings = state.status === 'denied' && !state.canAskAgain;
  return (
    <View style={styles.container}>
      {state.status === 'registering' ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : (
        <Icon
          name={registered ? 'notifications-active' : 'notifications-none'}
          size={20}
          color={registered ? colors.statusSuccess : colors.primary}
        />
      )}
      <View style={styles.copy}>
        <Text style={styles.title}>Thông báo điện thoại</Text>
        <Text style={styles.message}>{state.message}</Text>
      </View>
      {showAction ? (
        <Pressable
          accessibilityRole="button"
          onPress={settings ? openSettings : retry}
          style={({ pressed }) => [styles.action, pressed && styles.pressed]}
        >
          <Text style={styles.actionText}>
            {settings
              ? 'Cài đặt'
              : state.status === 'denied'
                ? 'Bật'
                : 'Thử lại'}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.spaceSm,
    padding: spacing.spaceSm,
    marginBottom: spacing.spaceSm,
    borderRadius: radius.default,
    backgroundColor: colors.surfaceContainerLow,
  },
  copy: { flex: 1, minWidth: 0 },
  title: { ...typography.labelMd, color: colors.onSurface },
  message: {
    ...typography.bodySm,
    color: colors.onSurfaceVariant,
    marginTop: 2,
  },
  action: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: spacing.spaceSm,
  },
  actionText: { ...typography.labelMd, color: colors.primary },
  pressed: { opacity: 0.75 },
});

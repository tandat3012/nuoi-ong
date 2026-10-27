import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '@/src/core/theme/tokens';
import {
  AppShell,
  Icon,
  PageHeader,
  type IconName,
} from '@/src/shared/ui/MobileShell';
import NotificationBell from '@/src/features/notifications/presentation/NotificationBell';
import type { FarmRoleCode } from '@/src/features/auth/types';

export const roleLabels: Record<FarmRoleCode, string> = {
  ADMIN: 'Quản trị viên',
  FARM_OWNER: 'Chủ trại',
  EMPLOYEE: 'Nhân viên',
  GUEST: 'Khách',
};

export function AccountLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  const router = useRouter();
  return (
    <AppShell active="dashboard" showScrollIndicator>
      <PageHeader
        title={title}
        subtitle={subtitle}
        onBack={() =>
          router.canGoBack()
            ? router.back()
            : router.replace('/dashboard' as never)
        }
        action={<NotificationBell />}
      />
      {children}
    </AppShell>
  );
}

export function SettingsRow({
  icon,
  title,
  subtitle,
  onPress,
  danger = false,
  last = false,
}: {
  icon: IconName;
  title: string;
  subtitle?: string;
  onPress: () => void;
  danger?: boolean;
  last?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      android_ripple={{ color: colors.primaryFixed }}
      style={({ pressed }) => [
        styles.row,
        last && styles.lastRow,
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.icon, danger && styles.dangerIcon]}>
        <Icon
          name={icon}
          size={21}
          color={danger ? colors.error : colors.primary}
        />
      </View>
      <View style={styles.copy}>
        <Text style={[styles.title, danger && styles.dangerText]}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      <Icon
        name="chevron-right"
        size={21}
        color={danger ? colors.error : colors.outline}
      />
    </Pressable>
  );
}

export function InfoField({
  label,
  value,
  last = false,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View style={[styles.field, last && styles.lastRow]}>
      <Text style={styles.subtitle}>{label}</Text>
      <Text selectable style={styles.value}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.spaceSm,
    paddingVertical: spacing.spaceMd,
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
  },
  lastRow: { borderBottomWidth: 0 },
  icon: {
    width: 42,
    height: 42,
    borderRadius: radius.default,
    backgroundColor: colors.honeyChip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerIcon: { backgroundColor: colors.errorContainer },
  copy: { flex: 1, minWidth: 0, gap: spacing.spaceXs },
  title: { ...typography.labelLg, color: colors.onSurface },
  subtitle: { ...typography.bodySm, color: colors.onSurfaceVariant },
  dangerText: { color: colors.error },
  pressed: { opacity: 0.75 },
  field: {
    paddingVertical: spacing.spaceMd,
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
    gap: spacing.spaceXs,
  },
  value: { ...typography.bodyMd, color: colors.onSurface },
});

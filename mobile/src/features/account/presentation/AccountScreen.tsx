import { useAuth } from '@clerk/clerk-expo';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  colors,
  radius,
  shadows,
  spacing,
  typography,
} from '@/src/core/theme/tokens';
import { useAuthContext } from '@/src/features/auth/context/AuthContext';
import { signOutDevice } from '@/src/features/auth/session/sign-out-device';
import { pushRegistrationManager } from '@/src/features/notifications/push-registration-runtime';
import { clearApiCache } from '@/src/shared/api/client';
import {
  Card,
  HoneycombDecor,
  Icon,
  Pill,
  SectionTitle,
} from '@/src/shared/ui/MobileShell';
import { AccountLayout, roleLabels, SettingsRow } from './AccountLayout';

export default function AccountScreen() {
  const router = useRouter();
  const { signOut, getToken, userId, sessionId } = useAuth();
  const { data, currentFarmId } = useAuthContext();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const signingOut = useRef(false);
  const membership = data?.memberships.find(
    ({ farm }) => farm.id === currentFarmId,
  );
  const name = data?.user.fullName || data?.user.email || 'Tài khoản của bạn';
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((word) => word[0])
    .join('')
    .toUpperCase();

  async function logout() {
    if (signingOut.current) return;
    signingOut.current = true;
    setBusy(true);
    setError(null);
    try {
      await signOutDevice({
        unregisterDevice: () =>
          userId
            ? pushRegistrationManager.beforeSignOut(
                () => getToken({ skipCache: true }),
                userId,
              )
            : Promise.resolve(),
        signOut: async () => {
          // Close the native dialog before Clerk changes the protected route tree.
          setConfirmOpen(false);
          await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
          if (!sessionId) throw new Error('Session unavailable');
          await signOut({ sessionId });
        },
        clearCache: clearApiCache,
      });
      // Stack.Protected returns to the public index route after Clerk signs out.
    } catch {
      setError('Chưa đăng xuất được. Vui lòng kiểm tra kết nối và thử lại.');
      setBusy(false);
      signingOut.current = false;
      setConfirmOpen(true);
    }
  }

  return (
    <AccountLayout
      title="Tài khoản & cài đặt"
      subtitle="Quản lý ứng dụng của bạn"
    >
      <Card style={styles.hero}>
        <HoneycombDecor muted />
        <View style={styles.avatar}>
          {data?.user.avatarUrl ? (
            <Image
              accessibilityLabel="Ảnh tài khoản"
              source={{ uri: data.user.avatarUrl }}
              style={styles.avatarImage}
            />
          ) : (
            <Text style={styles.initials}>{initials || 'U'}</Text>
          )}
        </View>
        <View style={styles.heroCopy}>
          <Text style={styles.name}>{name}</Text>
          {data?.user.fullName ? (
            <Text style={styles.email}>{data.user.email}</Text>
          ) : null}
          <View style={styles.badge}>
            <Pill tone="success">
              <Icon
                name="verified-user"
                size={14}
                color={colors.statusSuccess}
              />
              <Text style={styles.active}>Đang đăng nhập</Text>
            </Pill>
          </View>
        </View>
      </Card>
      <SectionTitle title="Tài khoản" />
      <Card style={styles.menu}>
        <SettingsRow
          icon="person-outline"
          title="Thông tin tài khoản"
          subtitle="Thông tin đăng nhập và vai trò của bạn"
          onPress={() => router.push('/account/profile' as never)}
        />
        <View style={styles.farmRow}>
          <View style={styles.farmIcon}>
            <Icon name="hive" color={colors.primary} />
          </View>
          <View style={styles.flex}>
            <Text style={styles.label}>Trang trại đang chọn</Text>
            <Text style={styles.farmName}>
              {membership?.farm.name ?? 'Chưa chọn trang trại'}
            </Text>
            <Text style={styles.email}>
              {membership?.roles.map((role) => roleLabels[role]).join(' · ') ||
                'Chọn trang trại tại Tổng quan để xem vai trò'}
            </Text>
          </View>
        </View>
      </Card>
      <SectionTitle title="Cài đặt" />
      <Card style={styles.menu}>
        <SettingsRow
          icon="notifications-none"
          title="Quản lý thông báo"
          subtitle="Quyền thông báo, trạng thái thiết bị và hộp thông báo"
          last
          onPress={() => router.push('/account/notifications' as never)}
        />
      </Card>
      <SectionTitle title="Phiên đăng nhập" />
      <Card style={styles.menu}>
        <Text style={styles.sessionNote}>
          Tài khoản được giữ trên thiết bị khi bạn đóng và mở lại ứng dụng.
        </Text>
        <SettingsRow
          icon="logout"
          title="Đăng xuất"
          subtitle="Kết thúc phiên trên thiết bị này"
          last
          danger
          onPress={() => {
            setError(null);
            setConfirmOpen(true);
          }}
        />
      </Card>
      <Text style={styles.version}>
        Nuôi Ong · Phiên bản {Constants.expoConfig?.version ?? '1.0.0'}
      </Text>
      <Modal
        visible={confirmOpen}
        transparent
        animationType="none"
        onRequestClose={() => {
          if (!busy) setConfirmOpen(false);
        }}
      >
        <View style={styles.backdrop}>
          <View style={styles.dialog} accessibilityRole="alert">
            <View style={styles.logoutIcon}>
              <Icon name="logout" size={24} color={colors.error} />
            </View>
            <Text style={styles.dialogTitle}>Đăng xuất tài khoản?</Text>
            <Text style={styles.description}>
              Phiên đăng nhập và đăng ký nhận thông báo trên thiết bị này sẽ kết
              thúc. Bạn có thể đăng nhập lại bất cứ lúc nào.
            </Text>
            {error ? (
              <Text accessibilityRole="alert" style={styles.error}>
                {error}
              </Text>
            ) : null}
            <View style={styles.dialogActions}>
              <Pressable
                disabled={busy}
                accessibilityRole="button"
                onPress={() => setConfirmOpen(false)}
                style={[styles.cancel, busy && styles.disabled]}
              >
                <Text style={styles.cancelText}>Ở lại</Text>
              </Pressable>
              <Pressable
                disabled={busy}
                accessibilityRole="button"
                onPress={() => void logout()}
                style={[styles.confirm, busy && styles.disabled]}
              >
                {busy ? (
                  <ActivityIndicator size="small" color={colors.onError} />
                ) : (
                  <Icon name="logout" size={18} color={colors.onError} />
                )}
                <Text style={styles.confirmText}>
                  {busy ? 'Đang đăng xuất…' : 'Đăng xuất'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </AccountLayout>
  );
}

const styles = StyleSheet.create({
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.spaceMd,
    overflow: 'hidden',
    paddingVertical: spacing.spaceLg,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: radius.full,
    backgroundColor: colors.honeyChip,
    borderWidth: 1,
    borderColor: colors.borderAmberGlow,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: { width: '100%', height: '100%' },
  initials: { ...typography.headlineMd, color: colors.primary },
  heroCopy: { flex: 1, minWidth: 0, gap: spacing.spaceXs },
  name: { ...typography.headlineSm, color: colors.deepAmberStrong },
  email: { ...typography.bodySm, color: colors.onSurfaceVariant },
  badge: { alignSelf: 'flex-start', marginTop: spacing.spaceXs },
  active: { ...typography.labelMd, color: colors.statusSuccess },
  menu: { paddingVertical: 0 },
  farmRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.spaceSm,
    paddingVertical: spacing.spaceMd,
  },
  farmIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.default,
    backgroundColor: colors.honeyChip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: { flex: 1, minWidth: 0, gap: spacing.spaceXs },
  label: { ...typography.labelMd, color: colors.onSurfaceVariant },
  farmName: { ...typography.labelLg, color: colors.deepAmber },
  sessionNote: {
    ...typography.bodySm,
    color: colors.onSurfaceVariant,
    paddingTop: spacing.spaceMd,
  },
  version: {
    ...typography.bodySm,
    textAlign: 'center',
    color: colors.outline,
    paddingVertical: spacing.spaceSm,
  },
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.spaceLg,
    backgroundColor: colors.modalOverlay,
  },
  dialog: {
    width: '100%',
    maxWidth: 400,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    padding: spacing.spaceLg,
    gap: spacing.spaceSm,
    ...shadows.floating,
  },
  logoutIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 46,
    height: 46,
    borderRadius: radius.full,
    backgroundColor: colors.errorContainer,
  },
  dialogTitle: { ...typography.headlineSm, color: colors.deepAmberStrong },
  description: { ...typography.bodySm, color: colors.onSurfaceVariant },
  dialogActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.spaceSm,
    marginTop: spacing.spaceMd,
  },
  cancel: {
    flex: 1,
    minWidth: 80,
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: radius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirm: {
    flexGrow: 1,
    minHeight: 48,
    paddingHorizontal: spacing.spaceMd,
    gap: spacing.spaceSm,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.error,
    borderRadius: radius.full,
  },
  cancelText: { ...typography.labelLg, color: colors.onSurfaceVariant },
  confirmText: { ...typography.labelLg, color: colors.onError },
  error: { ...typography.bodySm, color: colors.error },
  disabled: { opacity: 0.6 },
});

import { useRouter } from 'expo-router';
import { StyleSheet, Text } from 'react-native';
import { colors, spacing, typography } from '@/src/core/theme/tokens';
import { Card, SectionTitle } from '@/src/shared/ui/MobileShell';
import { usePushRegistration } from '@/src/features/notifications/context/PushRegistrationProvider';
import PushRegistrationStatus from '@/src/features/notifications/presentation/PushRegistrationStatus';
import { AccountLayout, SettingsRow } from './AccountLayout';

export default function NotificationSettingsScreen() {
  const router = useRouter();
  const { retry, openSettings } = usePushRegistration();
  return (
    <AccountLayout
      title="Quản lý thông báo"
      subtitle="Tùy chọn cho thiết bị này"
    >
      <SectionTitle title="Trên điện thoại" />
      <Card>
        <PushRegistrationStatus />
        <Text style={styles.description}>
          Bật hoặc tắt quyền trong cài đặt điện thoại. Khi quay lại ứng dụng,
          trạng thái nhận thông báo được đồng bộ theo quyền bạn đã chọn.
        </Text>
        <SettingsRow
          icon="settings"
          title="Quyền thông báo"
          subtitle="Mở cài đặt ứng dụng trên điện thoại"
          onPress={openSettings}
        />
        <SettingsRow
          icon="sync"
          title="Đồng bộ lại thiết bị"
          subtitle="Kiểm tra quyền và đăng ký nhận thông báo"
          onPress={retry}
          last
        />
      </Card>
      <SectionTitle title="Trong ứng dụng" />
      <Card>
        <SettingsRow
          icon="notifications-none"
          title="Hộp thông báo"
          subtitle="Xem và xử lý thông báo của trang trại đang chọn"
          onPress={() => router.push('/notifications' as never)}
          last
        />
        <Text style={styles.description}>
          Tắt thông báo trên điện thoại không xóa thông báo trong ứng dụng. Nội
          dung và quyền xem vẫn theo tài khoản, vai trò và trang trại hiện tại.
        </Text>
      </Card>
    </AccountLayout>
  );
}

const styles = StyleSheet.create({
  description: {
    ...typography.bodySm,
    color: colors.onSurfaceVariant,
    paddingBottom: spacing.spaceSm,
  },
});

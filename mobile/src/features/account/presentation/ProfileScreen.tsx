import { Card, SectionTitle } from '@/src/shared/ui/MobileShell';
import { useAuthContext } from '@/src/features/auth/context/AuthContext';
import { AccountLayout, InfoField, roleLabels } from './AccountLayout';

export default function ProfileScreen() {
  const { data, currentFarmId } = useAuthContext();
  const membership = data?.memberships.find(
    ({ farm }) => farm.id === currentFarmId,
  );
  return (
    <AccountLayout
      title="Thông tin tài khoản"
      subtitle="Tài khoản đang đăng nhập"
    >
      <SectionTitle title="Thông tin cá nhân" />
      <Card>
        <InfoField
          label="Họ và tên"
          value={data?.user.fullName || 'Chưa cập nhật'}
        />
        <InfoField
          label="Email đăng nhập"
          value={data?.user.email || 'Chưa có email'}
          last
        />
      </Card>
      <SectionTitle title="Trang trại hiện tại" />
      <Card>
        <InfoField
          label="Tên trang trại"
          value={membership?.farm.name ?? 'Chưa chọn trang trại'}
        />
        <InfoField
          label="Mã trang trại"
          value={membership?.farm.code ?? 'Chưa chọn'}
        />
        <InfoField
          label="Vai trò tại trang trại này"
          value={
            membership?.roles.map((role) => roleLabels[role]).join(' · ') ||
            'Chưa có vai trò'
          }
          last
        />
      </Card>
    </AccountLayout>
  );
}

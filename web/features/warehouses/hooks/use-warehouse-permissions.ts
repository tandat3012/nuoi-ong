'use client';

import { useAuthContext } from '@/features/auth/context/auth-context';

export function useWarehousePermissions() {
  const { data: authData, selectedFarmId } = useAuthContext();
  const membership = authData.memberships.find(
    ({ farm }) => farm.id === selectedFarmId,
  );

  return {
    selectedFarmId,
    farmName: membership?.farm.name ?? 'Chưa chọn trang trại',
    canWrite:
      membership?.roles.some(
        (role) => role === 'ADMIN' || role === 'FARM_OWNER',
      ) ?? false,
  };
}

'use client';

import { useAuthContext } from '../context/auth-context';

/** Membership of the selected farm; ADMIN and FARM_OWNER may manage (write) farm data. */
export function useFarmMembership() {
  const { data, selectedFarmId } = useAuthContext();
  const membership = data.memberships.find(({ farm }) => farm.id === selectedFarmId);
  const canManageFarm = membership?.roles.some((role) => role === 'ADMIN' || role === 'FARM_OWNER') ?? false;
  const storeFarm = data.storeFarm;
  const isStoreFarm = !!storeFarm && storeFarm.id === selectedFarmId;
  const canManageOrders =
    membership?.roles.some((role) => ['ADMIN', 'FARM_OWNER', 'EMPLOYEE'].includes(role)) ?? false;
  return { selectedFarmId, membership, canManageFarm, canManageOrders, storeFarm, isStoreFarm };
}

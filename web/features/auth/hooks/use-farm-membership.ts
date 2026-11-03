'use client';

import { useAuthContext } from '../context/auth-context';
import {
  FARM_ADMIN_ROLES,
  FARM_AREA_ROLES,
  HISTORY_ROLES,
  STORE_DELIVERY_ROLES,
  STORE_MANAGE_ROLES,
  WAREHOUSE_MANAGE_ROLES,
  hasAnyRole,
} from '../farm-roles';

/** Membership of the selected farm and what its roles allow; see farm-roles.ts. */
export function useFarmMembership() {
  const { data, selectedFarmId } = useAuthContext();
  const membership = data.memberships.find(({ farm }) => farm.id === selectedFarmId);
  const roles = membership?.roles ?? [];
  const isStoreFarm = !!selectedFarmId && data.storeFarmIds.includes(selectedFarmId);
  return {
    selectedFarmId,
    membership,
    /** Personnel, assets and maintenance management. */
    canManageFarm: hasAnyRole(roles, FARM_ADMIN_ROLES),
    canManageWarehouse: hasAnyRole(roles, WAREHOUSE_MANAGE_ROLES),
    canManageStore: hasAnyRole(roles, STORE_MANAGE_ROLES),
    canDeliver: hasAnyRole(roles, STORE_DELIVERY_ROLES),
    /** The store catalog is shared by every farm; only admins edit it. */
    canEditCatalog: roles.includes('ADMIN'),
    canAccessFarmArea: hasAnyRole(roles, FARM_AREA_ROLES),
    /** Own activity unless farm admin; same staff set as the dashboard metrics. */
    canViewHistory: hasAnyRole(roles, HISTORY_ROLES),
    canViewMetrics: hasAnyRole(roles, HISTORY_ROLES),
    isStoreFarm,
  };
}

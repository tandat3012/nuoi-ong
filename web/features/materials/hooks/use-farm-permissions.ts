"use client";

import { useFarmMembership } from "@/features/auth/hooks/use-farm-membership";

export function useFarmPermissions() {
  const { selectedFarmId, membership, canManageWarehouse } = useFarmMembership();

  return {
    selectedFarmId,
    farmName: membership?.farm.name ?? "Chưa chọn trang trại",
    canWrite: canManageWarehouse,
  };
}

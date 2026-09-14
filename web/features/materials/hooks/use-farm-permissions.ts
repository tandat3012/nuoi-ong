"use client";

import { useAuthContext } from "@/features/auth/context/auth-context";

export function useFarmPermissions() {
  const { data: authData, selectedFarmId } = useAuthContext();

  const membership = authData.memberships.find(
    ({ farm }) => farm.id === selectedFarmId,
  );

  const canWrite =
    membership?.roles.some(
      (role) => role === "ADMIN" || role === "FARM_OWNER",
    ) ?? false;

  return {
    selectedFarmId,
    farmName: membership?.farm.name ?? "Chưa chọn trang trại",
    canWrite,
  };
}

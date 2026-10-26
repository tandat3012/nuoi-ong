"use client";

import { useAuthContext } from "@/features/auth";
import { ErrorAlert } from "@/shared/components/ui/error-alert";
import { canManagePersonnel } from "./personnel.logic";
import { PersonnelList } from "./components/personnel-list";
import { PersonnelDetailView } from "./components/personnel-detail";

export function PersonnelScreen({ memberId }: { memberId?: string }) {
  const { data, selectedFarmId } = useAuthContext();
  const membership = data.memberships.find(
    ({ farm }) => farm.id === selectedFarmId,
  );
  if (!membership || !canManagePersonnel(membership.roles))
    return (
      <ErrorAlert message="Bạn không có quyền quản lý nhân sự trong trại đang chọn." />
    );
  const key = `${membership.farm.id}:${membership.roles.join(",")}:${memberId ?? ""}`;
  return memberId ? (
    <PersonnelDetailView
      key={key}
      farmId={membership.farm.id}
      farmName={membership.farm.name}
      memberId={memberId}
      actorMemberId={membership.memberId}
      roles={membership.roles}
    />
  ) : (
    <PersonnelList
      key={key}
      farmId={membership.farm.id}
      roles={membership.roles}
    />
  );
}

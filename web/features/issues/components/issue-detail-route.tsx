"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthContext } from "@/features/auth";
import { IssueDetail } from "./issue-detail";
import { IssueDraftForm } from "./issue-draft-form";
import type { IssueDetail as IssueDetailData } from "../types/issue";

export function IssueDetailRoute({ id }: { id: string }) {
  const { data, selectedFarmId } = useAuthContext();
  const membership = data.memberships.find(
    ({ farm }) => farm.id === selectedFarmId,
  );
  if (!membership)
    return <p role="status">Vui lòng chọn trang trại để xem phiếu xuất.</p>;
  const canWrite = membership.roles.some(
    (role) => role === "ADMIN" || role === "FARM_OWNER",
  );
  return (
    <FarmIssueDetailRoute
      key={`${membership.farm.id}:${id}`}
      farmId={membership.farm.id}
      id={id}
      canWrite={canWrite}
    />
  );
}

function FarmIssueDetailRoute({
  farmId,
  id,
  canWrite,
}: {
  farmId: string;
  id: string;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<IssueDetailData | null>(null);
  const [attempt, setAttempt] = useState(0);
  if (editing)
    return (
      <IssueDraftForm
        key={editing.issue.id}
        farmId={farmId}
        canWrite={canWrite}
        initial={editing}
        onCancel={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          setAttempt((value) => value + 1);
        }}
      />
    );
  return (
    <IssueDetail
      key={`${id}:${attempt}`}
      farmId={farmId}
      id={id}
      canWrite={canWrite}
      onEdit={setEditing}
      onChanged={() => setAttempt((value) => value + 1)}
      onBack={() => router.push("/issues")}
    />
  );
}

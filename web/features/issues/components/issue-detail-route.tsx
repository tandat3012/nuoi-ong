"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthContext } from "@/features/auth";
import { useNotificationRefresh } from "@/features/notifications";
import { IssueDetail } from "./issue-detail";
import { IssueDraftForm } from "./issue-draft-form";
import type { IssueDetail as IssueDetailData } from "../types/issue";
import { canCreateStockDocuments } from "@/features/stock-documents";
import type { StockDocumentViewer } from "@/features/stock-documents/stock-document.logic";

export function IssueDetailRoute({ id }: { id: string }) {
  const { data, selectedFarmId } = useAuthContext();
  const notificationRevision = useNotificationRefresh();
  const membership = data.memberships.find(
    ({ farm }) => farm.id === selectedFarmId,
  );
  if (!membership)
    return <p role="status">Vui lòng chọn trang trại để xem phiếu xuất.</p>;
  return (
    <FarmIssueDetailRoute
      key={`${membership.farm.id}:${id}:${notificationRevision}`}
      farmId={membership.farm.id}
      id={id}
      viewer={{ roles: membership.roles, memberId: membership.memberId }}
    />
  );
}

function FarmIssueDetailRoute({
  farmId,
  id,
  viewer,
}: {
  farmId: string;
  id: string;
  viewer: StockDocumentViewer;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<IssueDetailData | null>(null);
  const [attempt, setAttempt] = useState(0);
  if (editing)
    return (
      <IssueDraftForm
        key={editing.issue.id}
        farmId={farmId}
        canWrite={canCreateStockDocuments(viewer.roles)}
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
      viewer={viewer}
      onEdit={setEditing}
      onChanged={() => setAttempt((value) => value + 1)}
      onBack={() => router.push("/issues")}
    />
  );
}

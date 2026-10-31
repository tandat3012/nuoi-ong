"use client";

import { useState } from "react";
import { useAuthenticatedRequest } from "@/features/auth";
import { Button } from "@/shared/components/ui/button";
import { FormDialog } from "@/shared/components/ui/form-dialog";
import { DateInput } from "@/shared/components/ui/date-input";
import { Textarea } from "@/shared/components/ui/textarea";
import {
  approveMaintenanceRequest,
  approveTransferRequest,
  rejectRequest,
} from "../api/requests.api";
import {
  normalizeRequestReason,
  requestActions,
  runRequestAction,
  serializeScheduledAt,
  transferDestination,
} from "../requests.logic";
import type { RequestRow } from "../types/request";
import { requestFailureMessage, requestFormError } from "./request-error";

export function RequestReview({
  farmId, row, roles, onChanged, onError,
}: {
  farmId: string;
  row: RequestRow;
  roles: readonly string[];
  onChanged: () => void;
  onError: (message: string | null) => void;
}) {
  const request = useAuthenticatedRequest();
  const [action, setAction] = useState<"approve" | "reject" | null>(null);
  const actions = requestActions(roles, row.status);
  const maintenance = "maintenanceType" in row;
  const type = maintenance ? "maintenance" : "transfer";
  if (!actions.approve && !actions.reject) return null;
  return (
    <>
      <Button onClick={() => setAction("approve")}>Duyệt</Button>
      <Button variant="outline" onClick={() => setAction("reject")}>
        Từ chối
      </Button>
      {action && (
        <FormDialog
          title={action === "reject" ? "Từ chối yêu cầu" : maintenance ? "Duyệt yêu cầu bảo trì" : "Duyệt chuyển tài sản"}
          description={action === "reject"
            ? `Từ chối yêu cầu cho tài sản ${row.assetCode}. Người gửi sẽ nhận được lý do.`
            : maintenance
              ? `Chọn lịch bảo trì cho tài sản ${row.assetCode}.`
              : `Duyệt chuyển tài sản ${row.assetCode} đến ${transferDestination(row)}?`}
          submitLabel={action === "reject" ? "Từ chối yêu cầu" : "Duyệt yêu cầu"}
          onClose={() => setAction(null)}
          errorMessage={requestFormError}
          onSubmit={async (data) => {
            let perform: () => Promise<unknown>;
            if (action === "reject") {
              const result = normalizeRequestReason(String(data.get("rejectionReason") ?? ""));
              if ("error" in result) throw new Error(result.error);
              perform = () => rejectRequest(request, farmId, type, row.id, result.reason);
            } else if (maintenance) {
              const result = serializeScheduledAt(String(data.get("scheduledAt") ?? ""));
              if ("error" in result) throw new Error(result.error);
              perform = () => approveMaintenanceRequest(request, farmId, row.id, result.scheduledAt);
            } else {
              perform = () => approveTransferRequest(request, farmId, row.id);
            }
            await runRequestAction(perform, {
              onChanged,
              onError: (failure) => onError(failure === null ? null : requestFailureMessage(failure)),
            });
          }}
        >
          {action === "reject" ? (
            <label className="block space-y-2 text-sm font-medium">
              Lý do từ chối (3–1000 ký tự)
              <Textarea name="rejectionReason" required minLength={3} maxLength={1000} rows={4} />
            </label>
          ) : maintenance ? (
            <label className="block space-y-2 text-sm font-medium">
              Ngày và giờ bảo trì
              <DateInput name="scheduledAt" mode="datetime" required />
            </label>
          ) : null}
        </FormDialog>
      )}
    </>
  );
}

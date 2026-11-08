"use client";

import { useState } from "react";
import { useAuthenticatedRequest } from "@/features/auth";
import { Button } from "@/shared/components/ui/button";
import { FormDialog } from "@/shared/components/ui/form-dialog";
import { DateInput } from "@/shared/components/ui/date-input";
import { Textarea } from "@/shared/components/ui/textarea";
import { Input } from "@/shared/components/ui/input";
import { Select } from "@/shared/components/ui/select";
import {
  approveMaintenanceRequest,
  approveTransferRequest,
  receiveTransferRequest,
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
  const [action, setAction] = useState<"approve" | "reject" | "receive" | null>(null);
  const maintenance = "maintenanceType" in row;
  const actions = requestActions(roles, row.status, maintenance);
  const type = maintenance ? "maintenance" : "transfer";
  if (!actions.approve && !actions.reject && !actions.receive) return null;
  return (
    <>
      {actions.receive && <Button onClick={() => setAction("receive")}>Nhận tài sản</Button>}
      {actions.approve && <Button onClick={() => setAction("approve")}>Duyệt</Button>}
      {actions.reject && (
        <Button variant="outline" onClick={() => setAction("reject")}>
          Từ chối
        </Button>
      )}
      {action && (
        <FormDialog
          title={action === "receive" ? "Kho đích nhận tài sản" : action === "reject" ? "Từ chối yêu cầu" : maintenance ? "Duyệt yêu cầu bảo trì" : "Duyệt chuyển tài sản"}
          description={action === "receive"
            ? `Quét hoặc nhập mã tài sản thực nhận${"maintenanceType" in row ? "" : ` tại ${transferDestination(row)}`}. Tồn kho đích chỉ tăng khi xác nhận.`
            : action === "reject"
            ? `Từ chối yêu cầu cho tài sản ${row.assetCode}. Người gửi sẽ nhận được lý do.`
            : maintenance
              ? `Chọn lịch bảo trì cho tài sản ${row.assetCode}.`
              : `Duyệt chuyển tài sản ${row.assetCode} đến ${transferDestination(row)}? Khác kho thì kho nguồn xuất ngay, kho đích xác nhận nhận sau.`}
          submitLabel={action === "receive" ? "Xác nhận đã nhận" : action === "reject" ? "Từ chối yêu cầu" : "Duyệt yêu cầu"}
          onClose={() => setAction(null)}
          errorMessage={requestFormError}
          onSubmit={async (data) => {
            let perform: () => Promise<unknown>;
            if (action === "receive") {
              const assetCode = String(data.get("assetCode") ?? "").trim();
              const condition = data.get("condition") === "DAMAGED" ? "DAMAGED" : "GOOD";
              const note = String(data.get("note") ?? "").trim() || null;
              if (!assetCode) throw new Error("Nhập mã tài sản thực nhận.");
              if (condition === "DAMAGED" && !note) throw new Error("Ghi rõ tình trạng hỏng.");
              perform = () => receiveTransferRequest(request, farmId, row.id, { assetCode, condition, note });
            } else if (action === "reject") {
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
          {action === "receive" ? (
            <>
              <label className="block space-y-2 text-sm font-medium">
                Mã tài sản thực nhận
                <Input name="assetCode" required maxLength={100} autoComplete="off" />
              </label>
              <label className="block space-y-2 text-sm font-medium">
                Tình trạng khi nhận
                <Select name="condition" defaultValue="GOOD">
                  <option value="GOOD">Tốt, dùng được</option>
                  <option value="DAMAGED">Hỏng, chưa dùng được</option>
                </Select>
              </label>
              <label className="block space-y-2 text-sm font-medium">
                Ghi chú (bắt buộc nếu hỏng)
                <Textarea name="note" maxLength={4000} rows={3} />
              </label>
            </>
          ) : action === "reject" ? (
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

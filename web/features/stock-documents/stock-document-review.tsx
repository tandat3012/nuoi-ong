"use client";

import { useRef, useState } from "react";
import { useAuthenticatedRequest } from "@/features/auth/hooks/use-authenticated-request";
import { ApiError } from "@/shared/api/client";
import { Button } from "@/shared/components/ui/button";
import { FormDialog } from "@/shared/components/ui/form-dialog";
import { Textarea } from "@/shared/components/ui/textarea";
import {
  normalizeRejectionReason,
  shouldReloadAfterFailure,
  stockDocumentErrorMessage,
  type StockDocumentKind,
} from "./stock-document.logic";

const failureStatus = (failure: unknown) =>
  failure instanceof ApiError ? failure.status : null;
const failureMessage = (failure: unknown) =>
  failure instanceof ApiError
    ? stockDocumentErrorMessage(failure.status, failure.message)
    : failure instanceof Error && failure.message
      ? failure.message
      : stockDocumentErrorMessage(null, "");

/** Submit (employee) and reject (approver) buttons shared by the four stock documents. */
export function StockDocumentReview({
  kind,
  farmId,
  id,
  code,
  canSubmit,
  canReject,
  disabled,
  onChanged,
  onError,
}: {
  kind: StockDocumentKind;
  farmId: string;
  id: string;
  code: string;
  canSubmit: boolean;
  canReject: boolean;
  disabled?: boolean;
  /** Called after every answered request so the screen reloads the document. */
  onChanged: () => void;
  /** Failures go to the parent, because the reload above can unmount this component. */
  onError: (message: string | null) => void;
}) {
  const request = useAuthenticatedRequest();
  const pending = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const [rejecting, setRejecting] = useState(false);

  async function submit() {
    if (pending.current) return;
    if (
      !window.confirm(
        `Gửi phiếu ${code} để quản lý duyệt? Sau khi gửi, bạn không sửa hoặc hủy được phiếu nữa.`,
      )
    )
      return;
    pending.current = true;
    setSubmitting(true);
    onError(null);
    try {
      await request(`/${kind}/${id}/submit`, {
        method: "POST",
        params: { farmId },
      });
      onChanged();
    } catch (failure) {
      onError(failureMessage(failure));
      if (shouldReloadAfterFailure(failureStatus(failure))) onChanged();
    } finally {
      pending.current = false;
      setSubmitting(false);
    }
  }

  if (!canSubmit && !canReject) return null;
  return (
    <>
      {canSubmit && (
        <Button disabled={disabled || submitting} onClick={() => void submit()}>
          {submitting ? "Đang gửi duyệt..." : "Gửi duyệt"}
        </Button>
      )}
      {canReject && (
        <Button
          variant="outline"
          className="border-destructive/40 text-destructive hover:bg-destructive/10"
          disabled={disabled || submitting}
          onClick={() => {
            onError(null);
            setRejecting(true);
          }}
        >
          Từ chối
        </Button>
      )}
      {rejecting && (
        <FormDialog
          title={`Từ chối phiếu ${code}`}
          description="Người tạo phiếu sẽ nhận được lý do. Phiếu bị từ chối không thể gửi lại."
          submitLabel="Từ chối phiếu"
          onClose={() => setRejecting(false)}
          errorMessage={failureMessage}
          onSubmit={async (data) => {
            const result = normalizeRejectionReason(
              String(data.get("rejectionReason") ?? ""),
            );
            if ("error" in result) throw new Error(result.error);
            try {
              await request(`/${kind}/${id}/reject`, {
                method: "POST",
                params: { farmId },
                data: { rejectionReason: result.reason },
              });
            } catch (failure) {
              if (shouldReloadAfterFailure(failureStatus(failure))) {
                // The dialog closes with the reload, so the parent keeps the message.
                onError(failureMessage(failure));
                onChanged();
              }
              throw failure;
            }
            onChanged();
          }}
        >
          <label className="block space-y-1 text-sm font-medium">
            <span>Lý do từ chối</span>
            <Textarea name="rejectionReason" required maxLength={4000} />
          </label>
        </FormDialog>
      )}
    </>
  );
}

export function RejectionNotice({ reason }: { reason?: string | null }) {
  if (!reason) return null;
  return (
    <p
      role="status"
      className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
    >
      <span className="font-semibold">Lý do từ chối:</span> {reason}
    </p>
  );
}

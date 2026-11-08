"use client";

import { useState } from "react";
import { useAuthenticatedRequest } from "@/features/auth/hooks/use-authenticated-request";
import { ApiError } from "@/shared/api/client";
import { Button } from "@/shared/components/ui/button";
import { Textarea } from "@/shared/components/ui/textarea";
import { acknowledgeIssue } from "../api/issues.api";
import type { Issue } from "../types/issue";
import { issueReceiptAction } from "./issue-draft.logic";

/** NV02: who the goods were handed to and whether they confirmed receipt. */
export function IssueReceipt({
  farmId,
  issue,
  viewer,
  onChanged,
}: {
  farmId: string;
  issue: Issue;
  viewer: { roles: readonly string[]; memberId?: string };
  onChanged: () => void;
}) {
  const request = useAuthenticatedRequest();
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!issue.recipientMemberId) return null;
  const action = issueReceiptAction(viewer, issue);
  const onBehalf = action === "onBehalf";
  const recordedForThem =
    issue.receivedRecordedByMemberId &&
    issue.receivedRecordedByMemberId !== issue.recipientMemberId;

  async function submit() {
    if (pending) return;
    if (onBehalf && !note.trim()) {
      setError("Ghi căn cứ khi ghi nhận thay người nhận (biên bản, chữ ký…).");
      return;
    }
    setPending(true);
    setError(null);
    try {
      await acknowledgeIssue(request, farmId, issue.id, note.trim() || null);
      onChanged();
    } catch (failure: unknown) {
      const status = failure instanceof ApiError ? failure.status : 0;
      setError(
        status === 409
          ? "Phiếu chưa được xác nhận xuất hoặc không ghi người nhận."
          : status === 404 || status === 403
            ? "Bạn không phải người nhận hoặc quản lý kho của phiếu này."
            : status === 400
              ? "Cần ghi căn cứ khi ghi nhận thay người nhận."
              : "Chưa ghi nhận được. Tải lại phiếu rồi thử lại.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <section
      aria-label="Người nhận hàng"
      className="space-y-3 rounded-xl border bg-card p-5 text-sm"
    >
      <p>
        <span className="text-muted-foreground">Người nhận: </span>
        <strong>{issue.recipientName ?? "—"}</strong>
      </p>
      {issue.receivedAt ? (
        <p role="status">
          Đã xác nhận nhận lúc{" "}
          {new Date(issue.receivedAt).toLocaleString("vi-VN")}
          {recordedForThem ? " (quản lý kho ghi nhận thay)" : ""}.
          {issue.receiptNote && (
            <span className="block whitespace-pre-wrap break-words text-muted-foreground">
              {issue.receiptNote}
            </span>
          )}
        </p>
      ) : (
        <p className="text-muted-foreground">
          {issue.status === "CONFIRMED"
            ? "Chưa xác nhận đã nhận. Tồn kho đã trừ khi xuất, xác nhận nhận không trừ thêm."
            : "Người nhận xác nhận sau khi phiếu được xác nhận xuất."}
        </p>
      )}
      {action && (
        <>
          <label className="block space-y-1 font-medium">
            {onBehalf ? "Căn cứ ghi nhận thay (bắt buộc)" : "Ghi chú (không bắt buộc)"}
            <Textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={4000}
              rows={2}
              className="w-full"
            />
          </label>
          {error && (
            <p role="alert" className="text-destructive">
              {error}
            </p>
          )}
          <Button onClick={() => void submit()} disabled={pending}>
            {pending
              ? "Đang ghi nhận…"
              : onBehalf
                ? "Ghi nhận thay: đã nhận"
                : "Xác nhận đã nhận"}
          </Button>
        </>
      )}
    </section>
  );
}

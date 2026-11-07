"use client";

import { useState } from "react";
import { useAuthenticatedRequest } from "@/features/auth";
import { ApiError } from "@/shared/api/client";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Select } from "@/shared/components/ui/select";
import type { createStockDocumentLock } from "@/features/stock-documents/stock-document.logic";
import { receiveErrorMessage } from "../transfer-receive.logic";

/** Owner/admin settles what a short receipt left open: back to the source, or written off. */
export function TransferResolvePanel({
  farmId,
  id,
  code,
  lock,
  onResolved,
  onClose,
}: {
  farmId: string;
  id: string;
  code: string;
  lock: ReturnType<typeof createStockDocumentLock>;
  onResolved: () => void;
  onClose: () => void;
}) {
  const request = useAuthenticatedRequest();
  const [resolution, setResolution] = useState("RETURN_TO_SOURCE");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function resolve() {
    if (!note.trim()) {
      setError("Phải ghi căn cứ xử lý.");
      return;
    }
    if (!lock.acquire()) return;
    setSaving(true);
    setError(null);
    try {
      await request(`/stock-transfers/${id}/resolve`, {
        method: "POST",
        params: { farmId },
        data: { resolution, note: note.trim() },
      });
      onResolved();
    } catch (failure) {
      const details =
        failure instanceof ApiError
          ? (failure.details as { message?: string | string[] } | undefined)
          : undefined;
      const message = Array.isArray(details?.message)
        ? details.message.join(", ")
        : (details?.message ?? (failure as Error).message);
      setError(receiveErrorMessage(message));
    } finally {
      setSaving(false);
      lock.release();
    }
  }

  return (
    <section className="space-y-3 rounded-xl border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold">Xử lý chênh lệch · {code}</h2>
        <Button variant="outline" onClick={onClose} disabled={saving}>
          Đóng
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        Phần thiếu đã trừ khỏi kho nguồn. Trả về kho nguồn sẽ cộng lại phần đó;
        ghi nhận mất/hỏng thì không cộng tồn ở đâu.
      </p>
      {error && (
        <p role="alert" className="text-sm font-semibold text-destructive">
          {error}
        </p>
      )}
      <fieldset disabled={saving} className="space-y-3">
        <Select
          aria-label="Cách xử lý"
          value={resolution}
          onChange={(event) => setResolution(event.target.value)}
        >
          <option value="RETURN_TO_SOURCE">Trả phần thiếu về kho nguồn</option>
          <option value="WRITE_OFF">Ghi nhận mất/hỏng</option>
        </Select>
        <Input
          aria-label="Căn cứ xử lý"
          maxLength={1000}
          placeholder="Căn cứ xử lý (bắt buộc)"
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
        <Button onClick={() => void resolve()} disabled={lock.locked}>
          {saving ? "Đang lưu..." : "Xác nhận xử lý"}
        </Button>
      </fieldset>
    </section>
  );
}

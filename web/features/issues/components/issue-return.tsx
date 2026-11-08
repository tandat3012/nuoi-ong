"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthenticatedRequest } from "@/features/auth/hooks/use-authenticated-request";
import { ApiError } from "@/shared/api/client";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Textarea } from "@/shared/components/ui/textarea";
import { canCreateStockDocuments } from "@/features/stock-documents/stock-document.logic";
import { formatInventoryQuantity } from "@/features/inventory/inventory.logic";
import { createIssueReturn } from "../api/issues.api";
import type { IssueDetail } from "../types/issue";
import {
  formatMilli,
  issueReturnPayload,
  remainingReturn,
  returnableLines,
  type IssueReturnRow,
} from "./issue-return.logic";

/** NV02: record goods given back from this issue as a DRAFT receipt; only the accepted part restocks. */
export function IssueReturn({
  farmId,
  detail,
  roles,
}: {
  farmId: string;
  detail: IssueDetail;
  roles: readonly string[];
}) {
  const request = useAuthenticatedRequest();
  const router = useRouter();
  const lines = returnableLines(detail);
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Record<string, IssueReturnRow>>({});
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!lines.length || !canCreateStockDocuments(roles)) return null;

  const rowOf = (id: string) =>
    rows[id] ?? {
      issueItemId: id,
      acceptedQuantity: "",
      rejectedQuantity: "",
      rejectionReason: "",
    };
  const update = (id: string, change: Partial<IssueReturnRow>) =>
    setRows((current) => ({ ...current, [id]: { ...rowOf(id), ...change } }));

  async function submit() {
    if (pending) return;
    const payload = issueReturnPayload(
      lines,
      lines.map((line) => rowOf(line.id)),
    );
    if ("error" in payload) {
      setError(payload.error);
      return;
    }
    setPending(true);
    setError(null);
    try {
      const response = await createIssueReturn(request, farmId, detail.issue.id, {
        note: note.trim() || undefined,
        items: payload.items.map((item) => ({
          ...item,
          rejectionReason: item.rejectionReason || undefined,
        })),
      });
      router.push(`/receipts?id=${encodeURIComponent(response.data.receipt.id)}`);
    } catch (failure: unknown) {
      const status = failure instanceof ApiError ? failure.status : 0;
      setError(
        status === 409
          ? "Phiếu xuất không còn nhận hoàn trả hoặc lượng trả vượt lượng còn lại. Tải lại phiếu rồi thử lại."
          : status === 403 || status === 404
            ? "Bạn không có quyền lập phiếu nhập cho kho này."
            : "Chưa lập được phiếu hoàn trả. Kiểm tra số lượng rồi thử lại.",
      );
      setPending(false);
    }
  }

  return (
    <section
      aria-label="Hoàn trả nội bộ"
      className="space-y-3 rounded-xl border bg-card p-5 text-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p>
          <strong>Hoàn trả nội bộ.</strong>{" "}
          <span className="text-muted-foreground">
            Lượng đạt được cộng lại tồn khi phiếu nhập hoàn trả được xác nhận; lượng không đạt chỉ ghi nhận.
          </span>
        </p>
        {!open && (
          <Button variant="outline" onClick={() => setOpen(true)}>
            Nhận hoàn trả
          </Button>
        )}
      </div>
      {open && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="border-b">
                <tr>
                  {["Hàng", "Đã xuất", "Còn có thể trả", "Đạt", "Không đạt", "Lý do / tình trạng"].map(
                    (label) => (
                      <th key={label} scope="col" className="px-2 py-2">
                        {label}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody className="divide-y">
                {lines.map((line) => {
                  const row = rowOf(line.id);
                  const name = line.itemName ?? line.itemCode ?? line.itemId;
                  return (
                    <tr key={line.id}>
                      <td className="px-2 py-2">
                        <p className="font-medium">{name}</p>
                        {line.lotCode && (
                          <p className="text-xs text-muted-foreground">Lô {line.lotCode}</p>
                        )}
                      </td>
                      <td className="px-2 py-2 tabular-nums">
                        {formatInventoryQuantity(line.quantity)}
                      </td>
                      <td className="px-2 py-2 tabular-nums">
                        {formatMilli(remainingReturn(line))} {line.unitSymbol ?? ""}
                      </td>
                      <td className="px-2 py-2">
                        <Input
                          inputMode="decimal"
                          aria-label={`Lượng đạt của ${name}`}
                          value={row.acceptedQuantity}
                          onChange={(event) =>
                            update(line.id, { acceptedQuantity: event.target.value })
                          }
                          className="w-24"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <Input
                          inputMode="decimal"
                          aria-label={`Lượng không đạt của ${name}`}
                          value={row.rejectedQuantity}
                          onChange={(event) =>
                            update(line.id, { rejectedQuantity: event.target.value })
                          }
                          className="w-24"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <Input
                          aria-label={`Lý do không đạt của ${name}`}
                          value={row.rejectionReason}
                          maxLength={4000}
                          onChange={(event) =>
                            update(line.id, { rejectionReason: event.target.value })
                          }
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <label className="block space-y-1 font-medium">
            Ghi chú (người trả, căn cứ…)
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
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void submit()} disabled={pending}>
              {pending ? "Đang lập phiếu…" : "Lập phiếu nhập hoàn trả"}
            </Button>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Đóng
            </Button>
          </div>
        </>
      )}
    </section>
  );
}

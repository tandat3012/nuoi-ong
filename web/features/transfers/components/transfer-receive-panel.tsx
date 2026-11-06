"use client";

import { useEffect, useState } from "react";
import { useAuthenticatedRequest } from "@/features/auth";
import { formatInventoryQuantity } from "@/features/inventory";
import { ApiError } from "@/shared/api/client";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { BeeLoader } from "@/shared/components/ui/bee-loader";
import type { createStockDocumentLock } from "@/features/stock-documents/stock-document.logic";
import {
  receiveErrorMessage,
  receivePayload,
  type ReceiveInput,
} from "../transfer-receive.logic";

type Line = {
  id: string;
  quantity: string;
  itemCode: string | null;
  itemName: string | null;
  unitSymbol: string | null;
  unitName: string | null;
  lotCode: string | null;
};

/** Destination counts a dispatched transfer in; empty fields mean "arrived in full". */
export function TransferReceivePanel({
  farmId,
  id,
  code,
  lock,
  onReceived,
  onClose,
}: {
  farmId: string;
  id: string;
  code: string;
  lock: ReturnType<typeof createStockDocumentLock>;
  onReceived: () => void;
  onClose: () => void;
}) {
  const request = useAuthenticatedRequest();
  const [lines, setLines] = useState<Line[] | null>(null);
  const [inputs, setInputs] = useState<Record<string, ReceiveInput>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void request<{ data: { items: Line[] } }>(`/stock-transfers/${id}`, {
      params: { farmId },
    })
      .then(({ data }) => {
        if (!cancelled) setLines(data.items);
      })
      .catch(() => {
        if (!cancelled) setError("Không tải được dòng hàng của phiếu.");
      });
    return () => {
      cancelled = true;
    };
  }, [request, farmId, id]);

  const input = (lineId: string) =>
    inputs[lineId] ?? { receivedQuantity: "", discrepancyReason: "" };

  async function receive() {
    if (!lines) return;
    let payload;
    try {
      payload = receivePayload(lines, inputs);
    } catch (invalid) {
      setError((invalid as Error).message);
      return;
    }
    if (!lock.acquire()) return;
    setSaving(true);
    setError(null);
    try {
      await request(`/stock-transfers/${id}/receive`, {
        method: "POST",
        params: { farmId },
        data: payload,
      });
      onReceived();
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
        <h2 className="font-semibold">Nhận hàng · {code}</h2>
        <Button variant="outline" onClick={onClose} disabled={saving}>
          Đóng
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        Nhập số thực nhận cho dòng bị thiếu; để trống là nhận đủ. Kho chỉ được
        cộng đúng số thực nhận.
      </p>
      {error && (
        <p role="alert" className="text-sm font-semibold text-destructive">
          {error}
        </p>
      )}
      {!lines ? (
        !error && <BeeLoader label="Đang tải dòng hàng..." size="sm" />
      ) : (
        <fieldset disabled={saving} className="space-y-3">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-muted/50">
                <tr>
                  {["Hàng hóa", "Lô", "Đã xuất", "Thực nhận", "Lý do lệch"].map(
                    (label) => (
                      <th key={label} scope="col" className="px-3 py-2">
                        {label}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody className="divide-y">
                {lines.map((line) => {
                  const unit = line.unitSymbol || line.unitName || "";
                  const label = line.itemCode
                    ? `${line.itemCode} — ${line.itemName}`
                    : line.id;
                  const value = input(line.id);
                  return (
                    <tr key={line.id}>
                      <td className="px-3 py-2">{label}</td>
                      <td className="px-3 py-2">{line.lotCode ?? "—"}</td>
                      <td className="px-3 py-2">
                        {formatInventoryQuantity(line.quantity)} {unit}
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          aria-label={`Thực nhận ${label}`}
                          inputMode="decimal"
                          placeholder={formatInventoryQuantity(line.quantity)}
                          value={value.receivedQuantity}
                          onChange={(event) =>
                            setInputs({
                              ...inputs,
                              [line.id]: {
                                ...value,
                                receivedQuantity: event.target.value,
                              },
                            })
                          }
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          aria-label={`Lý do lệch ${label}`}
                          maxLength={1000}
                          placeholder="Thất lạc, hỏng…"
                          value={value.discrepancyReason}
                          onChange={(event) =>
                            setInputs({
                              ...inputs,
                              [line.id]: {
                                ...value,
                                discrepancyReason: event.target.value,
                              },
                            })
                          }
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Button onClick={() => void receive()} disabled={lock.locked}>
            {saving ? "Đang lưu..." : "Xác nhận nhận hàng"}
          </Button>
        </fieldset>
      )}
    </section>
  );
}

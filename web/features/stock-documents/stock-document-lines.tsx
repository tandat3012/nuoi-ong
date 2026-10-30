"use client";

import { useEffect, useRef, useState } from "react";
import { useAuthenticatedRequest } from "@/features/auth/hooks/use-authenticated-request";
import { WarehouseLotSelect } from "@/features/inventory";
import { HistoryPanel } from "@/features/history";
import { ApiError } from "@/shared/api/client";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Select } from "@/shared/components/ui/select";
import { Textarea } from "@/shared/components/ui/textarea";
import {
  documentCodeLabel,
  isFarmOwner,
  numberingDraft,
  numberingOptionsError,
  numberingOptionsPayload,
  shouldReloadAfterFailure,
  stockDocumentActions,
  stockDocumentErrorMessage,
  type createStockDocumentLock,
  type StockDocumentState,
  type NumberingDraft,
  type NumberingOptions,
  type StockDocumentViewer,
} from "./stock-document.logic";
import { NumberingOptionsFields } from "./numbering-options-fields";
import {
  documentLinesPayload,
  validateDocumentLines,
  type EditableLine,
  type LineDocumentKind,
} from "./stock-document-lines.logic";

type Line = EditableLine & {
  id: string;
  itemCode: string | null;
  itemName: string | null;
  unitSymbol: string | null;
  unitName: string | null;
  lotNumber: string | null;
  lotExpiryDate: string | null;
  systemQuantity?: string;
  actualQuantity?: string;
  difference?: string | null;
};
type Header = StockDocumentState & NumberingOptions & {
  note: string | null;
  transferCode?: string | null;
  countCode?: string | null;
  warehouseId?: string;
  fromWarehouseId?: string;
};
type Detail = { header: Header; lines: Line[] };
type CatalogItem = {
  id: string;
  code: string;
  name: string;
  trackingMode: "QUANTITY" | "LOT" | "ASSET";
};

const date = (value: string) => value.split("-").reverse().join("/");
const failureMessage = (failure: unknown) =>
  stockDocumentErrorMessage(
    failure instanceof ApiError ? failure.status : null,
    failure instanceof ApiError ? failure.message : "",
  );

/** Lines of a transfer or count, editable as a whole while the viewer may edit the draft. */
export function StockDocumentLines({
  kind,
  farmId,
  id,
  viewer,
  items,
  revision,
  lock,
  onChanged,
  onError,
  onClose,
}: {
  kind: LineDocumentKind;
  farmId: string;
  id: string;
  viewer: StockDocumentViewer;
  /** Active non-ASSET catalog items offered when adding a line. */
  items: CatalogItem[];
  revision: number;
  /** Held by the screen while a draft is being edited, so no other action runs meanwhile. */
  lock: ReturnType<typeof createStockDocumentLock>;
  /** Called after every answered save so the screen reloads the list and this panel. */
  onChanged: () => void;
  onError: (message: string | null) => void;
  onClose: () => void;
}) {
  const request = useAuthenticatedRequest();
  const counts = kind === "stock-counts";
  const [result, setResult] = useState<{ revision: number; detail?: Detail; error?: string } | null>(null);
  const [draft, setDraft] = useState<{ note: string; lines: Line[]; numbering: NumberingDraft } | null>(null);
  const [added, setAdded] = useState({ itemId: "", lotId: "" });
  const [formError, setFormError] = useState<string | null>(null);
  const saving = useRef(false);
  const editing = useRef(false);
  useEffect(
    () => () => {
      if (editing.current) lock.release();
    },
    [lock],
  );
  const panel = useRef<HTMLElement>(null);
  useEffect(() => panel.current?.scrollIntoView({ block: "nearest" }), []);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void request<{ data: { transfer?: Header; count?: Header; items: Line[] } }>(`/${kind}/${id}`, {
      params: { farmId },
    })
      .then(({ data }) => {
        if (cancelled) return;
        const header = (counts ? data.count : data.transfer)!;
        // A reload (e.g. after a save) replaces the draft, so the edit lock ends here.
        setDraft(null);
        if (editing.current) {
          editing.current = false;
          lock.release();
        }
        setAdded({ itemId: "", lotId: "" });
        setFormError(null);
        setResult({
          revision,
          detail: {
            header,
            lines: data.items.map((line) => ({
              ...line,
              quantity: counts ? (line.actualQuantity ?? "0") : line.quantity,
            })),
          },
        });
      })
      .catch((failure: unknown) => {
        if (!cancelled) setResult({ revision, error: failureMessage(failure) });
      });
    return () => {
      cancelled = true;
    };
  }, [request, kind, id, farmId, counts, revision, lock]);

  const current = result?.revision === revision ? result : null;
  const detail = current?.detail;
  const canEdit = detail ? stockDocumentActions(viewer, detail.header).edit : false;
  const warehouseId = detail?.header.warehouseId ?? detail?.header.fromWarehouseId ?? "";
  const isOwner = isFarmOwner(viewer.roles);
  const addedItem = items.find((item) => item.id === added.itemId);

  function stopEditing() {
    if (saving.current) return;
    setDraft(null);
    setFormError(null);
    if (editing.current) {
      editing.current = false;
      lock.release();
    }
  }

  function updateLine(index: number, patch: Partial<Line>) {
    setDraft((current) =>
      current && {
        ...current,
        lines: current.lines.map((line, row) => (row === index ? { ...line, ...patch } : line)),
      },
    );
  }

  function addLine() {
    if (!draft || !addedItem) return;
    setDraft({
      ...draft,
      lines: [
        ...draft.lines,
        {
          id: crypto.randomUUID(),
          itemId: addedItem.id,
          itemCode: addedItem.code,
          itemName: addedItem.name,
          trackingMode: addedItem.trackingMode,
          lotId: addedItem.trackingMode === "LOT" ? added.lotId : null,
          lotNumber: null,
          lotExpiryDate: null,
          unitSymbol: null,
          unitName: null,
          quantity: counts ? "0" : "1",
          note: null,
        },
      ],
    });
    setAdded({ itemId: "", lotId: "" });
  }

  async function save() {
    if (!draft || !editing.current || saving.current) return;
    // Owners can change or clear a requested code, e.g. after a 409 on confirmation.
    const numberingOptions = isOwner ? numberingOptionsPayload(draft.numbering) : {};
    const invalid =
      validateDocumentLines(kind, draft.lines) ?? numberingOptionsError(numberingOptions);
    if (invalid) {
      setFormError(invalid);
      return;
    }
    saving.current = true;
    setIsSaving(true);
    setFormError(null);
    onError(null);
    try {
      await request(`/${kind}/${id}`, {
        method: "PATCH",
        params: { farmId },
        data: {
          note: draft.note.trim() || null,
          items: documentLinesPayload(kind, draft.lines),
          ...numberingOptions,
        },
      });
      onChanged();
    } catch (failure) {
      onError(failureMessage(failure));
      if (shouldReloadAfterFailure(failure instanceof ApiError ? failure.status : null))
        onChanged();
    } finally {
      saving.current = false;
      setIsSaving(false);
    }
  }

  const lines = draft?.lines ?? detail?.lines ?? [];
  return (
    <section ref={panel} aria-label="Dòng hàng của phiếu" className="space-y-3 rounded-xl border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold">
          Dòng hàng phiếu {detail ? documentCodeLabel(detail.header.transferCode ?? detail.header.countCode, id) : ""}
        </h2>
        <div className="flex gap-2">
          {canEdit && !draft && (
            <Button
              variant="outline"
              disabled={lock.locked}
              onClick={() => {
                if (!detail || !lock.acquire()) return;
                editing.current = true;
                setDraft({
                  note: detail.header.note ?? "",
                  lines: detail.lines,
                  numbering: numberingDraft(detail.header),
                });
              }}
            >
              Sửa nháp
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => {
              if (saving.current) return;
              stopEditing();
              onClose();
            }}
            disabled={isSaving}
          >
            Đóng
          </Button>
        </div>
      </div>
      {!current ? (
        <p role="status">Đang tải dòng hàng...</p>
      ) : current.error ? (
        <p role="alert" className="text-sm text-destructive">{current.error}</p>
      ) : (
        <fieldset disabled={isSaving} className="space-y-3">
          {formError && (
            <p role="alert" className="text-sm font-semibold text-destructive">{formError}</p>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-muted/50">
                <tr>
                  {["Hàng hóa", "Lô", ...(counts ? ["Sổ sách", "Thực tế", "Chênh lệch"] : ["Số lượng"]), ...(draft ? [""] : [])].map(
                    (label, index) => (
                      <th key={index} scope="col" className="px-3 py-2">{label}</th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody className="divide-y">
                {lines.map((line, index) => {
                  const unit = line.unitSymbol || line.unitName || "";
                  const label = line.itemCode ? `${line.itemCode} — ${line.itemName}` : line.itemId;
                  return (
                    <tr key={line.id}>
                      <td className="px-3 py-2">{label}</td>
                      <td className="px-3 py-2">
                        {line.lotNumber
                          ? `${line.lotNumber}${line.lotExpiryDate ? ` · HSD ${date(line.lotExpiryDate)}` : ""}`
                          : line.lotId
                            ? "Lô đã chọn"
                            : "—"}
                      </td>
                      {counts && !draft && <td className="px-3 py-2">{line.systemQuantity} {unit}</td>}
                      {counts && draft && <td className="px-3 py-2">{line.systemQuantity ?? "Tính khi lưu"}</td>}
                      <td className="px-3 py-2">
                        {draft ? (
                          <Input
                            aria-label={`Số lượng ${label}`}
                            inputMode="decimal"
                            value={line.quantity}
                            onChange={(event) => updateLine(index, { quantity: event.target.value })}
                          />
                        ) : (
                          `${line.quantity} ${unit}`
                        )}
                      </td>
                      {counts && <td className="px-3 py-2">{draft ? "—" : line.difference}</td>}
                      {draft && (
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            className="underline"
                            aria-label={`Bỏ dòng ${label}`}
                            onClick={() =>
                              setDraft({ ...draft, lines: draft.lines.filter((_, row) => row !== index) })
                            }
                          >
                            Bỏ dòng
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {draft && (
            <>
              <p role="status" className="text-sm text-muted-foreground">
                Hãy lưu hoặc bỏ sửa trước khi thao tác phiếu khác hay xác nhận, gửi duyệt hoặc hủy phiếu.
              </p>
              <div className="grid gap-3 md:grid-cols-3">
                <Select
                  aria-label="Thêm vật tư"
                  value={added.itemId}
                  onChange={(event) => setAdded({ itemId: event.target.value, lotId: "" })}
                >
                  <option value="">Chọn vật tư để thêm</option>
                  {items.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.code} - {item.name}
                    </option>
                  ))}
                </Select>
                {addedItem?.trackingMode === "LOT" && (
                  <WarehouseLotSelect
                    farmId={farmId}
                    warehouseId={warehouseId}
                    itemId={addedItem.id}
                    value={added.lotId}
                    onChange={(lotId) => setAdded({ ...added, lotId })}
                    inStockOnly={!counts}
                  />
                )}
                <Button
                  variant="outline"
                  disabled={!addedItem || (addedItem.trackingMode === "LOT" && !added.lotId)}
                  onClick={addLine}
                >
                  Thêm dòng
                </Button>
              </div>
              <label className="block text-sm">
                Ghi chú phiếu
                <Textarea
                  maxLength={4000}
                  value={draft.note}
                  onChange={(event) => setDraft({ ...draft, note: event.target.value })}
                />
              </label>
              {isOwner && (
                <NumberingOptionsFields
                  value={draft.numbering}
                  onChange={(numbering) => setDraft({ ...draft, numbering })}
                />
              )}
              <div className="flex gap-2">
                <Button onClick={() => void save()}>{isSaving ? "Đang lưu..." : "Lưu thay đổi"}</Button>
                <Button variant="outline" onClick={stopEditing}>
                  Bỏ sửa
                </Button>
              </div>
            </>
          )}
        </fieldset>
      )}
      <HistoryPanel key={`${farmId}:${kind}:${id}`} farmId={farmId} entityType={counts ? "STOCK_COUNT" : "STOCK_TRANSFER"} entityId={id} revision={revision} />
    </section>
  );
}

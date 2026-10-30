"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { useSaveReceiptDraft } from "../hooks/use-save-receipt-draft";
import { useFarmMembership } from "@/features/auth/hooks/use-farm-membership";
import { expiryBeforeManufactured } from "./receipt-draft.logic";
import type { ReceiptDraftInitial } from "../types/receipt";
import {
  ReceiptDraftPicker,
  type DraftChoice,
  type DraftPickerKind,
} from "./receipt-draft-picker";
import { PageHeader } from "@/shared/components/ui/page-header";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { AddLineTile } from "@/shared/components/ui/add-line-tile";
import { Textarea } from "@/shared/components/ui/textarea";
import { Input } from "@/shared/components/ui/input";
import {
  DOCUMENT_CODE_HINT,
  documentCodeLabel,
  isFarmOwner,
  numberingDraft,
  numberingOptionsPayload,
  NumberingOptionsFields,
} from "@/features/stock-documents";

// Labels inherit the section's text-sm font-medium; field components reset to font-normal.
const SECTION = "space-y-4 rounded-xl border bg-card p-4 text-sm font-medium sm:p-6";

type DraftLine = DraftChoice & {
  rowKey: string;
  quantity: string;
  unitPrice: string;
  lotMode: "new" | "existing";
  lotId: string | null;
  lotLabel: string;
  lotNumber: string;
  manufacturedDate: string;
  expiryDate: string;
  assetCode: string;
  serialNumber: string;
  locationId: string | null;
  locationLabel: string;
  note: string;
};

export function ReceiptDraftForm({
  farmId,
  canWrite,
  initial,
  onSaved,
  onCancel,
}: {
  farmId: string;
  canWrite: boolean;
  initial?: ReceiptDraftInitial;
  onSaved: (id: string) => void;
  onCancel: () => void;
}) {
  const [warehouse, setWarehouse] = useState<DraftChoice | null>(() =>
    initial
      ? {
          id: initial.detail.receipt.warehouseId,
          label:
            initial.warehouseLabel ??
            `Kho (${initial.detail.receipt.warehouseId})`,
        }
      : null,
  );
  const [supplier, setSupplier] = useState<DraftChoice | null>(() =>
    initial?.detail.receipt.supplierId
      ? {
          id: initial.detail.receipt.supplierId,
          label:
            initial.supplierLabel ??
            `Nhà cung cấp (${initial.detail.receipt.supplierId})`,
        }
      : null,
  );
  const [date, setDate] = useState(initial?.detail.receipt.receiptDate ?? "");
  const isOwner = isFarmOwner(useFarmMembership().membership?.roles ?? []);
  const [numbering, setNumbering] = useState(() =>
    numberingDraft(initial?.detail.receipt),
  );
  const [note, setNote] = useState(initial?.detail.receipt.note ?? "");
  const [lines, setLines] = useState<DraftLine[]>(() =>
    initial
      ? initial.detail.items.map((line) => {
          return {
            id: line.itemId,
            rowKey: line.id,
            trackingMode: line.trackingMode ?? "QUANTITY",
            label: line.itemCode
              ? `${line.itemCode} — ${line.itemName} (${line.unitSymbol || line.unitName || "—"})`
              : `Vật tư (${line.itemId})`,
            quantity: line.trackingMode === "ASSET" ? "1" : line.quantity,
            unitPrice: line.unitPrice,
            lotMode: line.lotId ? "existing" : "new",
            lotId: line.lotId,
            lotLabel:
              line.lotNumberFromLot ?? (line.lotId ? `Lô (${line.lotId})` : ""),
            lotNumber: line.lotNumber ?? "",
            manufacturedDate: line.manufacturedDate ?? "",
            expiryDate: line.expiryDate ?? "",
            assetCode: line.assetCode ?? "",
            serialNumber: line.serialNumber ?? "",
            locationId: line.locationId ?? null,
            locationLabel: line.locationCode
              ? `${line.locationCode} — ${line.locationName}`
              : line.locationId
                ? `Vị trí (${line.locationId})`
                : "",
            note: line.note ?? "",
          };
        })
      : [],
  );
  const { submit, isSaving, error } = useSaveReceiptDraft(
    farmId,
    canWrite,
    initial?.detail.receipt.id,
    onSaved,
  );
  function select(kind: DraftPickerKind, choice: DraftChoice, rowKey?: string) {
    if (kind === "warehouse") {
      if (warehouse?.id !== choice.id)
        setLines((previous) =>
          previous.map((line) => ({
            ...line,
            locationId: null,
            locationLabel: "",
          })),
        );
      setWarehouse(choice);
    } else if (kind === "supplier") setSupplier(choice);
    else if (kind === "lot" && rowKey)
      setLines((previous) =>
        previous.map((line) =>
          line.rowKey === rowKey
            ? { ...line, lotId: choice.id, lotLabel: choice.label }
            : line,
        ),
      );
    else if (kind === "location" && rowKey)
      setLines((previous) =>
        previous.map((line) =>
          line.rowKey === rowKey
            ? { ...line, locationId: choice.id, locationLabel: choice.label }
            : line,
        ),
      );
    else if (kind === "material" || kind === "asset")
      setLines((previous) =>
        choice.trackingMode === "QUANTITY" &&
        previous.some((line) => line.id === choice.id)
          ? previous
          : [
              ...previous,
              {
                ...choice,
                rowKey: crypto.randomUUID(),
                quantity: "1",
                unitPrice: "0",
                lotMode: "new",
                lotId: null,
                lotLabel: "",
                lotNumber: "",
                manufacturedDate: "",
                expiryDate: "",
                assetCode: "",
                serialNumber: "",
                locationId: null,
                locationLabel: "",
                note: "",
              },
            ],
      );
  }
  if (!canWrite)
    return (
      <div role="alert">
        <p>Bạn không có quyền lưu phiếu nhập.</p>
        <button type="button" onClick={onCancel} className="underline">
          Quay lại danh sách
        </button>
      </div>
    );
  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void submit({
          warehouseId: warehouse?.id ?? "",
          supplierId: supplier?.id ?? null,
          receiptDate: date || undefined,
          note: note.trim() || null,
          ...(isOwner ? numberingOptionsPayload(numbering) : {}),
          items: lines.map((line) => ({
            itemId: line.id,
            quantity:
              line.trackingMode === "ASSET" ? "1" : line.quantity.trim(),
            unitPrice: line.unitPrice.trim() || "0",
            note: line.note.trim() || null,
            ...(line.trackingMode === "LOT" && line.lotMode === "existing"
              ? { lotId: line.lotId ?? "" }
              : line.trackingMode === "LOT"
                ? {
                    lotNumber: line.lotNumber.trim(),
                    manufacturedDate: line.manufacturedDate || undefined,
                    expiryDate: line.expiryDate || undefined,
                  }
                : {}),
            ...(line.trackingMode === "ASSET"
              ? {
                  assetCode: line.assetCode.trim(),
                  serialNumber: line.serialNumber.trim() || undefined,
                  locationId: line.locationId ?? undefined,
                }
              : {}),
          })),
        });
      }}
      className="space-y-4"
    >
      <PageHeader
        title={initial ? "Sửa phiếu nhập nháp" : "Tạo phiếu nhập nháp"}
        description="Nhập vật tư theo số lượng/lô hoặc thiết bị theo từng tài sản. Lưu nháp chưa làm thay đổi tồn kho. Để trống ngày nhập để dùng ngày hiện tại của hệ thống."
      />
      {error && (
        <div
          role="alert"
          aria-live="assertive"
          className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm font-semibold text-destructive"
        >
          {error}
        </div>
      )}
      <fieldset disabled={isSaving} className="space-y-6 disabled:opacity-60">
        <section className={SECTION}>
          <h2 className="text-base font-semibold">Thông tin phiếu</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              Mã phiếu
              <p className="rounded-md border border-dashed bg-muted/40 px-3 py-2 font-normal text-muted-foreground">
                {initial
                  ? documentCodeLabel(
                      initial.detail.receipt.receiptCode,
                      initial.detail.receipt.id,
                    )
                  : DOCUMENT_CODE_HINT}
              </p>
            </div>
            <label className="space-y-1">
              Ngày nhập
              <Input
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className="w-full"
              />
            </label>
            {isOwner && (
              <NumberingOptionsFields value={numbering} onChange={setNumbering} />
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              Kho nhập *
              <ReceiptDraftPicker
                farmId={farmId}
                kind="warehouse"
                value={warehouse}
                placeholder="Tìm kho theo mã hoặc tên..."
                onSelect={(choice) => select("warehouse", choice)}
              />
            </div>
            <div className="space-y-1">
              <div className="flex items-baseline justify-between gap-2">
                Nhà cung cấp
                {supplier && (
                  <button
                    type="button"
                    onClick={() => setSupplier(null)}
                    className="text-sm text-muted-foreground underline"
                  >
                    Bỏ chọn
                  </button>
                )}
              </div>
              <ReceiptDraftPicker
                farmId={farmId}
                kind="supplier"
                value={supplier}
                placeholder="Không chọn — tìm nhà cung cấp..."
                onSelect={(choice) => select("supplier", choice)}
              />
            </div>
          </div>
          <label className="block">
            Ghi chú
            <Textarea
              maxLength={4000}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              className="w-full"
            />
          </label>
        </section>
        <section className={SECTION}>
          <h2 className="text-base font-semibold">
            Hàng hóa nhập{lines.length > 0 && ` (${lines.length})`}
          </h2>
          <div className="grid gap-4 lg:grid-cols-2">
            {lines.map((line) => (
              <div
                key={line.rowKey}
                className="flex flex-col gap-3 rounded-lg border bg-muted/40 p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-base font-semibold">{line.label}</p>
                  <Badge variant={line.trackingMode === "ASSET" ? "info" : "secondary"}>
                    {line.trackingMode === "LOT"
                      ? "Theo lô"
                      : line.trackingMode === "ASSET"
                        ? "Tài sản"
                        : "Theo số lượng"}
                  </Badge>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {line.trackingMode === "ASSET" ? (
                    <p>Số lượng: 1 tài sản</p>
                  ) : (
                    <label>
                      Số lượng *
                      <Input
                        aria-label={`Số lượng ${line.label}`}
                        required
                        inputMode="decimal"
                        value={line.quantity}
                        onChange={(event) =>
                          setLines((previous) =>
                            previous.map((row) =>
                              row.rowKey === line.rowKey
                                ? { ...row, quantity: event.target.value }
                                : row,
                            ),
                          )
                        }
                        className="w-full"
                      />
                    </label>
                  )}
                  <label>
                    Đơn giá
                    <Input
                      aria-label={`Đơn giá ${line.label}`}
                      inputMode="decimal"
                      value={line.unitPrice}
                      onChange={(event) =>
                        setLines((previous) =>
                          previous.map((row) =>
                            row.rowKey === line.rowKey
                              ? { ...row, unitPrice: event.target.value }
                              : row,
                          ),
                        )
                      }
                      className="w-full"
                    />
                  </label>
                </div>
                {line.trackingMode === "LOT" && (
                  <fieldset className="flex flex-wrap gap-4">
                    <legend className="sr-only">Lô của {line.label}</legend>
                    {(["new", "existing"] as const).map((mode) => (
                      <label key={mode} className="flex items-center gap-2">
                        <input
                          type="radio"
                          name={`lot-mode-${line.rowKey}`}
                          checked={line.lotMode === mode}
                          onChange={() =>
                            setLines((previous) =>
                              previous.map((row) =>
                                row.rowKey === line.rowKey
                                  ? { ...row, lotMode: mode }
                                  : row,
                              ),
                            )
                          }
                        />
                        {mode === "new" ? "Lô mới" : "Lô có sẵn"}
                      </label>
                    ))}
                  </fieldset>
                )}
                {line.trackingMode === "LOT" && line.lotMode === "existing" && (
                  <div className="space-y-1">
                    Lô có sẵn *
                    <ReceiptDraftPicker
                      farmId={farmId}
                      kind="lot"
                      itemId={line.id}
                      value={
                        line.lotId ? { id: line.lotId, label: line.lotLabel } : null
                      }
                      placeholder="Chọn lô..."
                      onSelect={(choice) => select("lot", choice, line.rowKey)}
                    />
                  </div>
                )}
                {line.trackingMode === "LOT" && line.lotMode === "new" && (
                  <div className="grid gap-3 sm:grid-cols-3">
                    <label>
                      Số lô *
                      <Input
                        required
                        maxLength={100}
                        value={line.lotNumber}
                        onChange={(event) =>
                          setLines((previous) =>
                            previous.map((row) =>
                              row.rowKey === line.rowKey
                                ? { ...row, lotNumber: event.target.value }
                                : row,
                            ),
                          )
                        }
                        className="w-full"
                      />
                    </label>
                    <label>
                      Ngày sản xuất
                      <Input
                        type="date"
                        value={line.manufacturedDate}
                        onChange={(event) =>
                          setLines((previous) =>
                            previous.map((row) =>
                              row.rowKey === line.rowKey
                                ? { ...row, manufacturedDate: event.target.value }
                                : row,
                            ),
                          )
                        }
                        className="w-full"
                      />
                    </label>
                    <label>
                      Hạn sử dụng
                      <Input
                        type="date"
                        min={line.manufacturedDate || undefined}
                        aria-invalid={expiryBeforeManufactured(line)}
                        value={line.expiryDate}
                        onChange={(event) =>
                          setLines((previous) =>
                            previous.map((row) =>
                              row.rowKey === line.rowKey
                                ? { ...row, expiryDate: event.target.value }
                                : row,
                            ),
                          )
                        }
                        className="w-full"
                      />
                    </label>
                    {expiryBeforeManufactured(line) && (
                      <p
                        role="alert"
                        className="text-sm text-destructive sm:col-span-3"
                      >
                        Hạn sử dụng phải từ ngày sản xuất trở đi.
                      </p>
                    )}
                  </div>
                )}
                {line.trackingMode === "ASSET" && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label>
                      Mã tài sản *
                      <Input
                        required
                        maxLength={100}
                        value={line.assetCode}
                        onChange={(event) =>
                          setLines((previous) =>
                            previous.map((row) =>
                              row.rowKey === line.rowKey
                                ? { ...row, assetCode: event.target.value }
                                : row,
                            ),
                          )
                        }
                        className="w-full"
                      />
                    </label>
                    <label>
                      Số serial
                      <Input
                        maxLength={255}
                        value={line.serialNumber}
                        onChange={(event) =>
                          setLines((previous) =>
                            previous.map((row) =>
                              row.rowKey === line.rowKey
                                ? { ...row, serialNumber: event.target.value }
                                : row,
                            ),
                          )
                        }
                        className="w-full"
                      />
                    </label>
                    <div className="space-y-1 sm:col-span-2">
                      <div className="flex items-baseline justify-between gap-2">
                        Vị trí trong kho
                        {line.locationId && (
                          <button
                            type="button"
                            onClick={() =>
                              setLines((previous) =>
                                previous.map((row) =>
                                  row.rowKey === line.rowKey
                                    ? {
                                        ...row,
                                        locationId: null,
                                        locationLabel: "",
                                      }
                                    : row,
                                ),
                              )
                            }
                            className="text-sm text-muted-foreground underline"
                          >
                            Bỏ vị trí
                          </button>
                        )}
                      </div>
                      <ReceiptDraftPicker
                        key={warehouse?.id ?? "none"}
                        farmId={farmId}
                        kind="location"
                        warehouseId={warehouse?.id}
                        disabled={!warehouse}
                        value={
                          line.locationId
                            ? { id: line.locationId, label: line.locationLabel }
                            : null
                        }
                        placeholder={
                          warehouse ? "Tìm vị trí..." : "Chọn kho nhập trước"
                        }
                        onSelect={(choice) =>
                          select("location", choice, line.rowKey)
                        }
                      />
                    </div>
                  </div>
                )}
                <label className="block">
                  Ghi chú dòng
                  <Textarea
                    maxLength={4000}
                    value={line.note}
                    onChange={(event) =>
                      setLines((previous) =>
                        previous.map((row) =>
                          row.rowKey === line.rowKey
                            ? { ...row, note: event.target.value }
                            : row,
                        ),
                      )
                    }
                    className="w-full"
                  />
                </label>
                <div className="mt-auto flex justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={`Bỏ dòng ${line.label}`}
                    onClick={() =>
                      setLines((previous) =>
                        previous.filter((row) => row.rowKey !== line.rowKey),
                      )
                    }
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                    Bỏ dòng
                  </Button>
                </div>
              </div>
            ))}
            <AddLineTile label="Thêm vật tư hoặc thiết bị/tài sản">
              {(close) => (
                <>
                  <div className="space-y-1">
                    Vật tư
                    <ReceiptDraftPicker
                      farmId={farmId}
                      kind="material"
                      autoFocus
                      placeholder="Tìm vật tư theo mã hoặc tên..."
                      onSelect={(choice) => {
                        select("material", choice);
                        close();
                      }}
                    />
                  </div>
                  <div className="space-y-1">
                    Thiết bị/tài sản
                    <ReceiptDraftPicker
                      farmId={farmId}
                      kind="asset"
                      placeholder="Tìm thiết bị theo mã hoặc tên..."
                      onSelect={(choice) => {
                        select("asset", choice);
                        close();
                      }}
                    />
                  </div>
                </>
              )}
            </AddLineTile>
          </div>
        </section>
        <div className="flex gap-3">
          <Button type="submit">
            {isSaving ? "Đang lưu..." : initial ? "Lưu thay đổi" : "Lưu nháp"}
          </Button>
          <Button variant="outline" onClick={onCancel}>
            Quay lại danh sách
          </Button>
        </div>
      </fieldset>
    </form>
  );
}

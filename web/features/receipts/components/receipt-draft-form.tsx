"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { useSaveReceiptDraft } from "../hooks/use-save-receipt-draft";
import { useFarmMembership } from "@/features/auth/hooks/use-farm-membership";
import { expiryBeforeManufactured, type ReceiptPreset } from "./receipt-draft.logic";
import type { ReceiptDraftInitial } from "../types/receipt";
import {
  ReceiptDraftPicker,
  type DraftChoice,
  type DraftPickerKind,
} from "./receipt-draft-picker";
import { SupplierLotMatches } from "./supplier-lot-matches";
import { PageHeader } from "@/shared/components/ui/page-header";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { AddLineTile } from "@/shared/components/ui/add-line-tile";
import { Textarea } from "@/shared/components/ui/textarea";
import { Input } from "@/shared/components/ui/input";
import { Select } from "@/shared/components/ui/select";
import { DateInput } from "@/shared/components/ui/date-input";
import { formatVndCurrency } from "@/shared/lib/currency";
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
  // Saved line id for rows loaded from the draft; new rows have none.
  lineId?: string;
  quantity: string;
  unitPrice: string;
  lotMode: "new" | "existing";
  lotId: string | null;
  lotLabel: string;
  supplierLotNumber: string;
  legacyLotNumber: string | null;
  manufacturedDate: string;
  expiryDate: string;
  assetCode: string;
  serialNumber: string;
  locationId: string | null;
  locationLabel: string;
  // Order returns: the shipped asset coming back and its inspected condition.
  assetId: string | null;
  assetCondition: "GOOD" | "DAMAGED" | "";
  note: string;
};

function newLine(choice: DraftChoice): DraftLine {
  return {
    ...choice,
    rowKey: crypto.randomUUID(),
    quantity: "1",
    unitPrice: "0",
    lotMode: "new",
    lotId: null,
    lotLabel: "",
    supplierLotNumber: "",
    legacyLotNumber: null,
    manufacturedDate: "",
    expiryDate: "",
    assetCode: "",
    serialNumber: "",
    locationId: null,
    locationLabel: "",
    assetId: null,
    assetCondition: "",
    note: "",
  };
}

export function ReceiptDraftForm({
  farmId,
  canWrite,
  initial,
  preset,
  onSaved,
  onCancel,
}: {
  farmId: string;
  canWrite: boolean;
  initial?: ReceiptDraftInitial;
  /** New draft only: warehouse and first line already chosen. */
  preset?: ReceiptPreset;
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
      : (preset?.warehouse ?? null),
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
          lineId: line.id,
          trackingMode: line.trackingMode ?? "QUANTITY",
          label: line.itemCode
            ? `${line.itemCode} — ${line.itemName} (${line.unitSymbol || line.unitName || "—"})`
            : `Vật tư (${line.itemId})`,
          quantity: line.trackingMode === "ASSET" ? "1" : line.quantity,
          unitPrice: line.unitPrice,
          lotMode: line.lotId ? "existing" : "new",
          lotId: line.lotId,
          lotLabel: line.lotCode ?? (line.lotId ? `Lô (${line.lotId})` : ""),
          supplierLotNumber: line.supplierLotNumber ?? "",
          legacyLotNumber: line.legacyLotNumber,
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
          assetId: line.assetId,
          assetCondition: line.assetCondition ?? "",
          note: line.note ?? "",
        };
      })
      : preset?.item
        ? [newLine(preset.item)]
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
          : [...previous, newLine(choice)],
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

  const totalValue = lines.reduce((sum, line) => {
    const qty = Number(line.quantity) || 0;
    const price = Number(line.unitPrice) || 0;
    return sum + qty * price;
  }, 0);

  const totalQuantity = lines.reduce((sum, line) => {
    return sum + (line.trackingMode === "ASSET" ? 1 : Number(line.quantity) || 0);
  }, 0);

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
            lineId: line.lineId,
            itemId: line.id,
            quantity:
              line.trackingMode === "ASSET" ? "1" : line.quantity.trim(),
            unitPrice: line.unitPrice.trim() || "0",
            note: line.note.trim() || null,
            ...(line.trackingMode === "LOT" && line.lotMode === "existing"
              ? { lotId: line.lotId ?? "" }
              : line.trackingMode === "LOT"
                ? {
                  supplierLotNumber: line.supplierLotNumber.trim() || undefined,
                  manufacturedDate: line.manufacturedDate || undefined,
                  expiryDate: line.expiryDate || undefined,
                }
                : {}),
            ...(line.trackingMode === "ASSET"
              ? {
                assetCode: line.assetCode.trim(),
                serialNumber: line.serialNumber.trim() || undefined,
                locationId: line.locationId ?? undefined,
                ...(line.assetId
                  ? { assetCondition: line.assetCondition }
                  : {}),
              }
              : {}),
          })),
        }, initial?.detail.orderReturn);
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
                    "PN",
                  )
                  : DOCUMENT_CODE_HINT}
              </p>
            </div>
            <label className="space-y-1">
              Ngày nhập
              <DateInput
                value={date}
                onValueChange={(value) => setDate(value)}
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
                className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-2xs hover:border-primary/40 transition-all"
              >
                <div className="flex items-start justify-between gap-2 border-b border-border/50 pb-2.5">
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-foreground leading-snug">{line.label}</p>
                    <Badge variant={line.trackingMode === "ASSET" ? "info" : line.trackingMode === "LOT" ? "secondary" : "outline"} className="text-xs">
                      {line.trackingMode === "LOT"
                        ? "Theo lô"
                        : line.trackingMode === "ASSET"
                          ? "Tài sản"
                          : "Theo số lượng"}
                    </Badge>
                  </div>
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
                    className="size-7 p-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive shrink-0 cursor-pointer"
                    title="Bỏ dòng hàng này"
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </Button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {line.trackingMode === "ASSET" ? (
                    <div className="flex items-center text-xs font-medium text-foreground bg-muted/40 px-3 py-2 rounded-md">
                      Số lượng: 1 tài sản
                    </div>
                  ) : (
                    <label className="space-y-1 text-xs font-medium">
                      <span>Số lượng *</span>
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
                        className="w-full text-xs"
                      />
                    </label>
                  )}
                  <label className="space-y-1 text-xs font-medium">
                    <span>Đơn giá nhập</span>
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
                      className="w-full text-xs"
                    />
                  </label>
                  {Number(line.quantity) > 0 && Number(line.unitPrice) > 0 && (
                    <div className="sm:col-span-2 flex items-center justify-between text-xs pt-1 px-1 text-muted-foreground bg-muted/30 p-2 rounded-md">
                      <span>Thành tiền dự kiến:</span>
                      <span className="font-bold text-primary text-sm tabular-nums">
                        {formatVndCurrency(Number(line.quantity) * Number(line.unitPrice))}
                      </span>
                    </div>
                  )}
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
                        {mode === "new" ? "Tạo lô mới" : "Nhập thêm vào lô có sẵn"}
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
                    <p className="sm:col-span-3">
                      Mã lô nội bộ{" "}
                      <span className="font-normal text-muted-foreground">
                        Tự cấp khi xác nhận phiếu
                      </span>
                    </p>
                    {line.legacyLotNumber && (
                      <p className="font-normal text-muted-foreground sm:col-span-3">
                        Số lô cũ (tham khảo, chưa xác minh là số trên hàng):{" "}
                        {line.legacyLotNumber}
                      </p>
                    )}
                    <label>
                      Số lô trên hàng
                      <Input
                        maxLength={100}
                        value={line.supplierLotNumber}
                        aria-describedby={`supplier-lot-hint-${line.rowKey}`}
                        onChange={(event) =>
                          setLines((previous) =>
                            previous.map((row) =>
                              row.rowKey === line.rowKey
                                ? { ...row, supplierLotNumber: event.target.value }
                                : row,
                            ),
                          )
                        }
                        className="w-full"
                      />
                      <span
                        id={`supplier-lot-hint-${line.rowKey}`}
                        className="text-xs font-normal text-muted-foreground"
                      >
                        Số lô do nhà sản xuất/nhà cung cấp ghi trên hàng.
                      </span>
                    </label>
                    <label>
                      Ngày sản xuất
                      <DateInput
                        value={line.manufacturedDate}
                        onValueChange={(value) =>
                          setLines((previous) =>
                            previous.map((row) =>
                              row.rowKey === line.rowKey
                                ? { ...row, manufacturedDate: value }
                                : row,
                            ),
                          )
                        }
                        className="w-full"
                      />
                    </label>
                    <label>
                      Hạn sử dụng
                      <DateInput
                        min={line.manufacturedDate || undefined}
                        aria-invalid={expiryBeforeManufactured(line)}
                        value={line.expiryDate}
                        onValueChange={(value) =>
                          setLines((previous) =>
                            previous.map((row) =>
                              row.rowKey === line.rowKey
                                ? { ...row, expiryDate: value }
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
                    <SupplierLotMatches
                      farmId={farmId}
                      itemId={line.id}
                      supplierLotNumber={line.supplierLotNumber}
                      onUse={(choice) =>
                        setLines((previous) =>
                          previous.map((row) =>
                            row.rowKey === line.rowKey
                              ? {
                                ...row,
                                lotMode: "existing",
                                lotId: choice.id,
                                lotLabel: choice.label,
                              }
                              : row,
                          ),
                        )
                      }
                    />
                  </div>
                )}
                {line.trackingMode === "ASSET" && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label>
                      Mã tài sản *
                      <Input
                        required
                        maxLength={100}
                        // A returned asset keeps its code; it is not a new asset.
                        readOnly={!!line.assetId}
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
                        readOnly={!!line.assetId}
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
                    {line.assetId && (
                      <label className="sm:col-span-2">
                        Kết quả kiểm nhận *
                        <Select
                          required
                          value={line.assetCondition}
                          onChange={(event) =>
                            setLines((previous) =>
                              previous.map((row) =>
                                row.rowKey === line.rowKey
                                  ? {
                                    ...row,
                                    assetCondition: event.target
                                      .value as DraftLine["assetCondition"],
                                  }
                                  : row,
                              ),
                            )
                          }
                          className="w-full font-normal"
                        >
                          <option value="">Chọn kết quả</option>
                          <option value="GOOD">Đạt, bán lại được</option>
                          <option value="DAMAGED">
                            Hỏng: nhập kho nhưng không cấp phát/bán
                          </option>
                        </Select>
                      </label>
                    )}
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
              </div>
            ))}
            <AddLineTile label="Thêm vật tư hoặc thiết bị/tài sản">
              {(close) => (
                <>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">
                      Vật tư
                    </label>
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
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">
                      Thiết bị / tài sản
                    </label>
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

        {/* Sticky Action Bar */}
        <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card/95 p-4 shadow-lg backdrop-blur-xs">
          <div className="flex flex-wrap items-center gap-4 text-xs font-medium">
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground">Số dòng hàng:</span>
              <span className="font-bold text-foreground tabular-nums">{lines.length}</span>
            </div>
            {totalQuantity > 0 && (
              <div className="flex items-center gap-1.5 border-l border-border pl-4">
                <span className="text-muted-foreground">Tổng số lượng:</span>
                <span className="font-bold text-foreground tabular-nums">{totalQuantity}</span>
              </div>
            )}
            {totalValue > 0 && (
              <div className="flex items-center gap-1.5 border-l border-border pl-4">
                <span className="text-muted-foreground">Tổng tiền tạm tính:</span>
                <span className="font-bold text-primary tabular-nums text-sm">
                  {formatVndCurrency(totalValue)}
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              type="button"
              onClick={onCancel}
              disabled={isSaving}
              className="text-xs font-medium h-9"
            >
              Quay lại danh sách
            </Button>
            <Button
              type="submit"
              disabled={isSaving}
              className="font-semibold shadow-xs text-xs h-9"
            >
              {isSaving ? "Đang lưu..." : initial ? "Lưu thay đổi" : "Lưu phiếu nháp"}
            </Button>
          </div>
        </div>
      </fieldset>
    </form>
  );
}

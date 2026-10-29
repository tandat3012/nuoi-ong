"use client";

import { useState } from "react";
import Link from "next/link";
import { useSaveIssueDraft } from "../hooks/use-save-issue-draft";
import {
  ISSUE_TYPE_LABELS,
  type CreateIssueInput,
  type IssueDetail,
  type IssueDraftTrackingMode,
} from "../types/issue";
import {
  preservesIssueItemTotals,
  splitIssueQuantity,
  supportsIssueDraftEdit,
} from "./issue-draft.logic";
import { IssueDraftPicker, type IssueChoice } from "./issue-draft-picker";
import { IssueLotPicker, type IssueLotChoice } from "./issue-lot-picker";
import { IssueAssetPicker, type IssueAssetChoice } from "./issue-asset-picker";
import { IssueMaintenancePicker } from "./issue-maintenance-picker";
import { PageHeader } from "@/shared/components/ui/page-header";
import { Button } from "@/shared/components/ui/button";
import { Textarea } from "@/shared/components/ui/textarea";
import { Select } from "@/shared/components/ui/select";
import { Input } from "@/shared/components/ui/input";

type DraftLine = IssueChoice & {
  rowKey: string;
  quantity: string;
  note: string;
  trackingMode: IssueDraftTrackingMode;
  lot: IssueLotChoice | null;
  asset: IssueAssetChoice | null;
  splitQuantity?: string;
};

export function IssueDraftForm({
  farmId,
  canWrite,
  initial,
  onSaved,
  onCancel,
}: {
  farmId: string;
  canWrite: boolean;
  initial?: IssueDetail;
  onSaved: (id: string) => void;
  onCancel: () => void;
}) {
  const [warehouse, setWarehouse] = useState<IssueChoice | null>(() =>
    initial
      ? {
          id: initial.issue.warehouseId,
          label: initial.issue.warehouseName
            ? `${initial.issue.warehouseCode ?? ""} — ${initial.issue.warehouseName}`
            : "Kho đã chọn (không có thông tin tên)",
        }
      : null,
  );
  const [code, setCode] = useState(initial?.issue.issueCode ?? "");
  const [date, setDate] = useState(initial?.issue.issueDate ?? "");
  const [issueType, setIssueType] = useState<CreateIssueInput["issueType"]>(
    initial?.issue.issueType ?? "CONSUMPTION",
  );
  const [maintenanceRecordId, setMaintenanceRecordId] = useState(
    initial?.issue.maintenanceRecordId ?? null,
  );
  const [reason, setReason] = useState(initial?.issue.reason ?? "");
  const [note, setNote] = useState(initial?.issue.note ?? "");
  const [linkedError, setLinkedError] = useState<string | null>(null);
  const isLinkedSale =
    initial?.issue.issueType === "SALE" && Boolean(initial.issue.orderId);
  const [lines, setLines] = useState<DraftLine[]>(
    () =>
      initial?.items.map((line) => ({
        id: line.itemId,
        rowKey: line.id,
        label: `${line.itemCode ?? ""} — ${line.itemName ?? "Vật tư đã chọn"} (${line.unitSymbol || line.unitName || "—"})`,
        quantity: line.quantity,
        note: line.note ?? "",
        trackingMode: line.trackingMode ?? "QUANTITY",
        lot: line.lotId
          ? {
              id: line.lotId,
              lotNumber: line.lotNumber ?? line.lotId,
              expiryDate: line.lotExpiryDate,
              quantityOnHand: null,
            }
          : null,
        asset: line.assetId
          ? {
              id: line.assetId,
              assetCode: line.assetCode ?? line.assetId,
              serialNumber: line.serialNumber,
            }
          : null,
      })) ?? [],
  );
  const [picker, setPicker] = useState<"warehouse" | "item" | null>(null);
  const { submit, isSaving, error } = useSaveIssueDraft(
    farmId,
    canWrite,
    initial?.issue.id,
    onSaved,
    isLinkedSale,
  );

  function select(choice: IssueChoice) {
    if (picker === "warehouse") {
      if (warehouse?.id !== choice.id)
        setLines((previous) =>
          previous.map((line) =>
            line.trackingMode === "LOT"
              ? { ...line, lot: null }
              : line.trackingMode === "ASSET"
                ? { ...line, asset: null }
                : line,
          ),
        );
      setWarehouse({ id: choice.id, label: choice.label });
    } else if (choice.trackingMode) {
      const trackingMode = choice.trackingMode;
      setLines((previous) => [
        ...previous,
        {
          ...choice,
          rowKey: crypto.randomUUID(),
          quantity: "1",
          note: "",
          trackingMode,
          lot: null,
          asset: null,
        },
      ]);
    }
    setPicker(null);
  }
  function updateLine(
    rowKey: string,
    patch: Partial<Pick<DraftLine, "quantity" | "note" | "lot" | "asset" | "splitQuantity">>,
  ) {
    setLinkedError(null);
    setLines((previous) =>
      previous.map((line) =>
        line.rowKey === rowKey ? { ...line, ...patch } : line,
      ),
    );
  }
  function splitLotLine(line: DraftLine) {
    const split = splitIssueQuantity(line.quantity, line.splitQuantity ?? "");
    if (!split) {
      setLinkedError("Nhập số lượng tách nhỏ hơn số lượng hiện có, tối đa 3 chữ số thập phân.");
      return;
    }
    setLinkedError(null);
    setLines((previous) =>
      previous.flatMap((row) =>
        row.rowKey !== line.rowKey
          ? [row]
          : [
              { ...row, quantity: split[0], splitQuantity: "" },
              {
                ...row,
                rowKey: crypto.randomUUID(),
                quantity: split[1],
                splitQuantity: "",
                lot: null,
                asset: null,
              },
            ],
      ),
    );
  }
  if (!canWrite || (initial && !supportsIssueDraftEdit(initial)))
    return (
      <div role="alert" className="space-y-3">
        <p>
          {!canWrite
            ? "Bạn không có quyền lưu phiếu xuất."
            : "Phiếu có dữ liệu không tương thích nên chỉ có thể xem."}
        </p>
        <Button type="button" variant="outline" onClick={onCancel}>
          Quay lại
        </Button>
      </div>
    );
  return (
    <form
      noValidate
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        if (picker) return;
        const input: CreateIssueInput = {
            warehouseId: warehouse?.id ?? "",
            issueCode: code.trim(),
            issueDate: date || undefined,
            issueType,
            maintenanceRecordId:
              issueType === "MAINTENANCE" ? maintenanceRecordId : null,
            reason: reason.trim() || null,
            note: note.trim() || null,
            items: lines.map((line) => ({
              itemId: line.id,
              quantity:
                line.trackingMode === "ASSET" ? "1" : line.quantity.trim(),
              note: line.note.trim() || null,
              ...(line.trackingMode === "LOT"
                ? { lotId: line.lot?.id ?? "" }
                : {}),
              ...(line.trackingMode === "ASSET"
                ? { assetId: line.asset?.id ?? "" }
                : {}),
            })),
          };
        if (
          isLinkedSale &&
          !preservesIssueItemTotals(
            initial!.items.map((line) => ({ itemId: line.itemId, quantity: line.quantity })),
            input.items,
          )
        ) {
          setLinkedError("Tổng số lượng của từng vật tư phải giữ nguyên khi phân bổ lại lô.");
          return;
        }
        void submit(input, lines.map((line) => line.trackingMode));
      }}
    >
      <PageHeader
        title={
          initial
            ? `Sửa phiếu xuất ${initial.issue.issueCode}`
            : "Tạo phiếu xuất nháp"
        }
        description={isLinkedSale ? "Phiếu bán hàng liên kết đơn; chỉ phân bổ lại lô/tài sản và giữ nguyên tổng từng vật tư." : "Phiếu nháp chưa trừ hoặc giữ chỗ tồn kho."}
      />
      <fieldset disabled={isSaving} className="space-y-6 disabled:opacity-70">
        <legend className="sr-only">Thông tin phiếu xuất</legend>
        <div className="grid gap-4 rounded-xl border bg-card p-5 sm:grid-cols-2">
          <div>
            <label
              htmlFor="issue-code"
              className="mb-1 block text-sm font-medium"
            >
              Mã phiếu *
            </label>
            <Input
              id="issue-code"
              value={code}
              readOnly={isLinkedSale}
              onChange={(event) => setCode(event.target.value)}
              maxLength={50}
              required
              className="w-full"
            />
          </div>
          <div>
            <label
              htmlFor="issue-date"
              className="mb-1 block text-sm font-medium"
            >
              Ngày xuất
            </label>
            <Input
              id="issue-date"
              type="date"
              value={date}
              readOnly={isLinkedSale}
              onChange={(event) => setDate(event.target.value)}
              className="w-full"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Để trống để dùng ngày hiện tại khi tạo phiếu.
            </p>
          </div>
          <div>
            <p className="mb-1 text-sm font-medium">Kho xuất *</p>
            <p className="mb-2">{warehouse?.label ?? "Chưa chọn kho"}</p>
            <Button type="button" variant="outline"
              disabled={isLinkedSale}
              onClick={() => setPicker("warehouse")}
            >
              Chọn kho xuất
            </Button>
          </div>
          <div>
            <label
              htmlFor="issue-type"
              className="mb-1 block text-sm font-medium"
            >
              Loại phiếu
            </label>
            <Select
              id="issue-type"
              value={issueType}
              disabled={isLinkedSale}
              onChange={(event) => {
                const next = event.target
                  .value as CreateIssueInput["issueType"];
                setIssueType(next);
                if (next !== "MAINTENANCE") setMaintenanceRecordId(null);
              }}
              className="w-full"
            >
              {Object.entries(ISSUE_TYPE_LABELS)
                .filter(([value]) => value !== "SALE" || isLinkedSale)
                .map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
            {(issueType === "DAMAGE" || issueType === "MAINTENANCE") && (
              <p className="mt-2 text-sm text-muted-foreground">
                Phiếu này chỉ xuất vật tư theo số lượng hoặc lô. Để báo hỏng hoặc
                đưa tài sản đi bảo trì, mở{" "}
                <Link href="/assets" className="text-primary underline">
                  hồ sơ tài sản
                </Link>.
              </p>
            )}
          </div>
          <div>
            <label
              htmlFor="issue-reason"
              className="mb-1 block text-sm font-medium"
            >
              Lý do xuất
            </label>
            <Textarea
              id="issue-reason"
              value={reason}
              readOnly={isLinkedSale}
              onChange={(event) => setReason(event.target.value)}
              maxLength={4000}
              rows={3}
              className="w-full"
            />
          </div>
          <div>
            <label
              htmlFor="issue-note"
              className="mb-1 block text-sm font-medium"
            >
              Ghi chú phiếu
            </label>
            <Textarea
              id="issue-note"
              value={note}
              readOnly={isLinkedSale}
              onChange={(event) => setNote(event.target.value)}
              maxLength={4000}
              rows={3}
              className="w-full"
            />
          </div>
        </div>
        {issueType === "MAINTENANCE" && (
          <IssueMaintenancePicker
            farmId={farmId}
            selectedId={maintenanceRecordId}
            onSelect={setMaintenanceRecordId}
          />
        )}
        {picker && (
          <IssueDraftPicker
            key={picker}
            farmId={farmId}
            kind={picker}
            onSelect={select}
            onClose={() => setPicker(null)}
          />
        )}
        <section aria-label="Các dòng vật tư" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Vật tư trong phiếu xuất</h2>
            <Button type="button" variant="outline"
              disabled={isLinkedSale}
              onClick={() => setPicker("item")}
            >
              Thêm vật tư
            </Button>
          </div>
          {lines.length === 0 && (
            <p role="status">Chưa có vật tư. Vui lòng thêm ít nhất một dòng.</p>
          )}
          {lines.map((line, index) => (
            <fieldset
              key={line.rowKey}
              className="space-y-3 rounded-xl border bg-card p-4"
            >
              <legend className="px-1 text-sm font-medium">
                Dòng {index + 1}
              </legend>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{line.label}</p>
                  <p className="text-sm text-muted-foreground">
                    Theo{" "}
                    {line.trackingMode === "LOT"
                      ? "lô"
                      : line.trackingMode === "ASSET"
                        ? "tài sản"
                        : "số lượng"}
                  </p>
                </div>
                <Button type="button" variant="outline"
                  disabled={isLinkedSale}
                  aria-label={`Xóa dòng ${index + 1}`}
                  onClick={() =>
                    setLines((previous) =>
                      previous.filter((row) => row.rowKey !== line.rowKey),
                    )
                  }
                >
                  Xóa
                </Button>
              </div>
              {line.trackingMode === "LOT" && (
                <IssueLotPicker
                  key={`${farmId}:${warehouse?.id ?? "none"}:${line.id}`}
                  farmId={farmId}
                  warehouseId={warehouse?.id ?? null}
                  itemId={line.id}
                  selected={line.lot}
                  onSelect={(lot) => updateLine(line.rowKey, { lot })}
                />
              )}
              {line.trackingMode === "ASSET" && (
                <IssueAssetPicker
                  key={`${farmId}:${warehouse?.id ?? "none"}:${line.id}`}
                  farmId={farmId}
                  warehouseId={warehouse?.id ?? null}
                  itemId={line.id}
                  selected={line.asset}
                  excludedIds={lines
                    .filter((row) => row.rowKey !== line.rowKey && row.asset)
                    .map((row) => row.asset!.id)}
                  onSelect={(asset) => updateLine(line.rowKey, { asset })}
                />
              )}
              <div className="grid gap-4 sm:grid-cols-[12rem_1fr]">
                <div>
                  <label
                    htmlFor={`quantity-${line.rowKey}`}
                    className="mb-1 block text-sm"
                  >
                    Số lượng *
                  </label>
                  <Input
                    id={`quantity-${line.rowKey}`}
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    required
                    value={line.trackingMode === "ASSET" ? "1" : line.quantity}
                    readOnly={isLinkedSale || line.trackingMode === "ASSET"}
                    onChange={(event) =>
                      updateLine(line.rowKey, { quantity: event.target.value })
                    }
                    aria-describedby="issue-quantity-help"
                    className="w-full"
                  />
                </div>
                <div>
                  <label
                    htmlFor={`note-${line.rowKey}`}
                    className="mb-1 block text-sm"
                  >
                    Ghi chú dòng
                  </label>
                  <Input
                    id={`note-${line.rowKey}`}
                    value={line.note}
                    readOnly={isLinkedSale}
                    onChange={(event) =>
                      updateLine(line.rowKey, { note: event.target.value })
                    }
                    maxLength={4000}
                    className="w-full"
                  />
                </div>
              </div>
              {isLinkedSale && line.trackingMode === "LOT" && (
                <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
                  <label htmlFor={`split-${line.rowKey}`} className="space-y-1 text-sm">
                    <span>Số lượng tách sang lô khác</span>
                    <Input
                      id={`split-${line.rowKey}`}
                      inputMode="decimal"
                      value={line.splitQuantity ?? ""}
                      onChange={(event) => updateLine(line.rowKey, { splitQuantity: event.target.value })}
                      placeholder="Ví dụ 1.250"
                    />
                  </label>
                  <Button type="button" variant="outline" onClick={() => splitLotLine(line)}>Tách dòng</Button>
                </div>
              )}
            </fieldset>
          ))}
          <p id="issue-quantity-help" className="text-sm text-muted-foreground">
            Số lượng phải lớn hơn 0, tối đa 3 chữ số thập phân. Dùng dấu chấm,
            ví dụ 1.250. Lưu nháp không giữ chỗ tồn kho.
          </p>
        </section>
      </fieldset>
      {error && (
        <p
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      {linkedError && (
        <p
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
        >
          {linkedError}
        </p>
      )}
      {isSaving && <p role="status">Đang lưu phiếu xuất...</p>}
      <div className="flex flex-wrap gap-3">
        <Button
          type="submit"
          disabled={isSaving || !!picker}
        >
          {isSaving ? "Đang lưu..." : "Lưu phiếu nháp"}
        </Button>
        <Button type="button" variant="outline"
          disabled={isSaving}
          onClick={onCancel}
        >
          {initial ? "Quay lại chi tiết" : "Quay lại danh sách"}
        </Button>
      </div>
    </form>
  );
}

"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useSaveIssueDraft } from "../hooks/use-save-issue-draft";
import { useFarmMembership } from "@/features/auth/hooks/use-farm-membership";
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
import { AddLineTile } from "@/shared/components/ui/add-line-tile";
import { IssueDraftPicker, type IssueChoice } from "./issue-draft-picker";
import { IssueLotPicker, type IssueLotChoice } from "./issue-lot-picker";
import { IssueAssetPicker, type IssueAssetChoice } from "./issue-asset-picker";
import { IssueMaintenancePicker } from "./issue-maintenance-picker";
import { AssetLookup } from "@/features/assets";
import { PageHeader } from "@/shared/components/ui/page-header";
import { Button } from "@/shared/components/ui/button";
import { Textarea } from "@/shared/components/ui/textarea";
import { Select } from "@/shared/components/ui/select";
import { Input } from "@/shared/components/ui/input";
import { DateInput } from "@/shared/components/ui/date-input";
import {
  DOCUMENT_CODE_HINT,
  documentCodeLabel,
  isFarmOwner,
  numberingDraft,
  numberingOptionsPayload,
  NumberingOptionsFields,
} from "@/features/stock-documents";
import { Trash2, AlertCircle, Info, Split } from "lucide-react";

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
  const [date, setDate] = useState(initial?.issue.issueDate ?? "");
  const isOwner = isFarmOwner(useFarmMembership().membership?.roles ?? []);
  const [numbering, setNumbering] = useState(() => numberingDraft(initial?.issue));
  const [issueType, setIssueType] = useState<CreateIssueInput["issueType"]>(
    initial?.issue.issueType ?? "CONSUMPTION",
  );
  const [maintenanceRecordId, setMaintenanceRecordId] = useState(
    initial?.issue.maintenanceRecordId ?? null,
  );
  const [reason, setReason] = useState(initial?.issue.reason ?? "");
  const [recipient, setRecipient] = useState<IssueChoice | null>(() =>
    initial?.issue.recipientMemberId
      ? {
          id: initial.issue.recipientMemberId,
          label: initial.issue.recipientName ?? "Người nhận đã chọn",
        }
      : null,
  );
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
              lotCode: line.lotCode ?? line.lotId,
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

  const { submit, isSaving, error } = useSaveIssueDraft(
    farmId,
    canWrite,
    initial?.issue.id,
    onSaved,
    isLinkedSale,
  );

  const totalQuantity = useMemo(() => {
    return lines.reduce((acc, line) => {
      const q = parseFloat(line.quantity);
      return acc + (isNaN(q) ? 0 : q);
    }, 0);
  }, [lines]);

  function select(kind: "warehouse" | "item", choice: IssueChoice) {
    if (kind === "warehouse") {
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
      <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 p-5 text-sm text-destructive">
        <p className="font-semibold">Không thể chỉnh sửa phiếu xuất</p>
        <p className="mt-1 text-xs">
          {!canWrite
            ? "Bạn không có quyền lưu phiếu xuất."
            : "Phiếu có dữ liệu không tương thích nên chỉ có thể xem."}
        </p>
        <Button type="button" variant="outline" size="sm" onClick={onCancel} className="mt-3 text-xs">
          Quay lại
        </Button>
      </div>
    );

  return (
    <form
      noValidate
      className="space-y-6 pb-12"
      onSubmit={(event) => {
        event.preventDefault();
        const input: CreateIssueInput = {
          warehouseId: warehouse?.id ?? "",
          issueDate: date || undefined,
          issueType,
          maintenanceRecordId:
            issueType === "MAINTENANCE" ? maintenanceRecordId : null,
          recipientMemberId: issueType === "SALE" ? null : (recipient?.id ?? null),
          reason: reason.trim() || null,
          note: note.trim() || null,
          ...(isOwner ? numberingOptionsPayload(numbering) : {}),
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
            ? `Sửa phiếu xuất ${documentCodeLabel(initial.issue.issueCode, initial.issue.id, "PX")}`
            : "Tạo phiếu xuất nháp"
        }
        description={
          isLinkedSale
            ? "Phiếu bán hàng liên kết đơn; chỉ phân bổ lại lô/tài sản và giữ nguyên tổng từng vật tư."
            : "Lập phiếu xuất kho nháp. Phiếu nháp chưa trừ hoặc giữ chỗ tồn kho trong hệ thống."
        }
      />

      <fieldset disabled={isSaving} className="space-y-6 disabled:opacity-75">
        <legend className="sr-only">Thông tin phiếu xuất</legend>

        {/* Section 1: General Info */}
        <section className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div>
              <h2 className="text-sm font-semibold text-foreground">1. Thông tin phiếu xuất</h2>
              <p className="text-xs text-muted-foreground">Kho nguồn, ngày xuất và mục đích sử dụng</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-foreground">Mã phiếu</label>
              <p className="rounded-md border border-dashed border-border bg-muted/40 px-3 py-2 font-mono text-xs text-muted-foreground">
                {initial
                  ? documentCodeLabel(initial.issue.issueCode, initial.issue.id, "PX")
                  : DOCUMENT_CODE_HINT}
              </p>
            </div>

            <div>
              <label htmlFor="issue-date" className="mb-1 block text-xs font-semibold text-foreground">
                Ngày xuất
              </label>
              <DateInput
                id="issue-date"
                value={date}
                readOnly={isLinkedSale}
                onValueChange={(value) => setDate(value)}
                className="w-full text-xs"
              />
              <p className="mt-1 text-[0.6875rem] text-muted-foreground">
                Để trống để dùng ngày hiện tại khi tạo phiếu.
              </p>
            </div>

            {isOwner && (
              <div className="sm:col-span-2">
                <NumberingOptionsFields value={numbering} onChange={setNumbering} />
              </div>
            )}

            <div>
              <label className="mb-1 block text-xs font-semibold text-foreground">Kho xuất *</label>
              <IssueDraftPicker
                farmId={farmId}
                kind="warehouse"
                value={warehouse}
                disabled={isLinkedSale}
                onSelect={(choice) => select("warehouse", choice)}
              />
            </div>

            <div>
              <label htmlFor="issue-type" className="mb-1 block text-xs font-semibold text-foreground">
                Loại phiếu
              </label>
              <Select
                id="issue-type"
                value={issueType}
                disabled={isLinkedSale}
                onChange={(event) => {
                  const next = event.target.value as CreateIssueInput["issueType"];
                  setIssueType(next);
                  if (next !== "MAINTENANCE") setMaintenanceRecordId(null);
                }}
                className="w-full text-xs font-medium"
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
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Phiếu này chỉ xuất vật tư theo số lượng hoặc lô. Để báo hỏng hoặc đưa tài sản đi bảo trì, mở{" "}
                  <Link href="/assets" className="text-primary underline">
                    hồ sơ tài sản
                  </Link>.
                </p>
              )}
            </div>

            {issueType !== "SALE" && (
              <div className="space-y-1 sm:col-span-2">
                <label className="block text-xs font-semibold text-foreground">Người nhận</label>
                <AssetLookup
                  farmId={farmId}
                  kind="member"
                  selected={recipient}
                  onSelect={setRecipient}
                />
                <p className="text-[0.6875rem] text-muted-foreground">
                  Không bắt buộc. Sau khi phiếu được xác nhận, người nhận có thể bấm &quot;Xác nhận đã nhận&quot; trên phiếu.
                </p>
              </div>
            )}

            <div>
              <label htmlFor="issue-reason" className="mb-1 block text-xs font-semibold text-foreground">
                Lý do xuất
              </label>
              <Textarea
                id="issue-reason"
                value={reason}
                readOnly={isLinkedSale}
                onChange={(event) => setReason(event.target.value)}
                maxLength={4000}
                rows={2}
                placeholder="Ví dụ: Xuất cho trại ong mật vụ cà phê..."
                className="w-full text-xs"
              />
            </div>

            <div>
              <label htmlFor="issue-note" className="mb-1 block text-xs font-semibold text-foreground">
                Ghi chú phiếu
              </label>
              <Textarea
                id="issue-note"
                value={note}
                readOnly={isLinkedSale}
                onChange={(event) => setNote(event.target.value)}
                maxLength={4000}
                rows={2}
                placeholder="Ghi chú thêm về quy cách đóng gói, vận chuyển..."
                className="w-full text-xs"
              />
            </div>
          </div>

          {issueType === "MAINTENANCE" && (
            <div className="pt-2">
              <IssueMaintenancePicker
                farmId={farmId}
                selectedId={maintenanceRecordId}
                onSelect={setMaintenanceRecordId}
              />
            </div>
          )}
        </section>

        {/* Section 2: Items List */}
        <section aria-label="Các dòng vật tư" className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
            <div>
              <h2 className="text-sm font-semibold text-foreground">2. Vật tư trong phiếu xuất</h2>
              <p className="text-xs text-muted-foreground">
                Chọn kho xuất trước khi chọn lô hoặc số serial tài sản tương ứng
              </p>
            </div>
            <span className="rounded-md border border-border bg-muted/60 px-2 py-0.5 text-xs font-semibold text-muted-foreground tabular-nums">
              {lines.length} dòng hàng
            </span>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {lines.map((line, index) => (
              <fieldset
                key={line.rowKey}
                className="relative min-w-0 space-y-3 rounded-lg border border-border bg-background p-4 shadow-2xs transition-colors"
              >
                <legend className="sr-only">Dòng {index + 1}</legend>
                
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[0.6875rem] font-semibold text-muted-foreground">
                        #{index + 1}
                      </span>
                      <p className="truncate text-xs font-bold text-foreground">
                        {line.label}
                      </p>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.2 text-[0.625rem] font-medium ${
                          line.trackingMode === "LOT"
                            ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20"
                            : line.trackingMode === "ASSET"
                              ? "bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/20"
                              : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
                        }`}
                      >
                        Theo {line.trackingMode === "LOT" ? "lô" : line.trackingMode === "ASSET" ? "tài sản" : "số lượng"}
                      </span>
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    disabled={isLinkedSale}
                    aria-label={`Xóa dòng ${index + 1}`}
                    onClick={() =>
                      setLines((previous) =>
                        previous.filter((row) => row.rowKey !== line.rowKey),
                      )
                    }
                    className="size-7 p-0 text-muted-foreground hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="size-3.5" aria-hidden="true" />
                  </Button>
                </div>

                {line.trackingMode === "LOT" && (
                  <div className="space-y-1">
                    <span className="text-[0.6875rem] font-medium text-muted-foreground">Lô xuất</span>
                    <IssueLotPicker
                      key={`${farmId}:${warehouse?.id ?? "none"}:${line.id}`}
                      farmId={farmId}
                      warehouseId={warehouse?.id ?? null}
                      itemId={line.id}
                      selected={line.lot}
                      onSelect={(lot) => updateLine(line.rowKey, { lot })}
                    />
                  </div>
                )}

                {line.trackingMode === "ASSET" && (
                  <div className="space-y-1">
                    <span className="text-[0.6875rem] font-medium text-muted-foreground">Chọn thiết bị / tài sản cụ thể:</span>
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
                  </div>
                )}

                <div className="grid gap-3 sm:grid-cols-[8rem_1fr]">
                  <div>
                    <label
                      htmlFor={`quantity-${line.rowKey}`}
                      className="mb-1 block text-xs font-semibold text-foreground"
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
                      className="h-8 text-xs font-medium tabular-nums"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor={`note-${line.rowKey}`}
                      className="mb-1 block text-xs font-semibold text-foreground"
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
                      placeholder="Ghi chú vật tư..."
                      className="h-8 text-xs"
                    />
                  </div>
                </div>

                {isLinkedSale && line.trackingMode === "LOT" && (
                  <div className="grid gap-2 border-t border-border pt-2 sm:grid-cols-[1fr_auto] sm:items-end">
                    <label htmlFor={`split-${line.rowKey}`} className="space-y-1 text-xs">
                      <span className="font-medium text-muted-foreground">Số lượng tách sang lô khác</span>
                      <Input
                        id={`split-${line.rowKey}`}
                        inputMode="decimal"
                        value={line.splitQuantity ?? ""}
                        onChange={(event) => updateLine(line.rowKey, { splitQuantity: event.target.value })}
                        placeholder="Ví dụ 1.250"
                        className="h-8 text-xs font-medium"
                      />
                    </label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => splitLotLine(line)}
                      className="h-8 gap-1 text-xs font-medium"
                    >
                      <Split className="size-3.5" aria-hidden="true" />
                      <span>Tách dòng</span>
                    </Button>
                  </div>
                )}
              </fieldset>
            ))}

            {!isLinkedSale && (
              <AddLineTile label="Thêm vật tư xuất kho">
                {(close) => (
                  <IssueDraftPicker
                    farmId={farmId}
                    kind="item"
                    onSelect={(choice) => {
                      select("item", choice);
                      close();
                    }}
                  />
                )}
              </AddLineTile>
            )}
          </div>

          <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            <Info className="size-4 shrink-0 text-primary" aria-hidden="true" />
            <span>
              Số lượng phải lớn hơn 0, tối đa 3 chữ số thập phân (dùng dấu chấm, ví dụ 1.250). Lưu nháp không giữ chỗ tồn kho.
            </span>
          </div>
        </section>
      </fieldset>

      {error && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-xs font-medium text-destructive"
        >
          <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {linkedError && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-xs font-medium text-destructive"
        >
          <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
          <span>{linkedError}</span>
        </div>
      )}

      {/* Sticky Action Bar */}
      <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card/95 p-4 shadow-lg backdrop-blur-xs">
        <div className="flex flex-wrap items-center gap-4 text-xs font-medium">
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">Số dòng hàng:</span>
            <span className="font-bold text-foreground tabular-nums">{lines.length}</span>
          </div>
          {totalQuantity > 0 && (
            <div className="flex items-center gap-1.5 border-l border-border pl-4">
              <span className="text-muted-foreground">Tổng số lượng xuất:</span>
              <span className="font-bold text-foreground tabular-nums">{totalQuantity}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            type="button"
            onClick={onCancel}
            disabled={isSaving}
            className="h-9 text-xs font-medium"
          >
            {initial ? "Quay lại chi tiết" : "Quay lại danh sách"}
          </Button>
          <Button
            type="submit"
            disabled={isSaving}
            className="h-9 text-xs font-semibold shadow-xs"
          >
            {isSaving ? "Đang lưu..." : initial ? "Lưu thay đổi" : "Lưu phiếu nháp"}
          </Button>
        </div>
      </div>
    </form>
  );
}

"use client";

import { useState } from "react";
import { useReceiptDetail } from "../hooks/use-receipt-detail";
import { useCancelReceipt } from "../hooks/use-cancel-receipt";
import { useConfirmReceipt } from "../hooks/use-confirm-receipt";
import {
  supportsQuantityDraftConfirm,
  supportsQuantityDraftEdit,
} from "./receipt-draft.logic";
import { RECEIPT_STATUS_LABELS } from "../types/receipt";
import type { ReceiptDraftInitial } from "../types/receipt";
import { PageHeader } from "@/shared/components/ui/page-header";
import { Button } from "@/shared/components/ui/button";
import { HistoryPanel } from "@/features/history";
import {
  RejectionNotice,
  StockDocumentReview,
  stockDocumentActions,
} from "@/features/stock-documents";
import type { StockDocumentViewer } from "@/features/stock-documents/stock-document.logic";

const date = (value: string | null) =>
  value ? value.split("-").reverse().join("/") : "—";

export function ReceiptDetail({
  farmId,
  id,
  viewer,
  onBack,
  onEdit,
  onCancelled,
  onConfirmed,
}: {
  farmId: string;
  id: string;
  viewer: StockDocumentViewer;
  onBack: () => void;
  onEdit: (initial: ReceiptDraftInitial) => void;
  onCancelled: () => void;
  onConfirmed: () => void;
}) {
  const {
    detail,
    warehouse,
    supplier,
    warning,
    error,
    isLoading,
    reload,
    revision,
  } = useReceiptDetail(farmId, id);
  const actions = stockDocumentActions(
    viewer,
    detail?.receipt ?? { status: "CANCELLED", createdByMemberId: null },
  );
  const [reviewError, setReviewError] = useState<string | null>(null);
  const refresh = () => {
    reload();
    onConfirmed();
  };
  const { cancel, isCancelling, cancelError } = useCancelReceipt(
    farmId,
    actions.cancel,
    id,
    onCancelled,
    refresh,
  );
  const canEdit = Boolean(
    detail && supportsQuantityDraftEdit(detail),
  );
  const canConfirm = Boolean(
    detail && supportsQuantityDraftConfirm(detail),
  );
  const { confirm, isConfirming, confirmError } = useConfirmReceipt(
    farmId,
    actions.confirm,
    id,
    refresh,
    refresh,
  );

  return (
    <section className="space-y-5" aria-label="Chi tiết phiếu nhập">
      <PageHeader
        title="Chi tiết phiếu nhập"
        actions={
          <>
          <Button
            onClick={onBack}
            disabled={isCancelling || isConfirming}
            variant="outline"
          >
            Quay lại danh sách
          </Button>
          {actions.edit && canEdit && (
            <Button
              onClick={() => {
                if (!detail) return;
                onEdit({
                  detail,
                  warehouseLabel: warehouse,
                  supplierLabel: supplier,
                });
              }}
              disabled={isCancelling || isConfirming}
              variant="outline"
            >
              Sửa nháp
            </Button>
          )}
          {actions.cancel && (
            <Button
              onClick={() => {
                if (window.confirm("Bạn có chắc muốn hủy phiếu nhập nháp này?"))
                  void cancel();
              }}
              disabled={isCancelling || isConfirming}
              variant="outline"
              className="border-destructive/40 text-destructive hover:bg-destructive/10"
            >
              {isCancelling ? "Đang hủy..." : "Hủy phiếu nháp"}
            </Button>
          )}
          {detail && (
            <StockDocumentReview
              kind="stock-receipts"
              farmId={farmId}
              id={id}
              code={detail.receipt.receiptCode}
              canSubmit={actions.submit}
              canReject={actions.reject}
              disabled={isCancelling || isConfirming}
              onChanged={refresh}
              onError={setReviewError}
            />
          )}
          {actions.confirm && canConfirm && (
            <Button
              onClick={() => {
                if (
                  window.confirm(
                    "Xác nhận phiếu nhập này? Sau khi xác nhận, hệ thống sẽ cập nhật tồn kho và không thể sửa hoặc hủy phiếu.",
                  )
                )
                  void confirm();
              }}
              disabled={isCancelling || isConfirming}
            >
              {isConfirming ? "Đang xác nhận..." : "Xác nhận nhập kho"}
            </Button>
          )}
          </>
        }
      />
      {isLoading ? (
        <p role="status">Đang tải chi tiết phiếu nhập...</p>
      ) : error ? (
        <div
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm font-semibold text-destructive"
        >
          <p>{error}</p>
          <button type="button" onClick={reload} className="mt-2 underline">
            Thử lại
          </button>
        </div>
      ) : (
        detail && (
          <>
            {cancelError && (
              <div
                role="alert"
                className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm font-semibold text-destructive"
              >
                {cancelError}
              </div>
            )}
            {reviewError && (
              <div
                role="alert"
                className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm font-semibold text-destructive"
              >
                {reviewError}
              </div>
            )}
            {confirmError && (
              <div
                role="alert"
                className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm font-semibold text-destructive"
              >
                {confirmError}
              </div>
            )}
            <RejectionNotice reason={detail.receipt.rejectionReason} />
            {(actions.confirm || actions.submit) &&
              !canConfirm &&
              !warning && (
                <p role="status" className="rounded-xl border p-3 text-sm">
                  {detail.items.length === 0
                    ? "Phiếu chưa có dòng hàng nên chưa thể xác nhận."
                    : "Phiếu có dòng hàng thiếu thông tin lô hoặc tài sản nên chưa thể xác nhận."}
                </p>
              )}
            {actions.edit && !canEdit && (
              <p role="status" className="rounded-xl border p-3 text-sm">
                Phiếu nháp có dòng hàng không hợp lệ nên chưa thể sửa bằng form
                hiện tại.
              </p>
            )}
            {warning && (
              <p role="status" className="rounded-xl border p-3 text-sm">
                Không tải được thông tin kho hoặc nhà cung cấp. Mã tham chiếu
                được hiển thị thay thế.{" "}
                <button type="button" onClick={reload} className="underline">
                  Thử lại
                </button>
              </p>
            )}
            <dl className="grid gap-4 rounded-xl border bg-card p-5 sm:grid-cols-2">
              <div>
                <dt className="text-sm text-muted-foreground">Mã phiếu</dt>
                <dd className="break-words font-mono">
                  {detail.receipt.receiptCode}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Ngày nhập</dt>
                <dd>{date(detail.receipt.receiptDate)}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Kho</dt>
                <dd className="break-words">
                  {warehouse ??
                    `Không tải được thông tin kho (${detail.receipt.warehouseId})`}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Nhà cung cấp</dt>
                <dd className="break-words">
                  {detail.receipt.supplierId
                    ? (supplier ??
                      `Không tải được thông tin nhà cung cấp (${detail.receipt.supplierId})`)
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Trạng thái</dt>
                <dd>{RECEIPT_STATUS_LABELS[detail.receipt.status]}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-sm text-muted-foreground">Ghi chú</dt>
                <dd className="whitespace-pre-wrap break-words">
                  {detail.receipt.note || "—"}
                </dd>
              </div>
            </dl>
            {detail.items.length === 0 ? (
              <p>Phiếu nhập chưa có dòng hàng.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border bg-card">
                <table className="w-full text-left text-sm">
                  <caption className="sr-only">
                    Các dòng hàng của phiếu nhập {detail.receipt.receiptCode}
                  </caption>
                  <thead className="border-b bg-muted/50">
                    <tr>
                      {[
                        "Hàng hóa",
                        "Số lượng",
                        "Đơn giá",
                        "Lô / Tài sản",
                        "Ghi chú",
                      ].map((label) => (
                        <th key={label} scope="col" className="px-4 py-3">
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {detail.items.map((line) => {
                      const lotNumber = line.lotNumber ?? line.lotNumberFromLot;
                      const manufacturedDate =
                        line.manufacturedDate ?? line.lotManufacturedDate;
                      const expiryDate = line.expiryDate ?? line.lotExpiryDate;
                      const assetCode = line.assetCode ?? line.assetCodeFromAsset;
                      const serialNumber =
                        line.serialNumber ?? line.assetSerialNumber;
                      return (
                        <tr key={line.id}>
                          <td className="px-4 py-3">
                            {line.itemCode ? (
                              <>
                                <p className="font-mono">{line.itemCode}</p>
                                <p>{line.itemName}</p>
                              </>
                            ) : (
                              <span className="break-all">
                                Không tìm thấy hàng ({line.itemId})
                              </span>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3">
                            {line.quantity} {line.unitSymbol || line.unitName}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3">
                            {line.unitPrice}
                          </td>
                          <td className="px-4 py-3">
                            {lotNumber && (
                              <p>
                                Lô: {lotNumber}
                                {line.lotId && !line.lotNumber && " (lô có sẵn)"}
                              </p>
                            )}
                            {manufacturedDate && (
                              <p>Ngày sản xuất: {date(manufacturedDate)}</p>
                            )}
                            {expiryDate && <p>Hạn sử dụng: {date(expiryDate)}</p>}
                            {assetCode && <p>Mã tài sản: {assetCode}</p>}
                            {serialNumber && <p>Serial: {serialNumber}</p>}
                            {line.locationId && (
                              <p>
                                Vị trí:{" "}
                                {line.locationCode
                                  ? `${line.locationCode} — ${line.locationName}`
                                  : `Không tìm thấy vị trí (${line.locationId})`}
                              </p>
                            )}
                            {!lotNumber &&
                              !manufacturedDate &&
                              !expiryDate &&
                              !assetCode &&
                              !serialNumber &&
                              !line.locationId &&
                              "—"}
                          </td>
                          <td className="whitespace-pre-wrap break-words px-4 py-3">
                            {line.note || "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )
      )}
      <HistoryPanel key={`${farmId}:${id}`} farmId={farmId} entityType="STOCK_RECEIPT" entityId={id} revision={revision} />
    </section>
  );
}

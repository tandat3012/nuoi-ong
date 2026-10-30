"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useIssueDetail } from "../hooks/use-issue-detail";
import { useCancelIssue } from "../hooks/use-cancel-issue";
import { useConfirmIssue } from "../hooks/use-confirm-issue";
import {
  ISSUE_STATUS_LABELS,
  ISSUE_TYPE_LABELS,
  type IssueDetail as IssueDetailData,
} from "../types/issue";
import { supportsIssueDraftEdit } from "./issue-draft.logic";
import { formatInventoryQuantity } from "@/features/inventory/inventory.logic";
import { IssueMaintenancePicker } from "./issue-maintenance-picker";
import { PageHeader } from "@/shared/components/ui/page-header";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { HistoryPanel } from "@/features/history";
import {
  RejectionNotice,
  StockDocumentReview,
  stockDocumentActions,
  documentCodeLabel,
  NumberingDetails,
} from "@/features/stock-documents";
import type { StockDocumentViewer } from "@/features/stock-documents/stock-document.logic";

export function IssueDetail({
  farmId,
  id,
  onBack,
  viewer,
  onEdit,
  onChanged,
}: {
  farmId: string;
  id: string;
  onBack: () => void;
  viewer: StockDocumentViewer;
  onEdit: (detail: IssueDetailData) => void;
  onChanged?: () => void;
}) {
  const { detail, isLoading, error, reload, revision } = useIssueDetail(farmId, id);
  const actionPending = useRef(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const refresh = () => {
    reload();
    onChanged?.();
  };
  const actions = stockDocumentActions(
    viewer,
    detail?.issue ?? { status: "CANCELLED", createdByMemberId: null },
  );
  const { confirm, isConfirming, confirmError } = useConfirmIssue(
    farmId,
    actions.confirm,
    id,
    detail?.issue.status,
    refresh,
  );
  const { cancel, isCancelling, cancelError } = useCancelIssue(
    farmId,
    actions.cancel,
    id,
    detail?.issue.status,
    refresh,
  );
  const isProcessing = isCancelling || isConfirming;
  async function runAction(action: () => Promise<void>, message: string) {
    if (actionPending.current || isProcessing) return;
    if (!window.confirm(message)) return;
    actionPending.current = true;
    try {
      await action();
    } finally {
      actionPending.current = false;
    }
  }
  return (
    <section className="space-y-6" aria-label="Chi tiết phiếu xuất">
      <div className="flex flex-wrap gap-3">
        <Button variant="outline"
          onClick={() => {
            if (!actionPending.current) onBack();
          }}
          disabled={isProcessing}
        >
          Quay lại danh sách
        </Button>
        <Button variant="outline"
          onClick={() => {
            if (!actionPending.current) reload();
          }}
          disabled={isLoading || isProcessing}
        >
          Tải lại chi tiết
        </Button>
      </div>
      {isCancelling && <p role="status">Đang hủy phiếu xuất...</p>}
      {isConfirming && <p role="status">Đang xác nhận phiếu xuất...</p>}
      {confirmError && (
        <p
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
        >
          {confirmError}
        </p>
      )}
      {reviewError && (
        <p
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
        >
          {reviewError}
        </p>
      )}
      {cancelError && (
        <p
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
        >
          {cancelError}
        </p>
      )}
      {isLoading ? (
        <p role="status">Đang tải chi tiết phiếu xuất...</p>
      ) : error ? (
        <div
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
        >
          <p>{error}</p>
          <button type="button" onClick={reload} className="mt-2 underline">
            Thử lại
          </button>
        </div>
      ) : (
        detail && (
          <>
            <PageHeader
              title={`Phiếu xuất ${documentCodeLabel(detail.issue.issueCode, detail.issue.id)}`}
              badge={
                <Badge variant="outline">
                  {ISSUE_STATUS_LABELS[detail.issue.status]}
                </Badge>
              }
              actions={
                <>
                  {actions.edit && supportsIssueDraftEdit(detail) && (
                    <Button
                      onClick={() => {
                        if (!actionPending.current) onEdit(detail);
                      }}
                      disabled={isProcessing}
                      variant="outline"
                    >
                      Sửa phiếu nháp
                    </Button>
                  )}
                  <StockDocumentReview
                    kind="stock-issues"
                    farmId={farmId}
                    id={id}
                    code={documentCodeLabel(detail.issue.issueCode, detail.issue.id)}
                    canSubmit={actions.submit}
                    canReject={actions.reject}
                    disabled={isProcessing}
                    onChanged={refresh}
                    onError={setReviewError}
                  />
                  {actions.confirm && (
                    <Button
                      disabled={isProcessing}
                      onClick={() =>
                        void runAction(
                          confirm,
                          `Xác nhận phiếu xuất ${documentCodeLabel(detail.issue.issueCode, detail.issue.id)} từ kho ${detail.issue.warehouseName ?? detail.issue.warehouseId} (${detail.items.length} dòng hàng)? Thao tác này sẽ trừ tồn kho và cập nhật trạng thái tài sản liên quan.`,
                        )
                      }
                    >
                      Xác nhận phiếu xuất
                    </Button>
                  )}
                  {actions.cancel && (
                    <Button
                      disabled={isProcessing}
                      onClick={() =>
                        void runAction(
                          cancel,
                          `Hủy phiếu xuất nháp ${documentCodeLabel(detail.issue.issueCode, detail.issue.id)}? Thao tác này không thay đổi tồn kho.`,
                        )
                      }
                      variant="outline"
                      className="border-destructive/40 text-destructive hover:bg-destructive/10"
                    >
                      Hủy phiếu nháp
                    </Button>
                  )}
                </>
              }
            />
            <RejectionNotice reason={detail.issue.rejectionReason} />
            {actions.edit && !supportsIssueDraftEdit(detail) && (
                <p className="text-sm text-muted-foreground">
                  Phiếu có dữ liệu không tương thích nên chưa thể chỉnh sửa trên
                  màn hình này.
                </p>
              )}
            {detail.issue.maintenanceRecordId && (
              <IssueMaintenancePicker
                farmId={farmId}
                selectedId={detail.issue.maintenanceRecordId}
              />
            )}
            {detail.issue.orderId && (
              <p className="rounded-xl border bg-card p-4 text-sm">
                Phiếu xuất liên kết với đơn hàng. {" "}
                <Link
                  className="text-primary underline"
                  href={`/store-orders/${encodeURIComponent(detail.issue.orderId)}`}
                >
                  Mở đơn hàng
                </Link>
                {actions.confirm && detail.issue.status === "DRAFT" && (
                  <span> · Hãy hủy đơn hàng từ màn hình đơn để hủy phiếu này.</span>
                )}
              </p>
            )}
            <dl className="grid gap-4 rounded-xl border bg-card p-5 sm:grid-cols-2">
              <div>
                <dt className="text-sm text-muted-foreground">Kho nguồn</dt>
                <dd>
                  {detail.issue.warehouseName
                    ? `${detail.issue.warehouseCode ?? ""} — ${detail.issue.warehouseName}`
                    : "Không có thông tin kho"}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Ngày xuất</dt>
                <dd>{detail.issue.issueDate.split("-").reverse().join("/")}</dd>
              </div>
              <NumberingDetails document={detail.issue} />
              <div>
                <dt className="text-sm text-muted-foreground">Loại phiếu</dt>
                <dd>{ISSUE_TYPE_LABELS[detail.issue.issueType]}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Số dòng hàng</dt>
                <dd>{detail.items.length}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Lý do</dt>
                <dd className="whitespace-pre-wrap break-words">
                  {detail.issue.reason || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Ghi chú</dt>
                <dd className="whitespace-pre-wrap break-words">
                  {detail.issue.note || "—"}
                </dd>
              </div>
            </dl>
            {detail.items.length === 0 ? (
              <p role="status">Phiếu xuất chưa có dòng hàng.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border bg-card">
                <table className="w-full text-left text-sm">
                  <caption className="sr-only">
                    Các dòng hàng trong phiếu xuất {documentCodeLabel(detail.issue.issueCode, detail.issue.id)}
                  </caption>
                  <thead className="border-b bg-muted/50">
                    <tr>
                      {[
                        "Vật tư / thiết bị",
                        "Theo dõi",
                        "Lô / tài sản",
                        "Số lượng",
                        "Đơn vị",
                        "Ghi chú",
                      ].map((label) => (
                        <th
                          key={label}
                          scope="col"
                          className={`px-4 py-3${label === "Số lượng" ? " text-right" : ""}`}
                        >
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {detail.items.map((line) => (
                      <tr key={line.id}>
                        <td className="px-4 py-3">
                          <p className="font-medium">
                            {line.itemName || "Không có thông tin vật tư"}
                          </p>
                          <p className="break-all text-xs text-muted-foreground">
                            {line.itemCode || line.itemId}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          {line.trackingMode
                            ? {
                                QUANTITY: "Số lượng",
                                LOT: "Theo lô",
                                ASSET: "Tài sản",
                              }[line.trackingMode]
                            : "Chưa có thông tin"}
                        </td>
                        <td className="px-4 py-3">
                          {line.lotId && (
                            <>
                              <p>{line.lotNumber || "Không có thông tin lô"}</p>
                              {!line.lotNumber && (
                                <p className="break-all text-xs text-muted-foreground">
                                  {line.lotId}
                                </p>
                              )}
                              <p className="text-xs text-muted-foreground">
                                Hạn dùng:{" "}
                                {line.lotExpiryDate
                                  ? line.lotExpiryDate
                                      .split("-")
                                      .reverse()
                                      .join("/")
                                  : "Không có thông tin"}
                              </p>
                            </>
                          )}
                          {line.assetId && (
                            <>
                              <p>
                                {line.assetCode || "Không có thông tin tài sản"}
                              </p>
                              {!line.assetCode && (
                                <p className="break-all text-xs text-muted-foreground">
                                  {line.assetId}
                                </p>
                              )}
                              {line.serialNumber && (
                                <p className="text-xs text-muted-foreground">
                                  Serial: {line.serialNumber}
                                </p>
                              )}
                            </>
                          )}
                          {!line.lotId && !line.assetId && "—"}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {formatInventoryQuantity(line.quantity)}
                        </td>
                        <td className="px-4 py-3">
                          {line.unitSymbol || line.unitName || "—"}
                        </td>
                        <td className="max-w-sm whitespace-pre-wrap break-words px-4 py-3">
                          {line.note || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )
      )}
      <HistoryPanel key={`${farmId}:${id}`} farmId={farmId} entityType="STOCK_ISSUE" entityId={id} revision={revision} />
    </section>
  );
}

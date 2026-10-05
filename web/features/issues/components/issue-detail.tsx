"use client";

import { useRef } from "react";
import { useIssueDetail } from "../hooks/use-issue-detail";
import { useCancelIssue } from "../hooks/use-cancel-issue";
import { useConfirmIssue } from "../hooks/use-confirm-issue";
import {
  ISSUE_STATUS_LABELS,
  ISSUE_TYPE_LABELS,
  type IssueDetail as IssueDetailData,
} from "../types/issue";
import { supportsIssueDraftEdit } from "./issue-draft.logic";
import { IssueMaintenancePicker } from "./issue-maintenance-picker";

export function IssueDetail({
  farmId,
  id,
  onBack,
  canWrite,
  onEdit,
  onChanged,
}: {
  farmId: string;
  id: string;
  onBack: () => void;
  canWrite: boolean;
  onEdit: (detail: IssueDetailData) => void;
  onChanged: () => void;
}) {
  const { detail, isLoading, error, reload } = useIssueDetail(farmId, id);
  const actionPending = useRef(false);
  const refresh = () => {
    reload();
    onChanged();
  };
  const { confirm, isConfirming, confirmError } = useConfirmIssue(
    farmId,
    canWrite,
    id,
    detail?.issue.status,
    refresh,
  );
  const { cancel, isCancelling, cancelError } = useCancelIssue(
    farmId,
    canWrite,
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
        <button
          type="button"
          onClick={() => {
            if (!actionPending.current) onBack();
          }}
          disabled={isProcessing}
          className="rounded-lg border px-4 py-2 text-sm hover:bg-muted"
        >
          Quay lại danh sách
        </button>
        <button
          type="button"
          onClick={() => {
            if (!actionPending.current) reload();
          }}
          disabled={isLoading || isProcessing}
          className="rounded-lg border px-4 py-2 text-sm hover:bg-muted disabled:opacity-50"
        >
          Tải lại chi tiết
        </button>
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
            <header className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold">
                Phiếu xuất {detail.issue.issueCode}
              </h1>
              <span className="rounded-full border px-3 py-1 text-sm">
                {ISSUE_STATUS_LABELS[detail.issue.status]}
              </span>
              {canWrite && supportsIssueDraftEdit(detail) && (
                <button
                  type="button"
                  onClick={() => {
                    if (!actionPending.current) onEdit(detail);
                  }}
                  disabled={isProcessing}
                  className="rounded-lg border px-4 py-2 text-sm hover:bg-muted"
                >
                  Sửa phiếu nháp
                </button>
              )}
              {canWrite && detail.issue.status === "DRAFT" && (
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() =>
                    void runAction(
                      confirm,
                      `Xác nhận phiếu xuất ${detail.issue.issueCode} từ kho ${detail.issue.warehouseName ?? detail.issue.warehouseId} (${detail.items.length} dòng hàng)? Thao tác này sẽ trừ tồn kho và cập nhật trạng thái tài sản liên quan.`,
                    )
                  }
                  className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
                >
                  Xác nhận phiếu xuất
                </button>
              )}
              {canWrite && detail.issue.status === "DRAFT" && (
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() =>
                    void runAction(
                      cancel,
                      `Hủy phiếu xuất nháp ${detail.issue.issueCode}? Thao tác này không thay đổi tồn kho.`,
                    )
                  }
                  className="rounded-lg border border-destructive/40 px-4 py-2 text-sm text-destructive hover:bg-destructive/10 disabled:opacity-50"
                >
                  Hủy phiếu nháp
                </button>
              )}
            </header>
            {canWrite &&
              detail.issue.status === "DRAFT" &&
              !supportsIssueDraftEdit(detail) && (
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
                    Các dòng hàng trong phiếu xuất {detail.issue.issueCode}
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
                        <th key={label} scope="col" className="px-4 py-3">
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
                        <td className="px-4 py-3 text-right font-mono tabular-nums">
                          {line.quantity}
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
    </section>
  );
}

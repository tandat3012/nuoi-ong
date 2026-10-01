'use client';

import { useReceiptDetail } from '../hooks/use-receipt-detail';
import { useCancelReceipt } from '../hooks/use-cancel-receipt';
import { useConfirmReceipt } from '../hooks/use-confirm-receipt';
import {
  supportsQuantityDraftConfirm,
  supportsQuantityDraftEdit,
} from './receipt-draft.logic';
import { RECEIPT_STATUS_LABELS } from '../types/receipt';
import type { ReceiptDraftInitial } from '../types/receipt';

const date = (value: string | null) =>
  value ? value.split('-').reverse().join('/') : '—';

export function ReceiptDetail({
  farmId,
  id,
  canWrite,
  onBack,
  onEdit,
  onCancelled,
  onConfirmed,
}: {
  farmId: string;
  id: string;
  canWrite: boolean;
  onBack: () => void;
  onEdit: (initial: ReceiptDraftInitial) => void;
  onCancelled: () => void;
  onConfirmed: () => void;
}) {
  const {
    detail,
    warehouse,
    supplier,
    locationLabels,
    references,
    warning,
    error,
    isLoading,
    reload,
  } = useReceiptDetail(farmId, id);
  const { cancel, isCancelling, cancelError } = useCancelReceipt(
    farmId,
    canWrite,
    id,
    onCancelled,
  );
  const canEdit = Boolean(
    detail && supportsQuantityDraftEdit(detail, references),
  );
  const canConfirm = Boolean(
    detail && supportsQuantityDraftConfirm(detail, references),
  );
  const { confirm, isConfirming, confirmError } = useConfirmReceipt(
    farmId,
    canWrite,
    id,
    () => {
      reload();
      onConfirmed();
    },
  );

  return (
    <section className="space-y-5" aria-label="Chi tiết phiếu nhập">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Chi tiết phiếu nhập</h1>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onBack}
            disabled={isCancelling || isConfirming}
            className="rounded-xl border px-4 py-2 text-sm hover:bg-muted disabled:opacity-50"
          >
            Quay lại danh sách
          </button>
          {canWrite && detail?.receipt.status === 'DRAFT' && canEdit && (
            <button
              type="button"
              onClick={() => {
                if (!detail) return;
                onEdit({
                  detail,
                  warehouseLabel: warehouse,
                  supplierLabel: supplier,
                  locationLabels,
                  references,
                });
              }}
              disabled={isCancelling || isConfirming}
              className="rounded-xl border px-4 py-2 text-sm hover:bg-muted disabled:opacity-50"
            >
              Sửa nháp
            </button>
          )}
          {canWrite && detail?.receipt.status === 'DRAFT' && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Bạn có chắc muốn hủy phiếu nhập nháp này?'))
                  void cancel();
              }}
              disabled={isCancelling || isConfirming}
              className="rounded-xl border border-destructive/40 px-4 py-2 text-sm text-destructive hover:bg-destructive/10 disabled:opacity-50"
            >
              {isCancelling ? 'Đang hủy...' : 'Hủy phiếu nháp'}
            </button>
          )}
          {canWrite && detail?.receipt.status === 'DRAFT' && canConfirm && (
            <button
              type="button"
              onClick={() => {
                if (
                  window.confirm(
                    'Xác nhận phiếu nhập này? Sau khi xác nhận, hệ thống sẽ cập nhật tồn kho và không thể sửa hoặc hủy phiếu.',
                  )
                )
                  void confirm();
              }}
              disabled={isCancelling || isConfirming}
              className="rounded-xl bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {isConfirming ? 'Đang xác nhận...' : 'Xác nhận nhập kho'}
            </button>
          )}
        </div>
      </header>
      {isLoading ? (
        <p role="status">Đang tải chi tiết phiếu nhập...</p>
      ) : error ? (
        <div
          role="alert"
          className="rounded-xl border border-destructive/30 p-4"
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
              <p
                role="alert"
                className="rounded-xl border border-destructive/30 p-3 text-destructive"
              >
                {cancelError}
              </p>
            )}
            {confirmError && (
              <p
                role="alert"
                className="rounded-xl border border-destructive/30 p-3 text-destructive"
              >
                {confirmError}
              </p>
            )}
            {canWrite &&
              detail.receipt.status === 'DRAFT' &&
              !canConfirm &&
              !warning && (
                <p role="status" className="rounded-xl border p-3 text-sm">
                  {detail.items.length === 0
                    ? 'Phiếu chưa có dòng hàng nên chưa thể xác nhận.'
                    : 'Phiếu có dòng hàng thiếu thông tin LOT/ASSET hoặc dữ liệu hàng hóa chưa tải được nên chưa thể xác nhận.'}
                </p>
              )}
            {canWrite && detail.receipt.status === 'DRAFT' && !canEdit && (
              <p role="status" className="rounded-xl border p-3 text-sm">
                Phiếu nháp có dòng hàng chưa tải được hoặc dữ liệu không hợp lệ
                nên chưa thể sửa bằng form hiện tại.
              </p>
            )}
            {warning && (
              <p role="status" className="rounded-xl border p-3 text-sm">
              Không tải được một số thông tin kho/nhà cung cấp/hàng hóa/vị trí.
              Mã tham chiếu được hiển thị thay thế.{' '}
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
                <dt className="text-sm text-muted-foreground">
                  Nhà cung cấp
                </dt>
                <dd className="break-words">
                  {detail.receipt.supplierId
                    ? supplier ??
                      `Không tải được thông tin nhà cung cấp (${detail.receipt.supplierId})`
                    : '—'}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Trạng thái</dt>
                <dd>{RECEIPT_STATUS_LABELS[detail.receipt.status]}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-sm text-muted-foreground">Ghi chú</dt>
                <dd className="whitespace-pre-wrap break-words">
                  {detail.receipt.note || '—'}
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
                        'Hàng hóa',
                        'Số lượng',
                        'Đơn giá',
                        'Lô / Tài sản',
                        'Ghi chú',
                      ].map((label) => (
                        <th key={label} scope="col" className="px-4 py-3">
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {detail.items.map((line) => {
                      const reference = references?.[line.itemId];
                      return (
                        <tr key={line.id}>
                          <td className="px-4 py-3">
                            {reference ? (
                              <>
                                <p className="font-mono">
                                  {reference.item.code}
                                </p>
                                <p>{reference.item.name}</p>
                              </>
                            ) : (
                              <span className="break-all">
                                Không tải được thông tin hàng ({line.itemId})
                              </span>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3">
                            {line.quantity}{' '}
                            {reference?.unitSymbol || reference?.unitName}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3">
                            {line.unitPrice}
                          </td>
                          <td className="px-4 py-3">
                            {line.lotNumber && <p>Lô: {line.lotNumber}</p>}
                            {line.lotId && (
                              <p className="break-all">ID lô: {line.lotId}</p>
                            )}
                            {line.manufacturedDate && (
                              <p>
                                Ngày sản xuất: {date(line.manufacturedDate)}
                              </p>
                            )}
                            {line.expiryDate && (
                              <p>Hạn sử dụng: {date(line.expiryDate)}</p>
                            )}
                            {line.assetCode && (
                              <p>Mã tài sản: {line.assetCode}</p>
                            )}
                            {line.assetId && (
                              <p className="break-all">
                                ID tài sản: {line.assetId}
                              </p>
                            )}
                            {line.serialNumber && (
                              <p>Serial: {line.serialNumber}</p>
                            )}
                            {line.locationId && (
                              <p>
                                Vị trí:{' '}
                                {locationLabels?.[line.locationId] ??
                                  `Không tải được thông tin vị trí (${line.locationId})`}
                              </p>
                            )}
                            {!line.lotNumber &&
                              !line.lotId &&
                              !line.manufacturedDate &&
                              !line.expiryDate &&
                              !line.assetCode &&
                              !line.assetId &&
                              !line.serialNumber &&
                              !line.locationId &&
                              '—'}
                          </td>
                          <td className="whitespace-pre-wrap break-words px-4 py-3">
                            {line.note || '—'}
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
    </section>
  );
}

import { RECEIPT_STATUS_LABELS, type Receipt } from '../types/receipt';

export function ReceiptTable({
  receipts,
  onOpen,
}: {
  receipts: Receipt[];
  onOpen: (id: string) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Danh sách phiếu nhập kho</caption>
        <thead className="border-b bg-muted/50">
          <tr>
            {[
              'Mã phiếu',
              'Ngày nhập',
              'Kho',
              'Nhà cung cấp',
              'Trạng thái',
              'Ghi chú',
              'Thao tác',
            ].map(
              (label) => (
                <th key={label} scope="col" className="px-4 py-3">
                  {label}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody className="divide-y">
          {receipts.map((receipt) => (
            <tr key={receipt.id}>
              <td className="px-4 py-3 font-mono">{receipt.receiptCode}</td>
              <td className="whitespace-nowrap px-4 py-3">
                {receipt.receiptDate.split('-').reverse().join('/')}
              </td>
              <td className="px-4 py-3">
                {receipt.warehouseCode && receipt.warehouseName
                  ? `${receipt.warehouseCode} — ${receipt.warehouseName}`
                  : '—'}
              </td>
              <td className="px-4 py-3">
                {receipt.supplierCode && receipt.supplierName
                  ? `${receipt.supplierCode} — ${receipt.supplierName}`
                  : '—'}
              </td>
              <td className="whitespace-nowrap px-4 py-3">
                {RECEIPT_STATUS_LABELS[receipt.status]}
              </td>
              <td className="max-w-sm break-words px-4 py-3 text-muted-foreground">
                {receipt.note || '—'}
              </td>
              <td className="px-4 py-3">
                <button
                  type="button"
                  onClick={() => onOpen(receipt.id)}
                  aria-label={`Chi tiết phiếu ${receipt.receiptCode}`}
                  className="rounded-lg border px-3 py-1 hover:bg-muted"
                >
                  Chi tiết
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

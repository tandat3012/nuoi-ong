"use client";

import { useAuthenticatedRequest } from "@/features/auth";
import { createReceipt, submitReceipt } from "@/features/receipts/api/receipts.api";
import { FormDialog } from "@/shared/components/ui/form-dialog";
import { Input } from "@/shared/components/ui/input";
import { storeAdminError } from "../store-admin.logic";
import type { StoreSalesStockRow } from "../types/store-admin";

/** Drafts a receipt into the sales warehouse and sends it for the warehouse's approval. */
export function StoreRestockDialog({
  farmId,
  warehouseId,
  row,
  onClose,
  onSent,
}: {
  farmId: string;
  warehouseId: string;
  row: StoreSalesStockRow;
  onClose: () => void;
  onSent: (receiptCode: string) => void;
}) {
  const request = useAuthenticatedRequest();
  return (
    <FormDialog
      title="Nhập thêm hàng"
      description={`${row.productName} – ${row.variantName} (${row.itemCode}). Phiếu được gửi kho duyệt; tồn chỉ tăng sau khi kho xác nhận.`}
      submitLabel="Gửi duyệt"
      onClose={onClose}
      errorMessage={(failure) =>
        failure && typeof failure === "object" && "status" in failure && failure.status === 403
          ? "Bạn không có quyền tạo phiếu nhập cho kho bán hàng."
          : storeAdminError(failure)
      }
      onSubmit={async (data) => {
        const quantity = String(data.get("quantity") ?? "").trim();
        if (!(Number(quantity) > 0)) throw new Error("Số lượng phải lớn hơn 0.");
        const unitPrice = String(data.get("unitPrice") ?? "").trim();
        const expiryDate = String(data.get("expiryDate") ?? "").trim();
        const note = String(data.get("note") ?? "").trim();
        const { data: draft } = await createReceipt(request, farmId, {
          warehouseId,
          note: note || null,
          items: [
            {
              itemId: row.itemId,
              quantity,
              ...(unitPrice && { unitPrice }),
              ...(expiryDate && { expiryDate }),
            },
          ],
        });
        const { data: sent } = await submitReceipt(request, farmId, draft.receipt.id);
        onSent(sent.receipt.receiptCode ?? "");
      }}
    >
      <label className="block space-y-2 text-sm font-medium">
        Số lượng nhập ({row.unitSymbol})
        <Input name="quantity" inputMode="decimal" required autoFocus />
      </label>
      <label className="block space-y-2 text-sm font-medium">
        Đơn giá nhập (không bắt buộc)
        <Input name="unitPrice" inputMode="decimal" />
      </label>
      {row.trackingMode === "LOT" && (
        <label className="block space-y-2 text-sm font-medium">
          Hạn dùng (không bắt buộc)
          <Input name="expiryDate" type="date" />
        </label>
      )}
      <label className="block space-y-2 text-sm font-medium">
        Ghi chú
        <Input name="note" />
      </label>
    </FormDialog>
  );
}

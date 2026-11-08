"use client";

import { useAuthenticatedRequest } from "@/features/auth";
import { FormDialog } from "@/shared/components/ui/form-dialog";
import { Textarea } from "@/shared/components/ui/textarea";
import { returnDelivery } from "../deliveries.api";
import { deliveryErrorMessage } from "../deliveries.logic";

/**
 * A SHIPPING order that was not delivered: back to the queue for another try
 * (stock untouched), or its goods back to the sales warehouse, where stock
 * rises only once the warehouse confirms the return receipt.
 */
export function ReturnDeliveryDialog({
  farmId,
  order,
  onReturned,
  onClose,
}: {
  farmId: string;
  order: { id: string; code: string };
  onReturned: () => void;
  onClose: () => void;
}) {
  const request = useAuthenticatedRequest();
  return (
    <FormDialog
      title={`Trả đơn ${order.code}`}
      description="Lý do được lưu vào lịch sử giao hàng."
      submitLabel="Trả đơn"
      errorMessage={deliveryErrorMessage}
      onClose={onClose}
      onSubmit={async (data) => {
        const reason = String(data.get("reason") ?? "").trim();
        const to =
          data.get("to") === "return-to-warehouse"
            ? "return-to-warehouse"
            : "return-delivery";
        await returnDelivery(request, farmId, order.id, reason, to);
        onReturned();
      }}
    >
      <fieldset className="space-y-2 text-sm">
        <legend className="font-medium">Xử lý</legend>
        <label className="flex items-start gap-2">
          <input
            type="radio"
            name="to"
            value="return-delivery"
            defaultChecked
            className="mt-0.5 size-4 accent-primary"
          />
          <span>
            Giao lại sau
            <span className="block text-xs text-muted-foreground">
              Đơn về danh sách chờ giao, hàng vẫn gắn với đơn, tồn kho không đổi.
            </span>
          </span>
        </label>
        <label className="flex items-start gap-2">
          <input
            type="radio"
            name="to"
            value="return-to-warehouse"
            className="mt-0.5 size-4 accent-primary"
          />
          <span>
            Không giao nữa, trả hàng về kho
            <span className="block text-xs text-muted-foreground">
              Tạo phiếu nhập nháp ở kho bán; tồn chỉ tăng khi kho kiểm nhận và
              xác nhận phiếu.
            </span>
          </span>
        </label>
      </fieldset>
      <label className="block space-y-1 text-sm">
        <span className="font-medium">Lý do</span>
        <Textarea
          name="reason"
          required
          minLength={1}
          maxLength={1000}
          placeholder="Ví dụ: khách không nghe máy, sai địa chỉ, nhận nhầm đơn"
        />
      </label>
    </FormDialog>
  );
}

"use client";

import { useAuthenticatedRequest } from "@/features/auth";
import { FormDialog } from "@/shared/components/ui/form-dialog";
import { Textarea } from "@/shared/components/ui/textarea";
import { returnDelivery } from "../deliveries.api";
import { deliveryErrorMessage } from "../deliveries.logic";

/** Sends a SHIPPING order back to the queue with the reason it was not delivered. */
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
      description="Đơn quay về danh sách chờ giao để người khác nhận. Lý do được lưu vào lịch sử giao hàng."
      submitLabel="Trả đơn"
      errorMessage={deliveryErrorMessage}
      onClose={onClose}
      onSubmit={async (data) => {
        const reason = String(data.get("reason") ?? "").trim();
        await returnDelivery(request, farmId, order.id, reason);
        onReturned();
      }}
    >
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

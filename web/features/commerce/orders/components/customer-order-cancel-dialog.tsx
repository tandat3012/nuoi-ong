"use client";

import { useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Select } from "@/shared/components/ui/select";
import { Textarea } from "@/shared/components/ui/textarea";
import type { CustomerOrder } from "../types/order";

const CANCEL_REASONS = [
  "Muốn thay đổi địa chỉ nhận hàng",
  "Muốn thay đổi sản phẩm trong đơn (kích cỡ, số lượng, loại)",
  "Tìm thấy giá tốt hơn hoặc sản phẩm phù hợp hơn",
  "Đặt trùng đơn hàng",
  "Đổi ý, không muốn mua nữa",
  "Thời gian giao hàng không phù hợp",
  "Lý do khác",
];

interface CustomerOrderCancelDialogProps {
  isOpen: boolean;
  order: CustomerOrder | null;
  isCancelling: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
}

export function CustomerOrderCancelDialog({
  isOpen,
  order,
  isCancelling,
  onClose,
  onConfirm,
}: CustomerOrderCancelDialogProps) {
  const [selectedReason, setSelectedReason] = useState(CANCEL_REASONS[0]);
  const [customReason, setCustomReason] = useState("");

  if (!order) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalReason =
      selectedReason === "Lý do khác"
        ? customReason.trim() || "Khách hàng hủy đơn"
        : selectedReason + (customReason.trim() ? `: ${customReason.trim()}` : "");
    await onConfirm(finalReason);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isCancelling && onClose()}>
      <DialogContent className="max-w-md p-6 sm:rounded-2xl">
        <DialogHeader className="space-y-2">
          <div className="flex items-center gap-2.5 text-destructive">
            <div className="grid size-9 place-items-center rounded-xl bg-destructive/10 text-destructive">
              <AlertTriangle className="size-5" />
            </div>
            <DialogTitle className="text-lg font-bold text-foreground">
              Hủy đơn hàng #{order.code}
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground text-left">
            Vui lòng chọn lý do hủy đơn để giúp Mộc Ong cải thiện chất lượng phục vụ tốt hơn. Thao tác này không thể hoàn tác.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <label
              htmlFor="cancel-reason-select"
              className="text-xs font-medium text-foreground block"
            >
              Lý do hủy đơn hàng <span className="text-destructive">*</span>
            </label>
            <Select
              id="cancel-reason-select"
              value={selectedReason}
              onChange={(e) => setSelectedReason(e.target.value)}
              disabled={isCancelling}
            >
              {CANCEL_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="cancel-reason-detail"
              className="text-xs font-medium text-muted-foreground block"
            >
              Chi tiết bổ sung (tùy chọn)
            </label>
            <Textarea
              id="cancel-reason-detail"
              placeholder="Nhập thêm thông tin nếu có..."
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
              disabled={isCancelling}
              className="min-h-20 text-xs resize-none"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isCancelling}
              className="cursor-pointer"
            >
              Giữ lại đơn hàng
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={isCancelling}
              className="gap-2 cursor-pointer"
            >
              {isCancelling ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  <span>Đang xử lý...</span>
                </>
              ) : (
                <span>Xác nhận hủy đơn</span>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

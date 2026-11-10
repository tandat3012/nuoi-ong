"use client";

import {
  Phone,
  Clock,
  MapPin,
  MessageCircle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import type { CustomerOrder } from "../types/order";

interface CustomerOrderContactDialogProps {
  isOpen: boolean;
  order: CustomerOrder | null;
  onClose: () => void;
}

export function CustomerOrderContactDialog({
  isOpen,
  order,
  onClose,
}: CustomerOrderContactDialogProps) {
  if (!order) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md p-6 sm:rounded-2xl">
        <DialogHeader className="space-y-1.5">
          <div className="flex items-center gap-2.5 text-primary">
            <div className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary">
              <MessageCircle className="size-5" />
            </div>
            <DialogTitle className="text-lg font-bold text-foreground">
              Trung tâm hỗ trợ Mộc Ong
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground text-left">
            Bạn cần trợ giúp về đơn hàng <strong>#{order.code}</strong>? Đội ngũ chăm sóc khách hàng luôn sẵn sàng đồng hành cùng bạn.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 pt-3 text-sm">
          <div className="flex items-start gap-3 rounded-xl border bg-muted/20 p-3.5">
            <Phone className="size-4.5 text-primary shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <div className="text-xs text-muted-foreground">Hotline & Zalo hỗ trợ</div>
              <a
                href="tel:0988000111"
                className="font-bold text-base text-foreground hover:text-primary transition-colors block"
              >
                0988 000 111
              </a>
              <p className="text-[11px] text-muted-foreground">
                Tư vấn kỹ thuật nuôi ong, tiến độ giao hàng & đổi trả
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-xl border bg-muted/20 p-3.5">
            <Clock className="size-4.5 text-primary shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <div className="text-xs text-muted-foreground">Thời gian làm việc</div>
              <p className="font-medium text-foreground text-xs">
                Thứ 2 - Thứ 7: 07:30 - 18:00 (Chủ nhật: 08:00 - 16:30)
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-xl border bg-muted/20 p-3.5">
            <MapPin className="size-4.5 text-primary shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <div className="text-xs text-muted-foreground">Văn phòng & Nông trại</div>
              <p className="font-medium text-foreground text-xs leading-relaxed">
                Trang trại ong Mộc Ong, Xã Đắk R&apos;Lấp, Tỉnh Đắk Nông
              </p>
            </div>
          </div>
        </div>

        <div className="pt-3">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="w-full cursor-pointer"
          >
            Đóng
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useState } from "react";
import { Printer, QrCode } from "lucide-react";
import { useAuthContext } from "@/features/auth";
import { useAuthenticatedRequest } from "@/features/auth/hooks/use-authenticated-request";
import { Button } from "@/shared/components/ui/button";
import { ErrorAlert } from "@/shared/components/ui/error-alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { getItemQr, qrErrorMessage, type ItemQr } from "./qr.api";

export function ItemQrButton({ itemId }: { itemId: string }) {
  const { selectedFarmId: farmId } = useAuthContext();
  const request = useAuthenticatedRequest();
  const [open, setOpen] = useState(false);
  const [qr, setQr] = useState<ItemQr | null>(null);
  const [error, setError] = useState("");

  function load() {
    setError("");
    setQr(null);
    if (!farmId) return setError("Chọn trang trại trước khi tạo mã QR.");
    getItemQr(request, farmId, itemId)
      .then(({ data }) => setQr(data))
      .catch((failure: unknown) =>
        setError(qrErrorMessage(failure, "Không tìm thấy mặt hàng trong trang trại đang chọn.")),
      );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={() => {
          setOpen(true);
          load();
        }}
      >
        <QrCode className="size-3.5" aria-hidden="true" />
        <span>Mã QR</span>
      </Button>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Nhãn QR mặt hàng</DialogTitle>
          <DialogDescription>
            Quét nhãn để mở tồn kho của mặt hàng này. Cần đăng nhập và chọn đúng trang trại.
          </DialogDescription>
        </DialogHeader>
        {error ? (
          <ErrorAlert message={error} onRetry={load} />
        ) : !qr ? (
          <p role="status" className="text-sm text-muted-foreground">Đang tạo mã QR…</p>
        ) : (
          <>
            <div className="qr-print-label flex flex-col items-center gap-2 text-center">
              {/* eslint-disable-next-line @next/next/no-img-element -- server-generated data URL */}
              <img src={qr.imageDataUrl} alt={`QR mặt hàng ${qr.itemCode}`} className="size-56" />
              <p className="font-semibold">{qr.itemName}</p>
              <p className="font-mono text-sm">{qr.itemCode}</p>
            </div>
            <Button type="button" className="w-full gap-1.5" onClick={() => window.print()}>
              <Printer className="size-4" aria-hidden="true" />
              In nhãn
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useAuthenticatedRequest } from "@/features/auth";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { ErrorAlert } from "@/shared/components/ui/error-alert";
import { Textarea } from "@/shared/components/ui/textarea";
import { returnAsset } from "../api/assets.api";
import { assetError } from "../asset.logic";
import type { Asset, AssetChoice } from "../types/asset";
import { AssetLookup } from "./asset-lookup";

export function AssetReturnDialog({
  farmId,
  asset,
  error,
  onError,
  onClose,
  onCloseFocus,
  onUnavailable,
  onReturned,
  onReload,
}: {
  farmId: string;
  asset: Asset;
  error: ReturnType<typeof assetError> | null;
  onError: (error: ReturnType<typeof assetError> | null) => void;
  onClose: () => void;
  onCloseFocus: () => void;
  onUnavailable: (message: string) => void;
  onReturned: () => void;
  onReload: () => void;
}) {
  const request = useAuthenticatedRequest();
  const [warehouse, setWarehouse] = useState<AssetChoice | null>(null);
  const [location, setLocation] = useState<AssetChoice | null>(null);
  const [condition, setCondition] = useState<"GOOD" | "DAMAGED">("GOOD");
  const [note, setNote] = useState("");
  // A damaged return must say what is wrong with it.
  const missingNote = condition === "DAMAGED" && !note.trim();
  const [pending, setPending] = useState(false);
  const alive = useRef(false);
  const submitting = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      submitting.current ||
      error?.reloadRequired ||
      !warehouse ||
      !location ||
      missingNote ||
      note.length > 4000
    )
      return;
    submitting.current = true;
    setPending(true);
    onError(null);
    try {
      await returnAsset(request, farmId, asset.id, {
        warehouseId: warehouse.id,
        locationId: location.id,
        condition,
        note: note.trim() || null,
      });
      if (alive.current) onReturned();
    } catch (failure) {
      if (!alive.current) return;
      const mapped = assetError(failure, true);
      if (
        failure &&
        typeof failure === "object" &&
        "status" in failure &&
        (failure.status === 403 || failure.status === 404)
      ) {
        onUnavailable(mapped.message);
      } else {
        onError(mapped);
      }
    } finally {
      submitting.current = false;
      if (alive.current) setPending(false);
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !submitting.current) onClose();
      }}
    >
      <DialogContent
        onEscapeKeyDown={(event) => {
          const picker =
            event.target instanceof Element
              ? event.target
                  .closest('[role="dialog"][data-state="open"]')
                  ?.querySelector<HTMLElement>("[popover]:popover-open")
              : null;
          if (picker) {
            event.preventDefault();
            picker.hidePopover();
          }
        }}
        hideCloseButton={pending}
        className="max-h-[90dvh] w-[calc(100%_-_2rem)] overflow-y-auto rounded-xl"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          onCloseFocus();
        }}
      >
        <DialogHeader>
          <DialogTitle>Trả tài sản về kho</DialogTitle>
          <DialogDescription className="break-words">
            Tài sản {asset.assetCode}
            {asset.serialNumber ? ` · Serial: ${asset.serialNumber}` : ""}. Chọn
            kho và vị trí nhận để xác nhận trả.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="min-w-0 space-y-4">
          <AssetLookup
            farmId={farmId}
            kind="warehouse"
            activeOnly
            selected={warehouse}
            disabled={pending || error?.reloadRequired}
            onSelect={(value) => {
              setWarehouse(value);
              setLocation(null);
            }}
          />
          <AssetLookup
            key={warehouse?.id ?? "none"}
            farmId={farmId}
            kind="location"
            activeOnly
            warehouseId={warehouse?.id}
            selected={location}
            disabled={!warehouse || pending || error?.reloadRequired}
            onSelect={setLocation}
          />
          {!location && (
            <p className="text-sm text-muted-foreground">
              Bắt buộc chọn một vị trí đang hoạt động trong kho nhận. Nếu không
              có vị trí phù hợp, chọn kho khác hoặc bổ sung vị trí trước.
            </p>
          )}
          <fieldset
            className="space-y-2 text-sm"
            disabled={pending || error?.reloadRequired}
          >
            <legend className="font-medium">Kết quả kiểm nhận</legend>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="condition"
                checked={condition === "GOOD"}
                onChange={() => setCondition("GOOD")}
              />
              Đạt, dùng lại được
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="condition"
                checked={condition === "DAMAGED"}
                onChange={() => setCondition("DAMAGED")}
              />
              Hỏng: vẫn nhập kho nhưng không cấp phát/bán, chờ bảo trì hoặc thanh lý
            </label>
          </fieldset>
          <label className="block space-y-2 text-sm font-medium">
            {condition === "DAMAGED"
              ? "Tình trạng hỏng (bắt buộc)"
              : "Ghi chú (không bắt buộc)"}
            <Textarea
              value={note}
              maxLength={4000}
              disabled={pending || error?.reloadRequired}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
            />
          </label>
          {warehouse && location && (
            <p className="break-words rounded-lg bg-muted p-3 text-sm">
              Xác nhận trả <strong>{asset.assetCode}</strong> về{" "}
              <strong>{warehouse.label}</strong>, vị trí{" "}
              <strong>{location.label}</strong>.
            </p>
          )}
          {error && (
            <ErrorAlert
              message={error.message}
              onRetry={error.reloadRequired ? onReload : undefined}
              retryLabel="Tải lại tài sản"
            />
          )}
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={onClose}
            >
              Đóng
            </Button>
            <Button
              type="submit"
              isLoading={pending}
              disabled={
                !warehouse ||
                !location ||
                missingNote ||
                note.length > 4000 ||
                error?.reloadRequired
              }
            >
              Xác nhận trả tài sản
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

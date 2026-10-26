"use client";

import { useEffect, useRef, useState } from "react";
import { useAuthenticatedRequest } from "@/features/auth";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { ErrorAlert } from "@/shared/components/ui/error-alert";
import { getAssetLabel } from "../api/assets.api";
import { assetError } from "../asset.logic";
import type { Asset } from "../types/asset";

export function AssetLabelDialog({
  farmId,
  asset,
  onClose,
  onCloseFocus,
}: {
  farmId: string;
  asset: Asset;
  onClose: () => void;
  onCloseFocus: () => void;
}) {
  const request = useAuthenticatedRequest();
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{
    attempt: number;
    svg?: string;
    error?: string;
  } | null>(null);
  const printFrame = useRef<HTMLIFrameElement | null>(null);
  useEffect(() => {
    let alive = true;
    void getAssetLabel(request, farmId, asset.id)
      .then(({ data }) => {
        if (alive) setResult({ attempt, svg: data.svg });
      })
      .catch((error) => {
        if (alive) setResult({ attempt, error: assetError(error).message });
      });
    return () => {
      alive = false;
      printFrame.current?.remove();
    };
  }, [request, farmId, asset.id, attempt]);
  const current = result?.attempt === attempt ? result : null;
  const source = current?.svg
    ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(current.svg)}`
    : null;
  function print() {
    if (!source) return;
    printFrame.current?.remove();
    const frame = document.createElement("iframe");
    frame.title = "In nhãn tài sản";
    frame.style.cssText = "position:fixed;width:0;height:0;border:0";
    frame.srcdoc =
      '<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>Nhãn tài sản</title><style>body{text-align:center;font:16px sans-serif;margin:12mm}img{width:40mm;height:40mm}p{overflow-wrap:anywhere}</style></head><body></body></html>';
    frame.onload = () => {
      const doc = frame.contentDocument;
      if (!doc || !frame.contentWindow) return;
      const image = doc.createElement("img");
      image.alt = "Mã QR tài sản";
      const caption = doc.createElement("p");
      caption.textContent = asset.assetCode;
      image.onload = () => {
        frame.contentWindow?.focus();
        frame.contentWindow?.print();
      };
      image.src = source!;
      doc.body.append(image, caption);
      frame.contentWindow.addEventListener("afterprint", () => frame.remove(), {
        once: true,
      });
    };
    printFrame.current = frame;
    document.body.append(frame);
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        className="w-[calc(100%_-_2rem)] rounded-xl"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          onCloseFocus();
        }}
      >
        <DialogHeader>
          <DialogTitle>Nhãn QR tài sản</DialogTitle>
          <DialogDescription>
            Quét bằng trang Tra cứu QR để mở hồ sơ trong trang trại đang chọn.
          </DialogDescription>
        </DialogHeader>
        {!current ? (
          <p role="status">Đang tạo nhãn…</p>
        ) : current.error ? (
          <ErrorAlert
            message={current.error}
            onRetry={() => setAttempt((value) => value + 1)}
          />
        ) : (
          source && (
            <>
              <div className="rounded-lg bg-white p-5 text-center text-black">
                {/* SVG comes from the authenticated QR encoder and is rendered as an isolated image. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={source}
                  width={224}
                  height={224}
                  alt={`Mã QR ${asset.assetCode}`}
                  className="mx-auto"
                />
                <p className="mt-2 break-words font-semibold">
                  {asset.assetCode}
                </p>
              </div>
              <div className="flex flex-wrap justify-end gap-3">
                <a
                  className="inline-flex h-10 items-center rounded-md border px-4 text-sm font-medium focus-visible:outline-2 focus-visible:outline-primary"
                  href={source}
                  download={`${asset.assetCode}.svg`}
                >
                  Tải nhãn SVG
                </a>
                <Button onClick={print}>In nhãn</Button>
              </div>
            </>
          )
        )}
      </DialogContent>
    </Dialog>
  );
}

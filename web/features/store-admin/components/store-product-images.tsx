"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { imageLoader } from "@/shared/lib/cloudinary-image";
import { ArrowDown, ArrowUp, Trash2, Upload } from "lucide-react";
import { useAuthenticatedRequest } from "@/features/auth";
import { Button } from "@/shared/components/ui/button";
import { ConfirmDialog } from "@/shared/components/ui/confirm-dialog";
import { ErrorAlert } from "@/shared/components/ui/error-alert";
import { Input } from "@/shared/components/ui/input";
import {
  deleteStoreImage,
  reorderStoreImages,
  updateStoreImage,
  uploadStoreImage,
} from "../api/store-admin.api";
import {
  moveItem,
  STORE_IMAGE_TYPES,
  storeAdminError,
  validateStoreImage,
} from "../store-admin.logic";
import type { StoreImage } from "../types/store-admin";

export function StoreProductImages({
  farmId,
  productId,
  images,
  onChange,
}: {
  farmId: string;
  productId: string;
  images: StoreImage[];
  onChange: (images: StoreImage[]) => void;
}) {
  const request = useAuthenticatedRequest();
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<StoreImage | null>(null);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (failure) {
      setError(storeAdminError(failure));
    } finally {
      setBusy(false);
    }
  };

  const upload = (files: FileList | null) => {
    const list = Array.from(files ?? []);
    if (fileInput.current) fileInput.current.value = "";
    for (const file of list) {
      const invalid = validateStoreImage(file);
      if (invalid) return setError(`${file.name}: ${invalid}`);
    }
    return run(async () => {
      let next = images;
      // Sequential so new images keep the order they were picked in.
      for (const file of list) {
        const { data } = await uploadStoreImage(request, farmId, productId, file, "");
        next = [...next, data];
        onChange(next);
      }
    });
  };

  const move = (from: number, to: number) =>
    run(async () => {
      const order = moveItem(images, from, to).map((image) => image.id);
      const { data } = await reorderStoreImages(request, farmId, productId, order);
      onChange(data);
    });

  return (
    <section className="space-y-4" aria-labelledby="store-images-title">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 id="store-images-title" className="text-base font-semibold">
            Ảnh sản phẩm
          </h2>
          <p className="text-sm text-muted-foreground">
            Ảnh đầu tiên là ảnh đại diện. JPEG, PNG hoặc WebP, tối đa 10MB; ảnh được tự nén khi tải lên.
          </p>
        </div>
        <Button
          variant="outline"
          isLoading={busy}
          onClick={() => fileInput.current?.click()}
        >
          <Upload className="size-4" aria-hidden="true" />
          Tải ảnh lên
        </Button>
        <input
          ref={fileInput}
          type="file"
          accept={STORE_IMAGE_TYPES.join(",")}
          multiple
          hidden
          onChange={(event) => void upload(event.target.files)}
        />
      </div>

      {error && <ErrorAlert message={error} />}

      {images.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          Chưa có ảnh. Cửa hàng sẽ hiển thị ảnh mặc định.
        </p>
      ) : (
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {images.map((image, index) => (
            <li key={image.id} className="space-y-2 rounded-lg border p-3">
              <Image
                src={image.url}
                loader={imageLoader(image.url)}
                alt={image.alt}
                width={400}
                height={300}
                className="aspect-[4/3] w-full rounded-md object-cover"
              />
              <Input
                aria-label={`Mô tả ảnh ${index + 1}`}
                placeholder="Mô tả ảnh (alt)"
                maxLength={500}
                defaultValue={image.alt}
                disabled={busy}
                onBlur={(event) => {
                  const alt = event.target.value.trim();
                  if (alt === image.alt) return;
                  void run(async () => {
                    const { data } = await updateStoreImage(
                      request,
                      farmId,
                      productId,
                      image.id,
                      alt,
                    );
                    onChange(images.map((i) => (i.id === data.id ? data : i)));
                  });
                }}
              />
              <div className="flex items-center gap-1">
                <span className="mr-auto text-xs text-muted-foreground">
                  {index === 0 ? "Ảnh đại diện" : `Vị trí ${index + 1}`}
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Đưa lên trước"
                  disabled={busy || index === 0}
                  onClick={() => void move(index, index - 1)}
                >
                  <ArrowUp className="size-4" aria-hidden="true" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Đưa xuống sau"
                  disabled={busy || index === images.length - 1}
                  onClick={() => void move(index, index + 1)}
                >
                  <ArrowDown className="size-4" aria-hidden="true" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Xóa ảnh"
                  disabled={busy}
                  onClick={() => setDeleting(image)}
                >
                  <Trash2 className="size-4 text-destructive" aria-hidden="true" />
                </Button>
              </div>
            </li>
          ))}
        </ol>
      )}

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Xóa ảnh?"
        description="Ảnh bị xóa khỏi sản phẩm và khỏi Cloudinary, không thể khôi phục."
        confirmLabel="Xóa ảnh"
        isLoading={busy}
        onConfirm={() =>
          run(async () => {
            if (!deleting) return;
            await deleteStoreImage(request, farmId, productId, deleting.id);
            onChange(images.filter((image) => image.id !== deleting.id));
            setDeleting(null);
          })
        }
      />
    </section>
  );
}

'use client';

import * as React from 'react';
import Image from 'next/image';
import { imageLoader } from '@/shared/lib/cloudinary-image';
import { Package, ZoomIn } from 'lucide-react';
import type { StorefrontProductImage } from '../types/product';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from '@/shared/components/ui/dialog';
import { cn } from '@/shared/lib/utils';

export interface ProductGalleryProps {
  productName: string;
  image?: StorefrontProductImage;
  images?: StorefrontProductImage[];
  className?: string;
}

export function ProductGallery({
  productName,
  image,
  images,
  className,
}: ProductGalleryProps) {
  // Aggregate verified images list without duplicates
  const galleryImages: StorefrontProductImage[] = React.useMemo(() => {
    if (Array.isArray(images) && images.length > 0) {
      return images;
    }
    if (image?.src) {
      return [image];
    }
    return [];
  }, [image, images]);

  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const [isZoomOpen, setIsZoomOpen] = React.useState(false);

  // Keep index in bound if images list changes
  const activeIndex = Math.min(
    selectedIndex,
    Math.max(0, galleryImages.length - 1),
  );
  const activeImage = galleryImages[activeIndex];

  const hasMultipleImages = galleryImages.length > 1;
  const hasImages = galleryImages.length > 0;

  return (
    <div className={cn('flex flex-col gap-3 sm:gap-4', className)}>
      {/* Khung ảnh chính ổn định tỉ lệ 4:3 / aspect-square */}
      <div className="group relative aspect-square sm:aspect-[4/3] w-full overflow-hidden rounded-2xl border border-[#ede6dc] dark:border-border/80 bg-[#fbf9f5] dark:bg-stone-900/50 shadow-2xs">
        {hasImages && activeImage ? (
          <>
            <Image
              src={activeImage.src}
              loader={imageLoader(activeImage.src)}
              alt={activeImage.alt || productName}
              fill
              priority
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 45vw"
              className="object-contain p-3 sm:p-4 transition-transform duration-300 group-hover:scale-102"
            />

            {/* Nút phóng to đặt trong vùng ảnh chính */}
            <Dialog open={isZoomOpen} onOpenChange={setIsZoomOpen}>
              <DialogTrigger asChild>
                <button
                  type="button"
                  aria-label={`Phóng to ảnh ${productName}`}
                  className="absolute bottom-3 right-3 sm:bottom-4 sm:right-4 z-10 flex size-9 sm:size-10 items-center justify-center rounded-xl bg-white/90 dark:bg-stone-900/90 text-foreground shadow-xs border border-border/60 backdrop-blur-xs transition-all hover:bg-white dark:hover:bg-stone-800 hover:scale-105 focus-visible:outline-2 focus-visible:outline-primary cursor-pointer"
                >
                  <ZoomIn className="size-4 sm:size-5 text-[#453c35] dark:text-foreground" aria-hidden="true" />
                </button>
              </DialogTrigger>

              <DialogContent
                theme="storefront"
                className="max-w-3xl border-border bg-background p-4 sm:p-6"
              >
                <DialogTitle className="text-base sm:text-lg font-semibold text-foreground">
                  {productName}
                </DialogTitle>
                <div className="relative mt-2 aspect-square sm:aspect-[4/3] w-full overflow-hidden rounded-xl bg-[#fbf9f5] dark:bg-stone-900/50">
                  <Image
                    src={activeImage.src}
                    loader={imageLoader(activeImage.src)}
                    alt={activeImage.alt || productName}
                    fill
                    sizes="(max-width: 768px) 100vw, 800px"
                    className="object-contain p-2 sm:p-4"
                  />
                </div>
              </DialogContent>
            </Dialog>
          </>
        ) : (
          /* Established image fallback khi chưa có ảnh */
          <div
            role="img"
            aria-label={`Hình ảnh minh họa cho ${productName}`}
            className="flex h-full w-full flex-col items-center justify-center text-muted-foreground/35"
          >
            <Package className="size-16 sm:size-20 stroke-1" aria-hidden="true" />
            <span className="mt-2 text-xs text-muted-foreground/60 select-none">
              Hình ảnh đang cập nhật
            </span>
          </div>
        )}
      </div>

      {/* Dãy thumbnail: chỉ hiển thị khi có từ 2 ảnh trở lên */}
      {hasMultipleImages && (
        <div
          role="region"
          aria-label="Danh sách hình ảnh thu nhỏ"
          className="flex gap-2.5 overflow-x-auto pb-1 pt-0.5 focus-visible:outline-2 focus-visible:outline-primary"
        >
          {galleryImages.map((img, index) => {
            const isSelected = index === activeIndex;
            return (
              <button
                key={`${img.src}-${index}`}
                type="button"
                onClick={() => setSelectedIndex(index)}
                aria-label={`Xem ảnh ${index + 1} của ${productName}`}
                aria-pressed={isSelected}
                className={cn(
                  'relative size-16 sm:size-20 shrink-0 overflow-hidden rounded-xl border bg-[#fbf9f5] dark:bg-stone-900/50 transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-primary',
                  isSelected
                    ? 'border-primary ring-2 ring-primary/30 shadow-xs'
                    : 'border-[#ede6dc] dark:border-border/80 opacity-70 hover:opacity-100 hover:border-primary/50',
                )}
              >
                <Image
                  src={img.src}
                  loader={imageLoader(img.src)}
                  alt={img.alt || `${productName} thu nhỏ ${index + 1}`}
                  fill
                  sizes="80px"
                  className="object-contain p-1"
                />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

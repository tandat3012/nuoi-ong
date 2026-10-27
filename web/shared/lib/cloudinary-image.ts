import type { ImageLoader } from 'next/image';

const UPLOAD_PATH = '/image/upload/';

/** Cloudinary resizes and picks AVIF/WebP at its CDN, so Next's optimizer is skipped. */
export const cloudinaryLoader: ImageLoader = ({ src, width, quality }) =>
  src.replace(
    UPLOAD_PATH,
    `${UPLOAD_PATH}f_auto,c_limit,w_${width},q_${quality ?? 'auto'}/`,
  );

/** Loader for `next/image`; other sources keep Next's default optimizer. */
export function imageLoader(src: string) {
  return src.startsWith('https://res.cloudinary.com/') &&
    src.includes(UPLOAD_PATH)
    ? cloudinaryLoader
    : undefined;
}

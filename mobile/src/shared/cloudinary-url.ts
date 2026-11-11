const CLOUDINARY_IMAGE_UPLOAD_SEGMENT = '/image/upload/';
const CLOUDINARY_HOST_RE = /^https?:\/\/res\.cloudinary\.com\//i;
const CLOUDINARY_TRANSFORM_RE =
  /^(?:w|h|c|q|f|dpr|g|ar|b|e|fl|l|o|r|t|u|x|y|z)_/i;

/**
 * Inserts compact square thumbnail transforms into Cloudinary image URLs so
 * list cards and modals decode lightweight images instead of full-resolution
 * sources. Non-Cloudinary URLs and URLs that already declare transforms are
 * returned unchanged.
 */
export function toThumbnailUrl(
  url?: string | null,
  size = 128,
): string | undefined {
  if (!url) return undefined;
  const trimmed = url.trim();
  if (!trimmed) return undefined;
  if (!CLOUDINARY_HOST_RE.test(trimmed)) return trimmed;

  const uploadIndex = trimmed.indexOf(CLOUDINARY_IMAGE_UPLOAD_SEGMENT);
  if (uploadIndex === -1) return trimmed;

  const prefixEnd = uploadIndex + CLOUDINARY_IMAGE_UPLOAD_SEGMENT.length;
  const remainder = trimmed.slice(prefixEnd);
  if (!remainder) return trimmed;

  const firstSegment = remainder.split('/', 1)[0] ?? '';
  const hasExistingTransform =
    firstSegment.includes(',') || CLOUDINARY_TRANSFORM_RE.test(firstSegment);
  if (hasExistingTransform) return trimmed;

  const safeSize = Number.isFinite(size) ? Math.max(1, Math.round(size)) : 128;
  const transform = `w_${safeSize},h_${safeSize},c_fill,q_auto,f_auto/`;
  return `${trimmed.slice(0, prefixEnd)}${transform}${remainder}`;
}

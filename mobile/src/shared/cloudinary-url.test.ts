import { describe, expect, it } from '@jest/globals';
import { toThumbnailUrl } from './cloudinary-url';

describe('toThumbnailUrl', () => {
  it('returns undefined for empty or nullish inputs', () => {
    expect(toThumbnailUrl(null)).toBeUndefined();
    expect(toThumbnailUrl(undefined)).toBeUndefined();
    expect(toThumbnailUrl('   ')).toBeUndefined();
  });

  it('inserts thumbnail transform before Cloudinary version segment', () => {
    expect(
      toThumbnailUrl(
        'https://res.cloudinary.com/ly6xwuwk/image/upload/v1793717918/nuoi-ong/items/abc.webp',
      ),
    ).toBe(
      'https://res.cloudinary.com/ly6xwuwk/image/upload/w_128,h_128,c_fill,q_auto,f_auto/v1793717918/nuoi-ong/items/abc.webp',
    );
  });

  it('supports custom thumbnail sizes and paths without version segment', () => {
    expect(
      toThumbnailUrl(
        'https://res.cloudinary.com/demo/image/upload/nuoi-ong/items/abc.webp',
        256,
      ),
    ).toBe(
      'https://res.cloudinary.com/demo/image/upload/w_256,h_256,c_fill,q_auto,f_auto/nuoi-ong/items/abc.webp',
    );
  });

  it('preserves Cloudinary URLs that already contain transformations', () => {
    const transformed =
      'https://res.cloudinary.com/demo/image/upload/w_64,h_64,c_fill/v1793717918/nuoi-ong/items/abc.webp';
    expect(toThumbnailUrl(transformed, 256)).toBe(transformed);

    const singleTransform =
      'https://res.cloudinary.com/demo/image/upload/f_auto/v1793717918/nuoi-ong/items/abc.webp';
    expect(toThumbnailUrl(singleTransform, 128)).toBe(singleTransform);
  });

  it('leaves non-Cloudinary URLs untouched', () => {
    const googleUrl = 'https://lh3.googleusercontent.com/a/avatar-123=s96-c';
    expect(toThumbnailUrl(googleUrl, 128)).toBe(googleUrl);
  });
});

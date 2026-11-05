import { isStoreImage } from './store-admin.service';

describe('isStoreImage', () => {
  const bytes = (text: string) => Buffer.from(text, 'latin1');

  it.each([
    ['JPEG', bytes('\xff\xd8\xff\xe0\x00\x10JFIF')],
    ['PNG', bytes('\x89PNG\r\n\x1a\n\x00\x00\x00\x0dIHDR')],
    ['WebP', bytes('RIFF\x24\x00\x00\x00WEBPVP8 ')],
  ])('accepts %s', (_name, file) => expect(isStoreImage(file)).toBe(true));

  it.each([
    ['GIF', bytes('GIF89a\x01\x00\x01\x00')],
    ['WAV in a RIFF container', bytes('RIFF\x24\x00\x00\x00WAVEfmt ')],
    ['text', bytes('<?php echo 1; ?>')],
    ['empty file', Buffer.alloc(0)],
  ])('rejects %s', (_name, file) => expect(isStoreImage(file)).toBe(false));
});

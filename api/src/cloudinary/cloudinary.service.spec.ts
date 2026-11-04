import { Logger } from '@nestjs/common';
import { PassThrough } from 'node:stream';
import { v2 as cloudinary } from 'cloudinary';
import type { UploadApiResponse, UploadResponseCallback } from 'cloudinary';
import { CloudinaryService } from './cloudinary.service';

describe('Cloudinary uploads', () => {
  const upload = jest.fn();
  const uploadStream = jest.fn();
  const client = {
    uploader: { upload, upload_stream: uploadStream },
  } as unknown as typeof cloudinary;
  const service = new CloudinaryService(client);
  let log: jest.SpyInstance;

  beforeEach(() => {
    jest.resetAllMocks();
    log = jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });
  afterEach(() => jest.restoreAllMocks());

  it('uploads the file buffer with the caller options', async () => {
    const file = Buffer.from('image');
    const result = {
      public_id: 'test',
      secure_url: 'https://example.com/test',
    };
    const stream = new PassThrough();
    uploadStream.mockImplementation(
      (_options: unknown, callback: UploadResponseCallback) => {
        queueMicrotask(() => callback(undefined, result as UploadApiResponse));
        return stream;
      },
    );

    await expect(
      service.uploadFile(file, { resource_type: 'image', folder: 'products' }),
    ).resolves.toBe(result);
    expect(uploadStream).toHaveBeenCalledWith(
      {
        resource_type: 'image',
        folder: 'products',
        disable_promises: true,
      },
      expect.any(Function),
    );
    expect(stream.read()).toEqual(file);
  });

  it('logs callback failures while keeping provider details out of HTTP responses', async () => {
    const error = {
      name: 'Error',
      message: 'Invalid Signature',
      http_code: 401,
    };
    uploadStream.mockImplementation(
      (_options: unknown, callback: UploadResponseCallback) => {
        queueMicrotask(() => callback(error));
        return new PassThrough();
      },
    );

    await expect(
      service.uploadFile(Buffer.from('image')),
    ).rejects.toMatchObject({
      response: { message: 'Cloudinary upload failed', statusCode: 502 },
      cause: { message: 'Invalid Signature' },
    });
    expect(log).toHaveBeenCalledWith(
      'Cloudinary upload failed: Invalid Signature',
    );
  });

  it('logs only the message for plain SDK rejection objects', async () => {
    upload.mockRejectedValue({
      message: 'Request Timeout',
      request: { api_secret: 'private-secret' },
    });

    await expect(service.uploadFile('trusted-image.png')).rejects.toThrow(
      'Cloudinary upload failed',
    );
    expect(log).toHaveBeenCalledWith(
      'Cloudinary upload failed: Request Timeout',
    );
    expect(JSON.stringify(log.mock.calls)).not.toContain('private-secret');
  });
});

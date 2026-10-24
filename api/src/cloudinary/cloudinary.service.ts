import {
  BadGatewayException,
  BadRequestException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import type {
  ImageTransformationOptions,
  ResourceApiOptions,
  ResourceApiResponse,
  UploadApiOptions,
  UploadApiResponse,
  VideoTransformationOptions,
} from 'cloudinary';
import { CLOUDINARY } from './cloudinary.provider';

@Injectable()
export class CloudinaryService {
  constructor(@Inject(CLOUDINARY) private readonly client: typeof cloudinary) {}

  async uploadFile(
    file: Buffer | string,
    options: UploadApiOptions = {},
  ): Promise<UploadApiResponse> {
    if (
      Buffer.isBuffer(file)
        ? file.length === 0
        : typeof file !== 'string' || !file.trim()
    ) {
      throw new BadRequestException('A non-empty file is required');
    }

    const uploadOptions: UploadApiOptions = {
      resource_type: 'auto',
      ...options,
    };

    try {
      if (typeof file === 'string') {
        return await this.client.uploader.upload(file, uploadOptions);
      }

      return await new Promise<UploadApiResponse>((resolve, reject) => {
        const stream = this.client.uploader.upload_stream(
          // The callback handles errors; the SDK's internal promise is unused.
          { ...uploadOptions, disable_promises: true },
          (error, result) => {
            if (error || !result) {
              reject(
                new Error(error?.message ?? 'Cloudinary returned no file', {
                  cause: error,
                }),
              );
              return;
            }
            resolve(result);
          },
        );
        stream.once('error', reject);
        stream.end(file);
      });
    } catch (error) {
      throw new BadGatewayException('Cloudinary upload failed', {
        cause: error,
      });
    }
  }

  async getFile(
    publicId: string,
    options: ResourceApiOptions = {},
  ): Promise<ResourceApiResponse['resources'][number]> {
    this.validatePublicId(publicId);

    try {
      return (await this.client.api.resource(
        publicId,
        options,
      )) as ResourceApiResponse['resources'][number];
    } catch (error) {
      throw new BadGatewayException('Cloudinary file lookup failed', {
        cause: error,
      });
    }
  }

  async deleteFile(
    publicId: string,
    resourceType: 'image' | 'video' | 'raw' = 'image',
  ): Promise<{ result: string }> {
    this.validatePublicId(publicId);

    try {
      return (await this.client.uploader.destroy(publicId, {
        resource_type: resourceType,
        invalidate: true,
      })) as { result: string };
    } catch (error) {
      throw new BadGatewayException('Cloudinary deletion failed', {
        cause: error,
      });
    }
  }

  getUrl(
    publicId: string,
    options: ImageTransformationOptions | VideoTransformationOptions = {},
  ): string {
    this.validatePublicId(publicId);
    return this.client.url(publicId, { ...options, secure: true });
  }

  private validatePublicId(publicId: string): void {
    if (typeof publicId !== 'string' || !publicId.trim()) {
      throw new BadRequestException('A non-empty public ID is required');
    }
  }
}

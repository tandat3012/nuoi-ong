import { v2 as cloudinary } from 'cloudinary';

export const CLOUDINARY = 'CLOUDINARY';

export const CloudinaryProvider = {
  provide: CLOUDINARY,
  useFactory: () => {
    const config = cloudinary.config();
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_NAME || config.cloud_name,
      api_key: process.env.CLOUDINARY_API_KEY || config.api_key,
      api_secret: process.env.CLOUDINARY_API_SECRET || config.api_secret,
      secure: true,
    });
    return cloudinary;
  },
};

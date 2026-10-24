import type { NextConfig } from 'next';

const cloudinaryCloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();

const nextConfig: NextConfig = {
  images: {
    remotePatterns: cloudinaryCloudName
      ? [
        {
          protocol: 'https',
          hostname: 'res.cloudinary.com',
          port: '',
          pathname: `/${cloudinaryCloudName}/image/upload/**`,
          search: '',
        },
      ]
      : [],
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5050',
  },
  ...(process.env.VERCEL
    ? {}
    : {
        output: 'standalone',
        outputFileTracingIncludes: {
          '/*': ['node_modules/@swc/helpers/esm/**'],
        },
      }),
};

export default nextConfig;

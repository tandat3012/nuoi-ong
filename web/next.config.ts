import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? process.env.API_URL ?? 'http://localhost:5050',
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

import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
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

import type { NextConfig } from 'next';
import path from 'path';

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

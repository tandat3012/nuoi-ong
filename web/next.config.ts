import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: process.env.VERCEL ? undefined : 'standalone',
  outputFileTracingIncludes: {
    '/*': ['node_modules/@swc/helpers/esm/**'],
  },
};

export default nextConfig;

import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  // Chỉ dùng standalone khi không build trên Vercel
  ...(process.env.VERCEL ? {} : { output: 'standalone' }),

  // Trỏ về root của monorepo (thư mục chứa pnpm-workspace.yaml / lockfile)
  outputFileTracingRoot: path.join(__dirname, '../'),

  outputFileTracingIncludes: {
    '/*': ['node_modules/@swc/helpers/esm/**'],
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: process.env.DATA_BACKEND === 'postgres' ? 'standalone' : undefined,
  experimental: { serverActions: { bodySizeLimit: '12mb' } },
};

export default nextConfig;

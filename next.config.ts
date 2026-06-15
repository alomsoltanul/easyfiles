import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['youtube-dl-exec'],
  turbopack: {
    root: __dirname,
  },
  async rewrites() {
    return [];
  },
};

export default nextConfig;

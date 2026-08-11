import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['youtube-dl-exec'],
  // The yt-dlp and ffmpeg binaries are spawned at runtime, so nothing imports
  // them — they have to be traced into the serverless bundle explicitly.
  outputFileTracingIncludes: {
    '/api/video/**': [
      './bin/ffmpeg',
      './node_modules/youtube-dl-exec/bin/**',
      './node_modules/ffmpeg-static/ffmpeg',
    ],
  },
  turbopack: {
    root: __dirname,
  },
  async rewrites() {
    return [];
  },
};

export default nextConfig;

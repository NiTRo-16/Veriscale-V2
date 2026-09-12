import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // A stray lockfile in the user's home folder otherwise confuses root detection.
  turbopack: { root: process.cwd() },
};

export default nextConfig;

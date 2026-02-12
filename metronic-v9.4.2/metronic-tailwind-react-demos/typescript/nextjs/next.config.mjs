/** @type {import('next').NextConfig} */
const nextConfig = {
  // basePath is configured via NEXT_PUBLIC_BASE_PATH environment variable at build time
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || '',
  assetPrefix: process.env.NEXT_PUBLIC_BASE_PATH || '',
  images: {},
  output: 'standalone',
};

export default nextConfig;

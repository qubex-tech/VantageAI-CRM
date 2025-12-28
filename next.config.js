/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Serverless-friendly configuration
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
}

module.exports = nextConfig


/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Serverless-friendly configuration
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  // Exclude scripts directory from compilation
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
      }
    }
    return config
  },
  // Exclude scripts from TypeScript compilation
  typescript: {
    ignoreBuildErrors: false,
  },
}

module.exports = nextConfig


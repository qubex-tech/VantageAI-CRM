/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Keep browser automation deps out of the Next server bundle (optional native modules).
  serverExternalPackages: ['playwright-core', '@browserbasehq/sdk'],
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
    serverComponentsExternalPackages: ['playwright-core', '@browserbasehq/sdk'],
    optimizePackageImports: [
      'lucide-react',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-select',
      '@radix-ui/react-tabs',
      'date-fns',
    ],
  },
  // Exclude scripts directory from compilation
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
      }
    }
    if (isServer) {
      const externals = ['playwright-core', '@browserbasehq/sdk']
      if (Array.isArray(config.externals)) {
        config.externals.push(...externals)
      } else if (typeof config.externals === 'function') {
        const original = config.externals
        config.externals = async (ctx, callback) => {
          if (ctx.request && externals.includes(ctx.request)) {
            return callback ? callback(null, `commonjs ${ctx.request}`) : `commonjs ${ctx.request}`
          }
          return original(ctx, callback)
        }
      } else {
        config.externals = [...externals]
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


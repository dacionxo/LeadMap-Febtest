/** @type {import('next').NextConfig} */
const nextConfig = {
  // Fix for Windows filesystem issues with webpack
  outputFileTracingRoot: require('path').join(__dirname),
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'api.mapbox.com',
      },
    ],
  },
  // Webpack configuration (used when --webpack flag is passed or when Turbopack is disabled)
  webpack: (config, { isServer }) => {
    // Make resend an optional external dependency
    if (isServer) {
      config.externals = config.externals || []
      // Allow resend to be optional - don't fail build if not installed
      config.resolve.fallback = {
        ...config.resolve.fallback,
        resend: false,
      }
    }
    // Fix for Windows filesystem symlink issues
    config.resolve.symlinks = false
    // Fix for Windows EISDIR errors - use realpath instead of readlink
    config.resolve.cacheWithContext = false
    return config
  },
  // Turbopack configuration (used by default in Next.js 16)
  // Empty config tells Next.js we're aware of Turbopack and it's okay to use it
  turbopack: {
    // Turbopack handles optional dependencies differently
    // The resend import is already handled with try-catch in the code
  },
}

module.exports = nextConfig

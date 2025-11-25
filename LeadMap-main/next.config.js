/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'api.mapbox.com',
      },
    ],
  },
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
    return config
  },
}

module.exports = nextConfig

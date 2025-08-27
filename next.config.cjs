/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['@mastra/core'],
  },
  typescript: {
    // Enforce builds to fail on TypeScript errors
    ignoreBuildErrors: false,
  },
  eslint: {
    // Allow builds to proceed even with ESLint errors during migration
    ignoreDuringBuilds: true,
  },
}

module.exports = nextConfig
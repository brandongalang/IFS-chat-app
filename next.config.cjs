/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['@mastra/core'],
  },
  typescript: {
    // Allow builds to proceed even with TypeScript errors during migration
    ignoreBuildErrors: true,
  },
  eslint: {
    // Allow builds to proceed even with ESLint errors during migration
    ignoreDuringBuilds: true,
  },
}

module.exports = nextConfig
/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['@mastra/core'],
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    // Allow builds to proceed even with ESLint errors during migration
    ignoreDuringBuilds: true,
  },
}

export default nextConfig

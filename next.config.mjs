/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['@mastra/core'],
  typescript: {
    // Fail the build on TypeScript errors
    ignoreBuildErrors: false,
  },
  eslint: {
    // Fail the build on ESLint errors
    ignoreDuringBuilds: false,
  },
}

export default nextConfig

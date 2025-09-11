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
  async redirects() {
    return [
      {
        source: '/ethereal',
        destination: '/chat',
        permanent: false,
      },
    ]
  },
}

export default nextConfig

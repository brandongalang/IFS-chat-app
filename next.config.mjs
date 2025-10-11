/** @type {import('next').NextConfig} */
const nextConfig = {
  // Silence workspace root inference warning in CI by explicitly setting project root
  outputFileTracingRoot: __dirname,
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

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@kotodama/shared'],
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
}

export default nextConfig

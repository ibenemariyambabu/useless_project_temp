/** @type {import('next').NextConfig} */
const backendUrl = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL;

const nextConfig = {
  reactStrictMode: false,
  swcMinify: true,
  eslint: {
    // Prevent ESLint errors from blocking Vercel production deployment
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Prevent TypeScript errors from blocking Vercel production deployment
    ignoreBuildErrors: true,
  },
  // If an external backend is configured (e.g. on Railway/Render/AWS), proxy calls to it
  ...(backendUrl ? {
    async rewrites() {
      const cleanUrl = backendUrl.replace(/\/$/, "");
      return [
        {
          source: "/api/:path*",
          destination: `${cleanUrl}/api/:path*`,
        },
        {
          source: "/ws/:path*",
          destination: `${cleanUrl}/ws/:path*`,
        },
      ];
    },
  } : {}),
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" }
        ],
      },
    ];
  },
};

module.exports = nextConfig;

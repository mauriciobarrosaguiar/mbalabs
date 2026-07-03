import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@mba-labs/shared"],
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb"
    }
  },
  async headers() {
    return [
      {
        source: "/bikecomanda-static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, no-cache, must-revalidate, proxy-revalidate"
          }
        ]
      }
    ];
  }
};

export default nextConfig;

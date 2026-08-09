import type { NextConfig } from "next";

const noCacheHeaders = [
  {
    key: "Cache-Control",
    value: "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0"
  },
  {
    key: "Pragma",
    value: "no-cache"
  },
  {
    key: "Expires",
    value: "0"
  }
];

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
        headers: noCacheHeaders
      },
      {
        source: "/calda-facil",
        headers: noCacheHeaders
      },
      {
        source: "/calda-facil/:path*",
        headers: noCacheHeaders
      }
    ];
  }
};

export default nextConfig;

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

const securityHeaders = [
  {
    key: "X-Content-Type-Options",
    value: "nosniff"
  },
  {
    key: "X-Frame-Options",
    value: "DENY"
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin"
  },
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'"
  }
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  transpilePackages: ["@mba-labs/shared"],
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb"
    }
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders
      },
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
      },
      {
        source: "/apps/dronegestor/calculadora",
        headers: noCacheHeaders
      },
      {
        source: "/apps/dronegestor/calculadora/:path*",
        headers: noCacheHeaders
      },
      {
        source: "/api/dronegestor/calculadora/version",
        headers: noCacheHeaders
      },
      {
        source: "/drone-calculadora-sw.js",
        headers: noCacheHeaders
      }
    ];
  }
};

export default nextConfig;

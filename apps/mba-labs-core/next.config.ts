import type { NextConfig } from "next";

const chamaDiaristaOrigin = process.env.CHAMA_DIARISTA_ORIGIN || "https://chama-diarista.vercel.app";

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
  },
  async rewrites() {
    return [
      {
        source: "/chama-diarista/:path*",
        destination: `${chamaDiaristaOrigin}/chama-diarista/:path*`
      }
    ];
  }
};

export default nextConfig;

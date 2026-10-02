import type { NextConfig } from "next";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://127.0.0.1:5000";

const isExport = process.env.OUTPUT_EXPORT === "1" || process.env.CF_PAGES === "1";

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
  ...(isExport ? { output: "export" } : {
    async rewrites() {
      return [
        {
          source: "/api/:path*",
          destination: `${BACKEND_URL}/api/:path*`,
        },
        {
          source: "/uploads/:path*",
          destination: `${BACKEND_URL}/uploads/:path*`,
        },
      ];
    },
  }),
};

export default nextConfig;

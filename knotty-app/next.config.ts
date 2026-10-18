import type { NextConfig } from "next";
import path from "path";

const BACKEND_URL =
  process.env.BACKEND_URL ||
  (process.env.NODE_ENV === "production"
    ? "https://knotty-backend.vercel.app"
    : "http://127.0.0.1:5000");

const isExport = process.env.OUTPUT_EXPORT === "1" || process.env.CF_PAGES === "1";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  images: {
    unoptimized: true,
  },
  compress: true,
  poweredByHeader: false,
  experimental: {
    optimizePackageImports: ["lucide-react", "recharts"],
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

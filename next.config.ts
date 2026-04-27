import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Widget iframe — allow embedding from any site
        source: "/widget",
        headers: [
          { key: "X-Frame-Options", value: "ALLOWALL" },
          { key: "Content-Security-Policy", value: "frame-ancestors *" },
        ],
      },
      {
        // AI API — allow cross-origin requests from ERP widget + embedded widget
        source: "/api/ai",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET, POST, OPTIONS" },
          {
            key: "Access-Control-Allow-Headers",
            value: "Content-Type, x-api-key, X-API-Key, x-user-id, X-User-Id, x-user-email, X-User-Email",
          },
          { key: "Access-Control-Max-Age", value: "86400" },
        ],
      },
      {
        // All other API routes — broad CORS coverage
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET, POST, OPTIONS" },
          {
            key: "Access-Control-Allow-Headers",
            value: "Content-Type, x-api-key, X-API-Key, x-user-id, X-User-Id, x-user-email, X-User-Email",
          },
          { key: "Access-Control-Max-Age", value: "86400" },
        ],
      },
    ];
  },
};

export default nextConfig;
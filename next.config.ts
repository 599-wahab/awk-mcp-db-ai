import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Widget iframe only — keep this, unrelated to CORS
        source: "/widget",
        headers: [
          { key: "X-Frame-Options", value: "ALLOWALL" },
          { key: "Content-Security-Policy", value: "frame-ancestors *" },
        ],
      },
      // API CORS is handled exclusively by each route's OPTIONS handler.
      // Defining it here AND in the route causes Vercel to merge/duplicate
      // headers unpredictably, which breaks preflight. Removed.
    ];
  },
};

export default nextConfig;
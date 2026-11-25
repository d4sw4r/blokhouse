import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next.js 16: Turbopack is the default bundler.
  // Removed deprecated `eslint` config key.
  // Removed `webpack` function — Turbopack handles optimisation by default.
  turbopack: {},
  async rewrites() {
    return [
      // Public URL of the API v1 OpenAPI document (route lives in app/api/v1/openapi)
      { source: "/api/v1/openapi.json", destination: "/api/v1/openapi" },
    ];
  },
};

export default nextConfig;

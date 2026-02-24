import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next.js 16: Turbopack is the default bundler.
  // Removed deprecated `eslint` config key.
  // Removed `webpack` function — Turbopack handles optimisation by default.
  turbopack: {},
};

export default nextConfig;

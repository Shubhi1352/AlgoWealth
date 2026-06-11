import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactCompiler: true,
  devIndicators: false,
  images: {
    domains: ["static2.finnhub.io"],
  },
};

export default nextConfig;

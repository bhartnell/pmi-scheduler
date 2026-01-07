import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    missingSuspenseWithCSRBailout: false,
  },
};

export default nextConfig;
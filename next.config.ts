import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Performance optimizations
  reactStrictMode: true,

  // Compiler optimizations
  compiler: {
    // Remove console logs in production
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn']
    } : false,
  },

  // Image optimization
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
  },

  // Production optimizations
  poweredByHeader: false,

  // Experimental features for better performance
  experimental: {
    optimizePackageImports: ['lucide-react', '@supabase/supabase-js'],
  },

  // Output settings
  output: 'standalone',

  // Redirects for consolidated admin pages
  async redirects() {
    return [
      {
        source: '/lab-management/admin/users',
        destination: '/admin/users',
        permanent: true,
      },
      {
        source: '/lab-management/admin/deletion-requests',
        destination: '/admin/deletion-requests',
        permanent: true,
      },
      {
        source: '/admin/create',
        destination: '/scheduler',
        permanent: true,
      },
      {
        source: '/skill-sheets',
        destination: '/lab-management/skill-sheets',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
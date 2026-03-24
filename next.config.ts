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

  // API rewrites — proxy /api/academics/planner/* to /api/scheduling/planner/*
  // The planner page moved to /academics/planner but API routes remain at /api/scheduling/planner
  async rewrites() {
    return [
      {
        source: '/api/academics/planner/:path*',
        destination: '/api/scheduling/planner/:path*',
      },
    ];
  },

  // Redirects for route reorganization
  async redirects() {
    return [
      // --- Existing redirects (updated destinations) ---
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
        source: '/osce-evaluator-signup',
        destination: '/osce/spring-2026',
        permanent: false,
      },

      // --- Planner → /academics/planner ---
      {
        source: '/scheduling/planner',
        destination: '/academics/planner',
        permanent: true,
      },
      {
        source: '/scheduling/planner/templates',
        destination: '/academics/planner/templates',
        permanent: true,
      },
      {
        source: '/scheduling/planner/workload',
        destination: '/academics/planner/workload',
        permanent: true,
      },
      {
        source: '/admin/instructor-workload',
        destination: '/academics/planner/workload',
        permanent: true,
      },

      // --- Lab Management → /labs ---
      {
        source: '/lab-management',
        destination: '/labs',
        permanent: true,
      },
      {
        source: '/lab-management/schedule',
        destination: '/labs/schedule',
        permanent: true,
      },
      {
        source: '/lab-management/schedule/new',
        destination: '/labs/schedule/new',
        permanent: true,
      },
      {
        source: '/lab-management/schedule/:id/edit',
        destination: '/labs/schedule/:id/edit',
        permanent: true,
      },
      {
        source: '/lab-management/schedule/:id',
        destination: '/labs/schedule/:id',
        permanent: true,
      },
      {
        source: '/lab-management/grade/station/:id',
        destination: '/labs/grade/station/:id',
        permanent: true,
      },
      {
        source: '/lab-management/scenarios',
        destination: '/labs/scenarios',
        permanent: true,
      },
      {
        source: '/lab-management/scenarios/new',
        destination: '/labs/scenarios/new',
        permanent: true,
      },
      {
        source: '/lab-management/scenarios/:id',
        destination: '/labs/scenarios/:id',
        permanent: true,
      },
      {
        source: '/lab-management/scenario-library',
        destination: '/labs/scenario-library',
        permanent: true,
      },
      {
        source: '/lab-management/templates',
        destination: '/labs/templates',
        permanent: true,
      },
      {
        source: '/lab-management/skill-drills',
        destination: '/labs/skill-drills',
        permanent: true,
      },
      {
        source: '/lab-management/groups',
        destination: '/labs/groups',
        permanent: true,
      },
      {
        source: '/lab-management/flags',
        destination: '/labs/flags',
        permanent: true,
      },
      {
        source: '/lab-management/ekg-warmup',
        destination: '/labs/ekg-warmup',
        permanent: true,
      },
      {
        source: '/lab-management/debrief-review',
        destination: '/labs/debrief-review',
        permanent: true,
      },
      {
        source: '/lab-management/skills',
        destination: '/labs/skills',
        permanent: true,
      },
      {
        source: '/lab-management/skills/:path*',
        destination: '/labs/skills/:path*',
        permanent: true,
      },
      {
        source: '/lab-management/stations',
        destination: '/labs/stations',
        permanent: true,
      },
      {
        source: '/lab-management/stations/:path*',
        destination: '/labs/stations/:path*',
        permanent: true,
      },
      {
        source: '/lab-management/seating',
        destination: '/labs/seating',
        permanent: true,
      },
      {
        source: '/lab-management/seating/:path*',
        destination: '/labs/seating/:path*',
        permanent: true,
      },
      {
        source: '/lab-management/mentorship',
        destination: '/labs/mentorship',
        permanent: true,
      },
      {
        source: '/lab-management/mentorship/:path*',
        destination: '/labs/mentorship/:path*',
        permanent: true,
      },
      {
        source: '/lab-management/peer-evals',
        destination: '/labs/peer-evals',
        permanent: true,
      },
      {
        source: '/lab-management/peer-evals/:path*',
        destination: '/labs/peer-evals/:path*',
        permanent: true,
      },
      {
        source: '/lab-management/protocol-tracking',
        destination: '/labs/protocol-tracking',
        permanent: true,
      },
      {
        source: '/lab-management/protocol-tracking/:path*',
        destination: '/labs/protocol-tracking/:path*',
        permanent: true,
      },
      {
        source: '/lab-management/my-certifications',
        destination: '/labs/my-certifications',
        permanent: true,
      },
      {
        source: '/lab-management/my-certifications/:path*',
        destination: '/labs/my-certifications/:path*',
        permanent: true,
      },
      {
        source: '/lab-management/skill-sheets',
        destination: '/academics/skill-sheets',
        permanent: true,
      },
      {
        source: '/lab-management/skill-sheets/:path*',
        destination: '/academics/skill-sheets/:path*',
        permanent: true,
      },

      // --- Cohorts & Students → /academics ---
      {
        source: '/lab-management/admin/cohorts',
        destination: '/academics/cohorts',
        permanent: true,
      },
      {
        source: '/lab-management/admin/cohorts/:path*',
        destination: '/academics/cohorts/:path*',
        permanent: true,
      },
      {
        source: '/lab-management/cohorts/:id',
        destination: '/academics/cohorts/:id',
        permanent: true,
      },
      {
        source: '/lab-management/students',
        destination: '/academics/students',
        permanent: true,
      },
      {
        source: '/lab-management/students/new',
        destination: '/academics/students/new',
        permanent: true,
      },
      {
        source: '/lab-management/students/import',
        destination: '/academics/students/import',
        permanent: true,
      },
      {
        source: '/lab-management/students/:id',
        destination: '/academics/students/:id',
        permanent: true,
      },

      // --- Admin pages from lab-management ---
      {
        source: '/lab-management/admin/feedback',
        destination: '/admin/feedback',
        permanent: true,
      },
      {
        source: '/lab-management/admin/feedback/:path*',
        destination: '/admin/feedback/:path*',
        permanent: true,
      },
      {
        source: '/lab-management/admin/timer-displays',
        destination: '/admin/timer-displays',
        permanent: true,
      },
      {
        source: '/lab-management/admin/timer-displays/:path*',
        destination: '/admin/timer-displays/:path*',
        permanent: true,
      },
      {
        source: '/lab-management/admin/certifications',
        destination: '/admin/certifications',
        permanent: true,
      },
      {
        source: '/lab-management/admin/certifications/:path*',
        destination: '/admin/certifications/:path*',
        permanent: true,
      },

      // --- Reports from lab-management ---
      {
        source: '/lab-management/reports',
        destination: '/reports',
        permanent: true,
      },
      {
        source: '/lab-management/reports/:path*',
        destination: '/reports/:path*',
        permanent: true,
      },

      // --- Clinical trackers ---
      {
        source: '/lab-management/emt-tracker',
        destination: '/clinical/emt-tracking',
        permanent: true,
      },
      {
        source: '/lab-management/aemt-tracker',
        destination: '/clinical/aemt-tracking',
        permanent: true,
      },

      // --- Skill sheets → /academics ---
      {
        source: '/skill-sheets',
        destination: '/academics/skill-sheets',
        permanent: true,
      },
      {
        source: '/skill-sheets/:id',
        destination: '/academics/skill-sheets/:id',
        permanent: true,
      },

      // --- Scheduler → /scheduling/polls ---
      {
        source: '/scheduler',
        destination: '/scheduling/polls',
        permanent: true,
      },
      {
        source: '/scheduler/create',
        destination: '/scheduling/polls/create',
        permanent: true,
      },
      {
        source: '/admin/create',
        destination: '/scheduling/polls/create',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
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

  // Cache-Control header overrides for specific API routes that
  // can safely tolerate a short browser cache.
  //
  // Why NOT a catch-all no-store rule: Next.js merges headers from
  // every matching rule into the response. A `/api/:path*` no-store
  // rule plus a `/api/lab-management/timer` cache rule produces
  // TWO Cache-Control headers in the same response, and browsers
  // resolve that ambiguously. So we list only the routes that need
  // caching; everything else gets Vercel's default for serverless
  // functions (no Cache-Control header → browser defaults to
  // network-only for dynamic API responses, which is what we want).
  //
  // Routes that explicitly need no-store can call res.headers.set()
  // in their handler — that's the canonical Next.js pattern and
  // doesn't conflict with the overrides below.
  //
  // 2026-05-26 perf incident background: a live lab generated 3,462
  // timer requests in ~1 hour because every poll fetched fresh
  // (catch-all was forcing no-store). The 2s browser cache lets
  // multiple components on the same page dedupe their polls.
  async headers() {
    return [
      {
        // Timer state GET: per-browser cache for 2s, serve stale up
        // to 5s while revalidating in the background. `private` keeps
        // it out of any shared CDN cache (route is authenticated).
        source: '/api/lab-management/timer',
        headers: [
          { key: 'Cache-Control', value: 'private, max-age=2, stale-while-revalidate=3' },
        ],
      },
      {
        // Ready statuses: same shape — multiple components on the
        // lab day page poll this; let the browser dedupe.
        source: '/api/lab-management/timer/ready',
        headers: [
          { key: 'Cache-Control', value: 'private, max-age=2, stale-while-revalidate=3' },
        ],
      },
      {
        // Token-gated timer display page reads — data is the same
        // per token. Short cache absorbs rapid polls.
        source: '/api/timer-display/:token',
        headers: [
          { key: 'Cache-Control', value: 'private, max-age=2, stale-while-revalidate=3' },
        ],
      },
    ];
  },

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
      // Cohort hub consolidation: /lab-management/cohorts duplicated
      // /academics/cohorts and split user mental model. Academics is
      // the canonical hub (where "Update from Template", student
      // tools, semester review, etc. all live). The :path* matcher
      // catches the cohort hub itself plus /calendar /completion
      // /groups /smc /skill-log /semester-review subpages.
      {
        source: '/lab-management/cohorts/:path*',
        destination: '/academics/cohorts/:path*',
        permanent: true,
      },
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
        // Retarget to /labs/stations/pool since /labs/stations has no
        // index page — following the same redirect would hit a 404.
        destination: '/labs/stations/pool',
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
      // The /lab-management/admin hub itself — was previously
      // rendered by app/lab-management/admin/page.tsx, deleted
      // 2026-05-23 during the duplicate-route cleanup. /admin is
      // the canonical hub.
      {
        source: '/lab-management/admin',
        destination: '/admin',
        permanent: true,
      },
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
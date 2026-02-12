# PMI EMS Scheduler - Claude Code Instructions

## Project Overview

PMI EMS Scheduler is a comprehensive scheduling and management system for the Pima Medical Institute Paramedic Program. It handles lab management, clinical tracking, student onboarding, scheduling polls, reporting, and more.

## Tech Stack

- **Framework:** Next.js 16 (App Router), React 19, TypeScript 5
- **Database:** Supabase (PostgreSQL), direct client queries (no ORM)
- **Auth:** NextAuth.js 4, Google OAuth, restricted to @pmi.edu
- **Styling:** Tailwind CSS 4, Lucide React icons
- **Deployment:** Vercel (frontend) + Supabase (database)

## Commands

- `npm run dev` - Dev server (Turbo mode)
- `npm run build` - Production build (use to verify changes)
- `npm run lint` - ESLint
- `npm run type-check` - TypeScript check (no emit)

## Key Directories

- `app/api/` - API route handlers organized by feature
- `app/` - Pages organized by feature (admin, clinical, lab-management, scheduler, etc.)
- `components/` - Reusable React components
- `lib/` - Utilities: auth.ts, permissions.ts, audit.ts, notifications.ts, export-utils.ts
- `types/` - TypeScript type definitions
- `supabase/migrations/` - SQL migration files (format: YYYYMMDD_description.sql)

## External Resources

- **Project instructions & specs:** `C:\Users\benny\OneDrive\Documents\(1)Pima Paramedic Instructor\Pmitools folder`
- **Repository & deployment:** `C:\Users\benny\.claude-worktrees\pmi-scheduler`
- **Services:** GitHub, Vercel, Supabase

## Git Workflow

- **Always push to `main` branch** - This session works directly on main
- Commit completed work with descriptive messages
- Run `npm run build` before committing to verify no errors

## Conventions

- API routes: NextRequest/NextResponse, getServerSession for auth, createClient for Supabase
- Roles: superadmin > admin > instructor > user > guest
- Pages: client components with useEffect data fetching
- Styling: Tailwind only, dark mode via next-themes
- Migrations: IF NOT EXISTS, always add RLS policies and indexes
- Audit: log sensitive operations via lib/audit.ts

## Agent Workflow (Supervisor Pattern)

This project uses a supervisor pattern with two specialized sub-agents:

- **bugfix-agent** - Diagnoses and fixes bugs with minimal changes
- **feature-agent** - Implements new features following project conventions

The main Claude Code session acts as project manager, delegating work to these agents.

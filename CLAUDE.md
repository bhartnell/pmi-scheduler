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

### CRITICAL: Direct-to-Main Deployment

**This project deploys directly to `main`. Do NOT use feature branches or PRs unless explicitly requested.**

1. **Before starting work:** If on a worktree branch, merge to main first:
   ```bash
   git checkout main
   git merge <worktree-branch> --no-edit
   git push origin main
   ```

2. **During work:** Commit and push directly to `main`:
   ```bash
   git add <files>
   git commit -m "descriptive message"
   git push origin main
   ```

3. **Build verification:** Always run `npm run build` before pushing to catch errors

4. **Worktree branches:** These are temporary workspaces only. Always merge completed work to `main` before ending a session.

5. **Never leave work stranded:** If a session ends with unmerged changes on a worktree branch, the next session should merge those changes to main immediately.

### Why Direct-to-Main?
- Vercel auto-deploys from `main` - feature branches create preview URLs that aren't used
- Preview branches cause deployment confusion and delays
- Single developer workflow doesn't need PR review gates

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

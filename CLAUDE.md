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

## Development Environment (HARD REQUIREMENT)

**`node_modules/` and `.next/` are NTFS junctions pointing at
`C:\dev-cache\pmi-scheduler\`.** This intentional setup keeps the
heaviest dev artifacts off OneDrive so OneDrive sync doesn't fight
the dev loop.

### Rules

1. **Never `rm -rf node_modules` or `rm -rf .next` without
   recreating the junction.** A plain delete removes the link target
   from `C:\dev-cache\` AND breaks the link, resurfacing the
   OneDrive-sync lag the junction was meant to fix. If you need a
   clean install:
   ```powershell
   # From the repo root (PowerShell):
   Remove-Item node_modules -Recurse -Force        # removes the JUNCTION only
   New-Item -ItemType Directory C:\dev-cache\pmi-scheduler\node_modules -Force
   New-Item -ItemType Junction -Path node_modules -Target C:\dev-cache\pmi-scheduler\node_modules
   npm install
   ```
   Same pattern for `.next`. Verify with
   `Get-Item node_modules | Select-Object LinkType, Target`.

2. **Never commit `.next/`, `.next-old*/`, or `node_modules/`.**
   `.gitignore` already covers these (the `/.next-old*/` pattern was
   added 2026-06-05 after commit `5a7ddc90` removed 150,773
   accidentally-committed `.next-old*` build artifacts; .git had
   bloated to 115 MB).

3. **Build timeouts in Windows** — Turbopack occasionally hits
   "TurbopackInternalError: Failed to write app endpoint" with a
   "deadline has elapsed" / "timeout while receiving message from
   process" trailer. This is an OneDrive-sync race with the build
   workers, not a code error. Retry the build; it typically passes
   on the second attempt. Exit code 0 with that trailer means the
   build actually finished — check for "Compiled successfully" /
   the route-table footer.

See `MEMORY.md` for the long-form history of this setup.

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

## Database Migrations

Run migrations against Supabase production using the migration runner script:

```bash
node scripts/run-migration.js supabase/migrations/<filename>.sql
```

- Connection is configured via `SUPABASE_DB_URL` in `.env.local`
- Uses the `pg` npm package with the Supabase session pooler (us-west-2)
- Add `--dry-run` to preview SQL without executing
- Always run migrations after committing code that creates new tables
- Migration files use `IF NOT EXISTS` for idempotency

### PostgREST FK Ambiguity Check

**After running any migration that creates or modifies foreign keys**, run:

```bash
node scripts/check-fk-ambiguity.js
```

This detects table pairs connected by multiple FK paths that cause PGRST201 errors. Fix any CRITICAL warnings before committing. When a new FK creates ambiguity, add `!fk_constraint_name` to all affected `.select()` embeds:

```
Before: cohort:cohorts(id, cohort_number)
After:  cohort:cohorts!students_cohort_id_fkey(id, cohort_number)
```

## Conventions

- API routes: NextRequest/NextResponse, getServerSession for auth, createClient for Supabase
- Roles: superadmin > admin > instructor > user > guest
- Pages: client components with useEffect data fetching
- Styling: Tailwind only, dark mode via next-themes
- Migrations: IF NOT EXISTS, always add RLS policies and indexes
- Audit: log sensitive operations via lib/audit.ts
- Supabase embeds: Use explicit FK hints (`!fk_name`) when tables have multiple FK paths (see PostgREST FK Ambiguity Check above)

## Navigation Entry-Point Rule (HARD REQUIREMENT)

**Every new page (`app/**/page.tsx`) MUST have at least one
navigation entry point or the task is INCOMPLETE.**

Acceptable entry points (any one of these is enough):

1. **Card on a hub page** — add a `<Link href="..." />` card on
   the relevant parent hub:
   - `/admin/page.tsx` for admin tools
   - `/admin/scenarios/page.tsx` for scenario tools
   - `/scheduling/page.tsx` for scheduling tools
   - `/lab-management/page.tsx` for lab tools
   - the home `/page.tsx` for user-facing tools

2. **UserMenu dropdown link** — for personal/settings pages,
   add to `components/UserMenu.tsx`.

3. **Sidebar/header nav link** — when the page slots into an
   existing module's nav.

4. **Breadcrumb back to a discoverable parent** — sufficient for
   detail pages whose parent (a list view) is itself linked.

Pure URL-only access (where the operator must type the path) is
NEVER acceptable as the only entry point. Telling the user
"navigate to /admin/foo" without also wiring a link is a regression.

**When you ship a new page, the same commit MUST include the link.**
If you defer the link, mention it explicitly in the response and
flag the deferral as a follow-up task — do not silently ship a
disconnected page.

When auditing whether existing pages have entry points, search for
`href="<path>"` across `app/`, `components/`, and `lib/nav*` —
the link must exist somewhere a user can click.

## Documentation Update Rule (HARD REQUIREMENT)

After every commit that adds, removes, or significantly changes
a feature, route, component, or data structure, update the
relevant documentation in the same commit or as an immediate
follow-up commit.

### What to update and when

**`docs/SITEMAP.md`** — update when:
- A new page/route is added or removed
- A route is redirected or renamed
- A page's access level or description changes

**`docs/COMPONENTS.md`** — update when:
- A new shared component is created
- A component's props or behavior change significantly
- A component is deleted

**`docs/DEAD_CODE_REPORT.md`** — update when:
- Dead code is removed (mark as resolved in the
  "What's Been Resolved" section at the top)
- New dead code or duplication is identified

**`docs/PMI-ROADMAP-*.md`** — update when:
- A roadmap item is completed (mark ✅)
- A new feature is planned or specced
- A deadline or priority changes

**`docs/PMI-MASTER-REFERENCE-*.md`** — update when:
- A major feature ships
- Key IDs, table names, or configuration change
- Team, cohort, or environment information changes
- New companion doc is added

**`docs/CHANGELOG.md`** — update with EVERY commit. Format:
```
YYYY-MM-DD | commit-hash | brief description
```
- One line per commit.
- Group multiple same-day commits under a single date heading.
- Reverse chronological order (newest first).
- Keep the description short — readers go to `git show <hash>`
  for the full diff.

### Format guidance

- One-line entry is sufficient for most changes.
- Full section rewrite only for major architectural changes.
- If a commit touches multiple doc areas, update all of them.
- Dead-code removal always updates DEAD_CODE_REPORT.md.
- New pages always update SITEMAP.md (pairs with the existing
  Navigation Entry-Point Rule).

### Why this matters

This codebase has complex interconnections between lab management,
scheduling, clinical tracking, Google Calendar sync, and LVFR.
Poor documentation has caused, in actual incidents:
- Fixes landing in the wrong duplicate route (/labs vs
  /lab-management — wasted a full day before the consolidation
  in commit `808bb34d`)
- Hours re-investigating already-solved problems
- Context loss between chat sessions requiring full re-orientation
- Template content reverting undetected for days (the embedded
  `data/paramedic_s2_labs.json` seed-file overwrite bug)

A living documentation system prevents these issues and makes
each new session faster to orient. The cost per commit is 2–5
minutes; the cost of NOT doing it compounds every session.

## Agent Workflow (Supervisor Pattern)

This project uses a supervisor pattern with two specialized sub-agents:

- **bugfix-agent** - Diagnoses and fixes bugs with minimal changes
- **feature-agent** - Implements new features following project conventions

The main Claude Code session acts as project manager, delegating work to these agents.

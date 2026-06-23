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

**The repo lives at `C:\dev\pmi-scheduler` — OUTSIDE OneDrive.**
`node_modules/` and `.next/` are ordinary directories created by
`npm install` and `next build/dev` respectively. No junctions, no
symlinks, no `C:\dev-cache\` redirection. Turbopack works normally
in dev and prod build.

### Rules

1. **Never put this repo back under a OneDrive- or Dropbox-synced
   path.** The earlier OneDrive location caused two compounding
   problems: heavy sync churn that made the machine feel
   unresponsive during dev, and a Turbopack failure ("Symlink
   node_modules is invalid, it points out of the filesystem root")
   that came from the junction workaround. Both vanished the
   instant the repo moved to `C:\dev\pmi-scheduler`. Do not
   recreate the junction workaround — fix the path instead.

2. **Never commit `.next/`, `.next-old*/`, or `node_modules/`.**
   `.gitignore` already covers these (the `/.next-old*/` pattern
   was added 2026-06-05 after commit `5a7ddc90` removed 150,773
   accidentally-committed `.next-old*` build artifacts that had
   bloated `.git` to 115 MB).

3. **A clean reinstall is just a clean reinstall now:**
   ```powershell
   Remove-Item node_modules -Recurse -Force
   Remove-Item .next -Recurse -Force
   npm install
   ```
   No junction recreation step needed.

See `docs/CHANGELOG.md` entry for the 2026-06-05 migration if you
need the long-form history.

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
- Styling: Tailwind only, dark mode via next-themes; **desktop-first / wide layouts** (see UI Layout Rule below)
- Migrations: IF NOT EXISTS, always add RLS policies and indexes
- Audit: log sensitive operations via lib/audit.ts
- Supabase embeds: Use explicit FK hints (`!fk_name`) when tables have multiple FK paths (see PostgREST FK Ambiguity Check above)

## UI Layout Rule (HARD REQUIREMENT)

**Build desktop-first / wide, mobile-FRIENDLY — NOT mobile-first.**
This is a school setting used primarily on **desktop, laptop, and
iPad/tablet in landscape** (especially for labs). Phone access happens
but is the occasional fallback, never the design baseline.

1. **Start from the wide layout and adapt DOWN.** The base (unprefixed)
   layout is the desktop/landscape view — multi-column, horizontal, uses
   the screen width. Collapse to single-column only at small screens.
   Do NOT start from a phone (vertical, single-column) and scale up.

2. **Tailwind, concretely:** make the **base classes the WIDE layout**
   and use `max-sm:` / `max-md:` variants to stack down
   (e.g. `grid-cols-3 max-md:grid-cols-1`), rather than the mobile-first
   default of `grid-cols-1` + `sm:`/`md:`/`lg:` scaling up. Wide is the
   baseline; small screens are the exception.

3. **Management/admin interfaces are the PRIMARY use** and must be wide
   and multi-column: scheduling, grading, ACLS hub, results,
   schedule-building, lab management.

4. **Landscape/wide is the default working orientation** — design for
   tablet-landscape, not portrait phone.

5. **Touch targets** stay comfortably sized (min ~44px height) for
   tablet/touch use. Bigger cards + mobile-friendly touches are welcome
   — "mobile friendly," not "mobile first."

**When building or touching any page:** ensure it follows
desktop-first/wide, and **FLAG any page still stuck in a
vertical/mobile-first layout** so it can be brought in line (some older
/ newer builds came in vertical-heavy — fix or flag them when touched).
(Source: `PMI_Project_Instructions.md`, desktop-first principle.)

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

## Schema-First Rule (HARD REQUIREMENT)

Before any database or schema work, read `docs/DATABASE_SCHEMA.md`
first to locate the relevant tables and columns — do not rediscover
the layout from scratch. Then verify against the live database
before relying on it. If the doc and the live database disagree,
**the live database is the source of truth** and the doc is
corrected in the SAME commit.

**Rationale:** a stale schema doc is worse than no doc, because it
is trusted and sends work to the wrong place with confidence.
Reading the doc and updating the doc are one loop; doing only one
half lets the doc rot. (This is the companion to the Documentation
Update Rule below — the read-first and update-always halves are the
same loop.)

## Documentation Update Rule (HARD REQUIREMENT)

After every commit that adds, removes, or significantly changes
a feature, route, component, or data structure, update the
relevant documentation in the same commit or as an immediate
follow-up commit.

### What to update and when

**`docs/DATABASE_SCHEMA.md`** — update when (per the Schema-First Rule):
- A table is added, renamed, or removed
- A column is added, renamed, removed, or its type/constraint changes
- A foreign-key relationship changes
Update it in the SAME commit as the schema change — never let the
doc lag the live database.

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

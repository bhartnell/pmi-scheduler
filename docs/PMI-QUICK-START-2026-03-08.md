# PMI EMS Scheduler — Quick Start Prompt

> Use this as the opening context for new Claude Code sessions.
> **Refreshed 2026-05-23** (filename kept as -2026-03-08 for compatibility
> with existing project-knowledge upload pipelines).

---

## Current State

You are working on the **PMI EMS Scheduler**, a Next.js 16 / React 19 /
TypeScript 5 web application for the Pima Medical Institute Paramedic
Program. The codebase is mature and active:

- **271 page routes**, **~480 API routes** (~750 total)
- **63 top-level React components** + subdirs (lab-day/, grading/,
  scheduling/, scenario/, seating/, ui/)
- **54 lib utilities** (up from 30 in March)
- **15 custom hooks**
- **~80+ database tables** in Supabase (PostgreSQL)
- **~200 SQL migrations**, **~700+ commits**
- **17 Vercel cron jobs**

Deployment: Vercel auto-deploys from `main`. Database is Supabase
(us-west-2).

---

## Active Cohorts (memorize these IDs)

| Cohort | UUID | Notes |
|--------|------|-------|
| **PM G14** (Paramedic, S2) | `8577fdc3-eff6-4000-9302-1ee6e3043eeb` | Active mid-semester |
| **PM G15** (Paramedic, S1) | `856bcf1d-2e85-48b5-92a3-aba941103109` | ⚠ 0/20 students have email on file |
| **EMT G5** (EMT, S1) | `67080313-0c52-411b-8e88-2ae6e99eb6c6` | Templates fixed 2026-05-20 |

---

## Major Features Shipped (May 2026 update)

- **Lab Management** — Lab days, stations, scenarios, assessments,
  timer system with multi-device sync, equipment + costs tracking,
  per-day refresh from template
- **Lab Template Safeguards** — placeholder gate (rejects "Content
  Pending" uploads), `lab_day_template_audit` trigger trail,
  Fill Gaps Only generation mode, Force Regenerate gate (blocks
  when results exist)
- **Clinical Tracking** — Internships, preceptors, site visits,
  hours, alerts, ride-along scheduling
- **OSCE** — Multi-event OSCE management with blocks, observers,
  public signup, tokens, results dashboard
- **Case Studies** — Case library, practice mode, live classroom
  sessions (session/[code]/instructor|join|student|tv), AI generation
- **Scheduling** — Polls, part-timer shifts (with slot-level
  "Need X" tiles), calendar view, availability, bulk lab-shift
  generator
- **Google Calendar Integration (Phases 1–4 complete)** —
  per-user OAuth, FreeBusy availability checks, shared-calendar
  event creation with RRULE recurrence, bulk sync + per-user
  Force Re-sync admin tool
- **Scenario Import/Export** — Export JSON / Update from JSON /
  Bulk Export with id-based round-trip dedup
- **NREMT Day Guards** — per-lab-day scoped kill-switch
  (`isNremtLabDay(labDayId)`), result-email blocking, NREMT
  completion tracking
- **LVFR-AEMT Module** — self-contained partner-program module
  (calendar, planner, files, grades, pharm tracking, scheduling,
  skills, per-day views)
- **Seating** — Suite 1 room preset (30 seats, two-section split),
  drag-drop charts, learning-style distribution
- **Gamification** — Achievements, leaderboards, stats
- **Reporting** — 24 reports across Analytics Dashboards, Existing
  Reports, Operational, and (NEW) Cohort Progress sections
- **Student Portal** — Skill sheets, lab history, classroom
  participation, attendance appeals, peer eval, available labs
- **Admin** — User management, RBAC, audit logs, announcements,
  onboarding, calendar sync, scenario admin, lab template admin,
  feedback CSV (ISO + RFC 4180), deletion requests, broadcast,
  time-clock, deep-links, equipment + maintenance
- **Lab Day Live Chat** — Supabase realtime presence + messages
  with exponential-backoff reconnect

---

## Key Tables (May 2026)

| Table | Purpose |
|-------|---------|
| `lab_users` | All users (role, email, google_calendar_*, needs_reauth) |
| `students` | FERPA-protected student records |
| `cohorts` | Student groups |
| `lab_days` | Scheduled lab sessions (rotation_duration is the col, not rotation_minutes) |
| `lab_stations` | Station assignments (rotation_minutes lives here) |
| `lab_groups`, `lab_group_members` | Canonical (replaces legacy `student_groups`) |
| `lab_day_equipment` | Equipment checkout (station_id added 2026-05-21) |
| `lab_day_costs` | Cost tracking — category column requires snake_case ('instructor_pay'); route normalizes |
| `lab_day_debriefs` | Structured fields added 2026-05-22 |
| `lab_day_template_audit` | INSERT/UPDATE/DELETE history for lab_day_templates |
| `lab_timer_state` | Per-lab timer with version field |
| `scenarios` | Scenario library |
| `scenario_assessments` | Student assessments |
| `student_skill_evaluations` | Skill evaluations |
| `clinical_site_visits` | Site visit logs |
| `osce_events` | OSCE event definitions |
| `case_studies` | Case study definitions |
| `google_calendar_events` | PMI → Google Calendar event mappings (source_type='schedule_block_series' for recurring) |
| `notifications_log` | In-app notifications |
| `audit_log` | FERPA audit trail |
| `email_log` | Email send log — columns: to_email, error (NOT recipient/error_message) |
| `approved_external_emails` | Allowlist for non-@pmi.edu OAuth (Microsoft) |

---

## Standing Instructions

### Git Workflow
- **Direct-to-main**: Commit and push to `main` directly (no feature
  branches unless requested)
- Always run `npm run build` before pushing
- If on a worktree branch, merge to main first
- See `CLAUDE.md` for full rules incl. Navigation Entry-Point Rule

### Routing (post-cleanup)
- `/labs/*` is the canonical lab management hub. `/lab-management/*`
  URLs still work via `next.config.ts` redirects but the page files
  are GONE — do NOT recreate them under `app/lab-management/`.
- `/academics/cohorts`, `/academics/students`, `/academics/planner`,
  `/academics/skill-sheets` are canonical for those areas.
- `/admin/*` is canonical for admin tools (incl. feedback,
  timer-displays, certifications).
- `/reports/*` is canonical for all reports.
- `/clinical/aemt-tracking` and `/clinical/emt-tracking` (not the
  -tracker variants).

### FK Disambiguation (CRITICAL)
- After any migration that creates/modifies foreign keys, run:
  `node scripts/check-fk-ambiguity.js`
- Fix CRITICAL warnings by adding `!fk_constraint_name` to Supabase
  `.select()` embeds
- Example: `cohort:cohorts!students_cohort_id_fkey(id, cohort_number)`

### Migration Runner
```bash
node scripts/run-migration.js supabase/migrations/<filename>.sql
```
- Uses `SUPABASE_DB_URL` from `.env.local`
- Add `--dry-run` to preview
- Migrations must use `IF NOT EXISTS` for idempotency
- For ADD CONSTRAINT, wrap in DO block + pg_constraint check

### Auth Pattern
```typescript
// Server-side
const auth = await requireAuth('instructor');
if (auth instanceof NextResponse) return auth;
const { user } = auth;
```

### API Route Pattern
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';
```

### Email Pattern
```typescript
import { sendEmail } from '@/lib/email';
// labDayId is REQUIRED for any student-facing result email so the
// NREMT day kill-switch can scope correctly
await sendEmail({ to, template, data, labDayId });
```

If you add a new student-result email template, you MUST add its
template key to `STUDENT_EVAL_TEMPLATES` in `lib/email.ts` so it
goes through the NREMT-day guard.

### Audit-trail writer stamps
When updating `lab_day_templates`, set `updated_by` so the audit
trigger captures the actor:
```typescript
.update({ ..., updated_by: `import-route:${user.email}` })
```

### Calendar Sync Pattern
```typescript
// Fire-and-forget — never blocks, never throws
syncLabAssignment({ ... }).catch(() => {});
```

### Roles (highest to lowest)
`superadmin` (5) > `admin` (4) > `lead_instructor` (3) >
`agency_liaison` (?) > `instructor` (2) > `program_director` (1.75)
> `volunteer_instructor` (1.5) > `student` (1) = `guest` (1) >
`pending` (0)

---

## Active Work Items

- **#8** email_log schema sweep — confirm all writers use `to_email`
  / `error` (the canonical columns)
- **#9** FreeBusy 403 reconnect prompt — surface needs_reauth + UI
  banner when Google returns 403 on FreeBusy lookups
- **#13** Station documentation file upload — currently URL-only;
  add Supabase Storage upload for PDFs / Google Docs
- **Testing**: Still no automated tests (highest priority debt)
- **PM G15 email backfill**: 0/20 students have email on file —
  block on sending result emails to that cohort until resolved

---

## Commands

```bash
npm run dev          # Dev server (Turbo mode)
npm run build        # Production build (verify before push)
npm run lint         # ESLint
npm run type-check   # TypeScript check (no emit)
```

---

## Key Files

| File | Purpose |
|------|---------|
| `lib/auth.ts` | NextAuth config; @pmi.edu Google + Microsoft Azure AD (external) |
| `lib/permissions.ts` | Role hierarchy, RBAC helpers, FERPA data permissions |
| `lib/api-auth.ts` | `requireAuth(role)` helper for API routes |
| `lib/supabase.ts` | Supabase client factory (`getSupabase`, `getSupabaseAdmin`) |
| `lib/email.ts` | Central email sender; NREMT day scoping; STUDENT_EVAL_TEMPLATES gate |
| `lib/notifications.ts` | Notification creation helpers (canonical /labs/* URLs) |
| `lib/scenario-export.ts` | Scenario JSON converter; round-trip with id-based dedup |
| `lib/google-calendar.ts` | Google Calendar sync (fire-and-forget) |
| `lib/calendar-availability.ts` | FreeBusy API integration |
| `lib/google-shared-calendar.ts` | Shared-calendar RRULE event creation |
| `lib/calendar-auto-sync.ts` | `syncSeriesForUser()` for recurring sync |
| `lib/audit.ts` | FERPA audit logging |
| `lib/export-utils.ts` | Excel/PDF export utilities |
| `lib/date-input.ts` | Date input helpers (AZ-local handling) |
| `lib/poll-link.ts` | Scheduling poll URL builders + token validation |
| `lib/instructor-blocks.ts` | Per-instructor calendar block assembly |
| `scripts/check-fk-ambiguity.js` | FK disambiguation checker |
| `scripts/run-migration.js` | Database migration runner |
| `next.config.ts` | `/lab-management/*` → canonical path redirects |
| `vercel.json` | Cron job definitions |
| `CLAUDE.md` | Project workflow + Navigation Entry-Point Rule |

---

## Companion Documents

- `docs/PMI-MASTER-REFERENCE-2026-05-23.md` — full system snapshot
- `docs/PMI-ROADMAP.md` (and dated copies) — feature roadmap
- `docs/SITEMAP.md` — 271-route inventory
- `docs/COMPONENTS.md` — component + utility reference
- `docs/DEAD_CODE_REPORT.md` — resolved + outstanding dead code
- `docs/API.md`, `docs/DATABASE_SCHEMA.md`, `docs/ARCHITECTURE.md` —
  reference docs (last refreshed pre-May)

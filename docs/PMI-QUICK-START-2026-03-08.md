# PMI EMS Scheduler — Quick Start Prompt

> Use this as the opening context for new Claude Code sessions. Updated March 8, 2026.

---

## Current State

You are working on the **PMI EMS Scheduler**, a Next.js 16 / React 19 / TypeScript 5 web application for the Pima Medical Institute Paramedic Program. The codebase is mature with:

- **205 page routes**, **443 API routes** (651 total)
- **122 React components**, **30 lib modules**
- **~60+ database tables** in Supabase (PostgreSQL)
- **171 SQL migrations**, **639 commits**
- **~61,800 lines** of TypeScript/TSX
- **15 Vercel cron jobs**

Deployment: Vercel auto-deploys from `main`. Database is Supabase (us-west-2).

---

## Major Features Shipped

- **Lab Management** — Lab days, stations, scenarios, assessments, timer system, equipment
- **Clinical Tracking** — Internships, preceptors, site visits, hours, alerts
- **OSCE** — Multi-event OSCE management with blocks, observers, public signup
- **Case Studies** — Case library, practice mode, classroom sessions, AI generation
- **Scheduling** — Polls, part-timer shifts, calendar view, availability
- **Google Calendar** — 4-phase integration (availability, sync, overlay, admin dashboard)
- **Gamification** — Achievements, leaderboards, stats
- **Reporting** — 5 dashboards, Excel/PDF export, scheduled exports
- **Student Portal** — Skill sheets, lab history, classroom participation
- **Admin** — User management, RBAC, audit logs, announcements, onboarding

---

## Key Tables

| Table | Purpose |
|-------|---------|
| `lab_users` | All users (role, email, google_calendar_ids) |
| `students` | FERPA-protected student records |
| `cohorts` | Student groups |
| `lab_days` | Scheduled lab sessions |
| `lab_stations` | Station assignments |
| `scenarios` | EMS scenario library |
| `scenario_assessments` | Student assessments |
| `clinical_site_visits` | Site visit logs |
| `osce_events` | OSCE event definitions |
| `case_studies` | Case study definitions |
| `google_calendar_events` | PMI → Google Calendar event mappings |
| `notifications_log` | In-app notifications |
| `audit_log` | FERPA audit trail |

---

## Standing Instructions

### Git Workflow
- **Direct-to-main**: Commit and push to `main` directly (no feature branches)
- Always run `npm run build` before pushing
- If on a worktree branch, merge to main first

### FK Disambiguation (CRITICAL)
- After any migration that creates/modifies foreign keys, run: `node scripts/check-fk-ambiguity.js`
- Fix CRITICAL warnings by adding `!fk_constraint_name` to Supabase `.select()` embeds
- Example: `cohort:cohorts!students_cohort_id_fkey(id, cohort_number)`

### Migration Runner
```bash
node scripts/run-migration.js supabase/migrations/<filename>.sql
```
- Uses `SUPABASE_DB_URL` from `.env.local`
- Add `--dry-run` to preview
- Migrations must use `IF NOT EXISTS` for idempotency

### Auth Pattern
```typescript
const session = await getServerSession(authOptions);  // ALWAYS pass authOptions
```

### API Route Pattern
```typescript
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
```

### Calendar Sync Pattern
```typescript
// Fire-and-forget — never blocks, never throws
syncLabAssignment({ ... }).catch(() => {});
```

### Roles (highest to lowest)
`superadmin` > `admin` > `program_director` > `lead_instructor` > `instructor` > `volunteer_instructor` > `student` = `guest` > `pending`

---

## Active Work Items

- **Testing**: No automated tests yet (highest priority debt)
- **LVFR AEMT**: Additional program track support (pending business need)
- **RFID**: Station attendance via RFID (pending hardware)

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
| `lib/auth.ts` | NextAuth config, sign-in callback, user provisioning |
| `lib/permissions.ts` | Role hierarchy, RBAC helpers, FERPA data permissions |
| `lib/supabase.ts` | Supabase client factory (`getSupabase`, `getSupabaseAdmin`) |
| `lib/google-calendar.ts` | Google Calendar sync functions (fire-and-forget) |
| `lib/calendar-availability.ts` | FreeBusy API integration (multi-calendar) |
| `lib/audit.ts` | FERPA audit logging |
| `lib/notifications.ts` | Notification creation helpers |
| `lib/export-utils.ts` | Excel/PDF export utilities |
| `scripts/check-fk-ambiguity.js` | FK disambiguation checker |
| `scripts/run-migration.js` | Database migration runner |
| `vercel.json` | Cron job definitions |

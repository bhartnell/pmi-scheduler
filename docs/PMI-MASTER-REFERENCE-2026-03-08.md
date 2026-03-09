# PMI EMS Scheduler — Master Reference

> Updated: March 8, 2026

---

## System Overview

The PMI EMS Scheduler is a comprehensive scheduling and management system for the Pima Medical Institute Paramedic Program. It handles lab management, clinical tracking, student onboarding, scheduling polls, OSCE assessments, case studies, calendar integration, and more.

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router), React 19, TypeScript 5 |
| Database | Supabase (PostgreSQL), direct client queries (no ORM) |
| Auth | NextAuth.js 4, Google OAuth, restricted to @pmi.edu |
| Styling | Tailwind CSS 4, Lucide React icons, next-themes (dark mode) |
| Email | Resend (transactional), html2pdf.js (PDF exports) |
| Calendar | Google Calendar API v3 (FreeBusy, Events, CalendarList) |
| AI | OpenAI API (case generation, scenario content) |
| Export | xlsx (Excel), html2pdf.js (PDF), ICS (calendar) |
| Deployment | Vercel (frontend + cron) + Supabase (database) |

---

## Major Features

### Lab Management
- Lab day scheduling with station/role assignments
- Scenario library with EMS content
- Student assessments and grading
- Timer system (single active timer, quick display mode)
- Equipment tracking
- Coverage tag system for Google Calendar

### Clinical Tracking
- Internship placements and preceptor management
- Clinical site visits with check-in/out
- Clinical hours tracking and alerts
- Site visit Google Calendar sync (Phase 4)

### OSCE (Objective Structured Clinical Examination)
- Event-based OSCE management (multi-event support)
- Block scheduling with station assignments
- Observer signup and management
- Public signup pages with calendar invites
- Schedule alignment views

### Case Study Application
- Case library with practice mode
- Phase-based case progression
- Classroom sessions with realtime participation
- Instructor control panel + TV display
- AI-powered case generation (42+ brief catalog)
- Coverage dashboard and prompt editor

### Scheduling
- Scheduling polls with availability collection
- Part-timer shift management with calendar view
- Open shift coordination dashboard
- Google Calendar FreeBusy availability checking

### Google Calendar Integration (Phases 1-4)
- **Phase 1**: OAuth setup, calendar settings page
- **Phase 2**: Calendar availability badges on instructor picker
- **Phase 3**: Lab assignment sync, shift sync, admin bulk sync
- **Phase 4**: Multi-calendar availability, site visit sync, Google overlay, admin dashboard, auto-sync cron

### Student Portal
- Self-service student dashboard
- Skill sheet tracking
- Lab history
- Participation via classroom sessions

### Gamification
- Achievement badges
- Leaderboards
- Activity statistics

### Reporting
- 5 report views (analytics dashboards)
- Print views for key pages
- Excel and PDF export
- Scheduled automated exports (weekly/monthly cron)

### Admin
- User management with role assignment
- Audit logs (FERPA compliance)
- Announcements system
- Access request approval workflow
- Calendar sync status dashboard
- Onboarding track management

---

## Database Tables (by Feature Area)

### Authentication & Users
- `lab_users` — All application users (instructors, students, guests)
- `accounts` — NextAuth OAuth accounts
- `sessions` — NextAuth sessions
- `verification_tokens` — NextAuth email verification
- `user_preferences` — Per-user preference JSON blobs
- `dashboard_layouts` — Per-user dashboard widget layout

### Cohort & Student Management
- `cohorts` — Student cohort groups
- `students` — Student records (FERPA-protected)
- `student_documents` — Uploaded student documents

### Lab Management
- `lab_days` — Scheduled lab sessions
- `lab_day_roles` — Instructor role assignments per lab day
- `lab_stations` — Station definitions within a lab day
- `scenarios` — EMS scenario library
- `scenario_assessments` — Student assessment records
- `lab_day_attendance` — Student attendance
- `lab_day_equipment` — Equipment tracking per lab day
- `skill_sheets` — Skill sheet definitions
- `student_skill_completions` — Student skill sign-offs

### Clinical
- `internships` — Student clinical internship placements
- `preceptors` — Field preceptor records
- `clinical_site_visits` — Site visit logs
- `clinical_hours` — Clinical hours tracking
- `clinical_sites` — Clinical site directory

### Scheduling
- `polls` — Scheduling poll definitions
- `poll_submissions` — Poll response submissions
- `scheduling_shifts` — Open shift definitions
- `availability` — Instructor availability entries
- `shift_signups` — Shift signup records

### OSCE
- `osce_events` — Parent OSCE event definitions
- `osce_blocks` — Time blocks within events
- `osce_stations` — Station assignments within blocks
- `osce_observers` — Observer signups
- `osce_student_assignments` — Student station assignments

### Case Studies
- `case_studies` — Case definitions
- `case_study_questions` — Questions within cases
- `case_study_phases` — Phase definitions
- `case_study_attempts` — Student attempt records
- `case_study_responses` — Individual question responses
- `classroom_sessions` — Realtime classroom instances
- `classroom_participants` — Session participants
- `case_briefs` — AI-generated case briefs
- `ai_prompt_templates` — AI prompt templates

### Calendar
- `google_calendar_events` — Maps PMI source records to Google Calendar event IDs
- `calendar_sync_log` — Cron reconciliation results

### Gamification
- `achievements` — Achievement definitions
- `user_achievements` — Earned achievements
- `user_stats` — Aggregated statistics

### System
- `audit_log` — FERPA compliance audit trail
- `notifications_log` — In-app notification records
- `tasks` — Instructor task assignments
- `onboarding_tracks` — Onboarding task track definitions
- `onboarding_assignments` — Onboarding track assignments
- `announcements` — Admin announcements
- `feedback` — User feedback submissions
- `access_cards` — RFID access cards (future)
- `access_devices` — RFID reader devices (future)
- `access_logs` — RFID access logs (future)

---

## Role Hierarchy

| Role | Level | Description |
|------|-------|-------------|
| `superadmin` | 5 | Full system access including audit logs and system settings |
| `admin` | 4 | User management, announcements, all content |
| `program_director` | 3.5 | Program oversight, clinical access, reporting |
| `lead_instructor` | 3 | Cohort management, student roster, clinical, content management |
| `instructor` | 2 | Lab management, scenario creation, student assessment |
| `volunteer_instructor` | 1.5 | Read-only lab schedule and scheduling features; no student data |
| `student` | 1 | Student portal only |
| `guest` | 1 | Guest instructor access (directory info only) |
| `pending` | 0 | Awaiting approval; minimal access |

---

## Code Patterns

### API Route Auth Pattern
```typescript
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';

const session = await getServerSession(authOptions);
if (!session?.user?.email) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
// For role-restricted routes:
// const { requireRole } = await import('@/lib/permissions');
// requireRole(session, 'admin');
```

### Supabase FK Disambiguation
```typescript
// When table has multiple FK paths to another table:
.select('*, cohort:cohorts!students_cohort_id_fkey(id, cohort_number)')
// NOT:
.select('*, cohort:cohorts(id, cohort_number)')  // Ambiguous!
```

### Fire-and-Forget Calendar Sync
```typescript
import { syncLabAssignment } from '@/lib/google-calendar';
syncLabAssignment({ ... }).catch(() => {});  // Never blocks, never throws
```

### React Query Hooks (Task 76)
```typescript
import { useLabDays } from '@/hooks/useLabDays';
const { data, isLoading, error } = useLabDays(filters);
```

---

## File Structure

```
app/
  api/              # 447 API route handlers
    admin/          # Admin management, access requests, calendar sync
    calendar/       # Calendar data, Google events, availability
    cases/          # Case study CRUD, practice, classroom
    clinical/       # Internships, preceptors, site visits, hours
    cron/           # 15 scheduled tasks
    lab-management/ # Lab days, stations, scenarios, assessments
    osce/           # OSCE events, blocks, observers
    ...
  admin/            # Admin panel pages
  calendar/         # Unified calendar view
  cases/            # Case study pages
  clinical/         # Clinical tracking pages
  lab-management/   # Lab scheduling pages
  osce/             # OSCE management pages
  scheduler/        # Scheduling poll pages
  scheduling/       # Part-timer shift pages
  settings/         # User settings
  student/          # Student portal
  ...

components/         # 122 reusable React components
lib/                # 30 utility modules
types/              # TypeScript type definitions
hooks/              # Custom React hooks
supabase/
  migrations/       # 171 SQL migration files
scripts/
  run-migration.js  # Migration runner (pg client → Supabase)
  check-fk-ambiguity.js  # FK disambiguation checker
docs/               # Auto-generated documentation
```

---

## Deployment

- **Repository**: GitHub (`bhartnell/pmi-scheduler`)
- **Frontend**: Vercel (auto-deploy from `main` branch)
- **Database**: Supabase (us-west-2 region)
- **Cron**: Vercel Cron (defined in `vercel.json`)
- **Environment**: `.env.local` for local dev, Vercel environment variables for production
- **Workflow**: Direct-to-main (no feature branches or PRs)

### Key Environment Variables
- `NEXTAUTH_SECRET` — NextAuth session encryption
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — OAuth
- `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` — Database
- `SUPABASE_DB_URL` — Direct PostgreSQL connection (migrations)
- `CRON_SECRET` — Vercel cron authentication
- `RESEND_API_KEY` — Email delivery
- `OPENAI_API_KEY` — AI case generation

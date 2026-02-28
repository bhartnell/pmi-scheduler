# Architecture

This document describes the system architecture of the PMI EMS Scheduler.

---

## Folder Structure

```
app/
  api/              # Next.js API route handlers (server-side only)
    admin/          # Admin user management, announcements, access requests
    cron/           # Scheduled tasks run by Vercel cron
    clinical/       # Clinical internship, preceptor, site visit endpoints
    lab-management/ # Lab days, scenarios, stations, assessments
    notifications/  # Notification read/dismiss endpoints
    onboarding/     # Onboarding assignment and progress endpoints
    polls/          # Scheduling poll creation and response
    reports/        # Report generation and scheduled exports
    scheduling/     # Shift availability and open shift management
    search/         # Global search endpoint
    students/       # Student records and cohort management
    tasks/          # Task creation and assignment
    user/           # User preferences and profile
    ...

  admin/            # Admin panel pages (users, roles, announcements, audit logs)
  calendar/         # Unified calendar view (lab days + shifts)
  clinical/         # Clinical & internship tracking pages
  instructor/       # Instructor certifications, CE hours, teaching log
  lab-management/   # Lab scheduling, scenarios, student assessments
  onboarding/       # Instructor onboarding workflow
  reports/          # Program reporting and data export
  scheduler/        # Scheduling poll pages
  scheduling/       # Part-timer shift management pages
  student/          # Student self-service portal
  auth/             # Sign-in page
  guest/            # Guest instructor access (no auth required)
  request-access/   # Volunteer instructor self-service signup

components/         # Reusable React components (client-side)
  dashboard/        # Dashboard widget components and customization modal
  ui/               # Base UI primitives (SkeletonCard, SkeletonStats, etc.)
  *.tsx             # Feature-level shared components

lib/                # Shared server and client utilities
  auth.ts           # NextAuth config, sign-in callback, user provisioning
  permissions.ts    # Role-based access control helpers and FERPA data permissions
  audit.ts          # FERPA audit logging (logAuditEvent and convenience wrappers)
  supabase.ts       # Supabase client factory
  notifications.ts  # Notification creation and delivery helpers
  export-utils.ts   # Excel (xlsx) and PDF (html2pdf.js) export helpers
  email.ts          # Transactional email dispatch via Resend
  email-templates.ts# HTML email template builders
  validation.ts     # Shared input validation helpers
  rate-limit.ts     # Simple in-memory API rate limiter
  ics-export.ts     # iCalendar (.ics) file generation
  endorsements.ts   # Instructor endorsement helpers

types/              # TypeScript type definitions
  index.ts          # CurrentUserMinimal and other shared types
  user.ts           # User and role types
  student.ts        # Student record interfaces
  scheduling.ts     # Scheduling domain types (shifts, availability)
  lab-management.ts # Lab day, scenario, station types
  tasks.ts          # Task management types

supabase/
  migrations/       # SQL migration files applied to the Supabase database
```

---

## Next.js App Router Patterns

### Page Components

Pages in `app/` are React Client Components. The `'use client'` directive appears at the top of every page file. Data is loaded at runtime by `useEffect` calling internal API routes. Server Components are not used for application pages — this keeps the data-fetching pattern consistent and avoids hydration complexity.

```typescript
'use client';

import { useEffect, useState } from 'react';

export default function ExamplePage() {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch('/api/example').then(r => r.json()).then(setData);
  }, []);

  return <div>{/* render data */}</div>;
}
```

### API Routes

API routes in `app/api/` run server-side and have access to environment variables. All routes follow the same structure: authenticate the session, check permissions, query Supabase, return JSON.

Routes use `getSupabaseAdmin()` (service role key) — never the public anon client — so that Row-Level Security does not block server-side queries.

---

## Authentication Flow

1. The user clicks "Sign in with Google" on the landing page.
2. NextAuth.js redirects to Google OAuth. The requested scopes include Calendar and Gmail Send (used for optional calendar integration).
3. Google redirects back to `/api/auth/callback/google` with an authorization code.
4. NextAuth's `signIn` callback fires. The logic in `lib/auth.ts` handles three cases:

   | User type | Outcome |
   |---|---|
   | Existing approved user (any email) | Allowed through immediately |
   | New `@my.pmi.edu` student email | Auto-created with `student` role |
   | New `@pmi.edu` instructor email | Created with `pending` role; admins notified |
   | Non-PMI email with no existing account | Allowed through to reach `/request-access` |

5. After sign-in, the application calls `/api/instructor/me` to fetch the full user record (role, preferences, etc.).
6. Users with `pending` role see an "Access Pending" screen. Users with no role record are redirected to `/request-access`.

Access tokens and refresh tokens are stored in the JWT and attached to the NextAuth session object for use by Google API integrations (Calendar, Gmail).

---

## Role Hierarchy

Roles are defined in `lib/permissions.ts` with numeric levels that determine access:

| Role | Level | Description |
|---|---|---|
| `superadmin` | 5 | Full system access including audit logs and system settings |
| `admin` | 4 | User management, announcements, all content |
| `lead_instructor` | 3 | Cohort management, student roster, clinical access, content management |
| `instructor` | 2 | Lab management, scenario creation, student assessment |
| `volunteer_instructor` | 1.5 | Read-only lab schedule and scheduling features; no student data |
| `student` | 1 | Student portal only |
| `guest` | 1 | Guest instructor access (directory info only) |
| `pending` | 0 | Awaiting approval; minimal access |

Permission checks use helpers rather than direct role comparisons:

```typescript
import { canAccessAdmin, hasMinRole, canAccessClinical } from '@/lib/permissions';

// Check a minimum level
if (!hasMinRole(user.role, 'instructor')) { /* deny */ }

// Check a specific capability
if (canAccessAdmin(user.role)) { /* show admin nav */ }
```

### FERPA Data Permissions

Student records contain FERPA-protected data. `lib/permissions.ts` exports a `DATA_PERMISSIONS` map and a `canAccessData()` helper that controls which roles may see which fields:

| Data field | Minimum role |
|---|---|
| Name, cohort, status (directory info) | `guest` |
| Email | `lead_instructor` |
| Agency / employer | `instructor` |
| Learning style, performance notes, assessments | `instructor` |
| Full export | `lead_instructor` |
| Audit logs | `superadmin` |

The `sanitizeStudentForRole()` function strips fields the requesting user is not permitted to see before data is returned from API routes.

---

## Database

The application uses **Supabase** (hosted PostgreSQL) with direct SQL queries via the `@supabase/supabase-js` client. There is no ORM.

### Client Factory

`lib/supabase.ts` exports two functions:

```typescript
// Public anon client - for client-side use only (respects RLS)
getSupabase(): SupabaseClient

// Service role client - for API routes only (bypasses RLS)
getSupabaseAdmin(): SupabaseClient
```

API routes always use `getSupabaseAdmin()`. The anon client is used only in components that directly query Supabase (rare — most data flows through API routes).

### Migrations

Schema changes are managed as plain SQL files in `supabase/migrations/`. Files are named `YYYYMMDD_description.sql` and applied in chronological order.

Every migration:
- Uses `IF NOT EXISTS` / `IF EXISTS` to be safely re-runnable
- Enables Row-Level Security on new tables
- Defines at least a service-role policy granting full access
- Adds indexes for columns used in WHERE clauses, ORDER BY, or joins

### Core Tables

| Table | Purpose |
|---|---|
| `lab_users` | All application users (instructors, students, guests) |
| `cohorts` | Student cohort groups |
| `students` | Student records (FERPA-protected) |
| `lab_days` | Scheduled lab sessions |
| `scenarios` | EMS scenario library |
| `lab_stations` | Station assignments within a lab day |
| `scenario_assessments` | Student assessment records |
| `internships` | Student clinical internship placements |
| `preceptors` | Field preceptor records |
| `clinical_site_visits` | Site visit logs |
| `audit_log` | FERPA compliance audit trail |
| `notifications_log` | In-app notification records |
| `tasks` | Instructor task assignments |
| `polls` | Scheduling poll records |
| `poll_submissions` | Poll response submissions |
| `scheduling_shifts` | Open shift definitions |
| `availability` | Instructor availability entries |
| `user_preferences` | Per-user preference JSON blobs |
| `dashboard_layouts` | Per-user dashboard widget layout |
| `onboarding_tracks` | Onboarding task track definitions |
| `onboarding_assignments` | Onboarding track assignments to users |

---

## API Patterns

### Standard Route Shape

```typescript
// app/api/feature/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('example_table')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, data });
}
```

### Dynamic Route Segments

```
app/api/students/[id]/route.ts   →  /api/students/abc123
```

The segment value is accessed via `params`:

```typescript
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  // ...
}
```

### URL Search Parameters

```typescript
const { searchParams } = new URL(request.url);
const cohortId = searchParams.get('cohortId');
```

---

## Cron Jobs

Scheduled tasks are defined in `vercel.json` and run as standard Next.js API routes under `app/api/cron/`. Vercel calls these endpoints on the configured schedule.

| Route | Schedule | Purpose |
|---|---|---|
| `/api/cron/daily-digest` | Daily at 14:00 UTC | Send daily summary notifications |
| `/api/cron/attendance-alerts` | Daily at 14:00 UTC | Alert on attendance issues |
| `/api/cron/lab-reminder` | Daily at 17:00 UTC | Upcoming lab reminders |
| `/api/cron/availability-reminders` | Mondays at 13:00 UTC | Prompt instructors to set availability |
| `/api/cron/clinical-hours-reminder` | Mondays at 09:00 UTC | Clinical hours completion reminders |
| `/api/cron/compliance-expiry` | Daily at 08:00 UTC | Compliance document expiry warnings |
| `/api/cron/cert-expiry` | Mondays at 08:00 UTC | Certification expiry warnings |
| `/api/cron/internship-milestones` | Daily at 09:00 UTC | Internship milestone notifications |
| `/api/cron/scheduled-exports` | Sundays 06:00 UTC, 1st of month 06:00 UTC | Automated report exports |
| `/api/cron/system-health` | Hourly | System health monitoring |

Cron routes authenticate using the `CRON_SECRET` environment variable (set in Vercel). They are not protected by NextAuth since they are called by Vercel, not a browser.

---

## Key Shared Components

| Component | Purpose |
|---|---|
| `CommandPalette` | Ctrl+K global search and navigation |
| `NotificationBell` | In-app notification indicator and dropdown |
| `GlobalTimerBanner` | Live lab timer banner visible across all pages |
| `OnboardingTourWrapper` | First-time user guided tour overlay |
| `ActivityTracker` | Tracks user activity for session management |
| `OfflineProvider` | Detects network state; shows `OfflineBanner` when offline |
| `ThemeToggle` | Light/dark/system theme switcher |
| `ErrorBoundary` / `PageErrorBoundary` | React error boundaries for graceful failure |
| `Toast` / `useToast` | Global toast notification system |
| `LoadingSpinner` / `LoadingSkeleton` | Loading state UI components |
| `ExportDropdown` | Reusable Excel/PDF export button |
| `FeedbackButton` | Floating feedback submission button |
| `QuickActionsMenu` | Context-sensitive quick action floating menu |

---

## Global Providers

`app/providers.tsx` wraps the application in three context providers:

```
SessionProvider (NextAuth)
  ThemeProvider (next-themes: light/dark/system)
    ToastProvider (global toast notifications)
```

Additional infrastructure components are mounted directly in `app/layout.tsx`:

- `OfflineProvider` — network status detection
- `GlobalTimerBanner` — lab timer overlay
- `ActivityTracker` — session activity
- `OnboardingTourWrapper` — first-time tour
- `FeedbackButton` — feedback widget
- `QuickActionsMenu` — quick actions
- `CommandPalette` — search
- `ServiceWorkerRegistration` — PWA support

---

## PWA Support

The application includes Progressive Web App support via a service worker registered by `ServiceWorkerRegistration`. A `public/manifest.json` and theme-color meta tag are configured in `app/layout.tsx`. The service worker provides basic offline capability for cached pages.

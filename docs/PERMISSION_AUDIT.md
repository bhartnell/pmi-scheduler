# PMI EMS Scheduler -- Permission Audit

> Auto-generated from codebase scan -- March 8, 2026

## Summary

| Metric | Count |
|--------|-------|
| Total API routes scanned | 447 |
| Routes with proper auth (getServerSession/requireAuth + role check) | 360 |
| Routes with session-only auth (no role check) | 60 |
| Routes with bare getServerSession() (no authOptions) | 0 |
| Routes with NO auth | 7 |
| Public/cron/token routes (intentionally unauthenticated) | 20 |

## Findings by Severity

### CRITICAL: No Auth or Missing authOptions

Found **7** route(s) with critical auth issues:

| Route | Methods | Issue | File |
|-------|---------|-------|------|
| `/api/case-sessions/[code]` | GET | NO AUTH FOUND | `app/api/case-sessions/[code]/route.ts` |
| `/api/case-sessions/[code]/leaderboard` | GET | NO AUTH FOUND | `app/api/case-sessions/[code]/leaderboard/route.ts` |
| `/api/lab-management/scenario-library/favorites` | DELETE, POST | NO AUTH FOUND | `app/api/lab-management/scenario-library/favorites/route.ts` |
| `/api/osce/public/[slug]` | GET | NO AUTH FOUND | `app/api/osce/public/[slug]/route.ts` |
| `/api/osce/public/[slug]/register` | POST | NO AUTH FOUND | `app/api/osce/public/[slug]/register/route.ts` |
| `/api/osce/register` | POST | NO AUTH FOUND | `app/api/osce/register/route.ts` |
| `/api/osce/time-blocks` | GET | NO AUTH FOUND | `app/api/osce/time-blocks/route.ts` |

### WARNING: Session-Only (No Role Check)

These routes verify the user is logged in but do not check their role. Any authenticated user can access them.

Found **60** route(s) with session auth but no role verification:

| Route | Methods | Auth Pattern | File |
|-------|---------|-------------|------|
| `/api/access-requests` | GET, POST | getServerSession(authOptions) | `app/api/access-requests/route.ts` |
| `/api/access-requests/[id]` | PUT | getServerSession(authOptions) | `app/api/access-requests/[id]/route.ts` |
| `/api/admin/user-activity/log` | POST | getServerSession(authOptions) | `app/api/admin/user-activity/log/route.ts` |
| `/api/announcements/[id]/read` | POST | getServerSession(authOptions) | `app/api/announcements/[id]/read/route.ts` |
| `/api/calendar/calendars` | GET, PUT | requireAuth | `app/api/calendar/calendars/route.ts` |
| `/api/calendar/callback` | GET | getServerSession(authOptions) | `app/api/calendar/callback/route.ts` |
| `/api/calendar/connect` | DELETE, GET | requireAuth | `app/api/calendar/connect/route.ts` |
| `/api/calendar/google-events` | GET | requireAuth | `app/api/calendar/google-events/route.ts` |
| `/api/calendar/status` | GET | requireAuth | `app/api/calendar/status/route.ts` |
| `/api/case-sessions/[code]/join` | POST | getServerSession(authOptions) | `app/api/case-sessions/[code]/join/route.ts` |
| `/api/case-sessions/[code]/respond` | POST | getServerSession(authOptions) | `app/api/case-sessions/[code]/respond/route.ts` |
| `/api/cases/[id]/practice/complete` | POST | getServerSession(authOptions) | `app/api/cases/[id]/practice/complete/route.ts` |
| `/api/cases/[id]/practice/history` | GET | getServerSession(authOptions) | `app/api/cases/[id]/practice/history/route.ts` |
| `/api/cases/[id]/practice/progress` | GET | getServerSession(authOptions) | `app/api/cases/[id]/practice/progress/route.ts` |
| `/api/cases/[id]/practice/respond` | PUT | getServerSession(authOptions) | `app/api/cases/[id]/practice/respond/route.ts` |
| `/api/cases/[id]/practice/start` | POST | getServerSession(authOptions) | `app/api/cases/[id]/practice/start/route.ts` |
| `/api/cases/achievements/check` | POST | getServerSession(authOptions) | `app/api/cases/achievements/check/route.ts` |
| `/api/cases/leaderboard/[cohortId]` | GET | getServerSession(authOptions) | `app/api/cases/leaderboard/[cohortId]/route.ts` |
| `/api/clinical/affiliations` | DELETE, GET, POST, PUT | getServerSession(authOptions) | `app/api/clinical/affiliations/route.ts` |
| `/api/dashboard/cert-expiry` | GET | getServerSession(authOptions) | `app/api/dashboard/cert-expiry/route.ts` |
| `/api/dashboard/layout` | DELETE, GET, PUT | getServerSession(authOptions) | `app/api/dashboard/layout/route.ts` |
| `/api/dashboard/recent-activity` | GET | getServerSession(authOptions) | `app/api/dashboard/recent-activity/route.ts` |
| `/api/deep-links/qr` | GET | getServerSession(authOptions) | `app/api/deep-links/qr/route.ts` |
| `/api/errors/log` | POST | getServerSession(authOptions) | `app/api/errors/log/route.ts` |
| `/api/feedback/my-submissions` | GET | getServerSession(authOptions) | `app/api/feedback/my-submissions/route.ts` |
| `/api/instructor/me` | GET | getServerSession(authOptions) | `app/api/instructor/me/route.ts` |
| `/api/instructor/upcoming-labs` | GET | getServerSession(authOptions) | `app/api/instructor/upcoming-labs/route.ts` |
| `/api/notifications/archive` | PUT | getServerSession(authOptions) | `app/api/notifications/archive/route.ts` |
| `/api/notifications/digest-preview` | GET | getServerSession(authOptions) | `app/api/notifications/digest-preview/route.ts` |
| `/api/notifications/email-preferences` | GET, PUT | getServerSession(authOptions) | `app/api/notifications/email-preferences/route.ts` |
| `/api/notifications/read` | PUT | getServerSession(authOptions) | `app/api/notifications/read/route.ts` |
| `/api/onboarding/templates` | GET | getServerSession(authOptions) | `app/api/onboarding/templates/route.ts` |
| `/api/polls` | DELETE, GET, POST | getServerSession(authOptions) | `app/api/polls/route.ts` |
| `/api/scheduling/availability` | GET, POST | getServerSession(authOptions) | `app/api/scheduling/availability/route.ts` |
| `/api/scheduling/availability/[id]` | DELETE, PUT | getServerSession(authOptions) | `app/api/scheduling/availability/[id]/route.ts` |
| `/api/scheduling/availability/bulk` | DELETE, POST | getServerSession(authOptions) | `app/api/scheduling/availability/bulk/route.ts` |
| `/api/scheduling/availability/suggestions` | GET | getServerSession(authOptions) | `app/api/scheduling/availability/suggestions/route.ts` |
| `/api/scheduling/part-timer-status` | GET | getServerSession(authOptions) | `app/api/scheduling/part-timer-status/route.ts` |
| `/api/scheduling/reports` | GET | getServerSession(authOptions) | `app/api/scheduling/reports/route.ts` |
| `/api/scheduling/shifts/[id]/signup` | DELETE, POST | getServerSession(authOptions) | `app/api/scheduling/shifts/[id]/signup/route.ts` |
| `/api/scheduling/swaps/[id]/interest` | DELETE, GET, POST | getServerSession(authOptions) | `app/api/scheduling/swaps/[id]/interest/route.ts` |
| `/api/scheduling/team-availability` | GET, POST | getServerSession(authOptions) | `app/api/scheduling/team-availability/route.ts` |
| `/api/scheduling/team-availability/saved` | DELETE, GET | getServerSession(authOptions) | `app/api/scheduling/team-availability/saved/route.ts` |
| `/api/search` | GET | getServerSession(authOptions) | `app/api/search/route.ts` |
| `/api/settings/2fa/disable` | POST | getServerSession(authOptions) | `app/api/settings/2fa/disable/route.ts` |
| `/api/settings/2fa/setup` | POST | getServerSession(authOptions) | `app/api/settings/2fa/setup/route.ts` |
| `/api/settings/2fa/status` | GET | getServerSession(authOptions) | `app/api/settings/2fa/status/route.ts` |
| `/api/settings/2fa/verify` | POST | getServerSession(authOptions) | `app/api/settings/2fa/verify/route.ts` |
| `/api/settings/calendar-sync` | GET, PUT | requireAuth | `app/api/settings/calendar-sync/route.ts` |
| `/api/settings/notifications` | GET, PUT | getServerSession(authOptions) | `app/api/settings/notifications/route.ts` |
| `/api/settings/sessions` | GET, POST | getServerSession(authOptions) | `app/api/settings/sessions/route.ts` |
| `/api/settings/sessions/[id]` | DELETE | getServerSession(authOptions) | `app/api/settings/sessions/[id]/route.ts` |
| `/api/settings/sessions/revoke-all` | POST | getServerSession(authOptions) | `app/api/settings/sessions/revoke-all/route.ts` |
| `/api/students` | GET | getServerSession(authOptions) | `app/api/students/route.ts` |
| `/api/tasks` | GET, POST | getServerSession(authOptions) | `app/api/tasks/route.ts` |
| `/api/tasks/[id]` | DELETE, GET, PATCH | getServerSession(authOptions) | `app/api/tasks/[id]/route.ts` |
| `/api/tasks/[id]/comments` | GET, POST | getServerSession(authOptions) | `app/api/tasks/[id]/comments/route.ts` |
| `/api/tasks/bulk` | DELETE, PATCH | getServerSession(authOptions) | `app/api/tasks/bulk/route.ts` |
| `/api/timer-display` | DELETE, GET, PATCH, POST | getServerSession(authOptions) | `app/api/timer-display/route.ts` |
| `/api/user-preferences/tour` | GET, POST | getServerSession(authOptions) | `app/api/user-preferences/tour/route.ts` |

### Properly Secured Routes

**360** routes have proper session auth with role checks.

## Routes by Minimum Role Required

### superadmin (7 routes)

| Route | Methods | Auth Pattern |
|-------|---------|-------------|
| `/api/admin/audit-log` | DELETE, GET | getServerSession(authOptions) + isSuperadmin |
| `/api/admin/database-tools/audit-logs` | DELETE, GET | getServerSession(authOptions) + isSuperadmin |
| `/api/admin/database-tools/cohorts` | GET, PATCH | getServerSession(authOptions) + isSuperadmin |
| `/api/admin/database-tools/notifications` | DELETE, GET | getServerSession(authOptions) + isSuperadmin |
| `/api/admin/database-tools/orphans` | DELETE, GET | getServerSession(authOptions) + isSuperadmin |
| `/api/admin/database-tools/stats` | GET | getServerSession(authOptions) + isSuperadmin |
| `/api/admin/stats` | GET | getServerSession(authOptions) + role check (superadmin) |

### admin (110 routes)

| Route | Methods | Auth Pattern |
|-------|---------|-------------|
| `/api/access-requests/status` | GET | getServerSession(authOptions) + hasMinRole(admin) |
| `/api/admin/alumni` | GET, POST | requireAuth + requireAuth('admin') |
| `/api/admin/alumni/[id]` | DELETE, GET, PUT | requireAuth + requireAuth('admin') |
| `/api/admin/attendance-appeals` | GET | requireAuth + requireAuth('admin') |
| `/api/admin/attendance-appeals/[id]` | PUT | requireAuth + requireAuth('admin') |
| `/api/admin/broadcast` | GET, POST | requireAuth + requireAuth('admin') |
| `/api/admin/broadcast/history` | GET | requireAuth + requireAuth('admin') |
| `/api/admin/bulk-operations` | GET, POST | requireAuth + requireAuth('admin') |
| `/api/admin/bulk-operations/[id]/rollback` | POST | requireAuth + requireAuth('admin') |
| `/api/admin/calendar-sync` | POST | requireAuth + requireAuth('admin') |
| `/api/admin/calendar-sync/remind` | POST | requireAuth + requireAuth('admin') |
| `/api/admin/calendar-sync/status` | GET | requireAuth + requireAuth('admin') |
| `/api/admin/cases/briefs` | GET, POST | requireAuth + requireAuth('admin') |
| `/api/admin/cases/coverage` | GET | requireAuth + requireAuth('admin') |
| `/api/admin/cases/prompt-template` | GET, PUT | requireAuth + requireAuth('admin') |
| `/api/admin/cases/seed-briefs` | POST | requireAuth + requireAuth('admin') |
| `/api/admin/cases/seed-prompt` | POST | requireAuth + requireAuth('admin') |
| `/api/admin/cases/seed-samples` | POST | requireAuth + requireAuth('admin') |
| `/api/admin/certification-compliance` | GET | requireAuth + requireAuth('admin') |
| `/api/admin/certifications` | GET | requireAuth + requireAuth('admin') |
| `/api/admin/certifications/import` | POST | requireAuth + requireAuth('admin') |
| `/api/admin/certifications/verify` | PUT | requireAuth + requireAuth('admin') |
| `/api/admin/config` | GET, PUT | requireAuth + requireAuth('admin') |
| `/api/admin/dashboard-defaults` | GET, PUT | getServerSession(authOptions) + hasMinRole(admin, admin) |
| `/api/admin/data-export` | GET, POST | requireAuth + requireAuth('admin') |
| `/api/admin/data-import/execute` | POST | requireAuth + requireAuth('admin') |
| `/api/admin/data-import/history` | GET | requireAuth + requireAuth('admin') |
| `/api/admin/data-import/preview` | POST | requireAuth + requireAuth('admin') |
| `/api/admin/deletion-requests` | GET, PATCH, POST | requireAuth + requireAuth('admin') |
| `/api/admin/document-requests` | GET, POST | requireAuth + requireAuth('admin') |
| `/api/admin/document-requests/[id]` | PUT | requireAuth + requireAuth('admin') |
| `/api/admin/email-stats` | GET | requireAuth + requireAuth('admin') |
| `/api/admin/email-templates` | DELETE, GET, PUT | requireAuth + requireAuth('admin') |
| `/api/admin/email-templates/test` | POST | requireAuth + requireAuth('admin') |
| `/api/admin/endorsements` | DELETE, GET, POST | requireAuth + getServerSession(authOptions) + requireAuth('admin') |
| `/api/admin/equipment` | DELETE, GET, PATCH, POST | requireAuth + requireAuth('admin') |
| `/api/admin/equipment/checkout` | GET, POST, PUT | requireAuth + requireAuth('admin') |
| `/api/admin/equipment/maintenance` | GET, POST | requireAuth + requireAuth('admin') |
| `/api/admin/equipment/maintenance/[id]` | DELETE, PUT | requireAuth + requireAuth('admin') |
| `/api/admin/feedback/import` | POST | getServerSession(authOptions) + role check (admin, superadmin) |
| `/api/admin/incidents` | GET, POST | requireAuth + requireAuth('admin') |
| `/api/admin/incidents/[id]` | GET, PUT | requireAuth + requireAuth('admin') |
| `/api/admin/lab-templates/apply` | POST | requireAuth + requireAuth('admin') |
| `/api/admin/lab-templates/import` | POST | requireAuth + requireAuth('admin') |
| `/api/admin/lab-templates/seed` | POST | requireAuth + requireAuth('admin') |
| `/api/admin/lab-templates/update-from-lab` | POST | requireAuth + requireAuth('admin') |
| `/api/admin/program-requirements` | GET, POST | getServerSession(authOptions) + hasMinRole(admin, admin) |
| `/api/admin/rubrics` | GET, POST | requireAuth + requireAuth('admin') |
| `/api/admin/rubrics/[id]` | DELETE, GET, PUT | requireAuth + requireAuth('admin') |
| `/api/admin/scenarios/audit` | GET | requireAuth + requireAuth('admin') |
| `/api/admin/scenarios/auto-fill` | POST | requireAuth + requireAuth('admin') |
| `/api/admin/scenarios/bulk-import` | POST | requireAuth + requireAuth('admin') |
| `/api/admin/scenarios/bulk-import/commit` | POST | requireAuth + requireAuth('admin') |
| `/api/admin/scenarios/generate-content` | GET, POST | requireAuth + requireAuth('admin') |
| `/api/admin/scenarios/transform` | GET, POST | requireAuth + requireAuth('admin') |
| `/api/admin/scheduled-exports` | GET, POST | requireAuth + requireAuth('admin') |
| `/api/admin/scheduled-exports/[id]` | DELETE, PUT | requireAuth + requireAuth('admin') |
| `/api/admin/skill-drills/seed` | POST | requireAuth + requireAuth('admin') |
| `/api/admin/skill-sheets/counts` | GET | requireAuth + requireAuth('admin') |
| `/api/admin/skill-sheets/import` | POST | requireAuth + requireAuth('admin') |
| `/api/admin/skill-sheets/seed-aliases` | POST | requireAuth + requireAuth('admin') |
| `/api/admin/skill-sheets/seed-canonical` | POST | requireAuth + requireAuth('admin') |
| `/api/admin/skill-sheets/verify` | GET | requireAuth + requireAuth('admin') |
| `/api/admin/system-alerts` | GET, PATCH | requireAuth + requireAuth('admin') |
| `/api/admin/system-health` | GET | getServerSession(authOptions) + hasMinRole(admin) |
| `/api/admin/user-activity` | GET | requireAuth + requireAuth('admin') |
| `/api/admin/users` | DELETE, GET, PATCH, POST | requireAuth + requireAuth('admin') |
| `/api/admin/webhooks` | GET, POST | requireAuth + requireAuth('admin') |
| `/api/admin/webhooks/[id]` | DELETE, GET, PUT | requireAuth + requireAuth('admin') |
| `/api/admin/webhooks/[id]/logs` | GET | requireAuth + requireAuth('admin') |
| `/api/admin/webhooks/[id]/test` | POST | requireAuth + requireAuth('admin') |
| `/api/announcements` | DELETE, GET, POST, PUT | getServerSession(authOptions) + hasMinRole(admin, admin, admin, admin) |
| `/api/cases/generate` | POST | requireAuth + requireAuth('admin') |
| `/api/cases/generate/bulk` | POST | requireAuth + requireAuth('admin') |
| `/api/deep-links` | DELETE, GET, PATCH, POST | getServerSession(authOptions) + hasMinRole(admin, admin, admin, admin) |
| `/api/instructor/ce-records` | GET, POST | getServerSession(authOptions) + role check (admin, superadmin) |
| `/api/instructor/ce-records/[id]` | DELETE | getServerSession(authOptions) + role check (admin, superadmin) |
| `/api/instructor/teaching-log` | GET, POST | getServerSession(authOptions) + role check (admin, superadmin) |
| `/api/instructor/teaching-log/[id]` | DELETE | getServerSession(authOptions) + role check (admin, superadmin) |
| `/api/lab-management/certifications` | GET, POST | requireAuth + requireAuth('admin') |
| `/api/notifications` | DELETE, GET, POST | getServerSession(authOptions) + role check (admin, superadmin) |
| `/api/onboarding/assignments` | DELETE, GET, POST | getServerSession(authOptions) + role check (admin, superadmin) |
| `/api/onboarding/dashboard` | GET | getServerSession(authOptions) + role check (admin, superadmin) |
| `/api/onboarding/tasks/[id]/progress` | GET, PATCH | getServerSession(authOptions) + role check (admin, superadmin) |
| `/api/osce/admin/schedule` | GET | requireAuth + requireAuth('admin') |
| `/api/osce/admin/students/reorder` | POST | requireAuth + requireAuth('admin') |
| `/api/osce/events` | GET, POST | requireAuth + requireAuth('admin') |
| `/api/osce/events/[id]` | DELETE, GET, PUT | requireAuth + requireAuth('admin') |
| `/api/osce/events/[id]/calendar-invites` | GET, POST | requireAuth + requireAuth('admin') |
| `/api/osce/events/[id]/observers` | DELETE, GET, POST | requireAuth + requireAuth('admin') |
| `/api/osce/events/[id]/observers/[observerId]` | DELETE, GET, PUT | requireAuth + requireAuth('admin') |
| `/api/osce/events/[id]/observers/export` | GET | requireAuth + requireAuth('admin') |
| `/api/osce/events/[id]/schedule` | GET | requireAuth + requireAuth('admin') |
| `/api/osce/events/[id]/student-agencies` | DELETE, GET, POST | requireAuth + requireAuth('admin') |
| `/api/osce/events/[id]/students/reorder` | POST | requireAuth + requireAuth('admin') |
| `/api/osce/events/[id]/time-blocks` | DELETE, GET, POST, PUT | requireAuth + requireAuth('admin') |
| `/api/osce/observers` | GET | requireAuth + requireAuth('admin') |
| `/api/osce/observers/[id]` | DELETE | requireAuth + requireAuth('admin') |
| `/api/osce/observers/export` | GET | requireAuth + requireAuth('admin') |
| `/api/osce/student-agencies` | DELETE, GET, POST | requireAuth + requireAuth('admin') |
| `/api/resources/medications` | GET, POST | getServerSession(authOptions) + hasMinRole(admin) |
| `/api/resources/medications/[id]` | DELETE, PUT | getServerSession(authOptions) + hasMinRole(admin, admin) |
| `/api/scheduling/resource-bookings/[id]` | DELETE, PUT | getServerSession(authOptions) + hasMinRole(admin, admin) |
| `/api/scheduling/resource-bookings/resources` | GET, PATCH, POST | getServerSession(authOptions) + hasMinRole(admin, admin) |
| `/api/scheduling/shifts` | GET, POST | getServerSession(authOptions) + role check (admin, superadmin) |
| `/api/scheduling/shifts/[id]` | DELETE, GET, PUT | getServerSession(authOptions) + role check (admin, superadmin) |
| `/api/scheduling/shifts/[id]/signup/[signupId]` | POST | getServerSession(authOptions) + role check (admin, superadmin) |
| `/api/scheduling/signups/pending` | GET | getServerSession(authOptions) + role check (admin, superadmin) |
| `/api/scheduling/swaps/[id]/assign` | PUT | getServerSession(authOptions) + role check (admin, superadmin) |
| `/api/scheduling/trades` | GET, POST, PUT | getServerSession(authOptions) + role check (admin, superadmin) |

### lead_instructor (20 routes)

| Route | Methods | Auth Pattern |
|-------|---------|-------------|
| `/api/admin/guests` | DELETE, GET, PATCH, POST | requireAuth + requireAuth('lead_instructor') |
| `/api/admin/lab-templates` | GET, POST | requireAuth + requireAuth('lead_instructor') |
| `/api/admin/lab-templates/[id]` | DELETE, GET, PUT | requireAuth + requireAuth('lead_instructor') |
| `/api/admin/lab-templates/[id]/versions` | GET, POST | requireAuth + requireAuth('lead_instructor') |
| `/api/admin/lab-templates/compare` | GET | getServerSession(authOptions) + hasMinRole(lead_instructor) |
| `/api/clinical/capacity/check` | GET | requireAuth + requireAuth('lead_instructor') |
| `/api/clinical/internships/[id]/closeout/documents` | DELETE, POST | requireAuth + requireAuth('lead_instructor') |
| `/api/clinical/internships/[id]/preceptors` | GET, PATCH, POST | requireAuth + requireAuth('lead_instructor') |
| `/api/clinical/internships/[id]/preceptors/[assignmentId]` | DELETE, PUT | requireAuth + requireAuth('lead_instructor') |
| `/api/clinical/mce` | GET, PATCH, POST | requireAuth + requireAuth('lead_instructor') |
| `/api/lab-management/template-reviews/[id]/finalize` | POST | requireAuth + requireAuth('lead_instructor') |
| `/api/lab-management/weekly-templates/generate` | POST | requireAuth + requireAuth('lead_instructor') |
| `/api/reports/clinical-placements` | GET | requireAuth + requireAuth('lead_instructor') |
| `/api/reports/instructor-analytics` | GET | requireAuth + requireAuth('lead_instructor') |
| `/api/reports/program-overview` | GET | requireAuth + requireAuth('lead_instructor') |
| `/api/reports/scenario-usage-overview` | GET | requireAuth + requireAuth('lead_instructor') |
| `/api/reports/student-dashboard` | GET | requireAuth + requireAuth('lead_instructor') |
| `/api/scheduling/availability-status` | GET | getServerSession(authOptions) + hasMinRole(lead_instructor) |
| `/api/scheduling/availability/all` | GET | getServerSession(authOptions) + hasMinRole(lead_instructor) |
| `/api/scheduling/send-availability-reminders` | POST | getServerSession(authOptions) + hasMinRole(lead_instructor) |

### instructor (207 routes)

| Route | Methods | Auth Pattern |
|-------|---------|-------------|
| `/api/calendar/availability` | GET | requireAuth + requireAuth('instructor') |
| `/api/case-sessions` | POST | getServerSession(authOptions) + hasMinRole(instructor) |
| `/api/case-sessions/[code]/instructor` | GET, PUT | getServerSession(authOptions) + hasMinRole(instructor) |
| `/api/case-sessions/[code]/results` | GET | getServerSession(authOptions) + hasMinRole(instructor) |
| `/api/cases` | GET, POST | getServerSession(authOptions) + hasMinRole(instructor, instructor) |
| `/api/cases/[id]` | GET, PUT | getServerSession(authOptions) + hasMinRole(instructor, admin, instructor, admin) |
| `/api/cases/[id]/duplicate` | POST | getServerSession(authOptions) + hasMinRole(instructor) |
| `/api/cases/achievements/[studentId]` | GET | getServerSession(authOptions) + hasMinRole(instructor) |
| `/api/cases/import` | POST | getServerSession(authOptions) + hasMinRole(instructor) |
| `/api/clinical/aemt-tracking` | GET, POST | requireAuth + hasMinRole(lead_instructor, lead_instructor) + requireAuth('instructor') |
| `/api/clinical/agencies` | GET, POST | requireAuth + requireAuth('instructor') |
| `/api/clinical/agencies/[id]` | DELETE, GET, PUT | requireAuth + requireAuth('instructor') |
| `/api/clinical/capacity` | GET, PATCH | requireAuth + hasMinRole(lead_instructor, admin) + requireAuth('instructor') |
| `/api/clinical/compliance` | GET, POST | requireAuth + hasMinRole(lead_instructor, lead_instructor) + requireAuth('instructor') |
| `/api/clinical/emt-tracking` | GET, POST | requireAuth + hasMinRole(lead_instructor, lead_instructor) + requireAuth('instructor') |
| `/api/clinical/hours` | GET, POST | requireAuth + hasMinRole(lead_instructor, lead_instructor) + requireAuth('instructor') |
| `/api/clinical/internships` | GET, POST | requireAuth + hasMinRole(lead_instructor, lead_instructor) + requireAuth('instructor') |
| `/api/clinical/internships/[id]` | DELETE, GET, PUT | requireAuth + isSuperadmin + hasMinRole(lead_instructor, lead_instructor) + requireAuth('instructor') |
| `/api/clinical/internships/[id]/closeout` | GET, PATCH, POST | requireAuth + hasMinRole(lead_instructor, lead_instructor, admin) + requireAuth('instructor') |
| `/api/clinical/internships/[id]/closeout/employment` | DELETE, GET, POST, PUT | requireAuth + hasMinRole(lead_instructor, lead_instructor, lead_instructor, admin) + requireAuth('instructor') |
| `/api/clinical/internships/[id]/closeout/packet` | GET | requireAuth + hasMinRole(lead_instructor) + requireAuth('instructor') |
| `/api/clinical/internships/[id]/closeout/summary` | GET | requireAuth + hasMinRole(lead_instructor) + requireAuth('instructor') |
| `/api/clinical/internships/[id]/closeout/surveys` | DELETE, GET, POST, PUT | requireAuth + hasMinRole(lead_instructor, lead_instructor, lead_instructor, lead_instructor) + requireAuth('instructor') |
| `/api/clinical/internships/[id]/notify-nremt` | POST | requireAuth + hasMinRole(lead_instructor) + requireAuth('instructor') |
| `/api/clinical/overview-all` | GET | requireAuth + hasMinRole(lead_instructor) + requireAuth('instructor') |
| `/api/clinical/planning-calendar` | DELETE, GET, POST, PUT | requireAuth + requireAuth('instructor') |
| `/api/clinical/preceptor-eval/send` | POST | requireAuth + hasMinRole(lead_instructor) + requireAuth('instructor') |
| `/api/clinical/preceptor-eval/tokens` | GET | requireAuth + hasMinRole(lead_instructor) + requireAuth('instructor') |
| `/api/clinical/preceptor-feedback` | GET, POST, PUT | requireAuth + hasMinRole(instructor, instructor, instructor) + requireAuth('instructor') |
| `/api/clinical/preceptors` | GET, POST | requireAuth + hasMinRole(lead_instructor) + requireAuth('instructor') |
| `/api/clinical/preceptors/[id]` | DELETE, GET, PUT | requireAuth + requireAuth('instructor') |
| `/api/clinical/rotations` | GET, POST | requireAuth + requireAuth('instructor') |
| `/api/clinical/rotations/[id]` | DELETE, PATCH | requireAuth + requireAuth('instructor') |
| `/api/clinical/site-visits` | GET, POST | requireAuth + hasMinRole(lead_instructor, lead_instructor) + requireAuth('instructor') |
| `/api/clinical/site-visits/[id]` | DELETE, GET, PUT | requireAuth + requireAuth('instructor') |
| `/api/clinical/site-visits/coverage` | GET, POST | requireAuth + requireAuth('instructor') |
| `/api/clinical/site-visits/export` | GET | requireAuth + requireAuth('instructor') |
| `/api/clinical/sites` | GET, POST | requireAuth + requireAuth('instructor') |
| `/api/clinical/sites/[id]` | DELETE, GET, PUT | requireAuth + requireAuth('instructor') |
| `/api/clinical/sites/[id]/departments` | DELETE, GET, POST | requireAuth + requireAuth('instructor') |
| `/api/clinical/summative-evaluations` | GET, POST | requireAuth + hasMinRole(lead_instructor, lead_instructor) + requireAuth('instructor') |
| `/api/clinical/summative-evaluations/[id]` | DELETE, GET, PATCH | requireAuth + requireAuth('instructor') |
| `/api/clinical/summative-evaluations/[id]/export` | GET | requireAuth + requireAuth('instructor') |
| `/api/clinical/summative-evaluations/[id]/scenario-print` | GET | requireAuth + requireAuth('instructor') |
| `/api/clinical/summative-evaluations/[id]/scores` | DELETE, PATCH, POST | requireAuth + requireAuth('instructor') |
| `/api/clinical/summative-scenarios` | GET | requireAuth + requireAuth('instructor') |
| `/api/compliance` | GET, POST, PUT | getServerSession(authOptions) + hasMinRole(instructor, instructor, admin) |
| `/api/dashboard/quick-stats` | GET | requireAuth + hasMinRole(lead_instructor) + requireAuth('instructor') |
| `/api/feedback` | GET, PATCH, POST | getServerSession(authOptions) + [superadmin, admin, lead_instructor, instructor, volunteer_instructor].includes(role) |
| `/api/instructor/my-stats` | GET | getServerSession(authOptions) + hasMinRole(instructor) |
| `/api/instructor/time-clock` | GET, POST, PUT | getServerSession(authOptions) + hasMinRole(instructor, instructor, instructor) |
| `/api/instructor/time-clock/[id]` | DELETE, PUT | getServerSession(authOptions) + hasMinRole(instructor) |
| `/api/lab-management/assessments/scenario` | GET, POST | requireAuth + requireAuth('instructor') |
| `/api/lab-management/assessments/skill` | GET, POST | requireAuth + requireAuth('instructor') |
| `/api/lab-management/attendance/at-risk` | GET | requireAuth + requireAuth('instructor') |
| `/api/lab-management/ce-records` | GET, POST | requireAuth + requireAuth('instructor') |
| `/api/lab-management/ce-records/[id]` | DELETE | requireAuth + requireAuth('instructor') |
| `/api/lab-management/ce-requirements` | GET | requireAuth + requireAuth('instructor') |
| `/api/lab-management/certifications/[id]` | DELETE, GET, PATCH | requireAuth + requireAuth('instructor') |
| `/api/lab-management/checklist-templates` | DELETE, GET, POST, PUT | requireAuth + requireAuth('instructor') |
| `/api/lab-management/cohorts` | GET, POST | requireAuth + requireAuth('instructor') |
| `/api/lab-management/cohorts/[id]` | DELETE, GET, PATCH | requireAuth + isSuperadmin + requireAuth('instructor') |
| `/api/lab-management/cohorts/[id]/archive` | DELETE, POST | requireAuth + hasMinRole(admin, admin) + requireAuth('instructor') |
| `/api/lab-management/cohorts/[id]/calendar` | GET | requireAuth + hasMinRole(instructor) + requireAuth('instructor') |
| `/api/lab-management/cohorts/[id]/completion` | GET | requireAuth + hasMinRole(lead_instructor) + requireAuth('instructor') |
| `/api/lab-management/cohorts/[id]/email` | POST | requireAuth + hasMinRole(lead_instructor) + requireAuth('instructor') |
| `/api/lab-management/cohorts/[id]/stats` | GET | requireAuth + requireAuth('instructor') |
| `/api/lab-management/competencies` | GET, POST | requireAuth + hasMinRole(instructor) + requireAuth('instructor') |
| `/api/lab-management/competencies/report` | GET | requireAuth + requireAuth('instructor') |
| `/api/lab-management/costs` | GET, POST | requireAuth + requireAuth('instructor') |
| `/api/lab-management/costs/[id]` | DELETE, PUT | requireAuth + requireAuth('instructor') |
| `/api/lab-management/custom-skills` | DELETE, GET, POST | requireAuth + requireAuth('instructor') |
| `/api/lab-management/daily-notes` | GET, POST | requireAuth + requireAuth('instructor') |
| `/api/lab-management/field-trips` | DELETE, GET, POST | requireAuth + requireAuth('instructor') |
| `/api/lab-management/field-trips/attendance` | GET, PATCH, POST | requireAuth + requireAuth('instructor') |
| `/api/lab-management/flagged-items` | GET, PATCH | requireAuth + requireAuth('instructor') |
| `/api/lab-management/groups` | GET, POST, PUT | requireAuth + requireAuth('instructor') |
| `/api/lab-management/groups/[id]` | DELETE, GET, PUT | requireAuth + requireAuth('instructor') |
| `/api/lab-management/groups/[id]/members` | DELETE, GET, POST, PUT | requireAuth + requireAuth('instructor') |
| `/api/lab-management/groups/generate` | POST | requireAuth + requireAuth('instructor') |
| `/api/lab-management/instructors` | GET | requireAuth + requireAuth('instructor') |
| `/api/lab-management/lab-day-roles` | DELETE, GET, POST | requireAuth + requireAuth('instructor') + [lab_lead, roamer, observer].includes(role) |
| `/api/lab-management/lab-day-skills` | GET | requireAuth + requireAuth('instructor') |
| `/api/lab-management/lab-days` | GET, POST | requireAuth + hasMinRole(instructor) + requireAuth('instructor') |
| `/api/lab-management/lab-days/[id]` | DELETE, GET, PATCH | requireAuth + isSuperadmin + hasMinRole(instructor) + requireAuth('instructor') |
| `/api/lab-management/lab-days/[id]/attendance` | GET, POST, PUT | requireAuth + hasMinRole(instructor, instructor, instructor) + requireAuth('instructor') |
| `/api/lab-management/lab-days/[id]/attendance/absences` | GET | requireAuth + hasMinRole(instructor) + requireAuth('instructor') |
| `/api/lab-management/lab-days/[id]/checkin-token` | DELETE, POST | requireAuth + hasMinRole(instructor, instructor) + requireAuth('instructor') |
| `/api/lab-management/lab-days/[id]/checklist` | DELETE, GET, POST, PUT | requireAuth + requireAuth('instructor') |
| `/api/lab-management/lab-days/[id]/debrief` | GET, POST, PUT | requireAuth + requireAuth('instructor') |
| `/api/lab-management/lab-days/[id]/duplicate` | POST | requireAuth + hasMinRole(instructor) + requireAuth('instructor') |
| `/api/lab-management/lab-days/[id]/duplicate-bulk` | POST | requireAuth + hasMinRole(instructor) + requireAuth('instructor') |
| `/api/lab-management/lab-days/[id]/equipment` | DELETE, GET, POST, PUT | requireAuth + requireAuth('instructor') |
| `/api/lab-management/lab-days/[id]/ratings` | GET, POST | requireAuth + requireAuth('instructor') |
| `/api/lab-management/lab-days/[id]/roster` | GET | requireAuth + hasMinRole(instructor) + requireAuth('instructor') |
| `/api/lab-management/lab-days/templates` | GET | requireAuth + hasMinRole(instructor) + requireAuth('instructor') |
| `/api/lab-management/learning-style-report` | GET | requireAuth + hasMinRole(instructor) + requireAuth('instructor') |
| `/api/lab-management/locations` | GET | requireAuth + requireAuth('instructor') |
| `/api/lab-management/mentorship` | GET, POST | requireAuth + hasMinRole(instructor, instructor) + requireAuth('instructor') |
| `/api/lab-management/mentorship/[id]` | GET, PUT | requireAuth + hasMinRole(instructor, instructor) + requireAuth('instructor') |
| `/api/lab-management/mentorship/[id]/logs` | GET, POST | requireAuth + hasMinRole(instructor, instructor) + requireAuth('instructor') |
| `/api/lab-management/programs` | GET | requireAuth + requireAuth('instructor') |
| `/api/lab-management/request-coverage` | POST | requireAuth + requireAuth('instructor') |
| `/api/lab-management/scenario-library` | GET | requireAuth + requireAuth('instructor') |
| `/api/lab-management/scenario-library/clone` | POST | requireAuth + requireAuth('instructor') |
| `/api/lab-management/scenario-library/ratings` | DELETE, POST | requireAuth + requireAuth('instructor') |
| `/api/lab-management/scenario-library/tags` | DELETE, GET, POST | requireAuth + requireAuth('instructor') |
| `/api/lab-management/scenarios` | GET, POST | requireAuth + requireAuth('instructor') |
| `/api/lab-management/scenarios/[id]` | DELETE, GET, PATCH | requireAuth + isSuperadmin + requireAuth('instructor') |
| `/api/lab-management/scenarios/[id]/difficulty-recommendation` | GET, POST | requireAuth + hasMinRole(instructor, lead_instructor) + requireAuth('instructor') |
| `/api/lab-management/scenarios/[id]/duplicate` | POST | requireAuth + requireAuth('instructor') |
| `/api/lab-management/scenarios/[id]/versions` | GET, POST, PUT | requireAuth + hasMinRole(instructor, instructor, lead_instructor) + requireAuth('instructor') |
| `/api/lab-management/scenarios/favorites` | DELETE, GET, POST | requireAuth + requireAuth('instructor') |
| `/api/lab-management/scenarios/import` | POST | requireAuth + requireAuth('instructor') |
| `/api/lab-management/schedule/conflicts` | POST | requireAuth + hasMinRole(instructor) + requireAuth('instructor') |
| `/api/lab-management/schedule/suggestions` | GET | requireAuth + requireAuth('instructor') |
| `/api/lab-management/skill-drills` | GET, POST | requireAuth + hasMinRole(instructor) + requireAuth('instructor') |
| `/api/lab-management/skill-drills/[id]` | DELETE, GET, PUT | requireAuth + hasMinRole(instructor, admin, instructor, admin) + requireAuth('instructor') |
| `/api/lab-management/skill-drills/[id]/documents` | DELETE, GET, PATCH, POST | requireAuth + requireAuth('instructor') |
| `/api/lab-management/skill-signoffs` | GET, POST, PUT | requireAuth + hasMinRole(instructor, instructor, lead_instructor) + requireAuth('instructor') |
| `/api/lab-management/skills` | GET, POST | requireAuth + requireAuth('instructor') |
| `/api/lab-management/skills/[id]/documents` | DELETE, GET, PATCH, POST | requireAuth + requireAuth('instructor') |
| `/api/lab-management/station-instructors` | DELETE, GET, POST | requireAuth + requireAuth('instructor') |
| `/api/lab-management/station-skills` | DELETE, GET, POST | requireAuth + requireAuth('instructor') |
| `/api/lab-management/stations` | GET, POST | requireAuth + requireAuth('instructor') |
| `/api/lab-management/stations/[id]` | DELETE, GET, PATCH | requireAuth + requireAuth('instructor') |
| `/api/lab-management/stations/[id]/documents` | DELETE, POST | requireAuth + requireAuth('instructor') |
| `/api/lab-management/students` | GET, POST | requireAuth + hasMinRole(instructor, instructor) + requireAuth('instructor') |
| `/api/lab-management/students/[id]` | DELETE, GET, PATCH | requireAuth + isSuperadmin + hasMinRole(instructor, instructor) + requireAuth('instructor') |
| `/api/lab-management/students/[id]/clinical-tasks` | GET | requireAuth + requireAuth('instructor') |
| `/api/lab-management/students/[id]/communications` | GET, PATCH, POST | requireAuth + requireAuth('instructor') |
| `/api/lab-management/students/[id]/learning-plan` | GET, POST | requireAuth + hasMinRole(lead_instructor, lead_instructor) + requireAuth('instructor') |
| `/api/lab-management/students/[id]/learning-plan/notes` | POST | requireAuth + hasMinRole(lead_instructor) + requireAuth('instructor') |
| `/api/lab-management/students/[id]/notes` | DELETE, GET, POST, PUT | requireAuth + hasMinRole(instructor, instructor, instructor, lead_instructor, instructor, lead_instructor) + requireAuth('instructor') |
| `/api/lab-management/students/[id]/photo` | DELETE, POST | requireAuth + requireAuth('instructor') |
| `/api/lab-management/students/[id]/portfolio` | GET | requireAuth + hasMinRole(instructor) + requireAuth('instructor') |
| `/api/lab-management/students/[id]/ratings` | GET | requireAuth + requireAuth('instructor') |
| `/api/lab-management/students/check-duplicates` | POST | requireAuth + requireAuth('instructor') |
| `/api/lab-management/students/import` | GET, POST | requireAuth + hasMinRole(instructor, instructor) + requireAuth('instructor') |
| `/api/lab-management/students/notes-summary` | GET | requireAuth + hasMinRole(instructor) + requireAuth('instructor') |
| `/api/lab-management/team-leads` | GET, POST | requireAuth + hasMinRole(instructor, instructor) + requireAuth('instructor') |
| `/api/lab-management/template-reviews` | GET, POST | requireAuth + requireAuth('instructor') |
| `/api/lab-management/template-reviews/[id]` | DELETE, GET, PUT | requireAuth + requireAuth('instructor') |
| `/api/lab-management/template-reviews/[id]/items` | GET | requireAuth + requireAuth('instructor') |
| `/api/lab-management/template-reviews/[id]/items/[itemId]` | GET, PUT | requireAuth + requireAuth('instructor') |
| `/api/lab-management/template-reviews/[id]/items/[itemId]/comments` | POST | requireAuth + requireAuth('instructor') |
| `/api/lab-management/templates` | GET, POST | requireAuth + requireAuth('instructor') |
| `/api/lab-management/templates/[id]` | DELETE, GET, PUT | requireAuth + requireAuth('instructor') |
| `/api/lab-management/timer` | DELETE, GET, PATCH, POST | requireAuth + requireAuth('instructor') |
| `/api/lab-management/timer-displays` | GET, POST | requireAuth + requireAuth('instructor') |
| `/api/lab-management/timer-displays/[id]` | DELETE, PATCH | requireAuth + requireAuth('instructor') |
| `/api/lab-management/timer/active` | GET | requireAuth + requireAuth('instructor') |
| `/api/lab-management/timer/adjust` | PATCH | requireAuth + requireAuth('instructor') |
| `/api/lab-management/timer/ready` | DELETE, GET, PATCH, POST | requireAuth + requireAuth('instructor') |
| `/api/lab-management/users` | GET, PATCH, POST | requireAuth + requireAuth('instructor') |
| `/api/lab-management/weekly-templates` | DELETE, GET, POST, PUT | requireAuth + requireAuth('instructor') |
| `/api/notifications/preferences` | DELETE, GET, PUT | getServerSession(authOptions) + role check (role check (inferred: instructor+)) |
| `/api/peer-evaluations` | GET, POST | getServerSession(authOptions) + hasMinRole(instructor) |
| `/api/peer-evaluations/aggregate` | GET | getServerSession(authOptions) + hasMinRole(instructor) |
| `/api/reports/attendance` | GET | requireAuth + requireAuth('instructor') |
| `/api/reports/availability-patterns` | GET | requireAuth + hasMinRole(lead_instructor) + requireAuth('instructor') |
| `/api/reports/builder` | DELETE, GET, POST, PUT | requireAuth + hasMinRole(instructor, instructor, instructor, admin, instructor, admin) + requireAuth('instructor') |
| `/api/reports/builder/[id]` | GET | requireAuth + hasMinRole(instructor, admin) + requireAuth('instructor') |
| `/api/reports/clinical-hours` | GET | requireAuth + requireAuth('instructor') |
| `/api/reports/closeout-surveys` | GET | requireAuth + hasMinRole(admin) + requireAuth('instructor') |
| `/api/reports/cohort-comparison` | POST | requireAuth + hasMinRole(lead_instructor) + requireAuth('instructor') |
| `/api/reports/gradebook` | GET | requireAuth + hasMinRole(instructor) + requireAuth('instructor') |
| `/api/reports/instructor-workload` | GET | requireAuth + hasMinRole(lead_instructor) + requireAuth('instructor') + [instructor, lead_instructor].includes(role) |
| `/api/reports/internship-status` | GET | requireAuth + requireAuth('instructor') |
| `/api/reports/lab-progress` | GET | requireAuth + requireAuth('instructor') |
| `/api/reports/onboarding-status` | GET | requireAuth + requireAuth('instructor') |
| `/api/reports/program-outcomes` | DELETE, GET, POST | requireAuth + hasMinRole(lead_instructor, admin, admin) + requireAuth('instructor') |
| `/api/reports/scenario-analytics` | GET | requireAuth + hasMinRole(lead_instructor) + requireAuth('instructor') |
| `/api/reports/scenario-usage` | GET | requireAuth + requireAuth('instructor') |
| `/api/reports/student-progress` | GET | requireAuth + requireAuth('instructor') |
| `/api/reports/team-leads` | GET | requireAuth + requireAuth('instructor') |
| `/api/resources` | DELETE, GET, POST, PUT | getServerSession(authOptions) + hasMinRole(instructor, instructor, admin) |
| `/api/resources/versions` | GET | getServerSession(authOptions) + hasMinRole(instructor) |
| `/api/scheduling/resource-bookings` | GET, POST | getServerSession(authOptions) + hasMinRole(instructor) |
| `/api/scheduling/substitute-requests` | GET, POST | getServerSession(authOptions) + hasMinRole(lead_instructor, instructor, instructor) |
| `/api/scheduling/substitute-requests/[id]` | DELETE, PUT | getServerSession(authOptions) + hasMinRole(instructor, lead_instructor, admin) |
| `/api/seating/charts` | GET, POST | requireAuth + requireAuth('instructor') |
| `/api/seating/charts/[id]` | DELETE, GET, PUT | requireAuth + requireAuth('instructor') |
| `/api/seating/charts/[id]/assignments` | DELETE, GET, PUT | requireAuth + requireAuth('instructor') |
| `/api/seating/charts/[id]/generate` | POST | requireAuth + requireAuth('instructor') |
| `/api/seating/classrooms` | GET | requireAuth + requireAuth('instructor') |
| `/api/seating/learning-styles` | DELETE, GET, POST | requireAuth + requireAuth('instructor') |
| `/api/seating/preferences` | DELETE, GET, POST | requireAuth + requireAuth('instructor') |
| `/api/skill-sheets` | GET | getServerSession(authOptions) + hasMinRole(instructor) |
| `/api/skill-sheets/[id]` | GET | getServerSession(authOptions) + hasMinRole(instructor) |
| `/api/skill-sheets/[id]/evaluate` | POST | getServerSession(authOptions) + hasMinRole(instructor) |
| `/api/skill-sheets/by-skill-name` | GET | requireAuth + requireAuth('instructor') |
| `/api/skill-sheets/by-skill-name/bulk` | POST | requireAuth + requireAuth('instructor') |
| `/api/skill-sheets/evaluations-by-lab-day` | GET | getServerSession(authOptions) + hasMinRole(instructor) |
| `/api/stations/completions` | GET, POST | getServerSession(authOptions) + hasMinRole(instructor) |
| `/api/stations/completions/bulk` | POST | getServerSession(authOptions) + hasMinRole(instructor) |
| `/api/stations/pool` | GET, POST | getServerSession(authOptions) + hasMinRole(instructor) |
| `/api/stations/pool/[id]` | DELETE, GET, PATCH | getServerSession(authOptions) + hasMinRole(instructor, admin) |
| `/api/stations/pool/favorites` | DELETE, GET, POST | requireAuth + requireAuth('instructor') |
| `/api/students/[id]/progress` | GET | getServerSession(authOptions) + hasMinRole(instructor) |
| `/api/students/[id]/skill-evaluations` | GET | getServerSession(authOptions) + hasMinRole(instructor) |
| `/api/submissions` | GET, POST | requireAuth + getServerSession(authOptions) + requireAuth('instructor') |
| `/api/tracking/ekg-scores` | GET, POST | getServerSession(authOptions) + hasMinRole(instructor) |
| `/api/tracking/protocol-completions` | GET, POST | getServerSession(authOptions) + hasMinRole(instructor) |
| `/api/tracking/scenarios` | GET, POST | getServerSession(authOptions) + hasMinRole(instructor) |
| `/api/user/preferences` | DELETE, GET, PUT | getServerSession(authOptions) + role check (role check (inferred: instructor+)) |
| `/api/users/list` | GET | requireAuth + requireAuth('instructor') |

### user (any authenticated) (60 routes)

| Route | Methods | Auth Pattern |
|-------|---------|-------------|
| `/api/access-requests` | GET, POST | getServerSession(authOptions) |
| `/api/access-requests/[id]` | PUT | getServerSession(authOptions) |
| `/api/admin/user-activity/log` | POST | getServerSession(authOptions) |
| `/api/announcements/[id]/read` | POST | getServerSession(authOptions) |
| `/api/calendar/calendars` | GET, PUT | requireAuth |
| `/api/calendar/callback` | GET | getServerSession(authOptions) |
| `/api/calendar/connect` | DELETE, GET | requireAuth |
| `/api/calendar/google-events` | GET | requireAuth |
| `/api/calendar/status` | GET | requireAuth |
| `/api/case-sessions/[code]/join` | POST | getServerSession(authOptions) |
| `/api/case-sessions/[code]/respond` | POST | getServerSession(authOptions) |
| `/api/cases/[id]/practice/complete` | POST | getServerSession(authOptions) |
| `/api/cases/[id]/practice/history` | GET | getServerSession(authOptions) |
| `/api/cases/[id]/practice/progress` | GET | getServerSession(authOptions) |
| `/api/cases/[id]/practice/respond` | PUT | getServerSession(authOptions) |
| `/api/cases/[id]/practice/start` | POST | getServerSession(authOptions) |
| `/api/cases/achievements/check` | POST | getServerSession(authOptions) |
| `/api/cases/leaderboard/[cohortId]` | GET | getServerSession(authOptions) |
| `/api/clinical/affiliations` | DELETE, GET, POST, PUT | getServerSession(authOptions) |
| `/api/dashboard/cert-expiry` | GET | getServerSession(authOptions) |
| `/api/dashboard/layout` | DELETE, GET, PUT | getServerSession(authOptions) |
| `/api/dashboard/recent-activity` | GET | getServerSession(authOptions) |
| `/api/deep-links/qr` | GET | getServerSession(authOptions) |
| `/api/errors/log` | POST | getServerSession(authOptions) |
| `/api/feedback/my-submissions` | GET | getServerSession(authOptions) |
| `/api/instructor/me` | GET | getServerSession(authOptions) |
| `/api/instructor/upcoming-labs` | GET | getServerSession(authOptions) |
| `/api/notifications/archive` | PUT | getServerSession(authOptions) |
| `/api/notifications/digest-preview` | GET | getServerSession(authOptions) |
| `/api/notifications/email-preferences` | GET, PUT | getServerSession(authOptions) |
| `/api/notifications/read` | PUT | getServerSession(authOptions) |
| `/api/onboarding/templates` | GET | getServerSession(authOptions) |
| `/api/polls` | DELETE, GET, POST | getServerSession(authOptions) |
| `/api/scheduling/availability` | GET, POST | getServerSession(authOptions) |
| `/api/scheduling/availability/[id]` | DELETE, PUT | getServerSession(authOptions) |
| `/api/scheduling/availability/bulk` | DELETE, POST | getServerSession(authOptions) |
| `/api/scheduling/availability/suggestions` | GET | getServerSession(authOptions) |
| `/api/scheduling/part-timer-status` | GET | getServerSession(authOptions) |
| `/api/scheduling/reports` | GET | getServerSession(authOptions) |
| `/api/scheduling/shifts/[id]/signup` | DELETE, POST | getServerSession(authOptions) |
| `/api/scheduling/swaps/[id]/interest` | DELETE, GET, POST | getServerSession(authOptions) |
| `/api/scheduling/team-availability` | GET, POST | getServerSession(authOptions) |
| `/api/scheduling/team-availability/saved` | DELETE, GET | getServerSession(authOptions) |
| `/api/search` | GET | getServerSession(authOptions) |
| `/api/settings/2fa/disable` | POST | getServerSession(authOptions) |
| `/api/settings/2fa/setup` | POST | getServerSession(authOptions) |
| `/api/settings/2fa/status` | GET | getServerSession(authOptions) |
| `/api/settings/2fa/verify` | POST | getServerSession(authOptions) |
| `/api/settings/calendar-sync` | GET, PUT | requireAuth |
| `/api/settings/notifications` | GET, PUT | getServerSession(authOptions) |
| `/api/settings/sessions` | GET, POST | getServerSession(authOptions) |
| `/api/settings/sessions/[id]` | DELETE | getServerSession(authOptions) |
| `/api/settings/sessions/revoke-all` | POST | getServerSession(authOptions) |
| `/api/students` | GET | getServerSession(authOptions) |
| `/api/tasks` | GET, POST | getServerSession(authOptions) |
| `/api/tasks/[id]` | DELETE, GET, PATCH | getServerSession(authOptions) |
| `/api/tasks/[id]/comments` | GET, POST | getServerSession(authOptions) |
| `/api/tasks/bulk` | DELETE, PATCH | getServerSession(authOptions) |
| `/api/timer-display` | DELETE, GET, PATCH, POST | getServerSession(authOptions) |
| `/api/user-preferences/tour` | GET, POST | getServerSession(authOptions) |

### public / cron / framework (20 routes)

| Route | Methods | Auth Pattern |
|-------|---------|-------------|
| `/api/auth/[...nextauth]` | GET, POST | NextAuth handler (framework) |
| `/api/checkin/[token]` | GET, POST | Token-based access (public link with secret token) |
| `/api/clinical/preceptor-eval/[token]` | GET, POST | Token-based access (public link with secret token) |
| `/api/config/public` | GET | Intentionally public endpoint |
| `/api/cron/affiliation-expiry` | GET | CRON_SECRET verification |
| `/api/cron/attendance-alerts` | GET | CRON_SECRET verification |
| `/api/cron/availability-reminders` | GET | CRON_SECRET verification |
| `/api/cron/calendar-sync` | GET | CRON_SECRET verification |
| `/api/cron/cert-expiry` | GET | CRON_SECRET verification |
| `/api/cron/clinical-hours-reminder` | GET | CRON_SECRET verification |
| `/api/cron/compliance-expiry` | GET | CRON_SECRET verification |
| `/api/cron/daily-digest` | GET | CRON_SECRET verification |
| `/api/cron/internship-milestones` | GET | CRON_SECRET verification |
| `/api/cron/lab-reminder` | GET | CRON_SECRET verification |
| `/api/cron/scheduled-exports` | GET | CRON_SECRET verification |
| `/api/cron/site-visit-reminders` | GET | CRON_SECRET verification |
| `/api/cron/system-health` | GET | CRON_SECRET verification |
| `/api/cron/weekly-digest` | GET | CRON_SECRET verification |
| `/api/guest/login` | POST | Intentionally public endpoint |
| `/api/timer-display/[token]` | GET | Token-based access (public link with secret token) |

### MISSING (no auth detected) (7 routes)

| Route | Methods | Auth Pattern |
|-------|---------|-------------|
| `/api/case-sessions/[code]` | GET | NO AUTH FOUND |
| `/api/case-sessions/[code]/leaderboard` | GET | NO AUTH FOUND |
| `/api/lab-management/scenario-library/favorites` | DELETE, POST | NO AUTH FOUND |
| `/api/osce/public/[slug]` | GET | NO AUTH FOUND |
| `/api/osce/public/[slug]/register` | POST | NO AUTH FOUND |
| `/api/osce/register` | POST | NO AUTH FOUND |
| `/api/osce/time-blocks` | GET | NO AUTH FOUND |

## Full Route Index

| # | Route | Methods | Min Role | Severity | Auth Pattern |
|---|-------|---------|----------|----------|--------------|
| 1 | `/api/access-requests` | GET, POST | user | WARNING | getServerSession(authOptions) |
| 2 | `/api/access-requests/[id]` | PUT | user | WARNING | getServerSession(authOptions) |
| 3 | `/api/access-requests/status` | GET | admin | OK | getServerSession(authOptions) + hasMinRole(admin) |
| 4 | `/api/admin/alumni` | GET, POST | admin | OK | requireAuth + requireAuth('admin') |
| 5 | `/api/admin/alumni/[id]` | DELETE, GET, PUT | admin | OK | requireAuth + requireAuth('admin') |
| 6 | `/api/admin/attendance-appeals` | GET | admin | OK | requireAuth + requireAuth('admin') |
| 7 | `/api/admin/attendance-appeals/[id]` | PUT | admin | OK | requireAuth + requireAuth('admin') |
| 8 | `/api/admin/audit-log` | DELETE, GET | superadmin | OK | getServerSession(authOptions) + isSuperadmin |
| 9 | `/api/admin/broadcast` | GET, POST | admin | OK | requireAuth + requireAuth('admin') |
| 10 | `/api/admin/broadcast/history` | GET | admin | OK | requireAuth + requireAuth('admin') |
| 11 | `/api/admin/bulk-operations` | GET, POST | admin | OK | requireAuth + requireAuth('admin') |
| 12 | `/api/admin/bulk-operations/[id]/rollback` | POST | admin | OK | requireAuth + requireAuth('admin') |
| 13 | `/api/admin/calendar-sync` | POST | admin | OK | requireAuth + requireAuth('admin') |
| 14 | `/api/admin/calendar-sync/remind` | POST | admin | OK | requireAuth + requireAuth('admin') |
| 15 | `/api/admin/calendar-sync/status` | GET | admin | OK | requireAuth + requireAuth('admin') |
| 16 | `/api/admin/cases/briefs` | GET, POST | admin | OK | requireAuth + requireAuth('admin') |
| 17 | `/api/admin/cases/coverage` | GET | admin | OK | requireAuth + requireAuth('admin') |
| 18 | `/api/admin/cases/prompt-template` | GET, PUT | admin | OK | requireAuth + requireAuth('admin') |
| 19 | `/api/admin/cases/seed-briefs` | POST | admin | OK | requireAuth + requireAuth('admin') |
| 20 | `/api/admin/cases/seed-prompt` | POST | admin | OK | requireAuth + requireAuth('admin') |
| 21 | `/api/admin/cases/seed-samples` | POST | admin | OK | requireAuth + requireAuth('admin') |
| 22 | `/api/admin/certification-compliance` | GET | admin | OK | requireAuth + requireAuth('admin') |
| 23 | `/api/admin/certifications` | GET | admin | OK | requireAuth + requireAuth('admin') |
| 24 | `/api/admin/certifications/import` | POST | admin | OK | requireAuth + requireAuth('admin') |
| 25 | `/api/admin/certifications/verify` | PUT | admin | OK | requireAuth + requireAuth('admin') |
| 26 | `/api/admin/config` | GET, PUT | admin | OK | requireAuth + requireAuth('admin') |
| 27 | `/api/admin/dashboard-defaults` | GET, PUT | admin | OK | getServerSession(authOptions) + hasMinRole(admin, admin) |
| 28 | `/api/admin/data-export` | GET, POST | admin | OK | requireAuth + requireAuth('admin') |
| 29 | `/api/admin/data-import/execute` | POST | admin | OK | requireAuth + requireAuth('admin') |
| 30 | `/api/admin/data-import/history` | GET | admin | OK | requireAuth + requireAuth('admin') |
| 31 | `/api/admin/data-import/preview` | POST | admin | OK | requireAuth + requireAuth('admin') |
| 32 | `/api/admin/database-tools/audit-logs` | DELETE, GET | superadmin | OK | getServerSession(authOptions) + isSuperadmin |
| 33 | `/api/admin/database-tools/cohorts` | GET, PATCH | superadmin | OK | getServerSession(authOptions) + isSuperadmin |
| 34 | `/api/admin/database-tools/notifications` | DELETE, GET | superadmin | OK | getServerSession(authOptions) + isSuperadmin |
| 35 | `/api/admin/database-tools/orphans` | DELETE, GET | superadmin | OK | getServerSession(authOptions) + isSuperadmin |
| 36 | `/api/admin/database-tools/stats` | GET | superadmin | OK | getServerSession(authOptions) + isSuperadmin |
| 37 | `/api/admin/deletion-requests` | GET, PATCH, POST | admin | OK | requireAuth + requireAuth('admin') |
| 38 | `/api/admin/document-requests` | GET, POST | admin | OK | requireAuth + requireAuth('admin') |
| 39 | `/api/admin/document-requests/[id]` | PUT | admin | OK | requireAuth + requireAuth('admin') |
| 40 | `/api/admin/email-stats` | GET | admin | OK | requireAuth + requireAuth('admin') |
| 41 | `/api/admin/email-templates` | DELETE, GET, PUT | admin | OK | requireAuth + requireAuth('admin') |
| 42 | `/api/admin/email-templates/test` | POST | admin | OK | requireAuth + requireAuth('admin') |
| 43 | `/api/admin/endorsements` | DELETE, GET, POST | admin | OK | requireAuth + getServerSession(authOptions) + requireAuth('admin') |
| 44 | `/api/admin/equipment` | DELETE, GET, PATCH, POST | admin | OK | requireAuth + requireAuth('admin') |
| 45 | `/api/admin/equipment/checkout` | GET, POST, PUT | admin | OK | requireAuth + requireAuth('admin') |
| 46 | `/api/admin/equipment/maintenance` | GET, POST | admin | OK | requireAuth + requireAuth('admin') |
| 47 | `/api/admin/equipment/maintenance/[id]` | DELETE, PUT | admin | OK | requireAuth + requireAuth('admin') |
| 48 | `/api/admin/feedback/import` | POST | admin | OK | getServerSession(authOptions) + role check (admin, superadmin) |
| 49 | `/api/admin/guests` | DELETE, GET, PATCH, POST | lead_instructor | OK | requireAuth + requireAuth('lead_instructor') |
| 50 | `/api/admin/incidents` | GET, POST | admin | OK | requireAuth + requireAuth('admin') |
| 51 | `/api/admin/incidents/[id]` | GET, PUT | admin | OK | requireAuth + requireAuth('admin') |
| 52 | `/api/admin/lab-templates` | GET, POST | lead_instructor | OK | requireAuth + requireAuth('lead_instructor') |
| 53 | `/api/admin/lab-templates/[id]` | DELETE, GET, PUT | lead_instructor | OK | requireAuth + requireAuth('lead_instructor') |
| 54 | `/api/admin/lab-templates/[id]/versions` | GET, POST | lead_instructor | OK | requireAuth + requireAuth('lead_instructor') |
| 55 | `/api/admin/lab-templates/apply` | POST | admin | OK | requireAuth + requireAuth('admin') |
| 56 | `/api/admin/lab-templates/compare` | GET | lead_instructor | OK | getServerSession(authOptions) + hasMinRole(lead_instructor) |
| 57 | `/api/admin/lab-templates/import` | POST | admin | OK | requireAuth + requireAuth('admin') |
| 58 | `/api/admin/lab-templates/seed` | POST | admin | OK | requireAuth + requireAuth('admin') |
| 59 | `/api/admin/lab-templates/update-from-lab` | POST | admin | OK | requireAuth + requireAuth('admin') |
| 60 | `/api/admin/program-requirements` | GET, POST | admin | OK | getServerSession(authOptions) + hasMinRole(admin, admin) |
| 61 | `/api/admin/rubrics` | GET, POST | admin | OK | requireAuth + requireAuth('admin') |
| 62 | `/api/admin/rubrics/[id]` | DELETE, GET, PUT | admin | OK | requireAuth + requireAuth('admin') |
| 63 | `/api/admin/scenarios/audit` | GET | admin | OK | requireAuth + requireAuth('admin') |
| 64 | `/api/admin/scenarios/auto-fill` | POST | admin | OK | requireAuth + requireAuth('admin') |
| 65 | `/api/admin/scenarios/bulk-import` | POST | admin | OK | requireAuth + requireAuth('admin') |
| 66 | `/api/admin/scenarios/bulk-import/commit` | POST | admin | OK | requireAuth + requireAuth('admin') |
| 67 | `/api/admin/scenarios/generate-content` | GET, POST | admin | OK | requireAuth + requireAuth('admin') |
| 68 | `/api/admin/scenarios/transform` | GET, POST | admin | OK | requireAuth + requireAuth('admin') |
| 69 | `/api/admin/scheduled-exports` | GET, POST | admin | OK | requireAuth + requireAuth('admin') |
| 70 | `/api/admin/scheduled-exports/[id]` | DELETE, PUT | admin | OK | requireAuth + requireAuth('admin') |
| 71 | `/api/admin/skill-drills/seed` | POST | admin | OK | requireAuth + requireAuth('admin') |
| 72 | `/api/admin/skill-sheets/counts` | GET | admin | OK | requireAuth + requireAuth('admin') |
| 73 | `/api/admin/skill-sheets/import` | POST | admin | OK | requireAuth + requireAuth('admin') |
| 74 | `/api/admin/skill-sheets/seed-aliases` | POST | admin | OK | requireAuth + requireAuth('admin') |
| 75 | `/api/admin/skill-sheets/seed-canonical` | POST | admin | OK | requireAuth + requireAuth('admin') |
| 76 | `/api/admin/skill-sheets/verify` | GET | admin | OK | requireAuth + requireAuth('admin') |
| 77 | `/api/admin/stats` | GET | superadmin | OK | getServerSession(authOptions) + role check (superadmin) |
| 78 | `/api/admin/system-alerts` | GET, PATCH | admin | OK | requireAuth + requireAuth('admin') |
| 79 | `/api/admin/system-health` | GET | admin | OK | getServerSession(authOptions) + hasMinRole(admin) |
| 80 | `/api/admin/user-activity` | GET | admin | OK | requireAuth + requireAuth('admin') |
| 81 | `/api/admin/user-activity/log` | POST | user | WARNING | getServerSession(authOptions) |
| 82 | `/api/admin/users` | DELETE, GET, PATCH, POST | admin | OK | requireAuth + requireAuth('admin') |
| 83 | `/api/admin/webhooks` | GET, POST | admin | OK | requireAuth + requireAuth('admin') |
| 84 | `/api/admin/webhooks/[id]` | DELETE, GET, PUT | admin | OK | requireAuth + requireAuth('admin') |
| 85 | `/api/admin/webhooks/[id]/logs` | GET | admin | OK | requireAuth + requireAuth('admin') |
| 86 | `/api/admin/webhooks/[id]/test` | POST | admin | OK | requireAuth + requireAuth('admin') |
| 87 | `/api/announcements` | DELETE, GET, POST, PUT | admin | OK | getServerSession(authOptions) + hasMinRole(admin, admin, admin, admin) |
| 88 | `/api/announcements/[id]/read` | POST | user | WARNING | getServerSession(authOptions) |
| 89 | `/api/auth/[...nextauth]` | GET, POST | public | OK | NextAuth handler (framework) |
| 90 | `/api/calendar/availability` | GET | instructor | OK | requireAuth + requireAuth('instructor') |
| 91 | `/api/calendar/calendars` | GET, PUT | user | WARNING | requireAuth |
| 92 | `/api/calendar/callback` | GET | user | WARNING | getServerSession(authOptions) |
| 93 | `/api/calendar/connect` | DELETE, GET | user | WARNING | requireAuth |
| 94 | `/api/calendar/google-events` | GET | user | WARNING | requireAuth |
| 95 | `/api/calendar/status` | GET | user | WARNING | requireAuth |
| 96 | `/api/case-sessions` | POST | instructor | OK | getServerSession(authOptions) + hasMinRole(instructor) |
| 97 | `/api/case-sessions/[code]` | GET | MISSING | CRITICAL | NO AUTH FOUND |
| 98 | `/api/case-sessions/[code]/instructor` | GET, PUT | instructor | OK | getServerSession(authOptions) + hasMinRole(instructor) |
| 99 | `/api/case-sessions/[code]/join` | POST | user | WARNING | getServerSession(authOptions) |
| 100 | `/api/case-sessions/[code]/leaderboard` | GET | MISSING | CRITICAL | NO AUTH FOUND |
| 101 | `/api/case-sessions/[code]/respond` | POST | user | WARNING | getServerSession(authOptions) |
| 102 | `/api/case-sessions/[code]/results` | GET | instructor | OK | getServerSession(authOptions) + hasMinRole(instructor) |
| 103 | `/api/cases` | GET, POST | instructor | OK | getServerSession(authOptions) + hasMinRole(instructor, instructor) |
| 104 | `/api/cases/[id]` | GET, PUT | instructor | OK | getServerSession(authOptions) + hasMinRole(instructor, admin, instructor, admin) |
| 105 | `/api/cases/[id]/duplicate` | POST | instructor | OK | getServerSession(authOptions) + hasMinRole(instructor) |
| 106 | `/api/cases/[id]/practice/complete` | POST | user | WARNING | getServerSession(authOptions) |
| 107 | `/api/cases/[id]/practice/history` | GET | user | WARNING | getServerSession(authOptions) |
| 108 | `/api/cases/[id]/practice/progress` | GET | user | WARNING | getServerSession(authOptions) |
| 109 | `/api/cases/[id]/practice/respond` | PUT | user | WARNING | getServerSession(authOptions) |
| 110 | `/api/cases/[id]/practice/start` | POST | user | WARNING | getServerSession(authOptions) |
| 111 | `/api/cases/achievements/[studentId]` | GET | instructor | OK | getServerSession(authOptions) + hasMinRole(instructor) |
| 112 | `/api/cases/achievements/check` | POST | user | WARNING | getServerSession(authOptions) |
| 113 | `/api/cases/generate` | POST | admin | OK | requireAuth + requireAuth('admin') |
| 114 | `/api/cases/generate/bulk` | POST | admin | OK | requireAuth + requireAuth('admin') |
| 115 | `/api/cases/import` | POST | instructor | OK | getServerSession(authOptions) + hasMinRole(instructor) |
| 116 | `/api/cases/leaderboard/[cohortId]` | GET | user | WARNING | getServerSession(authOptions) |
| 117 | `/api/checkin/[token]` | GET, POST | public | OK | Token-based access (public link with secret token) |
| 118 | `/api/clinical/aemt-tracking` | GET, POST | instructor | OK | requireAuth + hasMinRole(lead_instructor, lead_instructor) + requireAuth('instructor') |
| 119 | `/api/clinical/affiliations` | DELETE, GET, POST, PUT | user | WARNING | getServerSession(authOptions) |
| 120 | `/api/clinical/agencies` | GET, POST | instructor | OK | requireAuth + requireAuth('instructor') |
| 121 | `/api/clinical/agencies/[id]` | DELETE, GET, PUT | instructor | OK | requireAuth + requireAuth('instructor') |
| 122 | `/api/clinical/capacity` | GET, PATCH | instructor | OK | requireAuth + hasMinRole(lead_instructor, admin) + requireAuth('instructor') |
| 123 | `/api/clinical/capacity/check` | GET | lead_instructor | OK | requireAuth + requireAuth('lead_instructor') |
| 124 | `/api/clinical/compliance` | GET, POST | instructor | OK | requireAuth + hasMinRole(lead_instructor, lead_instructor) + requireAuth('instructor') |
| 125 | `/api/clinical/emt-tracking` | GET, POST | instructor | OK | requireAuth + hasMinRole(lead_instructor, lead_instructor) + requireAuth('instructor') |
| 126 | `/api/clinical/hours` | GET, POST | instructor | OK | requireAuth + hasMinRole(lead_instructor, lead_instructor) + requireAuth('instructor') |
| 127 | `/api/clinical/internships` | GET, POST | instructor | OK | requireAuth + hasMinRole(lead_instructor, lead_instructor) + requireAuth('instructor') |
| 128 | `/api/clinical/internships/[id]` | DELETE, GET, PUT | instructor | OK | requireAuth + isSuperadmin + hasMinRole(lead_instructor, lead_instructor) + requireAuth('instructor') |
| 129 | `/api/clinical/internships/[id]/closeout` | GET, PATCH, POST | instructor | OK | requireAuth + hasMinRole(lead_instructor, lead_instructor, admin) + requireAuth('instructor') |
| 130 | `/api/clinical/internships/[id]/closeout/documents` | DELETE, POST | lead_instructor | OK | requireAuth + requireAuth('lead_instructor') |
| 131 | `/api/clinical/internships/[id]/closeout/employment` | DELETE, GET, POST, PUT | instructor | OK | requireAuth + hasMinRole(lead_instructor, lead_instructor, lead_instructor, admin) + requireAuth('instructor') |
| 132 | `/api/clinical/internships/[id]/closeout/packet` | GET | instructor | OK | requireAuth + hasMinRole(lead_instructor) + requireAuth('instructor') |
| 133 | `/api/clinical/internships/[id]/closeout/summary` | GET | instructor | OK | requireAuth + hasMinRole(lead_instructor) + requireAuth('instructor') |
| 134 | `/api/clinical/internships/[id]/closeout/surveys` | DELETE, GET, POST, PUT | instructor | OK | requireAuth + hasMinRole(lead_instructor, lead_instructor, lead_instructor, lead_instructor) + requireAuth('instructor') |
| 135 | `/api/clinical/internships/[id]/notify-nremt` | POST | instructor | OK | requireAuth + hasMinRole(lead_instructor) + requireAuth('instructor') |
| 136 | `/api/clinical/internships/[id]/preceptors` | GET, PATCH, POST | lead_instructor | OK | requireAuth + requireAuth('lead_instructor') |
| 137 | `/api/clinical/internships/[id]/preceptors/[assignmentId]` | DELETE, PUT | lead_instructor | OK | requireAuth + requireAuth('lead_instructor') |
| 138 | `/api/clinical/mce` | GET, PATCH, POST | lead_instructor | OK | requireAuth + requireAuth('lead_instructor') |
| 139 | `/api/clinical/overview-all` | GET | instructor | OK | requireAuth + hasMinRole(lead_instructor) + requireAuth('instructor') |
| 140 | `/api/clinical/planning-calendar` | DELETE, GET, POST, PUT | instructor | OK | requireAuth + requireAuth('instructor') |
| 141 | `/api/clinical/preceptor-eval/[token]` | GET, POST | public | OK | Token-based access (public link with secret token) |
| 142 | `/api/clinical/preceptor-eval/send` | POST | instructor | OK | requireAuth + hasMinRole(lead_instructor) + requireAuth('instructor') |
| 143 | `/api/clinical/preceptor-eval/tokens` | GET | instructor | OK | requireAuth + hasMinRole(lead_instructor) + requireAuth('instructor') |
| 144 | `/api/clinical/preceptor-feedback` | GET, POST, PUT | instructor | OK | requireAuth + hasMinRole(instructor, instructor, instructor) + requireAuth('instructor') |
| 145 | `/api/clinical/preceptors` | GET, POST | instructor | OK | requireAuth + hasMinRole(lead_instructor) + requireAuth('instructor') |
| 146 | `/api/clinical/preceptors/[id]` | DELETE, GET, PUT | instructor | OK | requireAuth + requireAuth('instructor') |
| 147 | `/api/clinical/rotations` | GET, POST | instructor | OK | requireAuth + requireAuth('instructor') |
| 148 | `/api/clinical/rotations/[id]` | DELETE, PATCH | instructor | OK | requireAuth + requireAuth('instructor') |
| 149 | `/api/clinical/site-visits` | GET, POST | instructor | OK | requireAuth + hasMinRole(lead_instructor, lead_instructor) + requireAuth('instructor') |
| 150 | `/api/clinical/site-visits/[id]` | DELETE, GET, PUT | instructor | OK | requireAuth + requireAuth('instructor') |
| 151 | `/api/clinical/site-visits/coverage` | GET, POST | instructor | OK | requireAuth + requireAuth('instructor') |
| 152 | `/api/clinical/site-visits/export` | GET | instructor | OK | requireAuth + requireAuth('instructor') |
| 153 | `/api/clinical/sites` | GET, POST | instructor | OK | requireAuth + requireAuth('instructor') |
| 154 | `/api/clinical/sites/[id]` | DELETE, GET, PUT | instructor | OK | requireAuth + requireAuth('instructor') |
| 155 | `/api/clinical/sites/[id]/departments` | DELETE, GET, POST | instructor | OK | requireAuth + requireAuth('instructor') |
| 156 | `/api/clinical/summative-evaluations` | GET, POST | instructor | OK | requireAuth + hasMinRole(lead_instructor, lead_instructor) + requireAuth('instructor') |
| 157 | `/api/clinical/summative-evaluations/[id]` | DELETE, GET, PATCH | instructor | OK | requireAuth + requireAuth('instructor') |
| 158 | `/api/clinical/summative-evaluations/[id]/export` | GET | instructor | OK | requireAuth + requireAuth('instructor') |
| 159 | `/api/clinical/summative-evaluations/[id]/scenario-print` | GET | instructor | OK | requireAuth + requireAuth('instructor') |
| 160 | `/api/clinical/summative-evaluations/[id]/scores` | DELETE, PATCH, POST | instructor | OK | requireAuth + requireAuth('instructor') |
| 161 | `/api/clinical/summative-scenarios` | GET | instructor | OK | requireAuth + requireAuth('instructor') |
| 162 | `/api/compliance` | GET, POST, PUT | instructor | OK | getServerSession(authOptions) + hasMinRole(instructor, instructor, admin) |
| 163 | `/api/config/public` | GET | public | OK | Intentionally public endpoint |
| 164 | `/api/cron/affiliation-expiry` | GET | public | OK | CRON_SECRET verification |
| 165 | `/api/cron/attendance-alerts` | GET | public | OK | CRON_SECRET verification |
| 166 | `/api/cron/availability-reminders` | GET | public | OK | CRON_SECRET verification |
| 167 | `/api/cron/calendar-sync` | GET | public | OK | CRON_SECRET verification |
| 168 | `/api/cron/cert-expiry` | GET | public | OK | CRON_SECRET verification |
| 169 | `/api/cron/clinical-hours-reminder` | GET | public | OK | CRON_SECRET verification |
| 170 | `/api/cron/compliance-expiry` | GET | public | OK | CRON_SECRET verification |
| 171 | `/api/cron/daily-digest` | GET | public | OK | CRON_SECRET verification |
| 172 | `/api/cron/internship-milestones` | GET | public | OK | CRON_SECRET verification |
| 173 | `/api/cron/lab-reminder` | GET | public | OK | CRON_SECRET verification |
| 174 | `/api/cron/scheduled-exports` | GET | public | OK | CRON_SECRET verification |
| 175 | `/api/cron/site-visit-reminders` | GET | public | OK | CRON_SECRET verification |
| 176 | `/api/cron/system-health` | GET | public | OK | CRON_SECRET verification |
| 177 | `/api/cron/weekly-digest` | GET | public | OK | CRON_SECRET verification |
| 178 | `/api/dashboard/cert-expiry` | GET | user | WARNING | getServerSession(authOptions) |
| 179 | `/api/dashboard/layout` | DELETE, GET, PUT | user | WARNING | getServerSession(authOptions) |
| 180 | `/api/dashboard/quick-stats` | GET | instructor | OK | requireAuth + hasMinRole(lead_instructor) + requireAuth('instructor') |
| 181 | `/api/dashboard/recent-activity` | GET | user | WARNING | getServerSession(authOptions) |
| 182 | `/api/deep-links` | DELETE, GET, PATCH, POST | admin | OK | getServerSession(authOptions) + hasMinRole(admin, admin, admin, admin) |
| 183 | `/api/deep-links/qr` | GET | user | WARNING | getServerSession(authOptions) |
| 184 | `/api/errors/log` | POST | user | WARNING | getServerSession(authOptions) |
| 185 | `/api/feedback` | GET, PATCH, POST | instructor | OK | getServerSession(authOptions) + [superadmin, admin, lead_instructor, instructor, volunteer_instructor].includes(role) |
| 186 | `/api/feedback/my-submissions` | GET | user | WARNING | getServerSession(authOptions) |
| 187 | `/api/guest/login` | POST | public | OK | Intentionally public endpoint |
| 188 | `/api/instructor/ce-records` | GET, POST | admin | OK | getServerSession(authOptions) + role check (admin, superadmin) |
| 189 | `/api/instructor/ce-records/[id]` | DELETE | admin | OK | getServerSession(authOptions) + role check (admin, superadmin) |
| 190 | `/api/instructor/history` | GET | lab_lead | OK | getServerSession(authOptions) + [lab_lead, roamer, observer].includes(role) |
| 191 | `/api/instructor/me` | GET | user | WARNING | getServerSession(authOptions) |
| 192 | `/api/instructor/my-stats` | GET | instructor | OK | getServerSession(authOptions) + hasMinRole(instructor) |
| 193 | `/api/instructor/teaching-log` | GET, POST | admin | OK | getServerSession(authOptions) + role check (admin, superadmin) |
| 194 | `/api/instructor/teaching-log/[id]` | DELETE | admin | OK | getServerSession(authOptions) + role check (admin, superadmin) |
| 195 | `/api/instructor/time-clock` | GET, POST, PUT | instructor | OK | getServerSession(authOptions) + hasMinRole(instructor, instructor, instructor) |
| 196 | `/api/instructor/time-clock/[id]` | DELETE, PUT | instructor | OK | getServerSession(authOptions) + hasMinRole(instructor) |
| 197 | `/api/instructor/upcoming-labs` | GET | user | WARNING | getServerSession(authOptions) |
| 198 | `/api/lab-management/assessments/scenario` | GET, POST | instructor | OK | requireAuth + requireAuth('instructor') |
| 199 | `/api/lab-management/assessments/skill` | GET, POST | instructor | OK | requireAuth + requireAuth('instructor') |
| 200 | `/api/lab-management/attendance/at-risk` | GET | instructor | OK | requireAuth + requireAuth('instructor') |
| 201 | `/api/lab-management/ce-records` | GET, POST | instructor | OK | requireAuth + requireAuth('instructor') |
| 202 | `/api/lab-management/ce-records/[id]` | DELETE | instructor | OK | requireAuth + requireAuth('instructor') |
| 203 | `/api/lab-management/ce-requirements` | GET | instructor | OK | requireAuth + requireAuth('instructor') |
| 204 | `/api/lab-management/certifications` | GET, POST | admin | OK | requireAuth + requireAuth('admin') |
| 205 | `/api/lab-management/certifications/[id]` | DELETE, GET, PATCH | instructor | OK | requireAuth + requireAuth('instructor') |
| 206 | `/api/lab-management/checklist-templates` | DELETE, GET, POST, PUT | instructor | OK | requireAuth + requireAuth('instructor') |
| 207 | `/api/lab-management/cohorts` | GET, POST | instructor | OK | requireAuth + requireAuth('instructor') |
| 208 | `/api/lab-management/cohorts/[id]` | DELETE, GET, PATCH | instructor | OK | requireAuth + isSuperadmin + requireAuth('instructor') |
| 209 | `/api/lab-management/cohorts/[id]/archive` | DELETE, POST | instructor | OK | requireAuth + hasMinRole(admin, admin) + requireAuth('instructor') |
| 210 | `/api/lab-management/cohorts/[id]/calendar` | GET | instructor | OK | requireAuth + hasMinRole(instructor) + requireAuth('instructor') |
| 211 | `/api/lab-management/cohorts/[id]/completion` | GET | instructor | OK | requireAuth + hasMinRole(lead_instructor) + requireAuth('instructor') |
| 212 | `/api/lab-management/cohorts/[id]/email` | POST | instructor | OK | requireAuth + hasMinRole(lead_instructor) + requireAuth('instructor') |
| 213 | `/api/lab-management/cohorts/[id]/stats` | GET | instructor | OK | requireAuth + requireAuth('instructor') |
| 214 | `/api/lab-management/competencies` | GET, POST | instructor | OK | requireAuth + hasMinRole(instructor) + requireAuth('instructor') |
| 215 | `/api/lab-management/competencies/report` | GET | instructor | OK | requireAuth + requireAuth('instructor') |
| 216 | `/api/lab-management/costs` | GET, POST | instructor | OK | requireAuth + requireAuth('instructor') |
| 217 | `/api/lab-management/costs/[id]` | DELETE, PUT | instructor | OK | requireAuth + requireAuth('instructor') |
| 218 | `/api/lab-management/custom-skills` | DELETE, GET, POST | instructor | OK | requireAuth + requireAuth('instructor') |
| 219 | `/api/lab-management/daily-notes` | GET, POST | instructor | OK | requireAuth + requireAuth('instructor') |
| 220 | `/api/lab-management/field-trips` | DELETE, GET, POST | instructor | OK | requireAuth + requireAuth('instructor') |
| 221 | `/api/lab-management/field-trips/attendance` | GET, PATCH, POST | instructor | OK | requireAuth + requireAuth('instructor') |
| 222 | `/api/lab-management/flagged-items` | GET, PATCH | instructor | OK | requireAuth + requireAuth('instructor') |
| 223 | `/api/lab-management/groups` | GET, POST, PUT | instructor | OK | requireAuth + requireAuth('instructor') |
| 224 | `/api/lab-management/groups/[id]` | DELETE, GET, PUT | instructor | OK | requireAuth + requireAuth('instructor') |
| 225 | `/api/lab-management/groups/[id]/members` | DELETE, GET, POST, PUT | instructor | OK | requireAuth + requireAuth('instructor') |
| 226 | `/api/lab-management/groups/generate` | POST | instructor | OK | requireAuth + requireAuth('instructor') |
| 227 | `/api/lab-management/instructors` | GET | instructor | OK | requireAuth + requireAuth('instructor') |
| 228 | `/api/lab-management/lab-day-roles` | DELETE, GET, POST | instructor | OK | requireAuth + requireAuth('instructor') + [lab_lead, roamer, observer].includes(role) |
| 229 | `/api/lab-management/lab-day-skills` | GET | instructor | OK | requireAuth + requireAuth('instructor') |
| 230 | `/api/lab-management/lab-days` | GET, POST | instructor | OK | requireAuth + hasMinRole(instructor) + requireAuth('instructor') |
| 231 | `/api/lab-management/lab-days/[id]` | DELETE, GET, PATCH | instructor | OK | requireAuth + isSuperadmin + hasMinRole(instructor) + requireAuth('instructor') |
| 232 | `/api/lab-management/lab-days/[id]/attendance` | GET, POST, PUT | instructor | OK | requireAuth + hasMinRole(instructor, instructor, instructor) + requireAuth('instructor') |
| 233 | `/api/lab-management/lab-days/[id]/attendance/absences` | GET | instructor | OK | requireAuth + hasMinRole(instructor) + requireAuth('instructor') |
| 234 | `/api/lab-management/lab-days/[id]/checkin-token` | DELETE, POST | instructor | OK | requireAuth + hasMinRole(instructor, instructor) + requireAuth('instructor') |
| 235 | `/api/lab-management/lab-days/[id]/checklist` | DELETE, GET, POST, PUT | instructor | OK | requireAuth + requireAuth('instructor') |
| 236 | `/api/lab-management/lab-days/[id]/debrief` | GET, POST, PUT | instructor | OK | requireAuth + requireAuth('instructor') |
| 237 | `/api/lab-management/lab-days/[id]/duplicate` | POST | instructor | OK | requireAuth + hasMinRole(instructor) + requireAuth('instructor') |
| 238 | `/api/lab-management/lab-days/[id]/duplicate-bulk` | POST | instructor | OK | requireAuth + hasMinRole(instructor) + requireAuth('instructor') |
| 239 | `/api/lab-management/lab-days/[id]/equipment` | DELETE, GET, POST, PUT | instructor | OK | requireAuth + requireAuth('instructor') |
| 240 | `/api/lab-management/lab-days/[id]/ratings` | GET, POST | instructor | OK | requireAuth + requireAuth('instructor') |
| 241 | `/api/lab-management/lab-days/[id]/roster` | GET | instructor | OK | requireAuth + hasMinRole(instructor) + requireAuth('instructor') |
| 242 | `/api/lab-management/lab-days/templates` | GET | instructor | OK | requireAuth + hasMinRole(instructor) + requireAuth('instructor') |
| 243 | `/api/lab-management/learning-style-report` | GET | instructor | OK | requireAuth + hasMinRole(instructor) + requireAuth('instructor') |
| 244 | `/api/lab-management/locations` | GET | instructor | OK | requireAuth + requireAuth('instructor') |
| 245 | `/api/lab-management/mentorship` | GET, POST | instructor | OK | requireAuth + hasMinRole(instructor, instructor) + requireAuth('instructor') |
| 246 | `/api/lab-management/mentorship/[id]` | GET, PUT | instructor | OK | requireAuth + hasMinRole(instructor, instructor) + requireAuth('instructor') |
| 247 | `/api/lab-management/mentorship/[id]/logs` | GET, POST | instructor | OK | requireAuth + hasMinRole(instructor, instructor) + requireAuth('instructor') |
| 248 | `/api/lab-management/programs` | GET | instructor | OK | requireAuth + requireAuth('instructor') |
| 249 | `/api/lab-management/request-coverage` | POST | instructor | OK | requireAuth + requireAuth('instructor') |
| 250 | `/api/lab-management/scenario-library` | GET | instructor | OK | requireAuth + requireAuth('instructor') |
| 251 | `/api/lab-management/scenario-library/clone` | POST | instructor | OK | requireAuth + requireAuth('instructor') |
| 252 | `/api/lab-management/scenario-library/favorites` | DELETE, POST | MISSING | CRITICAL | NO AUTH FOUND |
| 253 | `/api/lab-management/scenario-library/ratings` | DELETE, POST | instructor | OK | requireAuth + requireAuth('instructor') |
| 254 | `/api/lab-management/scenario-library/tags` | DELETE, GET, POST | instructor | OK | requireAuth + requireAuth('instructor') |
| 255 | `/api/lab-management/scenarios` | GET, POST | instructor | OK | requireAuth + requireAuth('instructor') |
| 256 | `/api/lab-management/scenarios/[id]` | DELETE, GET, PATCH | instructor | OK | requireAuth + isSuperadmin + requireAuth('instructor') |
| 257 | `/api/lab-management/scenarios/[id]/difficulty-recommendation` | GET, POST | instructor | OK | requireAuth + hasMinRole(instructor, lead_instructor) + requireAuth('instructor') |
| 258 | `/api/lab-management/scenarios/[id]/duplicate` | POST | instructor | OK | requireAuth + requireAuth('instructor') |
| 259 | `/api/lab-management/scenarios/[id]/versions` | GET, POST, PUT | instructor | OK | requireAuth + hasMinRole(instructor, instructor, lead_instructor) + requireAuth('instructor') |
| 260 | `/api/lab-management/scenarios/favorites` | DELETE, GET, POST | instructor | OK | requireAuth + requireAuth('instructor') |
| 261 | `/api/lab-management/scenarios/import` | POST | instructor | OK | requireAuth + requireAuth('instructor') |
| 262 | `/api/lab-management/schedule/conflicts` | POST | instructor | OK | requireAuth + hasMinRole(instructor) + requireAuth('instructor') |
| 263 | `/api/lab-management/schedule/suggestions` | GET | instructor | OK | requireAuth + requireAuth('instructor') |
| 264 | `/api/lab-management/skill-drills` | GET, POST | instructor | OK | requireAuth + hasMinRole(instructor) + requireAuth('instructor') |
| 265 | `/api/lab-management/skill-drills/[id]` | DELETE, GET, PUT | instructor | OK | requireAuth + hasMinRole(instructor, admin, instructor, admin) + requireAuth('instructor') |
| 266 | `/api/lab-management/skill-drills/[id]/documents` | DELETE, GET, PATCH, POST | instructor | OK | requireAuth + requireAuth('instructor') |
| 267 | `/api/lab-management/skill-signoffs` | GET, POST, PUT | instructor | OK | requireAuth + hasMinRole(instructor, instructor, lead_instructor) + requireAuth('instructor') |
| 268 | `/api/lab-management/skills` | GET, POST | instructor | OK | requireAuth + requireAuth('instructor') |
| 269 | `/api/lab-management/skills/[id]/documents` | DELETE, GET, PATCH, POST | instructor | OK | requireAuth + requireAuth('instructor') |
| 270 | `/api/lab-management/station-instructors` | DELETE, GET, POST | instructor | OK | requireAuth + requireAuth('instructor') |
| 271 | `/api/lab-management/station-skills` | DELETE, GET, POST | instructor | OK | requireAuth + requireAuth('instructor') |
| 272 | `/api/lab-management/stations` | GET, POST | instructor | OK | requireAuth + requireAuth('instructor') |
| 273 | `/api/lab-management/stations/[id]` | DELETE, GET, PATCH | instructor | OK | requireAuth + requireAuth('instructor') |
| 274 | `/api/lab-management/stations/[id]/documents` | DELETE, POST | instructor | OK | requireAuth + requireAuth('instructor') |
| 275 | `/api/lab-management/students` | GET, POST | instructor | OK | requireAuth + hasMinRole(instructor, instructor) + requireAuth('instructor') |
| 276 | `/api/lab-management/students/[id]` | DELETE, GET, PATCH | instructor | OK | requireAuth + isSuperadmin + hasMinRole(instructor, instructor) + requireAuth('instructor') |
| 277 | `/api/lab-management/students/[id]/clinical-tasks` | GET | instructor | OK | requireAuth + requireAuth('instructor') |
| 278 | `/api/lab-management/students/[id]/communications` | GET, PATCH, POST | instructor | OK | requireAuth + requireAuth('instructor') |
| 279 | `/api/lab-management/students/[id]/learning-plan` | GET, POST | instructor | OK | requireAuth + hasMinRole(lead_instructor, lead_instructor) + requireAuth('instructor') |
| 280 | `/api/lab-management/students/[id]/learning-plan/notes` | POST | instructor | OK | requireAuth + hasMinRole(lead_instructor) + requireAuth('instructor') |
| 281 | `/api/lab-management/students/[id]/notes` | DELETE, GET, POST, PUT | instructor | OK | requireAuth + hasMinRole(instructor, instructor, instructor, lead_instructor, instructor, lead_instructor) + requireAuth('instructor') |
| 282 | `/api/lab-management/students/[id]/photo` | DELETE, POST | instructor | OK | requireAuth + requireAuth('instructor') |
| 283 | `/api/lab-management/students/[id]/portfolio` | GET | instructor | OK | requireAuth + hasMinRole(instructor) + requireAuth('instructor') |
| 284 | `/api/lab-management/students/[id]/ratings` | GET | instructor | OK | requireAuth + requireAuth('instructor') |
| 285 | `/api/lab-management/students/check-duplicates` | POST | instructor | OK | requireAuth + requireAuth('instructor') |
| 286 | `/api/lab-management/students/import` | GET, POST | instructor | OK | requireAuth + hasMinRole(instructor, instructor) + requireAuth('instructor') |
| 287 | `/api/lab-management/students/notes-summary` | GET | instructor | OK | requireAuth + hasMinRole(instructor) + requireAuth('instructor') |
| 288 | `/api/lab-management/team-leads` | GET, POST | instructor | OK | requireAuth + hasMinRole(instructor, instructor) + requireAuth('instructor') |
| 289 | `/api/lab-management/template-reviews` | GET, POST | instructor | OK | requireAuth + requireAuth('instructor') |
| 290 | `/api/lab-management/template-reviews/[id]` | DELETE, GET, PUT | instructor | OK | requireAuth + requireAuth('instructor') |
| 291 | `/api/lab-management/template-reviews/[id]/finalize` | POST | lead_instructor | OK | requireAuth + requireAuth('lead_instructor') |
| 292 | `/api/lab-management/template-reviews/[id]/items` | GET | instructor | OK | requireAuth + requireAuth('instructor') |
| 293 | `/api/lab-management/template-reviews/[id]/items/[itemId]` | GET, PUT | instructor | OK | requireAuth + requireAuth('instructor') |
| 294 | `/api/lab-management/template-reviews/[id]/items/[itemId]/comments` | POST | instructor | OK | requireAuth + requireAuth('instructor') |
| 295 | `/api/lab-management/templates` | GET, POST | instructor | OK | requireAuth + requireAuth('instructor') |
| 296 | `/api/lab-management/templates/[id]` | DELETE, GET, PUT | instructor | OK | requireAuth + requireAuth('instructor') |
| 297 | `/api/lab-management/timer` | DELETE, GET, PATCH, POST | instructor | OK | requireAuth + requireAuth('instructor') |
| 298 | `/api/lab-management/timer-displays` | GET, POST | instructor | OK | requireAuth + requireAuth('instructor') |
| 299 | `/api/lab-management/timer-displays/[id]` | DELETE, PATCH | instructor | OK | requireAuth + requireAuth('instructor') |
| 300 | `/api/lab-management/timer/active` | GET | instructor | OK | requireAuth + requireAuth('instructor') |
| 301 | `/api/lab-management/timer/adjust` | PATCH | instructor | OK | requireAuth + requireAuth('instructor') |
| 302 | `/api/lab-management/timer/ready` | DELETE, GET, PATCH, POST | instructor | OK | requireAuth + requireAuth('instructor') |
| 303 | `/api/lab-management/users` | GET, PATCH, POST | instructor | OK | requireAuth + requireAuth('instructor') |
| 304 | `/api/lab-management/weekly-templates` | DELETE, GET, POST, PUT | instructor | OK | requireAuth + requireAuth('instructor') |
| 305 | `/api/lab-management/weekly-templates/generate` | POST | lead_instructor | OK | requireAuth + requireAuth('lead_instructor') |
| 306 | `/api/notifications` | DELETE, GET, POST | admin | OK | getServerSession(authOptions) + role check (admin, superadmin) |
| 307 | `/api/notifications/archive` | PUT | user | WARNING | getServerSession(authOptions) |
| 308 | `/api/notifications/digest-preview` | GET | user | WARNING | getServerSession(authOptions) |
| 309 | `/api/notifications/email-preferences` | GET, PUT | user | WARNING | getServerSession(authOptions) |
| 310 | `/api/notifications/preferences` | DELETE, GET, PUT | instructor | OK | getServerSession(authOptions) + role check (role check (inferred: instructor+)) |
| 311 | `/api/notifications/read` | PUT | user | WARNING | getServerSession(authOptions) |
| 312 | `/api/onboarding/assignments` | DELETE, GET, POST | admin | OK | getServerSession(authOptions) + role check (admin, superadmin) |
| 313 | `/api/onboarding/dashboard` | GET | admin | OK | getServerSession(authOptions) + role check (admin, superadmin) |
| 314 | `/api/onboarding/tasks/[id]/progress` | GET, PATCH | admin | OK | getServerSession(authOptions) + role check (admin, superadmin) |
| 315 | `/api/onboarding/templates` | GET | user | WARNING | getServerSession(authOptions) |
| 316 | `/api/osce/admin/schedule` | GET | admin | OK | requireAuth + requireAuth('admin') |
| 317 | `/api/osce/admin/students/reorder` | POST | admin | OK | requireAuth + requireAuth('admin') |
| 318 | `/api/osce/events` | GET, POST | admin | OK | requireAuth + requireAuth('admin') |
| 319 | `/api/osce/events/[id]` | DELETE, GET, PUT | admin | OK | requireAuth + requireAuth('admin') |
| 320 | `/api/osce/events/[id]/calendar-invites` | GET, POST | admin | OK | requireAuth + requireAuth('admin') |
| 321 | `/api/osce/events/[id]/observers` | DELETE, GET, POST | admin | OK | requireAuth + requireAuth('admin') |
| 322 | `/api/osce/events/[id]/observers/[observerId]` | DELETE, GET, PUT | admin | OK | requireAuth + requireAuth('admin') |
| 323 | `/api/osce/events/[id]/observers/export` | GET | admin | OK | requireAuth + requireAuth('admin') |
| 324 | `/api/osce/events/[id]/schedule` | GET | admin | OK | requireAuth + requireAuth('admin') |
| 325 | `/api/osce/events/[id]/student-agencies` | DELETE, GET, POST | admin | OK | requireAuth + requireAuth('admin') |
| 326 | `/api/osce/events/[id]/students/reorder` | POST | admin | OK | requireAuth + requireAuth('admin') |
| 327 | `/api/osce/events/[id]/time-blocks` | DELETE, GET, POST, PUT | admin | OK | requireAuth + requireAuth('admin') |
| 328 | `/api/osce/observers` | GET | admin | OK | requireAuth + requireAuth('admin') |
| 329 | `/api/osce/observers/[id]` | DELETE | admin | OK | requireAuth + requireAuth('admin') |
| 330 | `/api/osce/observers/export` | GET | admin | OK | requireAuth + requireAuth('admin') |
| 331 | `/api/osce/public/[slug]` | GET | MISSING | CRITICAL | NO AUTH FOUND |
| 332 | `/api/osce/public/[slug]/register` | POST | MISSING | CRITICAL | NO AUTH FOUND |
| 333 | `/api/osce/register` | POST | MISSING | CRITICAL | NO AUTH FOUND |
| 334 | `/api/osce/student-agencies` | DELETE, GET, POST | admin | OK | requireAuth + requireAuth('admin') |
| 335 | `/api/osce/time-blocks` | GET | MISSING | CRITICAL | NO AUTH FOUND |
| 336 | `/api/peer-evaluations` | GET, POST | instructor | OK | getServerSession(authOptions) + hasMinRole(instructor) |
| 337 | `/api/peer-evaluations/aggregate` | GET | instructor | OK | getServerSession(authOptions) + hasMinRole(instructor) |
| 338 | `/api/polls` | DELETE, GET, POST | user | WARNING | getServerSession(authOptions) |
| 339 | `/api/reports/attendance` | GET | instructor | OK | requireAuth + requireAuth('instructor') |
| 340 | `/api/reports/availability-patterns` | GET | instructor | OK | requireAuth + hasMinRole(lead_instructor) + requireAuth('instructor') |
| 341 | `/api/reports/builder` | DELETE, GET, POST, PUT | instructor | OK | requireAuth + hasMinRole(instructor, instructor, instructor, admin, instructor, admin) + requireAuth('instructor') |
| 342 | `/api/reports/builder/[id]` | GET | instructor | OK | requireAuth + hasMinRole(instructor, admin) + requireAuth('instructor') |
| 343 | `/api/reports/clinical-hours` | GET | instructor | OK | requireAuth + requireAuth('instructor') |
| 344 | `/api/reports/clinical-placements` | GET | lead_instructor | OK | requireAuth + requireAuth('lead_instructor') |
| 345 | `/api/reports/closeout-surveys` | GET | instructor | OK | requireAuth + hasMinRole(admin) + requireAuth('instructor') |
| 346 | `/api/reports/cohort-comparison` | POST | instructor | OK | requireAuth + hasMinRole(lead_instructor) + requireAuth('instructor') |
| 347 | `/api/reports/gradebook` | GET | instructor | OK | requireAuth + hasMinRole(instructor) + requireAuth('instructor') |
| 348 | `/api/reports/instructor-analytics` | GET | lead_instructor | OK | requireAuth + requireAuth('lead_instructor') |
| 349 | `/api/reports/instructor-workload` | GET | instructor | OK | requireAuth + hasMinRole(lead_instructor) + requireAuth('instructor') + [instructor, lead_instructor].includes(role) |
| 350 | `/api/reports/internship-status` | GET | instructor | OK | requireAuth + requireAuth('instructor') |
| 351 | `/api/reports/lab-progress` | GET | instructor | OK | requireAuth + requireAuth('instructor') |
| 352 | `/api/reports/onboarding-status` | GET | instructor | OK | requireAuth + requireAuth('instructor') |
| 353 | `/api/reports/program-outcomes` | DELETE, GET, POST | instructor | OK | requireAuth + hasMinRole(lead_instructor, admin, admin) + requireAuth('instructor') |
| 354 | `/api/reports/program-overview` | GET | lead_instructor | OK | requireAuth + requireAuth('lead_instructor') |
| 355 | `/api/reports/scenario-analytics` | GET | instructor | OK | requireAuth + hasMinRole(lead_instructor) + requireAuth('instructor') |
| 356 | `/api/reports/scenario-usage` | GET | instructor | OK | requireAuth + requireAuth('instructor') |
| 357 | `/api/reports/scenario-usage-overview` | GET | lead_instructor | OK | requireAuth + requireAuth('lead_instructor') |
| 358 | `/api/reports/student-dashboard` | GET | lead_instructor | OK | requireAuth + requireAuth('lead_instructor') |
| 359 | `/api/reports/student-progress` | GET | instructor | OK | requireAuth + requireAuth('instructor') |
| 360 | `/api/reports/team-leads` | GET | instructor | OK | requireAuth + requireAuth('instructor') |
| 361 | `/api/resources` | DELETE, GET, POST, PUT | instructor | OK | getServerSession(authOptions) + hasMinRole(instructor, instructor, admin) |
| 362 | `/api/resources/medications` | GET, POST | admin | OK | getServerSession(authOptions) + hasMinRole(admin) |
| 363 | `/api/resources/medications/[id]` | DELETE, PUT | admin | OK | getServerSession(authOptions) + hasMinRole(admin, admin) |
| 364 | `/api/resources/versions` | GET | instructor | OK | getServerSession(authOptions) + hasMinRole(instructor) |
| 365 | `/api/scheduling/availability` | GET, POST | user | WARNING | getServerSession(authOptions) |
| 366 | `/api/scheduling/availability-status` | GET | lead_instructor | OK | getServerSession(authOptions) + hasMinRole(lead_instructor) |
| 367 | `/api/scheduling/availability/[id]` | DELETE, PUT | user | WARNING | getServerSession(authOptions) |
| 368 | `/api/scheduling/availability/all` | GET | lead_instructor | OK | getServerSession(authOptions) + hasMinRole(lead_instructor) |
| 369 | `/api/scheduling/availability/bulk` | DELETE, POST | user | WARNING | getServerSession(authOptions) |
| 370 | `/api/scheduling/availability/suggestions` | GET | user | WARNING | getServerSession(authOptions) |
| 371 | `/api/scheduling/part-timer-status` | GET | user | WARNING | getServerSession(authOptions) |
| 372 | `/api/scheduling/reports` | GET | user | WARNING | getServerSession(authOptions) |
| 373 | `/api/scheduling/resource-bookings` | GET, POST | instructor | OK | getServerSession(authOptions) + hasMinRole(instructor) |
| 374 | `/api/scheduling/resource-bookings/[id]` | DELETE, PUT | admin | OK | getServerSession(authOptions) + hasMinRole(admin, admin) |
| 375 | `/api/scheduling/resource-bookings/resources` | GET, PATCH, POST | admin | OK | getServerSession(authOptions) + hasMinRole(admin, admin) |
| 376 | `/api/scheduling/send-availability-reminders` | POST | lead_instructor | OK | getServerSession(authOptions) + hasMinRole(lead_instructor) |
| 377 | `/api/scheduling/shifts` | GET, POST | admin | OK | getServerSession(authOptions) + role check (admin, superadmin) |
| 378 | `/api/scheduling/shifts/[id]` | DELETE, GET, PUT | admin | OK | getServerSession(authOptions) + role check (admin, superadmin) |
| 379 | `/api/scheduling/shifts/[id]/signup` | DELETE, POST | user | WARNING | getServerSession(authOptions) |
| 380 | `/api/scheduling/shifts/[id]/signup/[signupId]` | POST | admin | OK | getServerSession(authOptions) + role check (admin, superadmin) |
| 381 | `/api/scheduling/signups/pending` | GET | admin | OK | getServerSession(authOptions) + role check (admin, superadmin) |
| 382 | `/api/scheduling/substitute-requests` | GET, POST | instructor | OK | getServerSession(authOptions) + hasMinRole(lead_instructor, instructor, instructor) |
| 383 | `/api/scheduling/substitute-requests/[id]` | DELETE, PUT | instructor | OK | getServerSession(authOptions) + hasMinRole(instructor, lead_instructor, admin) |
| 384 | `/api/scheduling/swaps/[id]/assign` | PUT | admin | OK | getServerSession(authOptions) + role check (admin, superadmin) |
| 385 | `/api/scheduling/swaps/[id]/interest` | DELETE, GET, POST | user | WARNING | getServerSession(authOptions) |
| 386 | `/api/scheduling/team-availability` | GET, POST | user | WARNING | getServerSession(authOptions) |
| 387 | `/api/scheduling/team-availability/saved` | DELETE, GET | user | WARNING | getServerSession(authOptions) |
| 388 | `/api/scheduling/trades` | GET, POST, PUT | admin | OK | getServerSession(authOptions) + role check (admin, superadmin) |
| 389 | `/api/search` | GET | user | WARNING | getServerSession(authOptions) |
| 390 | `/api/seating/charts` | GET, POST | instructor | OK | requireAuth + requireAuth('instructor') |
| 391 | `/api/seating/charts/[id]` | DELETE, GET, PUT | instructor | OK | requireAuth + requireAuth('instructor') |
| 392 | `/api/seating/charts/[id]/assignments` | DELETE, GET, PUT | instructor | OK | requireAuth + requireAuth('instructor') |
| 393 | `/api/seating/charts/[id]/generate` | POST | instructor | OK | requireAuth + requireAuth('instructor') |
| 394 | `/api/seating/classrooms` | GET | instructor | OK | requireAuth + requireAuth('instructor') |
| 395 | `/api/seating/learning-styles` | DELETE, GET, POST | instructor | OK | requireAuth + requireAuth('instructor') |
| 396 | `/api/seating/preferences` | DELETE, GET, POST | instructor | OK | requireAuth + requireAuth('instructor') |
| 397 | `/api/settings/2fa/disable` | POST | user | WARNING | getServerSession(authOptions) |
| 398 | `/api/settings/2fa/setup` | POST | user | WARNING | getServerSession(authOptions) |
| 399 | `/api/settings/2fa/status` | GET | user | WARNING | getServerSession(authOptions) |
| 400 | `/api/settings/2fa/verify` | POST | user | WARNING | getServerSession(authOptions) |
| 401 | `/api/settings/calendar-sync` | GET, PUT | user | WARNING | requireAuth |
| 402 | `/api/settings/notifications` | GET, PUT | user | WARNING | getServerSession(authOptions) |
| 403 | `/api/settings/sessions` | GET, POST | user | WARNING | getServerSession(authOptions) |
| 404 | `/api/settings/sessions/[id]` | DELETE | user | WARNING | getServerSession(authOptions) |
| 405 | `/api/settings/sessions/revoke-all` | POST | user | WARNING | getServerSession(authOptions) |
| 406 | `/api/skill-sheets` | GET | instructor | OK | getServerSession(authOptions) + hasMinRole(instructor) |
| 407 | `/api/skill-sheets/[id]` | GET | instructor | OK | getServerSession(authOptions) + hasMinRole(instructor) |
| 408 | `/api/skill-sheets/[id]/evaluate` | POST | instructor | OK | getServerSession(authOptions) + hasMinRole(instructor) |
| 409 | `/api/skill-sheets/by-skill-name` | GET | instructor | OK | requireAuth + requireAuth('instructor') |
| 410 | `/api/skill-sheets/by-skill-name/bulk` | POST | instructor | OK | requireAuth + requireAuth('instructor') |
| 411 | `/api/skill-sheets/evaluations-by-lab-day` | GET | instructor | OK | getServerSession(authOptions) + hasMinRole(instructor) |
| 412 | `/api/stations/completions` | GET, POST | instructor | OK | getServerSession(authOptions) + hasMinRole(instructor) |
| 413 | `/api/stations/completions/bulk` | POST | instructor | OK | getServerSession(authOptions) + hasMinRole(instructor) |
| 414 | `/api/stations/pool` | GET, POST | instructor | OK | getServerSession(authOptions) + hasMinRole(instructor) |
| 415 | `/api/stations/pool/[id]` | DELETE, GET, PATCH | instructor | OK | getServerSession(authOptions) + hasMinRole(instructor, admin) |
| 416 | `/api/stations/pool/favorites` | DELETE, GET, POST | instructor | OK | requireAuth + requireAuth('instructor') |
| 417 | `/api/student/attendance-appeals` | GET, POST | student | OK | getServerSession(authOptions) + role check (student) |
| 418 | `/api/student/available-labs` | GET | student | OK | getServerSession(authOptions) + role check (student) |
| 419 | `/api/student/available-labs/cancel` | POST | student | OK | getServerSession(authOptions) + role check (student) |
| 420 | `/api/student/available-labs/my-signups` | GET | student | OK | getServerSession(authOptions) + role check (student) |
| 421 | `/api/student/available-labs/signup` | POST | student | OK | getServerSession(authOptions) + role check (student) |
| 422 | `/api/student/communication-preferences` | GET, PUT | student | OK | getServerSession(authOptions) + role check (student) |
| 423 | `/api/student/completions` | GET | student | OK | getServerSession(authOptions) + role check (student) |
| 424 | `/api/student/documents` | GET, POST | student | OK | getServerSession(authOptions) + role check (student) |
| 425 | `/api/student/documents/[id]` | DELETE, GET | student | OK | getServerSession(authOptions) + role check (student) |
| 426 | `/api/student/documents/requests` | GET, POST | student | OK | getServerSession(authOptions) + role check (student) |
| 427 | `/api/student/ekg-scenarios` | GET | student | OK | getServerSession(authOptions) + role check (student) |
| 428 | `/api/student/labs` | GET | student | OK | getServerSession(authOptions) + role check (student) |
| 429 | `/api/student/my-progress` | GET | student | OK | getServerSession(authOptions) + role check (student) |
| 430 | `/api/student/profile` | GET, PUT | student | OK | getServerSession(authOptions) + role check (student) |
| 431 | `/api/student/skill-sheets` | GET | student | OK | getServerSession(authOptions) + role check (student) |
| 432 | `/api/students` | GET | user | WARNING | getServerSession(authOptions) |
| 433 | `/api/students/[id]/progress` | GET | instructor | OK | getServerSession(authOptions) + hasMinRole(instructor) |
| 434 | `/api/students/[id]/skill-evaluations` | GET | instructor | OK | getServerSession(authOptions) + hasMinRole(instructor) |
| 435 | `/api/submissions` | GET, POST | instructor | OK | requireAuth + getServerSession(authOptions) + requireAuth('instructor') |
| 436 | `/api/tasks` | GET, POST | user | WARNING | getServerSession(authOptions) |
| 437 | `/api/tasks/[id]` | DELETE, GET, PATCH | user | WARNING | getServerSession(authOptions) |
| 438 | `/api/tasks/[id]/comments` | GET, POST | user | WARNING | getServerSession(authOptions) |
| 439 | `/api/tasks/bulk` | DELETE, PATCH | user | WARNING | getServerSession(authOptions) |
| 440 | `/api/timer-display` | DELETE, GET, PATCH, POST | user | WARNING | getServerSession(authOptions) |
| 441 | `/api/timer-display/[token]` | GET | public | OK | Token-based access (public link with secret token) |
| 442 | `/api/tracking/ekg-scores` | GET, POST | instructor | OK | getServerSession(authOptions) + hasMinRole(instructor) |
| 443 | `/api/tracking/protocol-completions` | GET, POST | instructor | OK | getServerSession(authOptions) + hasMinRole(instructor) |
| 444 | `/api/tracking/scenarios` | GET, POST | instructor | OK | getServerSession(authOptions) + hasMinRole(instructor) |
| 445 | `/api/user-preferences/tour` | GET, POST | user | WARNING | getServerSession(authOptions) |
| 446 | `/api/user/preferences` | DELETE, GET, PUT | instructor | OK | getServerSession(authOptions) + role check (role check (inferred: instructor+)) |
| 447 | `/api/users/list` | GET | instructor | OK | requireAuth + requireAuth('instructor') |

## Methodology

This audit was generated by scanning all `route.ts` files under `app/api/` for:

- `getServerSession(authOptions)` -- NextAuth session verification with proper config
- `getServerSession()` -- Bare session check (flagged as CRITICAL: missing authOptions)
- `requireAuth(minRole?)` from `@/lib/api-auth` -- Wrapper that internally calls getServerSession(authOptions)
- `hasMinRole(session, 'role')` -- Role hierarchy check from `lib/permissions.ts`
- `isSuperadmin(session)` -- Superadmin-only check
- `requireRole('role')` -- Role requirement pattern
- `['role1', 'role2'].includes(role)` -- Array-based role checks
- `CRON_SECRET` -- Cron job token verification
- Direct role comparisons (e.g., `role === 'admin'`)

### Role Hierarchy

`superadmin` > `admin` > `lead_instructor` > `instructor` > `user` > `guest`

---
*Generated by `scripts/audit-permissions-gen.js` on March 8, 2026*

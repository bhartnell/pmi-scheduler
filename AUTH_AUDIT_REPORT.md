# API Auth Audit Report

**Date:** 2026-03-21
**Total API routes:** 529

## Summary

| Pattern | Count | Status |
|---------|-------|--------|
| A - getServerSession | 148 | OK |
| C - requireAuth helper | 350 | OK |
| D - Cron (CRON_SECRET) | 18 | All verified |
| E - Public (intentional) | 13 | Documented |
| F - No auth (BUG) | 0 | None found |

## Pattern F Routes Fixed

**No Pattern F routes were found.** All 529 routes either have auth checks or are intentionally public.

## FERPA Routes Verified

All FERPA-critical routes have authentication. Auth pattern, role check, and audit logging status:

| Route | Auth | Role Check | Audit |
|-------|------|------------|-------|
| /api/students | getServerSession | No | Yes |
| /api/students/[id]/progress | getServerSession | Yes | No |
| /api/students/[id]/skill-evaluations | getServerSession | Yes | Yes |
| /api/lab-management/students | requireAuth | Yes | No |
| /api/lab-management/students/check-duplicates | requireAuth | Yes | No |
| /api/lab-management/students/import | requireAuth | Yes | Yes |
| /api/lab-management/students/notes-summary | requireAuth | Yes | No |
| /api/lab-management/students/[id] | requireAuth | Yes | No |
| /api/lab-management/students/[id]/clinical-tasks | requireAuth | Yes | No |
| /api/lab-management/students/[id]/communications | requireAuth | Yes | No |
| /api/lab-management/students/[id]/learning-plan | requireAuth | Yes | No |
| /api/lab-management/students/[id]/learning-plan/notes | requireAuth | Yes | No |
| /api/lab-management/students/[id]/notes | requireAuth | Yes | No |
| /api/lab-management/students/[id]/photo | requireAuth | Yes | No |
| /api/lab-management/students/[id]/portfolio | requireAuth | Yes | No |
| /api/lab-management/students/[id]/ratings | requireAuth | Yes | No |
| /api/clinical/hours | requireAuth | Yes | Yes |
| /api/clinical/internships | requireAuth | Yes | Yes |
| /api/clinical/internships/[id] | requireAuth | Yes | No |
| /api/clinical/internships/[id]/closeout | requireAuth | Yes | No |
| /api/clinical/internships/[id]/closeout/documents | requireAuth | Yes | No |
| /api/clinical/internships/[id]/closeout/employment | requireAuth | Yes | No |
| /api/clinical/internships/[id]/closeout/packet | requireAuth | Yes | No |
| /api/clinical/internships/[id]/closeout/summary | requireAuth | Yes | No |
| /api/clinical/internships/[id]/closeout/surveys | requireAuth | Yes | No |
| /api/clinical/internships/[id]/notify-nremt | requireAuth | Yes | No |
| /api/clinical/internships/[id]/preceptors | requireAuth | Yes | No |
| /api/clinical/internships/[id]/preceptors/[assignmentId] | requireAuth | Yes | No |
| /api/skill-sheets/[id]/evaluate | getServerSession | Yes | No |
| /api/skill-sheets/[id]/evaluations | getServerSession | Yes | No |
| /api/skill-sheets/evaluations/batch-print | getServerSession | Yes | No |
| /api/skill-sheets/evaluations/print | getServerSession | Yes | No |
| /api/skill-sheets/evaluations/send-batch-email | getServerSession | Yes | No |
| /api/skill-sheets/evaluations/send-email | getServerSession | Yes | No |
| /api/lab-management/assessments/scenario | requireAuth | Yes | Yes |
| /api/lab-management/assessments/scenario/send-email | requireAuth | Yes | No |
| /api/lab-management/assessments/skill | requireAuth | Yes | Yes |
| /api/lab-management/attendance/at-risk | requireAuth | Yes | No |
| /api/admin/data-export | requireAuth | Yes | Yes |

## Public Routes Documented

All intentionally public routes now have explicit `// PUBLIC:` comments:

| Route | Justification |
|-------|---------------|
| /api/auth/[...nextauth] | NextAuth.js handler — the auth endpoint itself |
| /api/case-sessions/[code] | Session status polling — students join via code, no PII exposed |
| /api/case-sessions/[code]/leaderboard | Anonymized leaderboard (initials + points only) |
| /api/checkin/[token] | Token-based student self-check-in, rate-limited |
| /api/clinical/preceptor-eval/[token] | Token-based preceptor evaluation form for external preceptors |
| /api/config/public | Public branding/legal/feature flag config only |
| /api/guest/login | Guest login for external observers — rate-limited |
| /api/lab-management/scenario-library/favorites | Deprecated stub returning 410 Gone |
| /api/osce/public/[slug] | Public OSCE event details page |
| /api/osce/public/[slug]/register | Public OSCE observer registration |
| /api/osce/register | Public OSCE registration (backward compat) |
| /api/osce/time-blocks | Public OSCE time block listing with observer counts |
| /api/timer-display/[token] | Token-based kiosk timer display — no sensitive data |

## Cron Routes

All 18 cron routes verify CRON_SECRET via authorization header:

| Route | CRON_SECRET | Status |
|-------|-------------|--------|
| /api/cron/affiliation-expiry | Yes | OK |
| /api/cron/attendance-alerts | Yes | OK |
| /api/cron/availability-reminders | Yes | OK |
| /api/cron/calendar-sync | Yes | OK |
| /api/cron/cert-expiry | Yes | OK |
| /api/cron/clinical-hours-reminder | Yes | OK |
| /api/cron/compliance-expiry | Yes | OK |
| /api/cron/compliance-reminders | Yes | OK |
| /api/cron/daily-digest | Yes | OK |
| /api/cron/data-export | Yes | OK |
| /api/cron/debrief-reminder | Yes | OK |
| /api/cron/internship-milestones | Yes | OK |
| /api/cron/lab-reminder | Yes | OK |
| /api/cron/lvfr-weekly-report | Yes | OK |
| /api/cron/scheduled-exports | Yes | OK |
| /api/cron/site-visit-reminders | Yes | OK |
| /api/cron/system-health | Yes | OK |
| /api/cron/weekly-digest | Yes (delegates to daily-digest handler) | OK |

# PMI EMS Scheduler -- Dead Code Report
> Auto-generated from comprehensive codebase scan -- March 8, 2026

## Summary

| Category | Count |
|----------|-------|
| Potentially unused imports | 53 |
| Potentially orphaned files | 13 |
| Large commented-out blocks (10+ lines) | 45 |
| TODO/FIXME/HACK comments | 10 |
| Console.log statements | 39 |

---

## 1. Potentially Unused Imports

Detected via static analysis: each named import below appears only once in the file (on its import line) and is not referenced elsewhere in the same file. Type-only imports were excluded.

| File | Unused Import | Line |
|------|--------------|------|
| `app/api/admin/certification-compliance/route.ts` | `createClient` | 2 |
| `app/api/admin/scenarios/bulk-import/route.ts` | `getSupabaseAdmin` | 3 |
| `app/api/admin/users/route.ts` | `createClient` | 2 |
| `app/api/calendar/connect/route.ts` | `NextRequest` | 1 |
| `app/api/feedback/route.ts` | `createClient` | 2 |
| `app/api/guest/login/route.ts` | `createClient` | 2 |
| `app/api/instructor/me/route.ts` | `createClient` | 2 |
| `app/api/instructor/upcoming-labs/route.ts` | `createClient` | 2 |
| `app/api/lab-management/checklist-templates/route.ts` | `hasMinRole` | 4 |
| `app/api/lab-management/programs/route.ts` | `NextRequest` | 1 |
| `app/api/onboarding/tasks/[id]/progress/route.ts` | `createClient` | 4 |
| `app/api/onboarding/templates/route.ts` | `createClient` | 4 |
| `app/api/scheduling/availability/bulk/route.ts` | `createClient` | 2 |
| `app/api/scheduling/availability/route.ts` | `createClient` | 2 |
| `app/api/scheduling/availability/[id]/route.ts` | `createClient` | 2 |
| `app/api/scheduling/shifts/route.ts` | `createClient` | 2 |
| `app/api/scheduling/shifts/[id]/route.ts` | `createClient` | 2 |
| `app/api/scheduling/shifts/[id]/signup/route.ts` | `createClient` | 2 |
| `app/api/scheduling/shifts/[id]/signup/[signupId]/route.ts` | `createClient` | 2 |
| `app/api/scheduling/signups/pending/route.ts` | `createClient` | 2 |
| `app/api/seating/classrooms/route.ts` | `NextRequest` | 1 |
| `app/api/stations/completions/bulk/route.ts` | `createClient` | 2 |
| `app/api/stations/completions/route.ts` | `createClient` | 2 |
| `app/api/stations/completions/route.ts` | `isStudent` | 5 |
| `app/api/stations/pool/route.ts` | `createClient` | 2 |
| `app/api/stations/pool/route.ts` | `canManageContent` | 5 |
| `app/api/stations/pool/[id]/route.ts` | `createClient` | 2 |
| `app/api/stations/pool/[id]/route.ts` | `canManageContent` | 5 |
| `app/api/student/completions/route.ts` | `createClient` | 2 |
| `app/api/student/ekg-scenarios/route.ts` | `createClient` | 2 |
| `app/api/students/route.ts` | `createClient` | 3 |
| `app/api/tasks/route.ts` | `createClient` | 2 |
| `app/api/tasks/[id]/comments/route.ts` | `createClient` | 2 |
| `app/api/tasks/[id]/route.ts` | `createClient` | 2 |
| `app/api/timer-display/route.ts` | `createClient` | 4 |
| `app/api/timer-display/[token]/route.ts` | `createClient` | 2 |
| `app/api/tracking/ekg-scores/route.ts` | `createClient` | 2 |
| `app/api/tracking/protocol-completions/route.ts` | `createClient` | 2 |
| `app/api/tracking/scenarios/route.ts` | `createClient` | 2 |
| `app/api/user/preferences/route.ts` | `createClient` | 4 |
| `app/clinical/internships/page.tsx` | `isSuperadmin` | 30 |
| `app/clinical/preceptors/page.tsx` | `canAccessClinical` | 22 |
| `app/clinical/rotation-scheduler/page.tsx` | `useRef` | 5 |
| `app/instructor/page.tsx` | `canManageContent` | 22 |
| `app/lab-management/groups/page.tsx` | `useRef` | 5 |
| `app/lab-management/scenario-library/page.tsx` | `canCreateScenarios` | 30 |
| `app/lab-management/skills/competencies/page.tsx` | `useRef` | 5 |
| `app/lab-management/skills/competencies/report/page.tsx` | `hasMinRole` | 19 |
| `app/page.tsx` | `getRoleLabel` | 33 |
| `app/page.tsx` | `getRoleBadgeClasses` | 33 |
| `app/scheduling/page.tsx` | `isDirector` | 23 |
| `components/cases/BadgeShowcase.tsx` | `Loader2` | 4 |
| `components/cases/Leaderboard.tsx` | `Loader2` | 4 |

**Pattern observed**: The most common unused import is `createClient` from `@supabase/supabase-js` (found in 25+ API route files). These files likely migrated to `getSupabaseAdmin` from `@/lib/supabase` but kept the old import. Three page files import `useRef` from React without using it. Several permission-check functions (`canManageContent`, `isStudent`, `hasMinRole`, etc.) are imported but never called.

---

## 2. Potentially Orphaned Files

Files that exist in `components/`, `hooks/`, or `lib/` but are not imported by any other file in the codebase.

| File | Notes |
|------|-------|
| `components/CapacityWarning.tsx` | Clinical capacity warning component; zero imports found |
| `components/LabDayTemplateSelector.tsx` | Lab day template picker; zero imports found |
| `components/LearningStyleBadge.tsx` | Displays learning style badge; zero imports found |
| `components/ShareLink.tsx` | Copy-to-clipboard share link component; zero imports found |
| `components/SwapInterestPanel.tsx` | Shift swap interest panel; zero imports found |
| `components/PrintButton.tsx` | Generic print button; zero imports found |
| `components/cases/AchievementCelebration.tsx` | Full-screen achievement celebration modal; zero imports found |
| `components/cases/BadgeShowcase.tsx` | Student badge showcase; zero imports found |
| `hooks/usePrograms.ts` | Programs data hook; zero imports found |
| `hooks/useLocations.ts` | Locations data hook; zero imports found |
| `hooks/useNotifications.ts` | Notifications polling hook; zero imports found |
| `lib/api-client.ts` | Fetch wrapper with offline detection and retry logic; zero imports found |
| `components/ScenarioDifficultyRecommendation.tsx` | Scenario difficulty suggestion; zero imports found |

### Borderline / Single-Consumer Files

These are imported by exactly one file. Not orphans, but worth noting for awareness:

| File | Single Consumer |
|------|----------------|
| `components/LabCalendarPanel.tsx` | `app/scheduling/shifts/new/page.tsx` |
| `components/FieldTripAttendance.tsx` | `app/lab-management/cohorts/[id]/page.tsx` |
| `components/StudentCommunications.tsx` | `app/lab-management/students/[id]/page.tsx` |
| `components/ScenarioVersionHistory.tsx` | `app/lab-management/scenarios/[id]/page.tsx` |
| `components/SkillSheetPanel.tsx` | `app/lab-management/grade/station/[id]/page.tsx` |
| `components/TagInput.tsx` | `components/cases/CaseEditor.tsx` |
| `hooks/useScenarios.ts` | `app/lab-management/scenarios/page.tsx` |
| `hooks/useSkillSheets.ts` | `app/skill-sheets/page.tsx` |
| `hooks/useLabDays.ts` | `app/lab-management/schedule/page.tsx` |

---

## 3. Commented-Out Code Blocks (>10 lines)

Blocks of 10 or more consecutive comment lines. Categorized by type.

### JSDoc Module Headers / API Documentation

| File | Lines | Size |
|------|-------|------|
| `app/admin/bulk-operations/page.tsx` | 3-16 | 14 lines |
| `app/admin/incidents/page.tsx` | 3-13 | 11 lines |
| `app/admin/webhooks/page.tsx` | 3-14 | 12 lines |
| `app/api/admin/email-stats/route.ts` | 5-14 | 10 lines |
| `app/api/errors/log/route.ts` | 7-17 | 11 lines |
| `app/api/lab-management/lab-days/templates/route.ts` | 6-16 | 11 lines |
| `app/api/lab-management/learning-style-report/route.ts` | 6-18 | 13 lines |
| `app/api/lab-management/schedule/conflicts/route.ts` | 12-25 | 14 lines |
| `app/api/lab-management/schedule/suggestions/route.ts` | 5-15 | 11 lines |
| `app/api/osce/events/[id]/calendar-invites/route.ts` | 10-20 | 11 lines |
| `app/api/peer-evaluations/aggregate/route.ts` | 7-19 | 13 lines |
| `app/api/peer-evaluations/route.ts` | 7-19 | 13 lines |
| `app/api/scheduling/availability/all/route.ts` | 18-27 | 10 lines |
| `app/api/stations/completions/bulk/route.ts` | 27-37 | 11 lines |
| `app/api/student/labs/route.ts` | 6-16 | 11 lines |
| `app/api/student/my-progress/route.ts` | 6-18 | 13 lines |
| `app/api/student/skill-sheets/route.ts` | 6-15 | 10 lines |
| `app/clinical/layout.tsx` | 8-18 | 11 lines |
| `app/lab-management/stations/log/page.tsx` | 3-12 | 10 lines |
| `app/student/my-progress/page.tsx` | 3-13 | 11 lines |
| `app/student/profile/page.tsx` | 3-14 | 12 lines |
| `components/ErrorBoundary.tsx` | 24-38 | 15 lines |
| `lib/notifications.ts` | 559-568 | 10 lines |

### Section Separator Blocks (horizontal rule patterns)

| File | Lines | Size |
|------|-------|------|
| `app/api/admin/alumni/route.ts` | 5-15 | 11 lines |
| `app/api/admin/alumni/route.ts` | 80-90 | 11 lines |
| `app/api/admin/database-tools/audit-logs/route.ts` | 20-29 | 10 lines |
| `app/api/admin/database-tools/audit-logs/route.ts` | 68-77 | 10 lines |
| `app/api/admin/database-tools/notifications/route.ts` | 20-29 | 10 lines |
| `app/api/admin/database-tools/notifications/route.ts` | 75-85 | 11 lines |
| `app/api/admin/database-tools/orphans/route.ts` | 20-31 | 12 lines |
| `app/api/admin/equipment/maintenance/route.ts` | 5-14 | 10 lines |
| `app/api/admin/lab-templates/apply/route.ts` | 5-28 | 24 lines |
| `app/api/admin/lab-templates/import/route.ts` | 42-54 | 13 lines |
| `app/api/admin/lab-templates/route.ts` | 5-14 | 10 lines |
| `app/api/admin/lab-templates/update-from-lab/route.ts` | 72-86 | 15 lines |
| `app/api/admin/program-requirements/route.ts` | 20-29 | 10 lines |
| `app/api/admin/skill-sheets/verify/route.ts` | 34-46 | 13 lines |
| `app/api/admin/system-alerts/route.ts` | 5-15 | 11 lines |
| `app/api/announcements/route.ts` | 18-28 | 11 lines |
| `app/api/cases/route.ts` | 20-29 | 10 lines |
| `app/api/cron/affiliation-expiry/route.ts` | 46-55 | 10 lines |
| `app/api/resources/route.ts` | 20-30 | 11 lines |
| `app/api/scheduling/availability-status/route.ts` | 40-49 | 10 lines |
| `app/api/scheduling/send-availability-reminders/route.ts` | 75-86 | 12 lines |

**Assessment**: All 45 blocks are JSDoc documentation headers or section separator comments (horizontal rule patterns like `// ---...`). No actual commented-out code blocks (disabled business logic) were detected. This is a healthy codebase pattern.

---

## 4. TODO/FIXME/HACK Comments

| File | Line | Comment |
|------|------|---------|
| `app/instructor/certifications/page.tsx` | 203 | `card_image_url: existingImageUrl, // TODO: Handle image upload` |
| `app/admin/osce-events/[id]/page.tsx` | 326 | `// TODO: PUT /api/osce/events/[id]/observers/[observerId] does not exist yet` |
| `app/admin/osce-events/[id]/page.tsx` | 334 | `// TODO: Implement PUT /api/osce/events/[id]/observers/[observerId]` |
| `app/admin/osce-events/[id]/page.tsx` | 359 | `// TODO: Add POST handler for admin observer creation` |
| `app/admin/osce-events/[id]/page.tsx` | 455 | `// TODO: These endpoints may need to be created` |
| `app/admin/osce-events/[id]/page.tsx` | 479 | `// TODO: Make API call to persist the change` |
| `app/api/scheduling/shifts/[id]/signup/[signupId]/route.ts` | 126 | `// TODO: Notify instructor of confirmation/decline` |
| `app/api/scheduling/shifts/[id]/signup/route.ts` | 135 | `// TODO: Notify shift creator of new signup` |
| `app/api/scheduling/shifts/[id]/signup/route.ts` | 199 | `// TODO: Notify shift creator if was confirmed` |
| `app/api/scheduling/shifts/[id]/route.ts` | 227 | `// TODO: Notify all signed up instructors that shift is cancelled` |

**Clusters**:
- **OSCE Observer Management** (5 items): Missing API endpoints for creating and updating OSCE observers. The admin page has client-side stubs but no corresponding server routes.
- **Shift Notifications** (4 items): Shift signup/cancellation routes lack notification triggers. These should use `createNotification()` from `lib/notifications.ts`.
- **Image Upload** (1 item): Certification card image upload is deferred.

---

## 5. Console.log Statements

All `console.log` statements found in `.ts`/`.tsx` files. Organized by location type.

### Client-Side Components (2 statements)

| File | Line | Context |
|------|------|---------|
| `components/ServiceWorkerRegistration.tsx` | 20 | `console.log('[SW] Registered successfully. Scope:', registration.scope)` |
| `components/ServiceWorkerRegistration.tsx` | 28 | `console.log('[SW] New service worker installed. Refresh to update.')` |

### Server-Side Cron Jobs (32 statements -- intentional operational logging)

| File | Line | Context |
|------|------|---------|
| `app/api/cron/system-health/route.ts` | 305 | `[SYSTEM-HEALTH] Health check cron started` |
| `app/api/cron/system-health/route.ts` | 337 | `[SYSTEM-HEALTH] Completed` |
| `app/api/cron/site-visit-reminders/route.ts` | 94 | `[SITE-VISIT-REMINDERS] Cron started` |
| `app/api/cron/site-visit-reminders/route.ts` | 122 | `[SITE-VISIT-REMINDERS] No active clinical sites found` |
| `app/api/cron/site-visit-reminders/route.ts` | 147 | `[SITE-VISIT-REMINDERS] RPC not available, using fallback` |
| `app/api/cron/site-visit-reminders/route.ts` | 286 | `[SITE-VISIT-REMINDERS] Completed` |
| `app/api/cron/scheduled-exports/route.ts` | 456 | `[SCHEDULED-EXPORTS] Cron started` |
| `app/api/cron/scheduled-exports/route.ts` | 477 | `[SCHEDULED-EXPORTS] No exports due` |
| `app/api/cron/scheduled-exports/route.ts` | 488 | `[SCHEDULED-EXPORTS] Processing N due export(s)` |
| `app/api/cron/scheduled-exports/route.ts` | 519 | `[SCHEDULED-EXPORTS] Completed` |
| `app/api/cron/lab-reminder/route.ts` | 83 | `[LAB-REMINDER] Cron started` |
| `app/api/cron/lab-reminder/route.ts` | 130 | `[LAB-REMINDER] No lab days found` |
| `app/api/cron/lab-reminder/route.ts` | 139 | `[LAB-REMINDER] Found N lab day(s)` |
| `app/api/cron/lab-reminder/route.ts` | 262 | `[LAB-REMINDER] Completed` |
| `app/api/cron/internship-milestones/route.ts` | 79 | `[INTERNSHIP-MILESTONES] Cron started` |
| `app/api/cron/internship-milestones/route.ts` | 351 | `[INTERNSHIP-MILESTONES] Completed` |
| `app/api/cron/daily-digest/route.ts` | 372 | `[DIGEST] digest cron started` |
| `app/api/cron/daily-digest/route.ts` | 395 | `[DIGEST] No users with mode found` |
| `app/api/cron/daily-digest/route.ts` | 407 | `[DIGEST] Processing N digest user(s)` |
| `app/api/cron/daily-digest/route.ts` | 444 | `[DIGEST] completed` |
| `app/api/cron/compliance-expiry/route.ts` | 89 | `[COMPLIANCE-EXPIRY] Cron started` |
| `app/api/cron/compliance-expiry/route.ts` | 264 | `[COMPLIANCE-EXPIRY] Completed` |
| `app/api/cron/clinical-hours-reminder/route.ts` | 74 | `[CLINICAL-HOURS-REMINDER] Cron started` |
| `app/api/cron/clinical-hours-reminder/route.ts` | 275 | `[CLINICAL-HOURS-REMINDER] Completed` |
| `app/api/cron/cert-expiry/route.ts` | 88 | `[CERT-EXPIRY] Cron started` |
| `app/api/cron/cert-expiry/route.ts` | 328 | `[CERT-EXPIRY] Completed` |
| `app/api/cron/availability-reminders/route.ts` | 232 | `[AVAIL-REMINDERS] Cron started` |
| `app/api/cron/availability-reminders/route.ts` | 270 | `[AVAIL-REMINDERS] No active instructors found` |
| `app/api/cron/availability-reminders/route.ts` | 282 | `[AVAIL-REMINDERS] Checking N instructor(s)` |
| `app/api/cron/availability-reminders/route.ts` | 347 | `[AVAIL-REMINDERS] Completed` |
| `app/api/cron/attendance-alerts/route.ts` | 66 | `[ATTENDANCE-ALERTS] Cron started` |
| `app/api/cron/attendance-alerts/route.ts` | 222 | `[ATTENDANCE-ALERTS] Completed` |

### Server-Side API Routes (5 statements -- operational logging)

| File | Line | Context |
|------|------|---------|
| `app/api/lab-management/timer/active/route.ts` | 77 | `Auto-stopped N stale timer(s) running >24h` |
| `app/api/lab-management/timer/active/route.ts` | 109 | `Stopped N extra active timer(s), keeping most recent` |
| `app/api/cron/affiliation-expiry/route.ts` | 68 | `[AFFILIATION-EXPIRY] Cron started` |
| `app/api/cron/affiliation-expiry/route.ts` | 88 | `[AFFILIATION-EXPIRY] Table does not exist yet, skipping` |
| `app/api/cron/affiliation-expiry/route.ts` | 222 | `[AFFILIATION-EXPIRY] Completed` |

**Assessment**: All 39 `console.log` statements are intentional. The 32 cron job logs use structured `[TAG]` prefixes for monitoring in Vercel logs. The 2 service worker logs are standard client-side lifecycle logging. The 5 API route logs track operational timer behavior. **No accidental debug statements were found.**

---

## Recommendations

### High Priority
1. **Remove 25+ unused `createClient` imports** -- These API routes migrated to `getSupabaseAdmin` but kept the old import. Safe to remove with zero functional impact.
2. **Remove unused `useRef` imports** (3 files) -- `rotation-scheduler/page.tsx`, `groups/page.tsx`, `competencies/page.tsx` all import `useRef` without using it.

### Medium Priority
3. **Evaluate 13 orphaned files** -- Decide whether `CapacityWarning`, `LabDayTemplateSelector`, `LearningStyleBadge`, `ShareLink`, `SwapInterestPanel`, `PrintButton`, `AchievementCelebration`, `BadgeShowcase`, `ScenarioDifficultyRecommendation`, `usePrograms`, `useLocations`, `useNotifications`, and `lib/api-client.ts` are planned for future use or should be removed.
4. **Address 5 OSCE observer TODOs** -- The admin OSCE page has stubs for observer create/update that need API endpoints.
5. **Add 4 shift notification triggers** -- Shift routes have TODO markers for notification hooks.

### Low Priority
6. **Remove unused permission imports** -- `canManageContent`, `isStudent`, `hasMinRole`, `canAccessClinical`, `canCreateScenarios`, `isDirector`, `getRoleLabel`, `getRoleBadgeClasses` are imported but unused in specific files.
7. **Remove unused `Loader2` imports** -- `BadgeShowcase.tsx` and `Leaderboard.tsx` import `Loader2` from lucide-react but do not use it.

---

## Methodology

- **Unused imports**: Scanned all `.ts`/`.tsx` files (excluding `node_modules`, `.next`, `.git`). For each named import, checked whether the identifier appears anywhere else in the file beyond the import line. Type-only imports were excluded.
- **Orphaned files**: For each file in `components/`, `hooks/`, and `lib/`, searched for `from.*<ComponentName>` import patterns across the entire codebase. Files with zero external imports were flagged as orphans.
- **Commented-out blocks**: Scanned for 10+ consecutive lines starting with `//`, `/*`, or `*` (excluding `*/`). Classified results as JSDoc headers, section separators, or potential dead code.
- **TODO/FIXME/HACK**: Grep for `TODO|FIXME|HACK` across all `.ts`/`.tsx` files.
- **Console.log**: Grep for `console\.log\(` across all `.ts`/`.tsx` files, excluding `node_modules`.
- **Scope**: All TypeScript/TSX files in `app/`, `components/`, `lib/`, `hooks/`, and `types/` directories.

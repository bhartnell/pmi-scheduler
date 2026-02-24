# PMI EMS Scheduler - Weekend Summary (Feb 22-24, 2026)

A comprehensive summary of all work completed on the PMI EMS Scheduler project over the Feb 22-24 weekend. This sprint delivered 20 new features, 9 bug fixes, security hardening, performance optimizations, and infrastructure improvements across 30+ commits.

---

## Features Added

### Wave 1 - Foundation & Productivity Tools

- **Command Palette (Ctrl+K / Cmd+K):** Global search and navigation modal with fuzzy matching, keyboard navigation (arrow keys + Enter), and recently used commands persisted in localStorage.
- **Instructor Workload Dashboard:** New `/reports/instructor-workload` page displaying per-instructor lab assignment counts, sortable table, color-coded workload badges, and CSV export.
- **Dashboard Widgets:** Three new widgets on the main dashboard -- Overdue Tasks (with red badge), Recent Activity feed, and Quick Stats (2x2 grid showing active students, labs this month, open tasks, and completion rate).
- **Auto-Save for Forms:** Reusable `useAutoSave` hook with localStorage persistence, 5-second debounce, and restore prompt on page reload. Integrated into the scenario editor and lab day creation form.
- **Notification Preferences:** Enhanced granular notification settings with per-category in-app and email toggles displayed side-by-side, email frequency options (Instant / Daily Digest / Off), and time picker for digest delivery.

### Wave 2 - Communication & Data Management

- **Daily Digest Email:** Vercel cron job running at 8am MST sends batched notification summaries grouped by category to users who opted into daily digest mode. Includes digest_sent_at tracking with partial index to avoid duplicate sends.
- **Lab Day Templates:** Save and load station configurations as reusable templates. Includes a template management page, "Load from Template" dropdown, and "Save as Template" button on the lab day creation form.
- **Student Progress Dashboard:** New `/students/[id]/progress` page with skills completion tracking, scenario grades, clinical hours summary, milestones timeline, and recent activity log. Print-friendly layout with a "View Progress" button on the student detail page.
- **Scenario Favorites:** Star toggle on scenario cards with optimistic UI updates, favorites-first sorting, and a "Favorites" filter toggle. Backed by new migration and API routes.
- **Bulk Student Import Improvements:** Preview table with per-cell validation, duplicate email detection, skip/update/import modes, row selection checkboxes, per-row error handling, CSV template download, and failed rows export.

### Wave 3 - Search, Scheduling & Administration

- **Global Search Page:** New `/api/search` endpoint searching across students, scenarios, tasks, lab days, and instructors. Integrated into the command palette with debounced live search, results grouped by type, and recent searches stored in localStorage.
- **Scenario Clone/Duplicate:** "Duplicate" button on scenario detail pages creates a deep copy with "(Copy)" suffix and opens the new copy for editing.
- **Instructor Availability Calendar:** New `/scheduling/availability/all` page for directors with a monthly grid view, per-day instructor availability dots, and a day-detail slide-out panel showing available vs. not-submitted instructors.
- **Attendance Tracking:** New `lab_day_attendance` table with GET/PUT/bulk POST API. AttendanceSection component with status toggles (Present, Absent, Late, Excused), bulk actions, and absence alerts. Integrated into the lab day detail page.
- **Email Templates Management:** Admin page at `/admin/email-templates` with HTML editor, live preview iframe, variable reference panel, test send functionality, and database-stored customizations with code-based fallback defaults.

### Wave 4 - Clinical, Lab Management & Timer Enhancements

- **Skill/Drill Documents Management:** Replaced the "Coming Soon" placeholder on skill sheets with a full document management page. Upload files or paste URLs, link documents to skill drills, display linked documents in both station builders, and show document count badges on drill cards.
- **Clinical Hours Program Filter:** Added a program filter dropdown to the clinical hours page that defaults to Paramedic, allowing filtering by EMT, AEMT, or Paramedic programs.
- **Clinical Sites vs. Internship Agencies Separation:** Updated the `/clinical` dashboard with two distinct sections -- Clinical Sites (hospitals/ERs) and Internship Agencies (fire departments/ambulance services). New `/clinical/agencies` page with type tabs (All / Clinical Sites / Internship Agencies) and card-based grid layout.
- **Daily Notes on Any Calendar Date:** Calendar days are now clickable for adding instructor notes on any date, not just scheduled lab days. Notes are instructor-specific with "My Notes / All Notes" toggle and author badges with colored initials.
- **Scheduled Exports/Backups Admin Page:** New `/admin/scheduled-exports` page for configuring automatic weekly (Sundays) or monthly (1st of month) CSV report exports delivered by email. Supports 4 report types: cohort progress, clinical hours, lab completion, and student status.
- **Multiple Preceptors per Student Internship:** Students can now be assigned multiple preceptors per internship with role designations and full assignment history tracking.
- **Previous Cohort Lab Suggestions Panel:** New panel on the `/schedule/new` page showing lab day configurations from previous cohorts as a reference when creating new lab days.
- **Duplicate Lab Day Feature:** "Duplicate" button on lab days with a date picker that creates a full copy including all stations and their configurations.
- **Seating Chart Randomize Button:** One-click randomization of student seating assignments.
- **Timer Display Enhancements:**
  - Fullscreen mode toggle for the timer kiosk display
  - Sound chime (3 Web Audio API beeps) when countdown hits zero, with mute toggle
  - Inline timer widget on the lab day detail page header showing current rotation, live countdown, and Pause/Resume controls
  - Widget color-codes by status: green (running), blue (paused), yellow (debrief), red (time up)

---

## Bug Fixes

- **Timer Custom Number Input:** Allow clearing duration and coverage fields while typing; validate min/max only on blur. Raised duration max to 999 and coverage max to 99.
- **Seating Chart Flipped Orientation:** Mirrored table columns in instructor view so left/right matches the physical classroom layout from the instructor's perspective at the front of the room.
- **Station Builder Create/Edit Parity:** Added skill_drill station type, editable station name, room dropdown, and BLS checklist to the creation form so it matches the edit modal feature-for-feature.
- **SNHD Completion Split into 2 Date Fields:** Replaced the single SNHD Requirements date with two distinct fields -- "Field Internship Documentation Submitted" and "SNHD Course Completion Record Submitted" -- with data migration from the original single date.
- **Skill Drill Sync to Inline Station Builder:** Fixed the schedule/new page's inline station builder which was missing the skill_drill type from STATION_TYPES, the name generator, the save handler, and the JSX skills block.
- **Breadcrumb Home Button Navigation:** Replaced `<a href="/">` with `<Link href="/">` in PageErrorBoundary to enable client-side navigation instead of a full page reload.
- **Coverage Request Notification Links to Wrong Page:** Fixed notification link to navigate to `/scheduling/shifts/new` with pre-filled date/time parameters instead of the lab day edit page. Updated shifts/new to read query params for form pre-fill.
- **Volunteer Instructor Login Blocked:** Fixed the signIn callback domain check to query the database for existing users before applying the @pmi.edu email domain restriction, allowing volunteer instructors with non-PMI emails to log in. Added volunteer_instructor to role arrays across 5 API routes.
- **Calendar Links Go to List Instead of Detail:** Fixed calendar event links to navigate to the correct detail pages.

---

## Security

- **22 Critical API Vulnerabilities Fixed:** Added authentication to 25 unprotected routes (19 write + 6 read-only), fixed 3 mass assignment vulnerabilities by whitelisting allowed update fields, added role checks to admin routes, fixed 7 files where role checks excluded superadmin, and removed PII from 5 console.log statements. 34 files changed.
- **Filter Injection Fixes:** Sanitized 6 `.or()` filter injection points across scenarios, preceptors, skills, students, and polls by stripping PostgREST metacharacters.
- **Volunteer Instructor API Permissions Hardened:** Added role checks to 15+ API routes to block volunteer instructor access to student data, clinical records, and lab day write operations.
- **Skill Documents Verified End-to-End:** Full audit confirmed no security issues with the skill documents upload and display pipeline.

---

## Performance Optimizations

- **N+1 Query Pattern Fixes:** Eliminated duplicate query pairs in lab-progress reports (9 queries reduced to 6), replaced full-table fetches with COUNT queries in student-progress, built O(C) Map lookups instead of O(UxC) filter-per-user in certification compliance, and parallelized notification sends with Promise.allSettled.
- **Database Indexes Added:** 11 new indexes on frequently queried columns including lab_users(email) used in every auth check across 70+ API routes, user_notifications composite index polled every 60 seconds, and indexes on lab_days, lab_stations, instructor_tasks, students, scenarios, audit_log, and more.
- **Supabase Egress Reduction (est. 40-60%):** Replaced SELECT * with explicit column lists on 8 high-traffic endpoints (notifications, tasks, scenarios, students, lab-days, clinical/hours, admin/users, clinical/overview-all). Added pagination with default limit=50 on 7 endpoints. Added Cache-Control headers to 9 reference data endpoints.

---

## UX & Accessibility Improvements

- **Accessibility:** Skip-to-content link, aria-labels on icon-only buttons, role="dialog" and aria-modal on modals, ESC key handling on all modals.
- **Error Boundaries:** Inline error recovery for widget sections and full-page error recovery with dashboard link. Wrapped Dashboard, Tasks, Lab Schedule, and Clinical Hours pages.
- **Toast Notifications:** New toast system with auto-dismiss, manual dismiss, stacking (up to 5), and slide-in animation. Replaced all alert() calls.
- **Form Validation:** Required field indicators, inline validation errors, disabled submit with spinner during submission, and character counts on textareas.
- **Print Styles:** Enhanced @media print rules with layout reset, dark mode fix, hidden navigation elements, and print buttons on Lab Schedule, Tasks, and Clinical Hours pages.
- **Mobile Responsiveness:** 2-column dashboard grid on mobile, list view for calendar on narrow screens, horizontal-scrolling breadcrumbs, full-width sort controls, and wrapping action buttons.
- **Keyboard Shortcuts:** Reusable `useKeyboardShortcuts` hook with J/K navigation, Enter to open, C to complete, X to toggle select on the Tasks page. Ctrl+N for new task, ? for help modal.
- **Bulk Actions:** Checkbox selection with Select All/Deselect All on Tasks page, bulk Mark Complete and Delete with confirmation modals. "Clear All" button on Notifications page.
- **Clickable Dashboard Stats:** Overview stat cards now link to their relevant pages (students, scenarios, schedule, feedback) with hover effects.
- **Click-to-Add-Lab on Calendar:** Empty calendar days are clickable, navigating to `/schedule/new?date=YYYY-MM-DD` with hover effects and tooltip.
- **Clinical Site Visit Reminders:** Changed default threshold from 7 to 14 days, added amber/red severity badges, and automatic director notifications (debounced, once per day).

---

## Database Migrations

### Created Feb 22 (20260222)
| File | Description |
|------|-------------|
| `20260222_add_indexes.sql` | Performance indexes on 11 frequently queried columns |
| `20260222_digest_sent_tracking.sql` | digest_sent_at column with partial index for daily digest deduplication |
| `20260222_lab_day_templates.sql` | Lab day templates table for saving/loading station configurations |
| `20260222_scenario_favorites.sql` | Scenario favorites table for star toggle functionality |

### Created Feb 23 (20260223)
| File | Description |
|------|-------------|
| `20260223_daily_notes_instructor_email.sql` | instructor_email column on daily notes with backfill |
| `20260223_drill_documents.sql` | drill_id column on skill_documents for drill document linking |
| `20260223_email_template_customizations.sql` | Email template customizations table with code fallback |
| `20260223_lab_day_attendance.sql` | Lab day attendance table with status tracking |
| `20260223_preceptor_assignments.sql` | Multiple preceptor assignments with roles and history |
| `20260223_scheduled_exports.sql` | Scheduled exports table with RLS and updated_at trigger |
| `20260223_skill_drills.sql` | Skill drills table with 10 seeded drills and drill_ids on lab_stations |
| `20260223_snhd_split_dates.sql` | Split SNHD into two separate date fields with data migration |

**Total: 12 migrations** (4 on Feb 22 + 8 on Feb 23)

---

## Infrastructure

- **Vercel Cron Jobs:** Configured two new cron jobs in `vercel.json`:
  - Daily digest email delivery (8am MST daily)
  - Scheduled exports runner (checks for due exports on Sundays and 1st of month)
- **Auto-Generate Station Names:** Verified as already working -- no additional changes needed.
- **New API Routes Created:** ~25 new API route files across search, templates, exports, attendance, drills, workload, and bulk operations.

---

## Code Quality

- **Code Audit Performed:**
  - 40 `console.log` statements found (non-critical, development aids)
  - 2 unused imports identified
  - 6 TODO comments remaining
  - 0 empty catch blocks (clean error handling)
- **PII Removed from Logs:** 5 files had console.log statements exposing emails and request bodies -- all removed as part of the security fixes.

---

## Summary Statistics

| Metric | Count |
|--------|-------|
| Features added | 20+ |
| Bug fixes | 9 |
| Security fixes | 22 critical + 6 filter injection + 15 API permissions |
| Database migrations | 12 |
| Performance optimizations | 3 major (N+1, indexes, egress) |
| Files changed | 100+ |
| Non-merge commits | 30 |

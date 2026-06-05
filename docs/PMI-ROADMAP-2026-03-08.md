# PMI EMS Scheduler — Master Roadmap

> Refreshed 2026-06-05 (sections "What Shipped May 23 → June 5" +
> "Active Roadmap (as of 2026-06-05)" added). Previous refresh
> 2026-05-23. Historical 2026-03-08 content preserved at the bottom.

---

## Project Stats (2026-05-23)

| Metric | Count (May 23) | Δ vs March 8 |
|--------|---------------|---------------|
| Page routes | 271 | +66 |
| API routes | ~480 | +37 |
| React components | 63 top-level + lab-day/grading/scheduling/scenario/seating subdirs | grew across subdirs |
| Library modules (`lib/*.ts`) | 54 | +24 |
| Database tables | ~80+ | +20 |
| Migration files | ~200 | +29 |
| Cron jobs | 17 | +2 |
| Total commits | ~700+ | +60 |

---

## What Shipped March 9 → May 23 (highlights)

### Major Features

| Area | Feature |
|------|---------|
| Lab Templates | **Placeholder gate** on /import + /seed routes; **audit trail** (lab_day_template_audit table + trigger); **Fill Gaps Only** generation mode; **Force Regenerate gate** that blocks when results exist (12 tables checked); **Per-day Refresh from template** button on lab day detail; **EMT cohort program/semester resolution** fix |
| Scenarios | **Export JSON / Update from JSON / Bulk Export** with id-based round-trip dedup; **bulk-import dedup** (id → case-insensitive trimmed title → most recent on ambiguity); wider Edit Station picker with chief_complaint preview |
| Google Calendar | **Phases 1–4 complete** — OAuth + FreeBusy + shared-calendar events with RRULE + bulk sync; **Force Re-sync** per-user admin tool (delete + recreate when PATCH leaves stale events) |
| NREMT | **Per-lab-day kill-switch scoping** (`isNremtLabDay(labDayId)`) so non-NREMT labs sharing a date with NREMT testing still send result emails; **NREMT completion tracking** flag |
| Lab Day | **Live chat** (Supabase realtime) with exponential-backoff reconnect; **multi-device timer overwrite fix**; **post-grade form reset + stay-on-page**; **cleanup button fix**; **Resend Results Emails** button (admin/lead_instructor); **"no email on file" warning toast** on grading |
| LVFR-AEMT | **Self-contained partner-program module** — calendar, planner, files, grades, pharm tracking, scheduling, skills, per-day views |
| Seating | **Suite 1 room preset** (30 seats, two-section split); layout-aware auto-generate |
| Reports | **6 new "Cohort Progress" reports** moved from /lab-management/reports/; **24 reports total** in hub |
| Feedback | **CSV export/import** with ISO dates + RFC 4180 escaping + multi-line quoted-field parser |
| Calendar | **Master calendar** with LVFR Compact toggle; **token-gated live ICS feed** for external subscribers; **coordinator calendar** with LVFR collapsed to AM/PM session chips |
| Scheduling | **Bulk lab-shift generator** for coordinators; **slot-level "Need X / X available / Filled"** tiles on shifts calendar |
| Lab Groups | Full migration from legacy `student_groups` to canonical `lab_groups` + `lab_group_members`; eliminated unique-id race; no-cache on read paths |
| NextAuth | 30-day session lifetime (was 24h); dropped explicit cookies block in favor of derived behavior |

### Structural Cleanup (commit `808bb34d`)

- **Deleted `app/lab-management/` entirely.** 28+ duplicate pages,
  ~43k lines. Redirects in `next.config.ts` keep all URLs working.
- 5 reports moved from `/lab-management/reports/` → `/reports/`.
- **Fixed `/reports/team-leads` infinite-redirect loop** (was bouncing
  back to itself via a useRouter().replace stub).
- Source-code references retargeted to canonical paths (lib/email,
  lib/notifications, cron routes, dashboard, calendar/unified).

### Infrastructure & Quality

- Numerous schema-mismatch fixes (costs, debrief, equipment) via
  migrations + route normalization
- Lab groups stability sweep
- Calendar sync RRULE recurrence (one Google event per series, not
  N per instance)
- Auto-save on grading + scenario editor pages

---

## What Shipped May 23 → June 5

### Skill Drills as a first-class station type (commits 69aefc48, fb740ab3, d2caae4a)
- New `skill_drills` table with `source` column, program CHECK,
  upsert index on `(lower(name), program, semester)`.
- `/admin/skill-drills/import` — JSON import (single drill, array,
  or `{drills:[]}` wrapper).
- `/labs/skill-drills/[id]` reference + print view (Concept → Run
  steps → Equipment grid → Setups → Instructor notes).
- StationCards "Drill Reference" pill for `station_type='skill_drill'`.
- Edit Station picker queries the right table and surfaces program
  badge / duration chip / description snippet + program filter, so
  imported drills with `category=NULL` (like "Lifepack Monitor
  Manipulation Drill") no longer hide at the bottom.
- **Dedicated grade view** at `/labs/grade/station/[id]` when
  `station_type='skill_drill'` — early returns a SkillDrillStationView
  (no rubric / Platinum / submit), shows one SkillDrillReference card
  per drill, observations textarea persisted to localStorage.

### Station documents (commit d2caae4a)
- New `station_documents` table — per-station file/link attachments.
- `/api/lab-management/stations/[id]/documents` GET/POST/PATCH/DELETE
  supports multipart upload + URL-only links. Reuses the existing
  public `station-documents` Supabase bucket.
- EditStationModal has an upload + link UI.
- StationCards renders ad-hoc docs as indigo chips alongside the
  inherited skill_documents chips.

### Lab day "coordinator" role (commit d2caae4a)
- Added `'coordinator'` to `lab_day_roles_role_check` CHECK constraint.
- Type unions widened across 8 source files; LabDayRolesSection has
  an indigo badge group; history page renders Coordinator label +
  icon; admin calendar-sync surfaces it.
- Bulk-assigned Hartnell as coordinator across PM G14 / PM G15 /
  EMT G5 lab days between 2026-05-28 and 2026-07-06 via
  `scripts/bulk-assign-coordinator-dryrun.js`. (6 EMT G5 Monday rows
  were subsequently deleted because the schedule blocks only have
  Wednesday as `block_type='lab'` — see `eb86091f`.)

### lab_day_role → Google Calendar sync (commit 150ec556)
- `syncLabDayRole` event title now reads "Lab — {cohort label} ·
  {title}" (was "PMI Lab: {title} — {role}"); role moved to the
  description so the title is scannable in Google's week view.
- PROGRAM_TIME_DEFAULTS — PM 15:00-17:30, EMT 09:00-12:00, AEMT
  18:00-21:30. Replaces the old 08:00-17:00 fallback when
  `lab_days.start_time/end_time` is NULL.
- Cohort context plumbed through both the admin bulk sync and the
  POST insert handler.
- Hartnell-specific: 27 calendar events are ready but blocked at
  OAuth (`google_calendar_scope='needs_reconnect'`). Reconnect
  flow at /settings/calendar-setup, then hit /admin/calendar-sync
  per-user.

### Lab day DOW mismatch safety (commit eb86091f)
- Generator at `/api/scheduling/planner/generate` now warns when an
  allowed `day_number` maps to a weekday that doesn't carry a
  `block_type='lab'` block in the cohort's schedule.
- Warnings ride out in `lab_template.warnings[]` and the wizard
  surfaces them as an `alert()`.
- `scripts/audit-lab-day-dow-mismatch.js` lists all active-cohort
  mismatches. Today it flags 32 — most in archived-ish cohorts (no
  schedule blocks). EMT G5 is now clean except for the legit
  2026-05-11 orientation.

### Timer polling
- `f9cb2c54` + `f05b44eb` — timer endpoints stop polling when there's
  no active timer or `status='stopped'`. LabTimer + TimerBanner go
  to null on `!timerState` or stopped; GlobalTimerBanner keeps a 60s
  cross-page discovery heartbeat.
- `19661ec6` — TimerBanner regression fix: restore a 30s discovery
  poll on `!timerState` after the perf tightening accidentally broke
  cross-device discovery on `/labs/grade/station/[id]` (the grade page
  was opened on a separate device from the controller and never saw
  the running timer). Tiers: running 5s / paused 15s / stopped null /
  no-timer 30s.

### FreeBusy reauth banner (commit f9cb2c54)
- Persistent amber banner on `/settings/calendar-setup` when
  `needs_reauth=true` with a one-click Reconnect.
- UserMenu already routed needs-reauth users to that page with an
  amber link; the banner makes the call to action impossible to miss.

### Performance batch (commits fcfd4ec5, 9c719662, 50c9b71b)
- `fcfd4ec5` — Emergency LabDayChat stub mid-lab on 2026-05-26;
  realtime subscriptions were exhausting Vercel function quota.
- `9c719662` — Cache `Cache-Control` headers on timer + FreeBusy
  endpoints; bump poll intervals.
- `50c9b71b` — LabDayChat behind `ENABLE_LAB_DAY_CHAT` System
  Setting (default OFF) + cache header refactor + availability
  case-normalization.

### Repo hygiene (commit 5a7ddc90, 2026-06-05)
- Removed 150,773 committed `.next-old*` build artifacts (~99% of
  tracked files; .git was 115 MB). Added `/.next-old*/` to
  `.gitignore`. OneDrive sync should be dramatically lighter now.

---

## Active Roadmap (as of 2026-06-05)

### High Priority

#### LabDayChat — turn back on safely
- Component is feature-flagged OFF since 2026-05-26. The realtime
  channel lifecycle still churns under live-lab load. Before
  flipping back on: rewrite teardown / resubscribe path with a
  proper state machine, add `lab_day_id` scoped channel reuse, and
  load-test against a 4-station / 6-instructor rotation.

#### Pending bug-fix follow-ups (open from May 23 list)
- **PM G15 student email backfill** — 0/20 students have email on
  file; result emails silently no-op. Backfill via CSV import or
  surface the no-email warning toast pattern (already shipped on
  the grading page) to prevent operator confusion.
- **Hartnell calendar reconnect** — once Hartnell reconnects with
  `events` scope, trigger `/admin/calendar-sync` per-user to push
  his 27 coordinator events.
- **Josh Lomonaco OAuth on tablet** — separate PMIops deployment
  redirects loop. Most likely NEXTAUTH_URL ↔ public domain mismatch
  or Safari ITP dropping the session cookie. Diagnostic playbook
  in chat history; needs investigation in the PMIops repo (this
  repo doesn't host that auth surface).

#### Unit & Integration Tests
- **Status**: Still not started
- **Scope**: API route tests (auth, CRUD), component snapshot tests,
  database query tests
- **Priority**: Highest debt. Worth seeding with 10-20 critical-path
  tests before another major feature batch.
- **Status**: Still not started
- **Scope**: API route tests (auth, CRUD), component snapshot tests,
  database query tests
- **Priority**: Highest debt. Worth seeding with 10-20 critical-path
  tests before another major feature batch.

### Medium Priority

#### Station Documentation File Upload
- **Status**: Not started (Task #13)
- **Scope**: Currently station docs only accept URLs. Add file upload
  (PDFs, Google Docs) via Supabase Storage. Surfaces on the Edit
  Station modal.

#### Extend bulk-importer for the lossy fields
The scenario JSON exporter writes these fields, but
`/api/admin/scenarios/bulk-import/commit` drops them on re-import:
`preferred_manikin`, `assessment_x/a/e`, top-level `general_impression`,
`opqrst`, `evaluation_criteria`. Round-trips are lossless via PATCH
but lossy via bulk-import. Worth fixing if operators rely on the
bulk path for round-trips.

#### WebSocket / Realtime Enhancements
- LabDayChat now uses Supabase realtime with backoff reconnect (✅).
- Timer system still uses polling — consider migrating to realtime
  for sub-second sync across multi-device controllers.

### Low Priority

#### Multi-Campus Support
- **Status**: Still not started
- **Scope**: Location-aware scheduling, campus-specific settings,
  cross-campus reporting
- **Prerequisite**: Business need from PMI leadership

#### Offline / PWA Enhancement
- **Status**: Basic service worker exists
- **Scope**: Cache API responses, offline-first for critical pages,
  background sync
- **Benefit**: Reliability during network issues in clinical settings

#### RFID Lab Station System
- **Status**: Hardware planned, database tables exist (access_cards,
  access_devices, access_logs)
- **Scope**: Student attendance via RFID taps, station login,
  rotation tracking
- **Prerequisite**: RFID hardware deployment at stations

---

## Technical Debt Status (2026-05-23)

| Category | Status | Notes |
|----------|--------|-------|
| Auth consistency | ✅ Resolved | `requireAuth(role)` everywhere |
| RBAC enforcement | ✅ Resolved | `hasMinRole` + role-level numbers |
| FK disambiguation | ✅ Resolved | check-fk-ambiguity.js + `!fk_name` embeds |
| Console.log cleanup | ✅ Resolved | removeConsole in production build |
| Client factory consolidation | ✅ Resolved | getSupabase / getSupabaseAdmin |
| Component splitting | ✅ Resolved | components/lab-day/, grading/, scheduling/, seating/ subdirs |
| N+1 queries | ✅ Resolved | React Query + parallel Promise.all |
| Breadcrumb navigation | ✅ Resolved | Updated Breadcrumbs component |
| `/labs` vs `/lab-management` duplication | ✅ Resolved 2026-05-23 | Deleted /lab-management/ entirely, redirects in next.config |
| Schema mismatch (costs / debrief / equipment) | ✅ Resolved 2026-05-22 | Migrations + route normalizers |
| Audit trail for lab_day_templates writes | ✅ Resolved 2026-05-21 | trigger + updated_by column |
| Lab template placeholder defense | ✅ Resolved 2026-05-21 | Gate on import + seed routes |
| `/reports/team-leads` infinite loop | ✅ Resolved 2026-05-23 | Moved real page into /reports/ |
| **Test coverage** | ❌ Not started | Highest open debt |
| **email_log schema sweep** | 🟡 Open | Task #8 |
| **FreeBusy 403 reconnect** | 🟡 Open | Task #9 |
| **PM G15 email backfill** | 🟡 Open | Data issue, not code |
| Migration squashing | 🟡 Optional | ~200 files |
| Server Components | 🟡 Optional | All pages still CSR |
| JSONB validation | 🟡 Optional | Some columns store untyped JSONB |

---

## Architecture Notes (current)

### Tech Stack
- **Next.js 16** (App Router) + **React 19** + **TypeScript 5**
- **Supabase** (PostgreSQL, us-west-2) — direct queries, no ORM
- **NextAuth.js 4** — Google OAuth (@pmi.edu, @my.pmi.edu) + Microsoft
  Azure AD (external partners via approved_external_emails)
- **Tailwind CSS 4** — dark mode via `next-themes`
- **Supabase Realtime** — LabDayChat, classroom sessions
- **Resend** — transactional email; NREMT day kill-switch in
  `lib/email.ts`
- **Vercel** — auto-deploy from `main`, 17 cron jobs
- **Google Calendar API v3** — FreeBusy + Events + CalendarList,
  shared-calendar with RRULE recurrence

### Key Patterns
- `requireAuth(role)` for API route protection (lib/api-auth)
- `getSupabaseAdmin()` for server-side queries (bypasses RLS)
- `isNremtLabDay(labDayId)` for student-result email gating
- Fire-and-forget for calendar sync, notifications, audit writes
- React Query hooks for client-side caching
- FK disambiguation with `!fk_constraint_name` syntax
- `check-fk-ambiguity.js` script for regression prevention
- Audit-trail writer stamps: `updated_by: '<source>:<actor>'`

---

---

# ARCHIVE — Original March 8, 2026 Roadmap

> Below is the pre-May content of this file, kept for historical
> reference. The current state is in the sections above.

## Project Stats (March 8, 2026)

| Metric | Count |
|--------|-------|
| Page routes | 208 |
| API routes | 447 |
| React components | 122 |
| Library modules | 30 |
| Database tables | ~60+ |
| Migration files | 171 |
| Cron jobs | 15 |
| Total commits | 639 |
| Lines of TS/TSX | ~61,800 |

## What Was Completed (March 4-8, 2026)

~80+ commits across:

- **Case Study Application** — Full case study system with 10 db
  tables, library, editor, practice mode, classroom sessions, 5
  sample cases (Tasks 81-85)
- **Classroom Session System** — Realtime API with join flow,
  instructor control panel, TV display, student participation UI
  (Tasks 86-88)
- **Gamification** — Leaderboards, badges, achievements, stats
  (Task 89)
- **AI Case Generation** — Migration, generation endpoints with
  validation pipeline, brief catalog (42 cases), admin UI (Tasks
  90A-D)
- **OSCE Events Refactoring** — Parent event table, event-scoped
  API routes, admin pages, public signup, calendar invites,
  observer management (Task 48)
- **Google Calendar Phase 4** — Multi-calendar availability, site
  visit sync, Google Calendar overlay, admin sync dashboard,
  auto-sync cron (Task 92)
- React Query caching layer with 9 custom hooks (Task 76)
- AI-powered scenario content generation (Task 77)
- Accessibility + dark mode audit (Task 78)
- Print views + PDF exports for key pages (Task 79)
- Reporting & analytics dashboards with 5 report views (Task 80)
- Fix `getServerSession(authOptions)` across 72 API routes (Task 93)
- PostgREST FK disambiguation (PGRST201 fixes) (Tasks 94-97)
- FK ambiguity checker script (Task 96)

(Polish/bug fix tasks 50-75 + Bugs 1-8 also shipped — see commit
history.)

# PMI EMS Scheduler — Master Roadmap

> Refreshed 2026-05-23 (was last updated 2026-03-08).
> The 2026-03-08 historical content is preserved at the bottom of
> this file for reference. The current state and active roadmap is
> in the sections below.

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

## Active Roadmap (as of 2026-05-23)

### High Priority

#### Pending bug-fix follow-ups
- **email_log schema sweep** — confirmed canonical columns are
  `to_email` and `error`; audit any writers still referencing
  `recipient` or `error_message`. (Task #8)
- **FreeBusy 403 reconnect prompt** — when Google returns 403 on
  FreeBusy, set `needs_reauth=true` and surface an in-app banner
  linking to /settings/calendar-setup. (Task #9)
- **PM G15 student email backfill** — 0/20 students have email on
  file; result emails silently no-op. Either backfill via CSV import
  or surface the no-email warning toast pattern (already shipped on
  the grading page) to prevent operator confusion.

#### Unit & Integration Tests
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

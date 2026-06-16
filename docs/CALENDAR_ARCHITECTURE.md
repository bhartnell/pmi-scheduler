# Calendar Architecture — Current State & Unification Plan

_Generated 2026-06-15 from a read-only investigation. The calendar/scheduling
layer is ~3/4 of this app and almost everything touches it, so this doc is the
reference for the unification work. Phased; each phase shippable and reversible._

## Headline: it's a READ/DISPLAY-LAYER job, not a data migration

Scheduled time is stored in **8 domain-specific stores** (this is correct — do
NOT merge them into one physical table; each is legitimately shaped for its
domain). A **unified read aggregator already exists** and unions 6 of the 8 with
dedup. "One filterable calendar" = finish + adopt that aggregator, not reconcile
data.

### The 8 stores (all primary; `google_calendar_events` is a mirror, not a source)
| Store | Domain | On unified calendar? |
|-------|--------|----------------------|
| `pmi_schedule_blocks` | didactic / planner | ✅ |
| `lab_days` + `lab_stations` | labs | ✅ (dedup vs blocks) |
| `lvfr_aemt_plan_placements` | LVFR (published instances only) | ✅ |
| `clinical_site_visits` | clinical visits | ✅ |
| `open_shifts` | staffing (lab-coverage excluded) | ✅ |
| `ride_along_shifts` | ride-alongs | ✅ |
| `exam_sessions` | self-scheduler written exam | ❌ **missing** |
| `volunteer_events` | volunteer campaigns | ❌ **missing** |

`google_calendar_events` mirrors several of the above to Google (source_types:
station_assignment, lab_day_role, shift_signup, schedule_block, …). It is a
push cache, not a calendar source of truth.

## The real problem: two+ independent readers, not one backbone

- **Unified aggregator** — `app/api/calendar/unified/route.ts` → consumed by
  `app/calendar/page.tsx` (already filterable: program / cohort / instructor /
  event-type / date, + presets all/instructor/labs) and the ICS export.
- **Planner** — `app/scheduling/planner/page.tsx` → `/api/scheduling/planner/blocks`
  (reads `pmi_schedule_blocks` ONLY; this is the editor surface).
- **Lab-day views** — `/labs/schedule` → `/api/lab-management/lab-days`
  (operational per-station detail).
- Others: `/scheduling/shifts`, dashboard MyLabs, `/academics/planner`.

The high-use surfaces (planner, lab-day) **don't use the unified aggregator** —
that's why "no single view shows a complete day." The fix is to complete the
aggregator and point the high-use READ surfaces at it (keeping their edit paths).

### Lab-day as a filter (yes for overview, no for operational detail)
A "lab-only" view on the unified calendar already works (`event_type='lab'`).
But the unified lab event carries only `{cohort, instructor_names, station_count}`
— the operational lab-day screen needs per-station scenarios/rooms/rotations,
lab roles, and shift-signups. So: **lab-only is a first-class VIEW; the lab
management/detail screens stay on lab-management.** Shared READ, separate detail.

## Dependency map (must keep working through any change)
- **Readers:** `/calendar` (unified) · `/scheduling/planner` (blocks) ·
  `/labs/schedule` (lab detail) · `/scheduling/shifts` · dashboard MyLabs ·
  `/academics/planner` · `/admin/volunteer-events`.
- **Writers:** planner CRUD (blocks) · lab-management CRUD (lab_days/stations/
  roles) · exam self-scheduler (exam_sessions/signups → Google push →
  `student_internships.written_exam_scheduled`) · LVFR planner (lvfr_* ,
  published-only) · ride-along · open_shifts/coverage · volunteer · the ACLS
  day-builder (writes lab_days/stations AND pmi_schedule_blocks).
- **Sync/feeds:** `google_calendar_events` mirror (push-to-shared, sync-my-blocks);
  **three** ICS endpoints (`/api/scheduling/planner/ical/[semesterId]` reads
  blocks; `/api/calendar/export-ics` uses unified; `/api/calendar/feed.ics`);
  freeBusy `/api/calendar/availability`.
- **Calendar↔lab link trigger:** `supabase/migrations/20260429_calendar_link_triggers.sql`
  auto-links a published lab-type block to a lab_day on (date, cohort) and copies
  times. Keep the **1 block ↔ 1 lab_day** relationship intact.

## Phased plan
- **Phase 0 — ✅ done:** cohort filter on the planner.
- **Phase 1 — Complete the aggregator (S):** add `exam_sessions` + `volunteer_events`
  to `/api/calendar/unified` with include toggles. Closes "no single view shows a
  complete day." **(In progress.)**
- **Phase 2 — Filterable view set (M):** lab-only / cohort / medic-only /
  didactic-only / full master on `/calendar`, building on existing filters/presets.
- **Phase 3 — Adopt unified on high-use surfaces (M–L, careful, POST-COURSE):**
  give the planner + lab views a "show full day" read via the unified endpoint
  (didactic + labs together) WITHOUT changing their edit paths. The heart of the
  "one calendar" feel.
- **Phase 4 — Unify the feeds (S–M):** point ICS endpoints at the unified
  aggregator; retire the redundant ICS route after checking consumers.
- **Phase 5 — Harden + clean (S, careful):** always-link lab blocks, dead-code
  removal (`components/LabCalendarPanel.tsx` flagged unused), dedup hardening.

### Safe vs careful
- **Safe/additive:** Phase 1 (exam+volunteer reads), Phase 2 presets, dead-code
  removal after grep.
- **Careful (dependency-map first):** the block↔lab_day dedup/link path + Google
  mirror + freeBusy. Never merge physical stores; never force planner editing onto
  the unified read; never fold lab operational detail into the calendar.

**Status:** Phase 1 in progress (this commit). Phases 3+ deliberately held for
post-course.

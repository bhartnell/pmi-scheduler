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

**Status:** Phase 0 + Phase 1 done. Phases 2–5 sequenced inside the MASTER
SEQUENCE below (which supersedes this bare phase list for ordering).

---

# MASTER SEQUENCE (consolidated build order)

Consolidates the calendar phases + lab-structure/team-lead + planning workspace +
day-builder + availability layer into ONE dependency-ordered plan.

**Principles:** foundational shared layers before what sits on them; within that,
small + high-value + reversible first. **High-stakes-DB rule** for anything that
reshapes existing structure: map dependencies BEFORE changing, back up, dry-run,
reversible path — never a blind change. **A proven ACLS fallback exists** (Google
forms + sheets), so nothing is rushed pre-course — that's what lets the high-care
pieces be done properly.

Sizes: **S** small · **M** medium · **L** large. Risk: **safe** (additive) ·
**careful** (touches shared structure / needs dependency map).

## The two foundations
1. **Unified calendar READ** (Phase 0+1) — ✅ DONE. Foundation for all views + the
   planning workspace.
2. **Lab-structure model** (the `lab_days` constraint) — foundation for team-lead
   tracking AND the day-builder. NOT yet done; high-care. This is the gating
   foundation for the top-priority value work.

## Ordered stages

### Stage 1 — Dependency maps (read-only) — S, safe — START HERE
- **1a. Lab-constraint dependency audit.** Map everything that assumes ONE lab_day
  per (date, cohort): the calendar link trigger (`20260429_calendar_link_triggers.sql`),
  lab-day lists/detail, assignment displays, `lab-templates/apply`, the unified
  aggregator's lab block + dedup (`linked_lab_day_id` + date/cohort fallback), and
  any "find THE lab day for this cohort/date" singular query. Output = the exact
  change-list for Stage 2. **Prereq for Stage 2.**
- **1b. Availability-layer audit.** Confirm what's built (full-timer
  always-available; part-timer availability input) and pin the exact gap
  (class-load conflict detection). Informs Stage 7 priority.

### Stage 2 — Lab-structure constraint correction — L, CAREFUL — TOP PRIORITY (foundation)
Depends on 1a. The `UNIQUE(date, cohort_id)` is a false assumption (multiple
distinct labs/day happen program-wide, not just ACLS/PALS). Correct it to allow
**multiple lab sections per cohort per date**, and update EVERY dependent from 1a
to handle multiple (trigger, views, dedup, template apply, singular "find the lab
day" code). Back up, dry-run, reversible. Preferred over the "sections inside one
lab_day" workaround because the constraint itself is wrong.
- **2b. Migrate the monolithic G14 ACLS day → sectioned structure** (M, careful) —
  validates the new model on real data; back up the 30 blocks + lab_day/stations first.
- **2c. Consistent sectioned structure across ALL section types** incl. BLS
  (check-box, no team-leads) — consistency of process over a BLS special case.

### Stage 3 — Team-lead tracking per section — M — TOP-PRIORITY VALUE (the driver)
Depends on Stage 2 (sections exist). Make-or-break competency (AHA requires
team-lead proficiency for paramedics; students have failed the program over it).
- Capture team-lead PER section (scenario/learning stations, megacode practice,
  megacode testing); BLS exempt but same structure.
- ACLS team-leads **feed each student's program-wide OVERALL team-lead count** —
  not isolated.
- Verify every student team-led ≥1 scenario/learning or megacode station.
- Reuse existing `scenario_assessments.team_lead_id` + `team_lead_log`.

### Stage 4 — Calendar Phase 2: filterable views + planning workspace — M→L
Depends on Phase 1 (done). Separate surface from Stage 2–3, so it can run in
PARALLEL with the lab-structure track.
- **4a. View set** (M, safe): lab-only / cohort / medic-only / didactic-only /
  full master on `/calendar`, building on existing filters/presets.
- **4b. Planning workspace** (L, mostly additive) — CENTRAL, not an add-on. Ryan +
  Ben schedule spatially (whiteboards + magnets); the LVFR drag-to-arrange planner
  was the deliberate prototype. Generalize it to the main calendar: draggable
  draft view (keep block content/length, drag to rearrange, resolve conflicts) that
  PUBLISHES to the calendar when finalized. Draft-then-publish. It's a first-class
  unified-calendar view.

### Stage 5 — Calendar Phase 3: adopt unified on high-use surfaces — M-L, CAREFUL
Depends on Phase 2 AND Stage 2 settled (so "show full day" reflects sections, and
the lab views already handle multiple sections — avoids double-work). Give the
planner + lab views a "show full day" read via the unified endpoint (didactic +
labs together) WITHOUT changing their edit paths. The "feels like one calendar" heart.

### Stage 6 — Repeatable ACLS/adv-cert day-builder — M-L (post-course)
Depends on **Stage 2 (section model)** + new save-as-template plumbing. Flag a day
adv-cert → standard sections + default cases populate → assign instructors / swap
cases per section. Directives (in memory): **cascade timing** (store length +
day-anchor, compute starts; never fixed starts) · **modular** sections/blocks
(never pre-combined) · **instructor FK-or-blank** (match sheet name → record, else
blank for dropdown; custom text only for genuine guests/RT) · **save-as-NEW-template
endpoint** (today only `update-from-lab` patches existing) + templates must store
section + time info (currently station-lists only). Generic `adv_cert_` already
built so PALS = content load.

### Stage 7 — Instructor-availability: class-load conflict detection — M, CONTINGENT
Feeds BOTH the manual lab dropdown AND the builder's auto-assign (assign-or-blank
instead of custom text). Core availability is BUILT (full-timer always-available;
part-timer input) + simple manual time-off/sick overrides. **Unbuilt linchpin:**
read an instructor's actual class load → mark UNAVAILABLE when a class conflicts
with a lab's time. **Priority is CONTINGENT on the August-cohort decision** (extra
August cohort + EMT + LVFR AEMT running off the standard week create the overlaps
where this earns its keep; otherwise conflicts are rare/mental). The builder's
basic FK-or-blank works WITHOUT this; this makes it truly availability-aware.
- **Future (low priority):** read Google Calendar for directors' external meetings
  (builds on this + the Google integration). Not initial.

### Stage 8 — Calendar Phase 4 (feeds) + Phase 5 (harden/clean) — S-M, careful
Last; depends on the readers being settled. Point ICS endpoints at the unified
aggregator (retire the redundant ICS route after checking consumers); always-link
lab blocks; dedup hardening; dead-code removal (`components/LabCalendarPanel.tsx`).

## Dependency summary (the prerequisites you asked about)
- **Constraint fix (Stage 2) MUST precede:** team-lead-per-section (Stage 3), the
  day-builder's section generation (Stage 6), and Phase 3's lab "show full day"
  (Stage 5).
- **Day-builder (Stage 6) needs:** Stage 2 (sections) + save-as-template plumbing;
  availability-aware auto-assign additionally wants Stage 7 (but FK-or-blank works
  without it).
- **Planning workspace (4b) needs:** unified read (done) + ideally the view set (4a).
- **Availability conflict-detection (Stage 7):** core data link EXISTS (full/part-
  timer availability); the conflict-detection compute is the unbuilt piece.
- **Parallelism:** Stage 4 (calendar views/workspace) is a different surface from
  Stages 2–3 (lab data) and can proceed concurrently; Stage 5 should wait for both.

## Recommended execution order
1a → **2 → 2b → 3** (top-value lab/team-lead core) · in parallel: 4a → 4b · then
5 · then 6 (post-course) · 7 (when August decided) · 8 (cleanup last).

**Realistic next ~1.5 days:** 1a (map, today) → Stage 2 (the careful constraint
correction + dependents) → 2b (migrate ACLS) → begin Stage 3. That delivers the
top-priority value (multi-section labs + team-lead tracking) on the solid corrected
foundation, with the fallback covering ACLS meanwhile.

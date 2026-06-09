# PMI EMS Scheduler — Master Reference

> **Updates since this snapshot (2026-06-08):**
> - LVFR AEMT runsheet rebuilt as the 30-day course (Jul 14 → Sep 17),
>   3-tier item model + day brief/debrief; AEMT G2 `end_date` → 2026-09-17
>   (`644b8816`).
> - `docs/DATABASE_SCHEMA.md` reconciled to the live DB (288→345 tables,
>   +97 columns); new **Schema-First Rule** in `CLAUDE.md`.
> - Exam self-scheduling (final summative WRITTEN exam) is in discovery —
>   will replace the unused poll-based exam scheduler.
>
> Snapshot 2026-06-05. Supersedes PMI-MASTER-REFERENCE-2026-05-23.
> Companion docs: SITEMAP.md, COMPONENTS.md, DEAD_CODE_REPORT.md,
> DATABASE_SCHEMA.md, ARCHITECTURE.md, PMI-ROADMAP-2026-03-08.md
> (kept as the running roadmap).
>
> **What changed since 2026-05-23:**
> - Skill drills as first-class station type (69aefc48 + fb740ab3)
> - Per-station document uploads (d2caae4a)
> - `'coordinator'` role on lab_day_roles (d2caae4a)
> - lab_day_role → Google Calendar sync overhaul (150ec556)
> - Lab day DOW mismatch generation-time warning + audit (eb86091f)
> - TimerBanner cross-device discovery restored (19661ec6)
> - FreeBusy reauth banner (f9cb2c54)
> - LabDayChat behind feature flag, default OFF (50c9b71b)
> - 150,773 `.next-old*` build artifacts removed (5a7ddc90)
>
> See **Known Issues** and **Active Cohorts** sections below for
> current state.

---

## System Overview

The PMI EMS Scheduler is a comprehensive scheduling and management system
for the Pima Medical Institute Paramedic Program. It handles lab
management, clinical tracking, student onboarding, scheduling polls,
OSCE assessments, case studies, calendar integration, ride-along
scheduling, the LVFR-AEMT partner program, and more.

### Tech Stack (unchanged since March)

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router), React 19, TypeScript 5 |
| Database | Supabase (PostgreSQL), direct client queries (no ORM) |
| Auth | NextAuth.js 4, Google OAuth (@pmi.edu) + Microsoft Azure AD (external) |
| Styling | Tailwind CSS 4, Lucide React icons, next-themes (dark mode) |
| Email | Resend (transactional), html2pdf.js (PDF exports) |
| Calendar | Google Calendar API v3 (FreeBusy, Events, CalendarList) |
| Realtime | Supabase Realtime (presence + postgres_changes) |
| Deployment | Vercel (frontend), Supabase us-west-2 (database) |

### Stats (2026-05-23)

| Metric | Count | Δ vs March |
|--------|-------|-----------|
| Page routes (`app/**/page.tsx`) | 271 | +66 |
| API routes (`app/api/**/route.ts`) | ~480 | +37 |
| React components | 63 top-level + lab-day/grading/scheduling/scenario/seating subdirs | grew across subdirs |
| Custom hooks (`hooks/`) | 15 | unchanged |
| Shared utilities (`lib/*.ts`) | 54 | +24 |
| SQL migrations | ~200 | +29 |
| Top-level route hubs | 39 | a few added (lvfr-aemt, cases, osce-*) |
| Vercel cron jobs | 17 | +2 |

---

## Active Cohorts & Key IDs (as of 2026-06-05)

| Cohort | UUID | Status |
|--------|------|--------|
| **PM G14** (Paramedic, S2) | `8577fdc3-eff6-4000-9302-1ee6e3043eeb` | Active. S2 Wk 3 territory; ACLS certification block falls inside the Hartnell coordinator window (June 18–19). Lab days Thu/Fri 15:00–17:30. |
| **PM G15** (Paramedic, S1) | `856bcf1d-2e85-48b5-92a3-aba941103109` | Active. S1; ⚠ 0/20 students have email on file (no change since 2026-05-23). Lab days Tue 14:40–17:00. |
| **EMT G5** (EMT, S1) | `67080313-0c52-411b-8e88-2ae6e99eb6c6` | Active. S1 Wk 3 territory. Lab days Wed only (per pmi_schedule_blocks). 6 bogus Monday lab_days that the generator created with `lab_day_index='both'` were deleted; only the legit 2026-05-11 orientation Monday remains. Lab times 09:00–12:00; 6 days in the summer block have NULL `start_time/end_time` and use the new PM_TIME_DEFAULTS fallback. |

PM G14 has 23/23 students with email. PM G15 still 0/20 — surfaced
as an inline warning on the grading page (commit `fa8143b2`).

## Known Issues (as of 2026-06-05)

- **Timer banner on grading page** — FIXED 2026-06-04 (`19661ec6`).
  Was a regression from the 2026-05-27 polling-tightening; cross-device
  discovery on `/labs/grade/station/[id]` is restored at 30s.
- **Josh Lomonaco OAuth on tablet (PMIops)** — OPEN. Redirects loop on
  the tablet, works on his main computer (cached session). PMIops is a
  separate Vercel deployment, not this repo. Most likely NEXTAUTH_URL ↔
  public-domain mismatch or Safari ITP dropping the session cookie.
  Diagnostic playbook in chat history.
- **FreeBusy reconnect** — banner SHIPPED 2026-05-28 (`f9cb2c54`).
  Several users (including Hartnell) still hold `needs_reconnect`
  scope until they each click through. UserMenu surfaces an amber
  "Reconnect Calendar" link for these users.
- **LabDayChat OFF** — flag-gated since 2026-05-26 (`50c9b71b`).
  Needs a proper realtime channel-lifecycle rewrite before turn-on.
- **PM G15 student emails 0/20** — backfill still pending. Result
  emails silently no-op for that cohort.
- **Lab day DOW mismatches in archived cohorts** — 32 surfaced by
  `scripts/audit-lab-day-dow-mismatch.js`. Most are no-schedule-block
  cohorts (AEMT G2, PM G12, EMT G999) — likely safe to ignore or
  archive properly. Active-cohort mismatches: EMT G5 (1 — legit
  orientation), PM G13 (1 Tuesday OSCE review).

---

## Major Features Shipped Since March 2026

### Google Calendar Integration (Phases 1–4 complete)
- **Phase 1**: per-user OAuth + connect flow (`/settings/calendar-setup`).
- **Phase 2**: FreeBusy lookups for scheduling availability checks.
- **Phase 3**: shared-calendar event creation with RRULE recurrence
  (one Google event per series, not N per instance).
- **Phase 4**: bulk sync job + admin tools (`/admin/calendar-sync`)
  with per-user **Force Re-sync** button (commit `a71d8547`) for
  delete-and-recreate when PATCH leaves stale events.

### Lab Template System
- **Per-day Refresh from template** (commit `e0ff3455`) — operator
  can repopulate a single lab day from its source template without
  affecting siblings.
- **Fill gaps only generation mode** (commit `e023c206`) — populates
  empty weeks only, skips any week with existing lab_days.
- **Force Regenerate gate** (commit `e023c206`) — blocked when any
  lab_day in scope has results in scenario_assessments, skill_assessments,
  student_skill_evaluations, skill_signoffs, scenario_participation,
  peer_evaluations, student_lab_ratings, lab_day_attendance,
  lab_day_debrief_notes, lab_day_debriefs, lab_day_signups, or
  student_lab_signups. Typed-DELETE prompt as last-line defense.
- **Placeholder gate on import + seed routes** (commit `9e62ac30`) —
  refuses uploads with "Content Pending" titles or empty stations
  arrays unless `confirm_placeholders: true` is passed. Stops the
  May 21 silent-revert bug from recurring.
- **Audit trail** (migration `20260521_lab_day_template_audit`) —
  `lab_day_templates.updated_by` column + `lab_day_template_audit` table
  + trigger captures every INSERT/UPDATE/DELETE with old/new name,
  station count, and writer identity (`import-route:<email>`,
  `seed-route:<email>`, `admin-edit:<email>`, `script:<name>`, etc.).
- **EMT cohort program/semester resolution fix** (commit `61f9dbba`)
  with manual program+semester override in the UI when auto-resolve
  fails.

### Scenarios
- **Export JSON** + **Update from JSON** + **Bulk Export** on the
  scenario edit page and list page (commits `95889636`, `b0a970fd`,
  `44bbd246`). `lib/scenario-export.ts` is the shared converter.
- **Bulk-import dedup**: matches by id (UUID) first, falls back to
  case-insensitive trimmed title; picks the most recently modified
  on ambiguity. Inserted vs updated counts in the response.
- **Wider Edit Station picker** with chief_complaint preview per row.

### NREMT Testing Day Guards
- **Per-lab-day NREMT scoping** — `isNremtLabDay(labDayId)` replaced
  the broad `isNremtTestingActiveToday()` as the default check
  (commit `e3c890a1`). Non-NREMT labs sharing a date with NREMT
  testing now send result emails normally.
- **NREMT completion tracking** (commit `31be3673`) — simple
  pass/cert-received flag for tracking who's passed NREMT.

### Lab Day Controls
- **Cleanup button fix** (commit `841eab3a`) — was wired to
  handleNextRotation which silently no-op'd at the final rotation
  boundary. Now uses `handleCleanup` → `sendAction('next')` unguarded.
- **Multi-device timer overwrite fix** — removed the useEffect
  that auto-pushed `totalSeconds` (derived from the
  `lab_day.rotation_minutes` PROP) back to the server on poll.
- **Post-grade flow** — replaced alert+router.push with toast +
  in-place form reset so coordinators don't get bounced back to the
  lab day page after every grade.
- **Resend Results Emails button** on the lab day page (commit
  `dbf6a0fc`) — admin/lead_instructor only, idempotent.
- **No-email warning toast** on grading page (commit `fa8143b2`).
- **Set Duration persists to DB** (commits `841eab3a` + `56a03c1d`) —
  rotation duration changes now mirror to `lab_days.rotation_duration`
  and all `lab_stations.rotation_minutes` for the lab day. (May 21
  attempt wrote to a wrong column; May 23 fix corrects it.)

### LVFR-AEMT Module (new)
Self-contained partner-program module under `/lvfr-aemt/*` covering
calendar, planner, files, grades, pharm tracking, scheduling,
skills, and per-day views (`/lvfr-aemt/day/[date]`). Sits parallel
to the main lab system but uses its own scheduling rules and
grading flow.

### Seating
- **Suite 1 room preset** (commit `4d377ed5`) — 30 seats, two-section
  split.
- **Layout-aware auto-generate** (commit `626a1f0d`).
- Suite 1 label fix.

### Other notable
- **Lab Day Live Chat** with Supabase realtime presence + messages
  (`components/lab-day/LabDayChat.tsx`). Exponential-backoff reconnect
  added 2026-05-23 (commit `56a03c1d`).
- **Bulk lab-shift generator** for coordinators (commit `3f97a745`).
- **Master calendar** at `/calendar` with LVFR Compact toggle.
- **Coordinator calendar view** with LVFR collapsed to AM/PM session
  chips.
- **Shifts calendar tile** with slot-level "Need X / X available /
  Filled" (commit `0fc1d899`).
- **Token-gated live ICS feed** for external calendar subscribers
  (commit `6450cb80`).
- **NextAuth 30-day session lifetime** (commit `407c3b53`).
- **Lab groups stability sweep** — moved read+write paths fully to
  `lab_groups` + `lab_group_members` (canonical), eliminated unique-id
  race on PUT, no-cache on read paths (`85813926`, `c607490a`,
  `1016bb1d`, `711eefb5`, `a0910a66`).
- **Feedback CSV export/import** with ISO dates + RFC 4180 escaping
  + multi-line quoted-field parser (commit `d51d7b33`).
- **Reports infinite-redirect-loop fix** — `/reports/team-leads` was
  bouncing forever via a `useRouter().replace` stub. Now serves the
  actual page (commit `808bb34d`).

### Structural cleanup
- **/lab-management → /labs consolidation** (commit `808bb34d`):
  deleted 28+ duplicate pages, ~43k lines. All `/lab-management/*`
  URLs continue to work via `next.config.ts` redirects to canonical
  `/labs/*`, `/admin/*`, `/clinical/*`, `/reports/*`, `/academics/*`.
- **5 reports moved** from `/lab-management/reports/` → `/reports/`:
  clinical-hours, internship-status, lab-progress, onboarding-status,
  student-progress, team-leads. New "Cohort Progress" hub section
  links them.

---

## New / Updated Database Tables Since March

| Table | Status | Notes |
|-------|--------|-------|
| `lab_day_template_audit` | NEW (2026-05-21) | Insert/update/delete history for `lab_day_templates`. Soft template_id reference (no FK) so audit survives template deletion. |
| `lab_day_templates.updated_by` | NEW column (2026-05-21) | Writer-identity stamp. Format `<source>:<actor>` e.g. `import-route:admin@pmi.edu`. |
| `lab_day_equipment.station_id` | NEW column (2026-05-21) | Optional FK to `lab_stations` (ON DELETE SET NULL). |
| `lab_day_debriefs` | RESHAPED (2026-05-22) | Added 7 structured columns: instructor_email, went_well, to_improve, student_concerns, equipment_issues, rating, updated_at. Legacy `content`/`author` kept. CHECK(rating 1..5) + partial UNIQUE on (lab_day_id, instructor_email). |
| `lab_users.google_calendar_*` | EXPANDED | google_calendar_connected, google_calendar_scope ('events' or 'freebusy'), google_refresh_token, google_calendar_ids, needs_reauth. |
| `lab_users.email` collation | NORMALIZED | All lookups use `.ilike(email)` to avoid case-sensitivity drift. |
| `lab_groups`, `lab_group_members` | CANONICAL | Replaces legacy `student_groups`/`student_group_assignments` for new read+write paths. |
| `google_calendar_events` | NEW source_type='schedule_block_series' | One mapping row per (user, series), recreated by Force Re-sync. |
| `lab_timer_state` | EXTENDED | Per-lab timer with version field for optimistic locking; `rotation_acknowledged` flag for ROTATE-alert behavior. |
| `approved_external_emails` | NEW | Allowlist for non-@pmi.edu OAuth (Microsoft Azure AD) sign-ins. |
| `students.cohort_id` FK | TIGHTENED | Various FK-ambiguity fixes via `!fk_constraint_name` embeds (see PostgREST FK Ambiguity Check in CLAUDE.md). |

---

## Role Hierarchy (unchanged)

| Level | Role | Description |
|-------|------|-------------|
| 5 | `superadmin` | Full system access, system settings, database tools |
| 4 | `admin` | User management, data imports/exports, certifications |
| 3 | `lead_instructor` | Clinical, cohort, scenario, and student management |
| 2 | `instructor` | Lab days, grading, teaching, scenarios |
| 1.75 | `program_director` | Affiliations access only |
| 1.5 | `volunteer_instructor` | Scheduling and lab schedule (read-only) |
| 1 | `student` | Student portal only |
| 1 | `guest` | Guest access (token-based lab day view) |
| 0 | `pending` | Awaiting approval — minimal access |

---

## Recent Commits Worth Knowing About (last ~10 days)

```
4b295153  Docs: refresh SITEMAP, COMPONENTS, DEAD_CODE_REPORT for May 2026
808bb34d  Cleanup: delete dead /lab-management/* duplicates
56a03c1d  Timer persist (correct column) + LabDayChat realtime backoff
dbf6a0fc  Costs + debrief 500 fixes, Resend Results button
fa8143b2  Grading: surface "no email on file" when Send to Student silently no-ops
d04f4197  Lab day + grading bug batch (May 21 lab)
d51d7b33  Feedback export/import: ISO dates, universal escaping, multi-line CSV
44bbd246  Scenarios: bulk-import dedup, Update from JSON, wider station picker
b0a970fd  Scenarios export: also wire into the actual /labs/scenarios pages
95889636  Scenarios: Export JSON (single + bulk)
9e62ac30  Lab templates: placeholder gate + audit trail
2f524b08  Scripts: one-shot direct re-import for paramedic S2 lab templates
e023c206  Lab gen: Fill gaps only mode + Force Regenerate results gate
e0ff3455  Lab day detail: per-day Refresh from template
61f9dbba  Lab templates: fix EMT cohort program/semester resolution
a71d8547  Calendar sync: per-user Force Re-sync (delete + recreate)
841eab3a  Lab day: cleanup button, multi-device timer overwrite, post-grade flow
e3c890a1  Lab result emails: scope NREMT guard per-lab + fix email_log schema
```

Full history: `git log --oneline main --since='2026-05-01'`.

---

## Key Files Updated Frequently

- `lib/email.ts` — central email sender. STUDENT_EVAL_TEMPLATES gating
  + NREMT scope check. Touch this when adding any new transactional
  email path.
- `lib/scenario-export.ts` — Export JSON / Update from JSON / Bulk
  Export converter. Round-trip lossless via PATCH; lossy via
  bulk-import for `preferred_manikin`, `assessment_x/a/e`, top-level
  `general_impression`, `opqrst`, `evaluation_criteria`.
- `lib/notifications.ts` — in-app notification creation. Link URLs
  retargeted to canonical /labs/* and /admin/* in commit `808bb34d`.
- `lib/calendar-availability.ts` — Google FreeBusy lookups +
  refresh-token flow. Used by bulk sync and per-request availability
  checks.
- `lib/permissions.ts` — `hasMinRole`, `canAccessAdmin`, role
  hierarchy enforcement. The level numbers haven't changed.
- `next.config.ts` — redirect map for `/lab-management/*` →
  canonical paths. Plus `/scheduler/*` → `/scheduling/polls/*`,
  `/skill-sheets/*` → `/academics/skill-sheets/*`,
  `/scheduling/planner/*` → `/academics/planner/*`.
- `components/lab-day/EditStationModal.tsx` — central station
  edit modal; widened picker on 2026-05-21.
- `components/lab-day/LabDayChat.tsx` — realtime chat with
  backoff reconnect (commit `56a03c1d`).
- `app/labs/grade/station/[id]/page.tsx` — primary grading page,
  ~1500 lines.
- `app/labs/schedule/[id]/page.tsx` — primary lab day view,
  ~1000 lines.

---

## Workflow & Conventions

### Direct-to-main deployment (per `CLAUDE.md`)
- No feature branches or PRs unless explicitly requested.
- Vercel auto-deploys from `main` (~90s typical).
- Worktree branches → merge to `main` before ending the session.
- Always `npm run build` before pushing.

### Database migrations
- `node scripts/run-migration.js supabase/migrations/<file>.sql`
- After any new FK: `node scripts/check-fk-ambiguity.js`
- Migrations are idempotent (use `IF NOT EXISTS`).

### Supabase embeds with multiple FKs
Disambiguate with `!fk_constraint_name`:
```ts
cohort:cohorts!students_cohort_id_fkey(id, cohort_number)
```

### Email gating
Any new student-result email template MUST be added to
`STUDENT_EVAL_TEMPLATES` in `lib/email.ts` so it goes through the
NREMT-day kill-switch.

### Audit-trail writer stamps
Any new writer route touching `lab_day_templates` must set
`updated_by: '<source>:<email>'` so the audit trigger captures the
actor.

---

## Pending Follow-ups (active task list as of 2026-05-23)

- **#8**: email_log schema audit — confirmed `to_email`/`error` are
  the canonical columns; some writers may still reference `recipient`
  or `error_message`. Sweep needed.
- **#9**: FreeBusy 403 reconnect prompt — when Google returns 403,
  set `needs_reauth=true` on `lab_users` and surface an in-app banner
  linking to `/settings/calendar-setup`.
- **#13**: Station documentation file upload — currently URL-only;
  add Supabase Storage upload option for PDFs / Google Docs.

Items already shipped from the May 2026 backlog (closed):
LabDayChat CHANNEL_ERROR (#6), grading stay-on-page (#7),
bulk import + JSON upload (#10), student lab result emails (#11),
timer/adjust column fix (#12), dedupe parallel scenario pages (#5),
docs refresh (#14).

---

## Companion Documents

- **`docs/SITEMAP.md`** — Full 271-route inventory grouped by hub.
- **`docs/COMPONENTS.md`** — Component + utility reference, with
  "New / Updated Since March 2026" section.
- **`docs/DEAD_CODE_REPORT.md`** — Resolved items section + original
  March inventory.
- **`docs/PMI-ROADMAP.md`** — Forward-looking feature roadmap.
- **`docs/PMI-QUICK-START-2026-03-08.md`** — Session-opener context
  (also being refreshed alongside this file).
- **`CLAUDE.md`** — Project instructions for Claude Code sessions
  (direct-to-main workflow, migration patterns, FK ambiguity rules,
  Navigation Entry-Point Rule).
- **`docs/API.md`**, **`docs/DATABASE_SCHEMA.md`**,
  **`docs/ARCHITECTURE.md`** — Reference docs for API surface,
  schema, and architecture (last refreshed prior to May).

---

## Team Roster

Not maintained in source control. See the project Notion / shared
doc for current instructor + admin assignments. Notable contributors
referenced in recent commits and code comments include B. Hartnell,
R. Young, M. Gannon, M. Schaffer, J. Lomonaco, R. Niedfeldt, B. Young,
S. Andreas, S. Peterson (per scenario format_notes across
paramedic S2 lab templates).

# Changelog

Reverse chronological. One line per commit. Per the Documentation
Update Rule in `CLAUDE.md`, every commit should append an entry
here. Group multi-commit days under a single date heading. Use
`git show <hash>` for the full diff of any entry.

Format: `commit-hash | brief description`

---

## 2026-06-09

- `_pending_` | Exam scheduler doors hotfix + admin placement. Part A (nav clarity): home student card relabeled "Students sign up here"; new admin-only home card "Manage Exam Sessions" → `/admin/exam-sessions`; clinical hub gets an admin-gated "Manage Exam Sessions" entry; `/exam-scheduling` blocked-state now detects staff and routes them to the admin console instead of the "account not linked" dead-end. Part B: understated "Sign up a student on their behalf" action on `/admin/exam-sessions` + `POST /api/exam-scheduling/signups/admin` — bypasses the self-service roster/email gate (admin picks the student directly), enforces one-active-slot + capacity/Pima pool, confirms directly (admin placement = approval), fires the standard notifications, audit-logged; warns when the student has no roster email (no confirmation email possible). Poll system untouched; no schema change.
- `89912b14` | Exam Self-Scheduling (final summative WRITTEN exam) — Phases A–C of SPEC_exam_self_scheduling_BUILD.md (Phase D poll retirement deliberately NOT touched). New tables `exam_sessions` + `exam_signups` (migration `20260609_exam_self_scheduling.sql`, applied: derived seat counts, partial-unique one-active-slot-per-student, advisory-lock capacity trigger). Student page `/exam-scheduling` (roster-scoped by email↔students match, NOT role — dual-role student-instructors sign up as students; unlinked email → explicit blocked message; phase-2 `current_semester=4`+PM/PMD auto-confirms, else pending; Lockdown own-computer vs Pima-computer seat gating; free reschedule; one slot per student). Admin page `/admin/exam-sessions` (session builder, phase-1 approve/deny queue, written-exam result write-back touching ONLY `student_internships.written_exam_passed`/`written_exam_date`, audit-logged). Notifications via Resend `general` template (exempt from NREMT kill-switch): directors on signup/change/cancel, students on auto-confirm/approve/deny, non-proctor directors get proctor heads-up. Calendar: session → main shared calendar with ONLY the proctor as attendee (operator token; lapsed calendar → reconnect prompt, never silent). Nav: home "Written Exam Signup" card + Admin→Lab & Clinical card. lib/exam-scheduling.ts.

## 2026-06-08

- `ed2009ee` | Documentation foundation pass. Reconciled `docs/DATABASE_SCHEMA.md` to the live database: +77 previously-undocumented tables (full detail, generated from live introspection — LVFR AEMT, PMI scheduling, OSCE scoring, ride-along, volunteers, lab_day, etc.) in a labeled "Schema Reconciliation Additions (2026-06-08)" section, +97 missing columns inserted across 28 documented tables (incl. `cohorts.is_external_program`, `email_log` status/resend_id, `polls` scheduled-meeting cols, `student_internships` meeting/nremt cols, `students` FERPA cols), Summary updated (288→345 tables, 371→483 FKs). Added the **Schema-First Rule** (HARD REQUIREMENT, with rationale) to `CLAUDE.md` and named `DATABASE_SCHEMA.md` in the Documentation Update Rule. Refreshed SITEMAP (LVFR runsheet), DEAD_CODE_REPORT (poll-scheduler artifacts), MASTER-REFERENCE. No DB/data changes — doc-only.
- `644b8816` | LVFR AEMT runsheet rebuilt as 30-day, 3-tier model (supersedes the 27-day `5bd34391` populate). New migration `20260608_lvfr_runsheet_3tier.sql` adds `requirement` (required/optional/info), `description`, `time_label` to `lvfr_schedule_items` and `brief`/`debrief` to `lvfr_day_schedule`. Parser `scripts/lvfr-rebuild/parse-sources.mjs` reads the authoritative 30-day sources (`data/lvfr-aemt/sources/`) → reviewable artifact `data/lvfr-aemt/runsheet_days.json` (30 days, 321 items: required=121, optional=48, info=152). `apply.mjs --commit` replaced live AEMT G2 data (364→321 items, Days 28-30 added, cohort `end_date`→2026-09-17; pre-replace backup written to gitignored `data/lvfr-aemt/backups/`). Day page `/lvfr-aemt/day/[date]` now renders 3 tiers (info = no checkbox), day brief above AM + debrief below PM, fixes AM-before-PM ordering, and gates progress on required items only. AEMT G2 only (is_external_program); no other cohort touched.

## 2026-06-05

- `3b47d019` | `cohorts.is_external_program` flag added — marks one-off / partner cohorts (LVFR AEMT G2 flagged) that should be excluded from generic "all active cohorts" sweeps. Calendar/date surfaces still include external cohorts; only filter the flag in code paths that would apply EMT/PM-style behavior INTO the external cohort. Immediate retrofit: `audit-lab-day-dow-mismatch.js` filters on it (32 → 17 mismatches, AEMT G2 noise gone). Future retrofit notes in commit body.
- `5bd34391` | LVFR AEMT runsheets populated: source files moved to `data/lvfr-aemt/` (course_calendar.json updated 7/7→7/14, new schedule_build_tracker.md + instructor_assignments.xlsx); new `scripts/populate-lvfr-aemt-runsheets.js` parses both files and writes lvfr_day_schedule + lvfr_schedule_items (mapping break/lunch→'break', ch/lecture/review→'chapter', quiz/exam→'exam', lab/checkoff/station→'skills', scenario→'lab'); Track A canonical PM + Track B appended after divider. Inserted 54 day-schedule rows + 364 items into AEMT G2 cohort. Cohort `start_date` moved 2026-01-19 → 2026-07-14.
- `97be71cc` | Docs sync: CLAUDE.md adds "Development Environment (HARD REQUIREMENT)" with junction setup; CHANGELOG date headings restored per actual commit dates; PMI-MASTER-REFERENCE-2026-06-05 created with current cohort + Known Issues sections; PMI-ROADMAP-2026-03-08 gets "What Shipped May 23 → June 5" + dated Active Roadmap; DEAD_CODE_REPORT logs build-artifact + LabDayChat-stub + single-slot-station-docs cleanups; SITEMAP refreshed to 2026-06-05 with skill-drill and reauth-banner routes.
- `40004bfe` | CHANGELOG: log 5a7ddc90 (.next-old* build-junk removal + OneDrive de-sync)
- `5a7ddc90` | Remove 150,773 accidentally-committed `.next-old*` build artifacts (~99% of tracked files, ~115MB of .git bloat driving heavy OneDrive sync load); add `/.next-old*/` to .gitignore so it can't recur. Build output is regenerable and Vercel builds fresh, so no live-site impact. Also moved `node_modules`/`.next` out of the OneDrive-synced tree via directory junctions to `C:\dev-cache\pmi-scheduler` to stop sync churn (local-machine change, not committed).

## 2026-06-04

- `19661ec6` | TimerBanner: restore 30s discovery poll on null timerState (regression from f05b44eb — grading pages opened on a separate device from the lab controller never discovered the running timer). Tiers: running 5s / paused 15s / stopped null / no-timer 30s.

## 2026-06-01

- `eb86091f` | Lab day DOW mismatch safety: generation-time warning when allowed day_number maps to a weekday that doesn't carry a 'lab' block_type in the cohort's schedule (the EMT G5 Monday root cause); audit script reports active-cohort mismatches; warnings surface as alert in /academics/planner wizard

## 2026-05-28

- `150ec556` | lab_day_role calendar sync: title format reworked to "Lab — {cohort} · {title}" (role moves to description); PROGRAM_TIME_DEFAULTS for PM/EMT/AEMT replaces 08:00-17:00 fallback when lab_days.start/end is null; cohort context plumbed through admin bulk endpoint + POST insert handler. Hartnell's 27 coordinator assignments are ready but blocked at OAuth (scope='needs_reconnect') — reconnect at /settings/calendar-setup then trigger admin/calendar-sync per-user.
- `fb740ab3` | Skill drill stations get a dedicated grade view (no rubric / Platinum / scenario UI — just the drill reference + observations textarea) via new SkillDrillReference component shared with /labs/skill-drills/[id]; also fixed /api/lab-management/lab-days/[id] to select drill_ids so StationCards "Drill Reference" pill renders
- `d2caae4a` | Station docs + lab coordinator role + drill picker enrichment (3 changes in one commit due to shared touchpoints): (1) per-station file/link attachments via new station_documents table + multi-doc API; (2) 'coordinator' role on lab_day_roles + 27 Hartnell coordinator assignments through 2026-07-06; (3) skill_drill picker now shows program/duration/snippet + search + filter so imported drills with category=NULL surface properly. Import Skill Drills card moved from Content&Templates to Lab&Clinical and surfaced on /labs/skill-drills header.
- `f9cb2c54` | Timer polling: status='stopped' now stops polling entirely (LabTimer, TimerBanner, GlobalTimerBanner discovery channel still polls 60s); FreeBusy reauth banner at /settings/calendar-setup surfaces above wizard card with one-click Reconnect

## 2026-05-27

- `69aefc48` | Skill drills: structured display + JSON import (migration adds source col + program CHECK + upsert index; new /admin/skill-drills/import UI + endpoint; /labs/skill-drills/[id] reference + print view; lab day station card adds Drill Reference pill for station_type='skill_drill')
- `2e96bf3b` | LabTimer: stop polling after End Lab (clear local state on null response, auto-close modal on remote End Lab)
- `f05b44eb` | Timer polling: gate on existence (no timer → no poll; remove auto-create on mount; GlobalTimerBanner discovery 10s→60s)

## 2026-05-26

- `50c9b71b` | Evening batch: LabDayChat feature flag (default OFF) + cache header refactor + availability case-norm. LabDayChat had been adding measurable load during live labs; gated behind ENABLE_LAB_DAY_CHAT system setting so it can be turned on per-lab once the realtime stability work lands properly.
- `9c719662` | URGENT perf: cache timer endpoints (Cache-Control max-age=3) + bump poll intervals + cache FreeBusy responses. Shipped mid-lab on 2026-05-26 in response to live-lab Vercel function exhaustion.
- `fcfd4ec5` | URGENT: stub out LabDayChat to mitigate live-lab perf issue. Realtime subscriptions were churning faster than the visibility heuristic could throttle; emergency stub returned empty state while the proper backoff + feature flag was being prepared (see 50c9b71b).
- `a1f29c2d` | LabDayChat: fix attempt-counter reset + Supabase stack overflow (regression from 56a03c1d) — senderRef for stable deps, attemptRef + subscribingRef mutex, full teardown (unsubscribe + removeChannel) before each retry
- `0ecf311d` | SMC mapping review CSV: 81 smc_requirements fuzzy-matched against canonical_skills (34 exact, 25 close, 22 no_match) for operator review before any DB writes
- `b3ce7bcf` | Documentation Update Rule (CLAUDE.md) + initial CHANGELOG.md with 30-day backfill
- `9e023b52` | Template matching: day=1 fallback for single-template-per-week programs + open_shifts.title trigger

## 2026-05-23

- `49f9441c` | Project-knowledge docs: May 2026 refresh (MASTER-REFERENCE + QUICK-START + ROADMAP)
- `4b295153` | Docs: refresh SITEMAP, COMPONENTS, DEAD_CODE_REPORT for May 2026
- `808bb34d` | Cleanup: delete dead /lab-management/* duplicates (~43k lines)
- `56a03c1d` | Timer persist (correct column) + LabDayChat realtime backoff

## 2026-05-22

- `dbf6a0fc` | Costs + debrief 500 fixes; Resend Results Emails button on lab day page

## 2026-05-21

- `fa8143b2` | Grading: surface "no email on file" when Send to Student silently no-ops
- `d04f4197` | Lab day + grading bug batch (May 21 lab — criteriaRatings reset, comments-for-NS, timer, equipment, calendar/costs)
- `d51d7b33` | Feedback export/import: ISO dates, universal escaping, multi-line CSV
- `44bbd246` | Scenarios: bulk-import dedup (id → title), Update from JSON, wider station picker
- `b0a970fd` | Scenarios export: also wire into the actual /labs/scenarios pages
- `95889636` | Scenarios: Export JSON (single + bulk)
- `9e62ac30` | Lab templates: placeholder gate + audit trail (lab_day_template_audit table + trigger)

## 2026-05-20

- `2f524b08` | Scripts: one-shot direct re-import for paramedic S2 lab templates
- `e023c206` | Lab gen: Fill gaps only mode + Force Regenerate results gate
- `e0ff3455` | Lab day detail: per-day Refresh from template button
- `61f9dbba` | Lab templates: fix EMT cohort program/semester resolution (EMT G5 current_semester=1)
- `a71d8547` | Calendar sync: per-user Force Re-sync (delete + recreate)
- `841eab3a` | Lab day: cleanup button, multi-device timer overwrite, post-grade flow

## 2026-05-19

- `01dde47f` | NextAuth: drop the explicit cookies block (derive from session.maxAge)
- `407c3b53` | NextAuth: 30-day session lifetime (was 24h)

## 2026-05-15

- `212682c0` | Poll creation: fix post-create 404, harden internship API, dark mode
- `aff8a41a` | Poll creation from internship page: full builder + redirect to new poll

## 2026-05-14

- `e3c890a1` | Lab result emails: scope NREMT guard per-lab + fix email_log schema
- `0fc1d899` | Shifts calendar tile: slot-level "Need X / X available / Filled"
- `31be3673` | NREMT completion tracking — simple pass/cert-received flag
- `6450cb80` | Calendar: token-gated live ICS feed for external subscribers

## 2026-05-13

- `4e381e5c` | Master calendar: drop lab-coverage shifts + dedup lab_day tiles
- `a0910a66` | Lab groups: belt-and-suspenders no-cache on all read paths
- `85813926` | Lab groups: read paths now use lab_group_members (was reading legacy student_groups)
- `3f97a745` | Scheduling: bulk lab-shift generator for coordinators
- `711eefb5` | Lab groups: PUT /members uses UPSERT, eliminating the unique-id race
- `1016bb1d` | Lab groups: fix 500 on save (unique student_id) + sort order
- `c607490a` | Lab groups: members route now uses lab_groups + lab_group_members
- `35203dac` | Lab groups + calendar availability: error log noise fixes

## 2026-05-12

- `1e5c77fb` | Labs: 5-bug batch (protocol tracking, collapsed sections, labels, links, NREMT retake)

## 2026-05-11

- `fe3c74fb` | Clinical internships: 6-bug batch fix (notifications, nav, state)
- `0d451890` | Clinical internships: 6-bug batch fix for preceptor + date flows
- `626a1f0d` | Seating: layout-aware auto-generate + Suite 1 label fix
- `4d377ed5` | Seating chart: Suite 1 room preset (30 seats, two-section split)
- `c2d5b618` | Master calendar (/calendar): LVFR "Compact" toggle on filter chip
- `10ae96bc` | Coordinator calendar: collapse LVFR blocks to AM/PM session chips
- `f4f1d3e9` | LVFR AEMT day runsheet — flexible checklist per day
- `acbf6fd3` | Part-timer self-service shift logging — Log a Shift
- `282778d2` | Seating chart: print fits on one landscape page
- `731c57a3` | Day 1 Intake: hardcoded EMS employer <select> (no agencies fetch)
- `638eafd0` | Day 1 Intake — quick-roster auto-save table

## 2026-05-08

- `c2efb2bd` | critical_actions: stop the JSON-wrapping loop + cleanup 6 corrupted rows
- `033bcd48` | Lab-day stations: flex-wrap actions + accept content alias for versions

## 2026-05-07

- `50b93b09` | Station-edit scenario picker — bump limit so all active scenarios show
- `df9d9c37` | Bulk-import: unwrap { scenarios: [...] } + consolidate import paths
- `3caec3c0` | ScenarioGrading — use ScenarioFullDisplay; lab preview default-open
- `41840b11` | ScenarioFullDisplay — extract grading panel + reuse on lab page
- `f75e67d4` | Scenarios — pure-regex demographic extraction (no Anthropic API)

## 2026-05-06

- `64347d9d` | Extract-demographics — fix 500: timeout, top-level catch, batching
- `aa05d06d` | Reports hub — link 5 orphan reports + add 'Operational' section
- `5921497b` | Navigation entry-point rule + My Account home card
- `691f52bf` | Scenarios — cleanup UI + preferred_manikin form integration
- `cfc7c424` | Direct-DB equivalent of /api/admin/scenarios/extract-demographics
- `c38cd66b` | Scenarios — extract-demographics endpoint + preferred_manikin column
- `830ae7e3` | Direct-DB equivalent of /api/admin/seed-instructor-availability
- `9a6c8345` | Cleanup duplicates — UI button + confirmation modal
- `11fa134d` | Seed availability — exclude Kat (medical director) + LV EMS (display login)
- `dfa9f170` | Seed availability — widen role filter to include superadmin / admin
- `668cb3fe` | URGENT — duplicate-events incident root cause + cleanup endpoint
- `39eea741` | URGENT: disable calendar-sync cron via kill switch
- `ecc467ec` | Calendar filter union + station_instructors user_id backfill

## 2026-05-05

- `5842bde2` | Availability-aware lab planning — 4-group instructor dropdown + seed
- `8b85577c` | Admin sync feedback + recurring series push + UserMenu hardening
- `fe3f2bb6` | Poll → Schedule Meeting — close the missing-endpoint loop
- `a2712ada` | Calendar sync — fix instructor-block lookup + recurrence + ownership guard
- `b1058886` | Semester management UI + UserMenu visibility fix
- `fbceb022` | Lab template import — accept field_trip + surface real DB errors
- `cd099fba` | Backfill missing schedule blocks — PM G14 / PM G15 Summer 2026
- `48df3025` | Lab template import — accept both title and name fields

## 2026-05-04

- `1255937a` | Calendar onboarding — top-nav user menu + home banner + 3-step wizard

## 2026-04-30

- `b8dec3e6` | Generate wizard — prevent duplicate program_schedules + show target semester upfront
- `ee3b54f2` | Generate wizard — auto-detect semester per block + unmapped-date prompt
- `e1aaafcc` | Generate Semester Schedule wizard — direct API + URL param normalization
- `1bd89bb1` | Generate Semester Schedule wizard — fix template program key mapping

---

## Earlier history

For commits before 2026-04-30, see `git log --oneline main` directly.
The historical changelog before this file existed is reconstructable
from git history but was not preserved as a CHANGELOG entry.

This file was created 2026-05-26 with a 30-day backfill, in response
to the Documentation Update Rule added to CLAUDE.md the same day.

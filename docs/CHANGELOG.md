# Changelog

Reverse chronological. One line per commit. Per the Documentation
Update Rule in `CLAUDE.md`, every commit should append an entry
here. Group multi-commit days under a single date heading. Use
`git show <hash>` for the full diff of any entry.

Format: `commit-hash | brief description`

---

## 2026-05-26

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

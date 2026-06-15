# PMI EMS Scheduler — Site Map
> Refreshed 2026-06-09 (Exam Self-Scheduling pages added).
> Previously refreshed 2026-06-08 (LVFR-AEMT runsheet section expanded).

## Exam Self-Scheduling (final written exam)

Two doors — labeled to keep directors out of the student dead-end:

| Path | Notes |
|------|-------|
| `/exam-scheduling` | **STUDENT door** — students sign up for their own exam. Roster-scoped (email ↔ students table, NOT role) so dual-role student-instructors can sign up. Lockdown own-computer vs Pima-computer seat logic; phase-2 auto-confirm, phase-1 pending. Admins who land here get routed to the admin door (blocked-state banner). Entry: home-page "Written Exam Signup" card (labeled "Students sign up here"). |
| `/admin/exam-sessions` | **ADMIN door** — directors create/manage sessions, approve/deny the phase-1 queue, record written-exam results, and can "sign up a student on their behalf" (understated action; bypasses the roster/email gate, confirms directly, same notifications). Entries: home-page "Manage Exam Sessions" card (admin+), Clinical hub → More clinical tools, Admin hub → Lab & Clinical. |
> Reflects the /lab-management → /labs consolidation that landed
> in commit 808bb34d; the /lab-management/* tree is GONE from disk
> and exists only as HTTP redirects in next.config.ts.
>
> **Routes added since 2026-05-23 refresh:**
> - `/admin/skill-drills/import` (commit 69aefc48)
> - `/labs/skill-drills/[id]` (commit 69aefc48)
> - `/labs/grade/station/[id]` skill_drill branch (commit fb740ab3)
> - `/settings/calendar-setup` FreeBusy reauth banner (commit f9cb2c54)

**271 page routes across 39 top-level hubs** (count from
`find app -name 'page.tsx'`).

## Role Hierarchy

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

## What changed since 2026-03-08

### Structural — the /lab-management → /labs consolidation (2026-05-23)
- `app/lab-management/` directory **deleted entirely.** 28+ duplicate pages
  removed (~43k lines).
- Every previously-served `/lab-management/*` URL now 308-redirects to its
  canonical location via `next.config.ts`. Old bookmarks and emails keep
  working.
- Five reports that only lived under `/lab-management/reports/*` (clinical-hours,
  internship-status, lab-progress, onboarding-status, student-progress) were
  moved to `/reports/*`.
- The infinite-redirect-loop bug at `/reports/team-leads` was fixed
  (the stub used to `router.replace('/lab-management/reports/team-leads')`
  which 308'd back; now serves the actual page).
- New "Cohort Progress" section on the `/reports` hub lists all six moved
  reports as cards.

### Redirects in place (all `permanent: true`, 308)
- `/lab-management/*` → `/labs/*` for: schedule, scenarios, scenario-library,
  templates, skill-drills, groups, flags, ekg-warmup, debrief-review, skills,
  stations, seating, mentorship, peer-evals, protocol-tracking, my-certifications,
  grade
- `/lab-management/skill-sheets/*` → `/academics/skill-sheets/*`
- `/lab-management/cohorts/*` → `/academics/cohorts/*`
- `/lab-management/students/*` → `/academics/students/*`
- `/lab-management/admin/*` → `/admin/*` (incl. feedback, timer-displays,
  certifications, cohorts, users, deletion-requests)
- `/lab-management/reports/*` → `/reports/*`
- `/lab-management/aemt-tracker` → `/clinical/aemt-tracking`
- `/lab-management/emt-tracker` → `/clinical/emt-tracking`
- `/scheduler/*` → `/scheduling/polls/*`
- `/skill-sheets/*` → `/academics/skill-sheets/*`
- `/scheduling/planner/*` → `/academics/planner/*`

### New pages added since March 8
- Calendar Sync admin tools (`/admin/calendar-sync`) including per-user
  Force Re-sync button
- Audit Log (`/admin/audit-log`), Data Export/Import (`/admin/data-export*`,
  `/admin/data-import`)
- Bulk Operations (`/admin/bulk-operations`)
- Deep Links (`/admin/deep-links`)
- Time Clock (`/admin/time-clock`, `/instructor/time-clock`)
- OSCE tooling: `/admin/osce-events/*`, `/admin/osce-tokens`,
  `/admin/osce-observers`, `/admin/osce-results`, `/osce/*`,
  `/osce-scenario/*`, `/osce-scoring/*`
- Cohort intake (`/academics/cohorts/[id]/intake`)
- Student portal expansion: `/student/attendance-appeals`,
  `/student/available-labs`, `/student/peer-eval`,
  `/student/skill-evaluations/[id]`
- LVFR-AEMT module (entire `/lvfr-aemt/*` tree)
- Cases (entire `/cases/*` tree including session/[code]/instructor|join|student|tv)
- Lab day: `assignments`, `checkoff`, `coordinator`, `results` subpages
- Reports: builder, availability-patterns, closeout-surveys, instructor-analytics,
  lab-costs, program-overview, scenario-usage-overview, skill-trends,
  student-dashboard

### Pages removed (with reasons)
- All of `app/lab-management/` (see above)
- `app/reports/team-leads/page.tsx` redirect-loop stub (replaced with real
  page content moved from `/lab-management/reports/team-leads`)

---

## Table of Contents

1. [Root / General](#root--general)
2. [Admin](#admin) (65 pages)
3. [Academics](#academics) (22 pages)
4. [Labs](#labs) (38 pages)
5. [Clinical](#clinical) (26 pages)
6. [Reports](#reports) (24 pages)
7. [Scheduling](#scheduling) (15 pages)
8. [Student](#student) (11 pages)
9. [Instructor](#instructor) (8 pages)
10. [LVFR-AEMT](#lvfr-aemt) (10 pages)
11. [Cases](#cases) (10 pages)
12. [OSCE](#osce) (8 pages across 4 hubs)
13. [Settings, Auth, Misc](#settings-auth-misc)
14. [Token-based / Public](#token-based--public)

---

## Root / General

| Path | Component | Role |
|------|-----------|------|
| `/` | `app/page.tsx` | any authenticated |
| `/calendar` | unified calendar | instructor+ |
| `/help` | help hub | any |
| `/notifications` | inbox | any |
| `/onboarding` | post-signup onboarding | pending → student |
| `/request-access` | external access request | unauth |
| `/resources` | resource hub | any |
| `/resources/medications` | medication reference | any |
| `/feedback/my-submissions` | user's submitted feedback | any |
| `/tasks`, `/tasks/[id]` | task system | any |

## Admin

The `/admin/*` hub is the canonical home for system-level administration.
65 pages cover: users + roles, certifications, scenarios (audit/bulk-import/
cleanup/transform), lab-templates (incl. import), data-exports, OSCE tooling,
poll viewing, ferpa-compliance, alerts, system-health, audit-log, deep-links,
broadcast, time-clock, calendar-sync, equipment + maintenance, deletion-requests,
incidents, qa-checklist, semesters, system-alerts, user-activity, webhooks,
guests, alumni, external-access, dashboard-defaults, scheduled-exports,
seed-availability, lab-templates, attendance-appeals, announcements,
access-requests, compliance, rubrics, settings, config, database-tools,
program-requirements, volunteer-events, open-labs, roles, instructor-workload.

Highlights with sub-pages:
- `/admin/calendar-sync` — Per-user calendar sync controls (incl. **Force
  Re-sync** added 2026-05-20).
- `/admin/certifications/{compliance,verification}` — compliance dashboards.
- `/admin/feedback` — bug/feedback admin with CSV import/export (ISO dates +
  RFC 4180 escaping fixed 2026-05-21).
- `/admin/lab-templates` + `/import` — bulk template seeding with
  **placeholder gate** (refuses Content Pending titles unless
  `confirm_placeholders` flag set) and **audit trail**
  (lab_day_template_audit table).
- `/admin/skill-drills/import` — JSON import for skill_drills
  (single drill, array, or `{drills:[]}` wrapper). Maps brief
  fields → DB columns and upserts on `(lower(name), program,
  semester)`. Card surfaces under **Lab & Clinical** in the admin
  hub (moved 2026-05-28 from Content & Templates) and is also
  linked from `/labs/skill-drills` header.
- `/admin/scenarios/{audit,bulk-import,cleanup,transform}` — scenario admin.
  Bulk-import now dedups by ID then case-insensitive title (2026-05-21).
- `/admin/osce-events/[id]/checklist` — per-event OSCE checklist.
- `/admin/poll/[id]` — admin view of any scheduling poll.

## Academics

Canonical home for cohort + student + planner workflows. 22 pages.

| Path | Notes |
|------|-------|
| `/academics/cohorts` | Cohort list |
| `/academics/cohorts/[id]` | Cohort hub with **Generate Lab Days** (Fill gaps mode + Force Regenerate gate), Update from Template, etc. |
| `/academics/cohorts/[id]/calendar` | Cohort calendar view |
| `/academics/cohorts/[id]/completion` | Completion tracking |
| `/academics/cohorts/[id]/groups` | Lab groups management |
| `/academics/cohorts/[id]/intake` | NEW — onboarding/intake checklist |
| `/academics/cohorts/[id]/semester-review` | End-of-semester review |
| `/academics/cohorts/[id]/skill-log` | Skill completion log |
| `/academics/cohorts/[id]/smc` | SMC requirements |
| `/academics/admin/smc` | Cross-cohort SMC tools (admin) |
| `/academics/planner` | Block planner |
| `/academics/planner/templates` | Course/lab block templates |
| `/academics/planner/workload` | Instructor workload heatmap |
| `/academics/skill-sheets` | Skill sheet library |
| `/academics/skill-sheets/[id]` | Skill sheet editor |
| `/academics/students` | Student directory |
| `/academics/students/[id]` | Student profile |
| `/academics/students/[id]/learning-plan` | Per-student plan |
| `/academics/students/[id]/portfolio` | Student portfolio |
| `/academics/students/import` | CSV import |
| `/academics/students/new` | New student form |

## Labs

Canonical home for lab day operations. 38 pages.

| Path | Notes |
|------|-------|
| `/labs` | Hub (formerly `/lab-management`) |
| `/labs/schedule` | Lab day list |
| `/labs/schedule/[id]` | Lab day details — primary lab-day view |
| `/labs/schedule/[id]/assignments` | Per-station assignments |
| `/labs/schedule/[id]/checkoff` | Skill checkoff sheet |
| `/labs/schedule/[id]/coordinator` | Coordinator view |
| `/labs/schedule/[id]/edit` | Edit metadata |
| `/labs/schedule/[id]/results` | Results dashboard |
| `/labs/schedule/[id]/stations/new` | Add station |
| `/labs/schedule/new` | New lab day |
| `/labs/grade/station/[id]` | Grading page — has **Export JSON**, **Update from JSON**, no-email-on-file warning toast. For `station_type='skill_drill'` early-returns a dedicated `SkillDrillStationView` (no rubric / Platinum / submit — just SkillDrillReference cards + an observations textarea persisted to localStorage). |
| `/labs/adv-cert/grade` | **Advanced-Cert (ACLS/PALS) megacode grading** (instructor+). Pick course → testing day → group → team-lead + members → drawn scenario; renders the scenario's ordered segments + criteria checklist, per-segment pass/fail, instructor-set overall group pass/fail. Saves to `adv_cert_test_attempts` (+ attempt_students / segment_results / criterion_results) with a client-minted `client_uuid` for offline-readiness, and writes a `team_lead_log` row for the test team-lead. Backed by `/api/adv-cert/*`. Linked from the Labs hub (Megacode Grading tile). |
| `/labs/scenarios` | Scenario library (with checkbox multi-select + **Export Selected as JSON**) |
| `/labs/scenarios/[id]` | Scenario editor (with **Export JSON** + **Update from JSON** buttons) |
| `/labs/scenarios/new` | New scenario |
| `/labs/scenario-library` | Read-only library view |
| `/labs/skills/competencies` + `/report` | Competency tracking |
| `/labs/skill-drills` | Drill library — header has **Import JSON** (links to /admin/skill-drills/import) + **Add Drill** + **Seed S3 Drills** |
| `/labs/skill-drills/[id]` | Drill reference + print view per Skill_Drill_Webapp_Brief — fixed section order Title → Concept → Run steps → Equipment grid → Setups → Instructor notes. Print stylesheet strips chrome. |
| `/labs/skill-sheets` | Skill sheets (links to /academics) |
| `/labs/stations/{log,pool}` | Station log + station pool |
| `/labs/templates` | Lab template list |
| `/labs/templates/review` + `/[id]` + `/item/[itemId]` | Template review workflow |
| `/labs/templates/weekly` | Weekly template view |
| `/labs/seating/{charts,charts/[id],learning-styles,preferences}` | Seating |
| `/labs/groups` | Group manager |
| `/labs/peer-evals` | Peer evaluation admin |
| `/labs/mentorship` | Mentorship tracking |
| `/labs/protocol-tracking` | Protocol tracking |
| `/labs/flags` | Flag review |
| `/labs/ekg-warmup` | EKG warmup tool |
| `/labs/debrief-review` | Debrief review |
| `/labs/my-certifications` | User's certs (incl. CE tracker) |

## Clinical

26 pages covering rotations, internships, ride-alongs, preceptors, site visits.

| Path | Notes |
|------|-------|
| `/clinical` | Hub |
| `/clinical/aemt-tracking`, `/clinical/emt-tracking` | Pre-clinical tracking |
| `/clinical/affiliations`, `/clinical/agencies` | Partner mgmt |
| `/clinical/capacity` | Site capacity |
| `/clinical/compliance`, `/clinical/compliance-tracker` | Compliance |
| `/clinical/hours` | Hours log |
| `/clinical/internships` + subpages | Internship pipeline |
| `/clinical/mce` | MCE evals |
| `/clinical/overview` | Overview dashboard |
| `/clinical/planning-calendar` | Planning calendar |
| `/clinical/preceptors` | Preceptor directory |
| `/clinical/ride-alongs` + `/availability` + `/shifts` | Ride-along scheduling |
| `/clinical/rotation-scheduler` | Rotation scheduler |
| `/clinical/site-visits`, `/clinical/site-visit-settings` | Site visit admin |
| `/clinical/summative-evaluations` + `/[id]/grade` | Summative evals |

## Reports

Canonical reports hub. 24 pages, including 6 moved from `/lab-management/reports/`
on 2026-05-23 (now linked from the hub's new "Cohort Progress" section).

| Section | Pages |
|---------|-------|
| **Analytics Dashboards** | program-overview, instructor-analytics, student-dashboard, clinical-placements |
| **Existing Reports** | attendance, scenario-analytics, instructor-workload, skill-trends, gradebook, cohort-comparison, program-outcomes |
| **Operational** | availability-patterns, lab-costs, scenario-usage, scenario-usage-overview, closeout-surveys, builder |
| **Cohort Progress** (NEW) | lab-progress, student-progress, clinical-hours, internship-status, onboarding-status, team-leads |

## Scheduling

15 pages.

| Path | Notes |
|------|-------|
| `/scheduling` | Hub |
| `/scheduling/availability` + `/all` | Per-instructor + cohort availability |
| `/scheduling/planner` → redirects to `/academics/planner` |
| `/scheduling/polls` + `/create` | Polls |
| `/scheduling/reports` | Scheduling reports |
| `/scheduling/resource-bookings` | Room/equipment bookings |
| `/scheduling/shifts` + `/new` | Shifts |
| `/scheduling/signups/pending` | Pending sign-ups |
| `/scheduling/substitute-requests` | Sub requests |
| `/scheduling/team-availability` | Team view |

## Student

Student-facing portal. 11 pages.

| Path | Notes |
|------|-------|
| `/student` | Hub |
| `/student/attendance-appeals` | Appeal attendance marks |
| `/student/available-labs` | Open labs sign-up |
| `/student/completions` | Completion tracker |
| `/student/documents` | Documents |
| `/student/labs` | Lab schedule (student view) |
| `/student/my-progress` | Progress dashboard |
| `/student/peer-eval` | Peer eval workflow |
| `/student/profile` | Profile |
| `/student/skill-evaluations/[id]` | Eval detail |
| `/student/skill-sheets` | Skill sheets |

## Instructor

8 pages.

| Path | Notes |
|------|-------|
| `/instructor` | Hub |
| `/instructor/ce` | CE log |
| `/instructor/certifications` | Cert tracker |
| `/instructor/email-history` | Email sent log |
| `/instructor/history` | Teaching history |
| `/instructor/my-stats` | Stats dashboard |
| `/instructor/teaching` | Teaching schedule |
| `/instructor/time-clock` | Time clock |

## LVFR-AEMT

Las Vegas Fire & Rescue AEMT partner program (cohort AEMT G2,
`is_external_program=true`). Self-contained module with its own calendar,
planner, grading, files, pharm tracking.

| Path | Notes |
|------|-------|
| `/lvfr-aemt` | Module dashboard (role-aware: instructor / student / agency) |
| `/lvfr-aemt/day/[date]` | **Day runsheet** — AM/PM blocks, 3-tier items (required/optional/info; info = no checkbox), day brief + debrief. Rebuilt 2026-06-08 as the 30-day course (Jul 14 → Sep 17). See `644b8816`. |
| `/lvfr-aemt/calendar` | Course calendar |
| `/lvfr-aemt/planner` | Instructor/lab planner |
| `/lvfr-aemt/scheduling` | Instructor availability / coverage |
| `/lvfr-aemt/skills` | Skills tracker |
| `/lvfr-aemt/pharm` | Pharmacology checkpoints |
| `/lvfr-aemt/grades`, `/lvfr-aemt/grades/import` | Gradebook + CSV import |
| `/lvfr-aemt/files` | Files |

## Cases

Case study system. 10 pages.

| Path | Notes |
|------|-------|
| `/cases`, `/cases/new`, `/cases/[id]`, `/cases/[id]/edit`, `/cases/[id]/practice` | Library + editor |
| `/cases/leaderboard` | Active again (was removed → restored — see DEAD_CODE_REPORT) |
| `/cases/session/[code]/instructor` | Instructor live view |
| `/cases/session/[code]/join` | Student join |
| `/cases/session/[code]/student` | Student play |
| `/cases/session/[code]/tv` | TV display |

## OSCE

| Path | Notes |
|------|-------|
| `/osce`, `/osce/[slug]` | Public OSCE landing |
| `/osce-evaluator-signup` → `/osce/spring-2026` (redirect) |
| `/osce-scenario`, `/osce-scenario/[letter]` | Scenario library |
| `/osce-scoring/{enter,dashboard,[assessmentId]}` | Scoring workflow |
| `/admin/osce-events`, `/admin/osce-tokens`, `/admin/osce-observers`, `/admin/osce-results` | Admin |

## Settings, Auth, Misc

| Path | Notes |
|------|-------|
| `/settings` | User settings hub |
| `/settings/calendar-setup` | Google Calendar OAuth setup |
| `/settings/sessions` | Active sessions |
| `/auth/signin`, `/auth/error` | NextAuth pages |
| `/guest` | Guest landing |
| `/poll/[id]`, `/poll/create` | Public poll views |
| `/skill-sheets` → `/academics/skill-sheets` (redirect) |
| `/skill-evaluations/[id]` | Skill eval detail |
| `/students/[id]/progress` | Public student progress |

## Token-based / Public

| Path | Notes |
|------|-------|
| `/checkin/[token]` | Lab day check-in |
| `/open-lab`, `/open-lab/edit/[token]` | Open lab session |
| `/preceptor/evaluate/[token]` | Preceptor eval link |
| `/ride-along-poll/[token]` | Ride-along response |
| `/timer-display/[token]`, `/timer-display/live/[labDayId]` | Public timer display |
| `/volunteer/[token]`, `/volunteer-lab/[token]` | Volunteer signup links |

---

## Notes

- API routes (`app/api/**`) are NOT inventoried here — they're documented in `docs/API.md`.
- This map reflects the file-system state on 2026-05-23. Some HTTP routes
  (the `/lab-management/*` redirects, `/scheduler/*` → `/scheduling/polls/*`,
  etc.) work via `next.config.ts` and have no files on disk.

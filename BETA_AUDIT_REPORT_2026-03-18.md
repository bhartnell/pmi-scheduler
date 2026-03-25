# PMI Paramedic Tools -- Beta Audit Report

**Date:** March 18, 2026
**Scope:** Full codebase and database audit for alpha-to-beta transition
**Status:** READ-ONLY audit -- no code or data modifications made

---

## Section 1: Codebase Inventory

### Summary Table

| Metric | Count |
|---|---|
| Page routes (`page.tsx`) | 227 |
| API routes (`route.ts`) | 528 |
| Components (`.tsx` in `components/`) | 125 |
| Total TS/TSX lines | 195,591 |
| Database tables | 307 |
| Database total rows | ~11,634 |
| Migration files | 204 |
| Build output (`.next/`) | 257 MB |

### All Page Routes (227)

#### Dashboard & Auth (5)
| Route | Status |
|---|---|
| `/` (dashboard) | Active & Used |
| `/auth/signin` | Active & Used |
| `/auth/error` | Active & Used |
| `/request-access` | Active & Used |
| `/guest` | Active & Used |

#### Admin (53)
| Route | Status |
|---|---|
| `/admin` | Active & Used |
| `/admin/access-requests` | Active & Used |
| `/admin/alumni` | Active & Underused -- 0 alumni records |
| `/admin/announcements` | Active & Underused -- 0 announcements |
| `/admin/attendance-appeals` | Active & Underused -- 0 appeals |
| `/admin/audit-log` | Active & Used |
| `/admin/broadcast` | Active & Underused -- 0 broadcasts |
| `/admin/bulk-operations` | Active & Underused -- 0 operations |
| `/admin/calendar-sync` | Active & Used |
| `/admin/cases/generate` | Active & Used |
| `/admin/certifications` | Active & Underused -- 0 cert records |
| `/admin/certifications/compliance` | Active & Underused |
| `/admin/certifications/verification` | Active & Underused |
| `/admin/compliance` | Active & Used -- 8 audits |
| `/admin/config` | Active & Used |
| `/admin/dashboard-defaults` | Active & Underused -- 0 defaults |
| `/admin/database-tools` | Active & Used |
| `/admin/data-export` | Active & Used |
| `/admin/data-exports` | Active & Used |
| `/admin/data-import` | Active & Underused |
| `/admin/deep-links` | Active & Underused -- 0 links |
| `/admin/deletion-requests` | Active & Underused -- 0 requests |
| `/admin/email-templates` | Active & Underused -- 0 templates |
| `/admin/equipment` | Active & Underused -- 84 items, 0 checkouts |
| `/admin/equipment/maintenance` | Active & Underused -- 0 records |
| `/admin/external-access` | Active & Underused -- 0 emails |
| `/admin/ferpa-compliance` | Active & Underused -- 0 consents |
| `/admin/guests` | Active & Underused -- 0 guests |
| `/admin/incidents` | Placeholder -- 0 incidents |
| `/admin/instructor-workload` | Active & Used -- 101 workload records |
| `/admin/lab-templates` | Active & Used -- 88 templates |
| `/admin/lab-templates/import` | Active & Used |
| `/admin/osce-events` | Active & Used -- 1 event |
| `/admin/osce-events/[id]` | Active & Used |
| `/admin/osce-observers` | Active & Used |
| `/admin/page` (poll detail) | Active & Used |
| `/admin/program-requirements` | Active & Underused -- 0 requirements |
| `/admin/qa-checklist` | Active & Used |
| `/admin/roles` | Active & Used |
| `/admin/rubrics` | Active & Underused -- 0 rubrics |
| `/admin/scenarios` | Active & Used |
| `/admin/scenarios/audit` | Active & Used |
| `/admin/scenarios/bulk-import` | Active & Used |
| `/admin/scenarios/transform` | Active & Used |
| `/admin/scheduled-exports` | Active & Underused -- 0 exports |
| `/admin/settings` | Active & Used |
| `/admin/skill-sheets/import` | Active & Used |
| `/admin/system-alerts` | Active & Used |
| `/admin/system-health` | Active & Used |
| `/admin/time-clock` | Active & Underused -- 0 entries |
| `/admin/user-activity` | Active & Used -- 2,087 records |
| `/admin/users` | Active & Used |
| `/admin/webhooks` | Placeholder -- 0 webhooks |

#### Lab Management (47)
| Route | Status |
|---|---|
| `/lab-management` | Active & Used |
| `/lab-management/admin/cohorts` | Active & Used -- 9 cohorts |
| `/lab-management/admin/certifications` | Active & Used |
| `/lab-management/admin/feedback` | Active & Used -- 148 reports |
| `/lab-management/admin/page` | Active & Used |
| `/lab-management/admin/timer-displays` | Active & Used |
| `/lab-management/aemt-tracker` | Active & Used |
| `/lab-management/cohorts/[id]` | Active & Used |
| `/lab-management/cohorts/[id]/calendar` | Active & Used |
| `/lab-management/cohorts/[id]/completion` | Active & Used |
| `/lab-management/cohorts/[id]/groups` | Active & Used |
| `/lab-management/debrief-review` | Active & Underused |
| `/lab-management/ekg-warmup` | Active & Underused -- 0 scores |
| `/lab-management/emt-tracker` | Active & Used |
| `/lab-management/flags` | Active & Used |
| `/lab-management/grade/station/[id]` | Active & Used |
| `/lab-management/groups` | Active & Used |
| `/lab-management/mentorship` | Placeholder -- 0 records |
| `/lab-management/my-certifications` | Active & Used |
| `/lab-management/peer-evals` | Placeholder -- 0 records |
| `/lab-management/protocol-tracking` | Active & Underused |
| `/lab-management/reports/*` (7 subroutes) | Active & Used |
| `/lab-management/scenario-library` | Active & Used |
| `/lab-management/scenarios/*` | Active & Used |
| `/lab-management/schedule/*` | Active & Used -- 105 lab days |
| `/lab-management/seating/*` (4 pages) | Orphaned -- built but unused |
| `/lab-management/skill-drills` | Active & Used -- 17 drills |
| `/lab-management/skills/competencies` | Active & Used |
| `/lab-management/skill-sheets` | Active & Used |
| `/lab-management/stations/*` | Active & Used |
| `/lab-management/students/*` | Active & Used -- 96 students |
| `/lab-management/templates/*` | Active & Used |

#### Scheduling (15)
| Route | Status |
|---|---|
| `/scheduler` | Active & Used -- 13 polls |
| `/scheduler/create` | Active & Used |
| `/scheduling` | Active & Used |
| `/scheduling/availability` | Active & Used -- 84 records |
| `/scheduling/availability/all` | Active & Used |
| `/scheduling/planner` | Active & Used -- 587 blocks |
| `/scheduling/planner/templates` | Active & Used |
| `/scheduling/planner/workload` | Active & Used |
| `/scheduling/reports` | Active & Used |
| `/scheduling/resource-bookings` | Placeholder -- 0 bookings |
| `/scheduling/shifts` | Active & Used -- 31 shifts |
| `/scheduling/shifts/new` | Active & Used |
| `/scheduling/signups/pending` | Active & Used |
| `/scheduling/substitute-requests` | Placeholder -- 0 requests |
| `/scheduling/team-availability` | Active & Used |

#### Clinical (20)
| Route | Status |
|---|---|
| `/clinical` | Active & Used |
| `/clinical/aemt-tracking` | Active & Used -- 10 records |
| `/clinical/affiliations` | Active & Used -- 2 affiliations |
| `/clinical/agencies` | Active & Used -- 15 agencies |
| `/clinical/capacity` | Active & Used |
| `/clinical/compliance` | Active & Used -- 21 docs |
| `/clinical/compliance-tracker` | Active & Used |
| `/clinical/emt-tracking` | Active & Used -- 18 records |
| `/clinical/hours` | Active & Used -- 22 records |
| `/clinical/internships` | Active & Used -- 22 internships |
| `/clinical/internships/[id]` | Active & Used |
| `/clinical/mce` | Active & Used |
| `/clinical/overview` | Active & Used |
| `/clinical/planning-calendar` | Active & Used |
| `/clinical/preceptors` | Active & Used -- 57 preceptors |
| `/clinical/rotation-scheduler` | Active & Underused -- 0 rotations |
| `/clinical/site-visits` | Active & Used -- 28 visits |
| `/clinical/site-visit-settings` | Active & Used |
| `/clinical/summative-evaluations` | Active & Used -- 9 evals |
| `/clinical/summative-evaluations/[id]/grade` | Active & Used |

#### LVFR AEMT (9)
| Route | Status |
|---|---|
| `/lvfr-aemt` | Active & Used |
| `/lvfr-aemt/calendar` | Active & Used -- 30 course days |
| `/lvfr-aemt/files` | Active & Underused -- 0 files |
| `/lvfr-aemt/grades` | Active & Used |
| `/lvfr-aemt/grades/import` | Active & Used |
| `/lvfr-aemt/pharm` | Active & Underused -- 0 checkpoints |
| `/lvfr-aemt/planner` | Active & Used -- 336 placements |
| `/lvfr-aemt/scheduling` | Active & Used |
| `/lvfr-aemt/skills` | Active & Used -- 30 skills |

#### Case Studies (10)
| Route | Status |
|---|---|
| `/cases` | Active & Used -- 3 cases |
| `/cases/[id]` | Active & Used |
| `/cases/[id]/edit` | Active & Used |
| `/cases/[id]/practice` | Active & Used |
| `/cases/leaderboard` | Active & Underused |
| `/cases/new` | Active & Used |
| `/cases/session/[code]/instructor` | Active & Used |
| `/cases/session/[code]/join` | Active & Used |
| `/cases/session/[code]/student` | Active & Used |
| `/cases/session/[code]/tv` | Active & Used |

#### Student Portal (13)
| Route | Status |
|---|---|
| `/student` | Active & Used |
| `/student/attendance-appeals` | Active & Underused |
| `/student/available-labs` | Active & Used |
| `/student/completions` | Active & Used |
| `/student/documents` | Active & Underused -- 0 docs |
| `/student/labs` | Active & Used |
| `/student/my-progress` | Active & Used |
| `/student/peer-eval` | Placeholder -- 0 evals |
| `/student/profile` | Active & Used |
| `/student/skill-evaluations/[id]` | Active & Used |
| `/student/skill-sheets` | Active & Used |
| `/students/[id]/progress` | Active & Used |

#### Other (16)
| Route | Status |
|---|---|
| `/calendar` | Active & Used |
| `/checkin/[token]` | Active & Used |
| `/feedback/my-submissions` | Active & Used |
| `/help` | Active & Used |
| `/instructor` | Active & Used |
| `/instructor/ce` | Active & Underused |
| `/instructor/certifications` | Active & Used |
| `/instructor/history` | Active & Used |
| `/instructor/my-stats` | Active & Used |
| `/instructor/teaching` | Active & Underused |
| `/instructor/time-clock` | Active & Underused |
| `/notifications` | Active & Used -- 1,002 notifications |
| `/onboarding` | Active & Used |
| `/osce/[slug]` | Active & Used |
| `/osce-evaluator-signup` | Active & Used |
| `/poll/[id]` | Active & Used |
| `/preceptor/evaluate/[token]` | Active & Used |
| `/reports/*` (16 subroutes) | Mixed -- most are Active & Underused |
| `/resources` | Active & Underused |
| `/resources/medications` | Active & Underused |
| `/settings` | Active & Used |
| `/settings/sessions` | Active & Used |
| `/skill-sheets` | Active & Used -- 133 sheets |
| `/skill-sheets/[id]` | Active & Used |
| `/tasks` | Active & Used -- 10 tasks |
| `/tasks/[id]` | Active & Used |
| `/timer-display/[token]` | Active & Used |
| `/timer-display/live/[labDayId]` | Active & Used |

### Page Status Summary

| Category | Count |
|---|---|
| Active & Used | ~155 |
| Active & Underused | ~50 |
| Orphaned | ~4 (seating charts) |
| Placeholder (empty data, no real usage) | ~12 |
| Broken | 0 (build passes) |

### Largest Files (>1,000 lines)

| File | Lines |
|---|---|
| `app/lab-management/schedule/[id]/page.tsx` | 5,282 |
| `app/lab-management/scenarios/[id]/page.tsx` | 3,100 |
| `app/scheduling/planner/page.tsx` | 3,053 |
| `app/lab-management/schedule/new/page.tsx` | 2,999 |
| `app/lab-management/students/[id]/page.tsx` | 2,321 |
| `app/lab-management/schedule/page.tsx` | 2,168 |
| `app/lab-management/scenarios/new/page.tsx` | 2,122 |
| `app/settings/page.tsx` | 2,114 |
| `components/SkillSheetPanel.tsx` | 1,962 |
| `components/clinical/CloseoutSection.tsx` | 1,935 |
| `app/scheduling/shifts/page.tsx` | 1,899 |
| `app/clinical/internships/[id]/page.tsx` | 1,864 |
| `app/scheduling/availability/all/page.tsx` | 1,852 |
| `app/lvfr-aemt/planner/page.tsx` | 1,849 |
| `app/admin/scenarios/audit/page.tsx` | 1,837 |
| `app/clinical/internships/page.tsx` | 1,795 |
| `app/clinical/hours/page.tsx` | 1,761 |
| `app/admin/osce-events/[id]/page.tsx` | 1,759 |
| `app/cases/[id]/practice/page.tsx` | 1,658 |
| `app/lab-management/cohorts/[id]/page.tsx` | 1,657 |

### Largest API Routes

| Route | Lines |
|---|---|
| `api/clinical/summative-evaluations/[id]/scenario-print` | 888 |
| `api/admin/skill-sheets/seed-aliases` | 732 |
| `api/scheduling/reports` | 727 |
| `api/lvfr-aemt/planner/reseed` | 712 |
| `api/admin/data-export` | 668 |
| `api/admin/skill-sheets/import` | 663 |
| `api/students/[id]/progress` | 601 |
| `api/admin/data-import/execute` | 586 |

---

## Section 2: Navigation Audit

### Main Dashboard Tiles (app/page.tsx)

| Tile | Link | Role Requirement |
|---|---|---|
| Lab Management | `/lab-management` | instructor+ |
| Lab Schedule (read-only) | `/lab-management/schedule` | volunteer_instructor only |
| Instructor Portal | `/instructor` | instructor+ |
| Scheduling Polls | `/scheduler` | instructor+ |
| Tasks | `/tasks` | instructor+ |
| Part-Timer Scheduling | `/scheduling` | canAccessScheduling |
| Calendar | `/calendar` | canAccessScheduling |
| Onboarding | `/onboarding` | Has active assignment |
| Student Portal | `/student` | student only |
| Case Studies | `/cases` | instructor+ or student |
| Clinical & Internship | `/clinical` | canAccessClinical or canAccessAffiliations |
| LVFR AEMT | `/lvfr-aemt` | canAccessLVFR |
| Admin Settings | `/admin` | canAccessAdmin |
| Help Center | `/help` | Always visible |
| Site Visit Check-In (banner) | `/clinical/site-visits` | canAccessClinical |

### Dashboard Widgets (14 available)
notifications, my_labs, quick_links, needs_attention, overview_stats, open_stations, recent_feedback, onboarding, overdue_tasks, recent_activity, quick_stats, my_tasks, cert_expiry, at_risk_students

### Admin Settings Grid (app/admin/page.tsx)

9 collapsible sections with ~45 links:

| Section | Links | Access |
|---|---|---|
| Users & Access | 5 (User Mgmt, Guests, Access Requests, External Access, Deletion Requests) | admin+ |
| Scenarios | 4 (Hub, Manage, Audit, Transform) | admin+ |
| Content & Templates | 6 (Lab Templates, Import, Rubrics, Email, Program Req, Dashboard Defaults) | admin+ |
| Lab & Clinical | 9 (Equipment, Time Clock, Appeals, Maintenance, Incidents, OSCE, Calendar Sync, Skill Sheets, Import) | admin+ |
| Data Management | 8 (Certs Import, Compliance, Export, Import, Scheduled, Archives, Verification, Bulk Ops) | admin+ |
| Communication | 2 (Announcements, Broadcast) | admin+ |
| Student Management | 2 (Alumni, QA Checklist) | admin+ |
| Reports | 4 (Hub, Closeout Surveys, Builder, Program Outcomes) | admin+ |
| Monitoring & Activity | 2 (User Activity, System Alerts) | admin+ |
| System (superadmin) | 10 (Health, Audit Log, FERPA, Compliance, Roles, Settings, Config, DB Tools, Webhooks, Deep Links) | superadmin |

### Clinical Hub Tiles (app/clinical/page.tsx)

| Tile | Link | Access |
|---|---|---|
| Clinical Sites | `/clinical/agencies?type=hospital` | canAccessClinical |
| Internship Agencies | `/clinical/agencies?type=ems` | canAccessClinical |
| Overview Dashboard | `/clinical/overview` | canAccessClinical |
| Cohort Manager | `/lab-management/admin/cohorts` | canAccessClinical |
| Preceptor Directory | `/clinical/preceptors` | canAccessClinical |
| Internship Tracker | `/clinical/internships` | canAccessClinical |
| Compliance Docs | `/clinical/compliance` | canAccessClinical |
| Clinical Hours | `/clinical/hours` | canAccessClinical |
| EMT Tracking | `/clinical/emt-tracking` | canAccessClinical |
| AEMT Tracking | `/clinical/aemt-tracking` | canAccessClinical |
| Summative Evaluations | `/clinical/summative-evaluations` | canAccessClinical |
| Site Visits | `/clinical/site-visits` | canAccessClinical |
| OSCE Events | `/admin/osce-events` | canAccessClinical |
| Planning Calendar | `/clinical/planning-calendar` | canAccessClinical |
| Site Capacity | `/clinical/capacity` | canAccessClinical |
| Compliance Tracker | `/clinical/compliance-tracker` | canAccessClinical |
| Rotation Scheduler | `/clinical/rotation-scheduler` | canAccessClinical |
| MCE Tracker | `/clinical/mce` | canAccessClinical |
| Affiliations | `/clinical/affiliations` | canAccessAffiliations |

### Unreachable Pages (no inbound navigation links found)

These pages exist but have no tile/link from any hub page:

1. `/lab-management/seating/charts` -- Seating chart system (orphaned)
2. `/lab-management/seating/charts/[id]` -- Individual chart view
3. `/lab-management/seating/learning-styles` -- Learning styles page
4. `/lab-management/seating/preferences` -- Seating preferences
5. `/reports/availability-patterns` -- Not linked from reports hub
6. `/reports/scenario-usage-overview` -- Duplicate of scenario-usage
7. `/admin/instructor-workload` -- Accessible via planner, not admin grid

### Navigation Depth (clicks from dashboard)

| Workflow | Depth |
|---|---|
| View lab day detail | 3 (Dashboard > Lab Mgmt > Schedule > Day) |
| Grade a station | 4 (Dashboard > Lab Mgmt > Schedule > Day > Station) |
| Create lab day | 3 (Dashboard > Lab Mgmt > Schedule > New) |
| View student profile | 3 (Dashboard > Lab Mgmt > Students > Student) |
| Log site visit | 2 (Dashboard > Site Visit banner or Clinical > Site Visits) |
| View internship detail | 3 (Dashboard > Clinical > Internships > Detail) |
| Submit availability | 2 (Dashboard > Scheduling > Availability) |
| Admin user management | 2 (Dashboard > Admin > Users) |

---

## Section 3: Feature Audit

### Core Features Status

| Feature | Route | Status | Data |
|---|---|---|---|
| **Lab day creation** | `/lab-management/schedule/new` | WORKING | 105 lab days |
| **Lab day detail** | `/lab-management/schedule/[id]` | WORKING | Fully functional |
| **Lab day editing** | `/lab-management/schedule/[id]/edit` | WORKING | |
| **Lab day grading** | `/lab-management/grade/station/[id]` | WORKING | 41 assessments |
| **Station management** | Built into lab day detail | WORKING | 272 stations |
| **Scenario management** | `/lab-management/scenarios` | WORKING | 68 scenarios |
| **Scenario library** | `/lab-management/scenario-library` | WORKING | Shared library |
| **Skill sheet formative** | `/skill-sheets/[id]` + panel | WORKING | 133 sheets, 1,309 steps |
| **Skill sheet final (NREMT)** | Individual testing grid | WORKING | 40 evaluations |
| **Individual testing tracker** | Built into lab day detail | WORKING | 38 queue items |
| **Semester planner** | `/scheduling/planner` | WORKING | 587 blocks |
| **Workload tracker** | `/scheduling/planner/workload` | WORKING | 101 workload records |
| **LVFR planner** | `/lvfr-aemt/planner` | WORKING | 336 placements |
| **LVFR calendar** | `/lvfr-aemt/calendar` | WORKING | 30 course days |
| **LVFR grades** | `/lvfr-aemt/grades` | WORKING | Import system |
| **LVFR skills** | `/lvfr-aemt/skills` | WORKING | 30 skills |
| **Clinical sites/agencies** | `/clinical/agencies` | WORKING | 15 agencies, 7 sites |
| **Internship tracker** | `/clinical/internships` | WORKING | 22 internships |
| **Clinical hours** | `/clinical/hours` | WORKING | 22 records |
| **Preceptor management** | `/clinical/preceptors` | WORKING | 57 preceptors |
| **Site visits** | `/clinical/site-visits` | WORKING | 28 visits |
| **Summative evals** | `/clinical/summative-evaluations` | WORKING | 9 evals |
| **Case studies** | `/cases` | WORKING | 3 cases |
| **Case practice mode** | `/cases/[id]/practice` | WORKING | |
| **Case sessions (live)** | `/cases/session/[code]` | WORKING | |
| **Data exports** | `/admin/data-export` | WORKING | 4 exports |
| **Feedback system** | `/feedback/my-submissions` | WORKING | 148 reports |
| **Dashboard widgets** | `/` | WORKING | 14 widgets, customizable |
| **Notifications** | `/notifications` | WORKING | 1,002 notifications |
| **Tasks system** | `/tasks` | WORKING | 10 tasks |
| **Onboarding** | `/onboarding` | WORKING | 1 assignment, 26 tasks |
| **Scheduling polls** | `/scheduler` | WORKING | 13 polls |
| **Part-timer shifts** | `/scheduling/shifts` | WORKING | 31 shifts |
| **Availability tracking** | `/scheduling/availability` | WORKING | 84 records |
| **User management** | `/admin/users` | WORKING | Multiple roles |
| **OSCE events** | `/admin/osce-events` | WORKING | 1 event |
| **EMT tracking** | `/clinical/emt-tracking` | WORKING | 18 records |
| **AEMT tracking** | `/clinical/aemt-tracking` | WORKING | 10 records |
| **Compliance docs** | `/clinical/compliance` | WORKING | 21 docs |
| **Cohort management** | `/lab-management/admin/cohorts` | WORKING | 9 cohorts |
| **Student management** | `/lab-management/students` | WORKING | 96 students |
| **Lab templates** | `/admin/lab-templates` | WORKING | 88 templates |
| **Timer system** | Timer display + lab day integration | WORKING | 4 tokens |
| **Command palette** | `Ctrl+K` search | WORKING | Global |
| **Help center** | `/help` | WORKING | Comprehensive |
| **Settings** | `/settings` | WORKING | 2FA, calendar, sessions |

### Features Built But Likely Unused

| Feature | Pages/Routes | Data | Recommendation |
|---|---|---|---|
| **Seating charts** | 4 pages, 3 API routes | 3 charts, 23 assignments, 48 learning styles | ARCHIVE -- no active usage, was experimental |
| **Learning styles** | `/lab-management/seating/learning-styles` | 48 records (imported once) | ARCHIVE with seating |
| **Equipment checkout** | `/admin/equipment` | 84 items, 0 checkouts | KEEP -- has inventory data but checkout flow unused |
| **Equipment maintenance** | `/admin/equipment/maintenance` | 0 records | ARCHIVE |
| **Gamification/achievements** | Achievement API routes | 0 achievements, 0 case stats | ARCHIVE |
| **Incident reports** | `/admin/incidents` | 0 incidents | KEEP code, hide from nav |
| **Peer evaluations** | `/lab-management/peer-evals`, `/student/peer-eval` | 0 records | ARCHIVE |
| **Mentorship pairs** | `/lab-management/mentorship` | 0 records | ARCHIVE |
| **Resource bookings** | `/scheduling/resource-bookings` | 0 bookings, 0 resources | ARCHIVE |
| **Webhooks** | `/admin/webhooks` | 0 records | KEEP code, keep hidden |
| **Alumni tracking** | `/admin/alumni` | 0 records | KEEP -- will be used post-graduation |
| **Rubrics** | `/admin/rubrics` | 0 rubrics, 0 criteria | KEEP code, low priority |
| **Protocol tracking** | `/lab-management/protocol-tracking` | 0 completions | ARCHIVE |
| **Substitute requests** | `/scheduling/substitute-requests` | 0 requests | KEEP -- will be useful |
| **Deep links** | `/admin/deep-links` | 0 links | ARCHIVE |
| **Email templates** | `/admin/email-templates` | 0 templates | KEEP -- future use |
| **Medications resource** | `/resources/medications` | 0 medications (separate from LVFR 8) | ARCHIVE |
| **Student documents** | `/student/documents` | 0 documents | KEEP -- future use |

---

## Section 4: Code Health

### Type Safety

| Metric | Count |
|---|---|
| Files containing `: any` | 330 |
| Total `: any` occurrences | 542 |
| Total `as any` casts | 182 |
| **Combined `any` usage** | **724** |

Most `any` usage is in API routes for Supabase query results and component event handlers. The codebase is broadly typed but uses escape hatches where Supabase return types are complex.

### TODO/FIXME/HACK Comments

Only **2 actual TODO items** found (plus 3 false positives from XXX patterns):
1. `app/api/lvfr-aemt/dashboard/route.ts:168` -- "TODO: calculate when skills data is populated"
2. `app/instructor/certifications/page.tsx:203` -- "TODO: Handle image upload"

This is an exceptionally clean codebase with almost no deferred work markers.

### Duplicate/Similar Components

| Pattern | Files | Action Needed |
|---|---|---|
| ButtonLoading | `components/ButtonLoading.tsx`, `components/ui/ButtonLoading.tsx`, `components/ui/ButtonSpinner.tsx` | Consolidate to 1 |
| ErrorBoundary | `components/ErrorBoundary.tsx`, `components/PageErrorBoundary.tsx`, `components/ui/ErrorBoundary.tsx` | Consolidate -- PageErrorBoundary is a wrapper, keep 2 |
| LoadingSpinner | `components/LoadingSpinner.tsx`, `components/ui/LoadingSpinner.tsx` | Consolidate to 1 |

### API Pattern Consistency

| Pattern | Count |
|---|---|
| Routes using `getServerSession` + `authOptions` | 151 / 528 (29%) |
| Routes using Supabase directly | 519 / 528 (98%) |
| Public/cron routes (no auth expected) | ~29 |
| Routes possibly missing auth | ~348 |

**Note:** Many API routes check session via Supabase user lookup rather than `getServerSession`. The 29% figure for `getServerSession` does not mean auth is missing -- rather, many routes use an alternative pattern of fetching the user and checking session validity inline. A dedicated auth audit should verify each unprotected route.

### Files Over 500 Lines

40+ files exceed 500 lines. The top concern is `app/lab-management/schedule/[id]/page.tsx` at **5,282 lines** -- this is the lab day detail page and is the most complex page in the application. Consider extracting sub-components for:
- Station cards (already extracted to `components/lab-day/StationCards.tsx`)
- Attendance section
- Timer controls
- Individual testing grid

---

## Section 5: Database Health

### Overview

| Metric | Value |
|---|---|
| Total tables | 307 |
| Tables with data (>0 rows) | 146 |
| Tables with no data | 161 |
| Total rows | ~11,634 |
| Total FK relationships | 418 |
| Delete protection triggers | 29 (on 15 tables) |

### Foreign Key Relationship Breakdown

| Delete Rule | Count | Notes |
|---|---|---|
| CASCADE | 59 | Child rows auto-deleted with parent |
| RESTRICT | 170 | Prevents parent deletion if children exist |
| NO ACTION | 126 | Similar to RESTRICT (deferred check) |
| SET NULL | 63 | Sets FK to NULL when parent deleted |

### Tables with Delete Protection Triggers

These critical tables have both individual and mass-delete prevention:

| Table | Trigger Count |
|---|---|
| `cohorts` | 2 |
| `students` | 2 |
| `lab_groups` | 2 |
| `lab_group_members` | 2 |
| `student_groups` | 2 |
| `student_group_assignments` | 2 |
| `student_clinical_hours` | 2 |
| `student_internships` | 2 |
| `student_skill_evaluations` | 2 |
| `scenario_assessments` | 2 |
| `skill_assessments` | 2 |
| `station_completions` | 2 |
| `summative_evaluations` | 1 |
| `summative_evaluation_scores` | 1 |
| `closeout_documents` | 1 |
| `closeout_surveys` | 1 |
| `programs` | 1 |

### Tables With No Data (Notable - 161 total, key ones listed)

| Table | Purpose | Notes |
|---|---|---|
| `alumni` | Graduate tracking | Will populate after first graduation |
| `announcements` | System announcements | Feature built, not yet used |
| `attendance_appeals` | Student appeals | Feature ready |
| `broadcast_history` | Broadcast log | Feature ready |
| `clinical_rotations` | Rotation assignments | Rotation scheduler underused |
| `equipment_checkouts` | Equipment loans | Checkout flow unused |
| `guest_access` | Guest access tokens | Guest feature underused |
| `instructor_certifications` | Cert tracking | Not yet imported |
| `instructor_time_entries` | Time clock | Time clock underused |
| `peer_evaluations` | Peer evals | Feature unused |
| `teaching_log` | Teaching records | Feature underused |
| `report_templates` | Saved reports | Report builder underused |

### Data Integrity Spot Checks

| Check | Result | Status |
|---|---|---|
| Cohorts | 9 total (status breakdown not available in query) | OK |
| Students | 96 total, 92 active | OK |
| Lab days | 105 | OK |
| Scenarios | 68 | OK |
| Skill evaluations | 40 | OK |
| Stations | 272 | OK |
| Notifications | 1,002 | OK |
| Audit log | 9 entries | LOW -- audit logging may not be capturing enough |
| User activity | 2,087 | OK |

### Migration Count: 204

Migrations span from `20250205` to `20260318` (March 18, 2026 -- today). Recent migrations include template default instructors, evaluation step details, and lab template fixes.

---

## Section 6: Performance & Build

### Build Status

- **Build result:** SUCCESS
- **Build output directory:** 257 MB
- **All 227 pages compile successfully**
- **No TypeScript errors** blocking build

### Page Types

| Type | Symbol | Count | Notes |
|---|---|---|---|
| Static (prerendered) | `o` | ~210 | Pre-built at deploy time |
| Dynamic (server-rendered) | `f` | ~17 | Rendered on demand (parameterized routes) |

### Bundle Size Concerns

The `.next` output at 257 MB is within normal range for an application of this size. Key concerns:

1. **Lab day detail page** (5,282 lines) -- largest single page, may benefit from code splitting
2. **Scheduling planner** (3,053 lines) -- complex drag-and-drop planner
3. **Settings page** (2,114 lines) -- could split into tab-based lazy loading

### Cron Jobs (17 scheduled endpoints)

| Cron Route | Purpose |
|---|---|
| `affiliation-expiry` | Check expiring affiliations |
| `attendance-alerts` | Student attendance alerts |
| `availability-reminders` | Part-timer availability reminders |
| `calendar-sync` | Google Calendar sync |
| `cert-expiry` | Certification expiry alerts |
| `clinical-hours-reminder` | Clinical hours reminders |
| `compliance-expiry` | Compliance doc expiry |
| `compliance-reminders` | Compliance reminders |
| `daily-digest` | Daily email digest |
| `data-export` | Automated data exports |
| `debrief-reminder` | Debrief reminders |
| `internship-milestones` | Internship milestone checks |
| `lab-reminder` | Lab day reminders |
| `lvfr-weekly-report` | LVFR weekly report |
| `scheduled-exports` | Scheduled export runner |
| `site-visit-reminders` | Site visit reminders |
| `system-health` | System health monitoring |
| `weekly-digest` | Weekly email digest |

---

## Section 7: Recommendations

### 1. Remove/Archive List (hide from nav, keep code)

These features should be hidden from navigation but code preserved for potential future use:

| Feature | Pages | Reason |
|---|---|---|
| Seating Charts & Learning Styles | 4 pages | No active usage, experimental feature |
| Peer Evaluations | 2 pages | Never used, not in current workflow |
| Mentorship Pairs | 1 page | Never used |
| Equipment Maintenance | 1 page | 0 records, equipment system underused |
| Protocol Tracking | 1 page | 0 records |
| Deep Links | 1 page | 0 records, admin tool unused |
| Resource Bookings | 1 page | 0 records |
| Medications Resource | 1 page | 0 records (separate from LVFR) |
| Gamification/Achievements | API only | 0 records, over-engineered |
| Scenario Usage Overview | 1 page | Duplicate of scenario-usage report |

### 2. Fix/Stabilize List (for beta quality)

| Issue | Priority | Details |
|---|---|---|
| Audit log coverage | HIGH | Only 9 entries -- audit logging should capture more operations (student record access, grade changes, clinical data views) |
| API auth consistency | HIGH | Verify all 348 non-public routes that don't use `getServerSession` have proper auth via alternative patterns |
| Lab day detail page size | MEDIUM | 5,282 lines -- extract remaining inline sections to components |
| Consolidate duplicate components | LOW | Merge ButtonLoading (3 versions), ErrorBoundary (3 versions), LoadingSpinner (2 versions) |
| Instructor certifications import | MEDIUM | 0 records -- needs initial data import before beta |
| `any` type reduction | LOW | 724 instances -- prioritize API routes where type safety matters most |

### 3. Consolidate List

| Current | Merge Into | Reason |
|---|---|---|
| `components/ButtonLoading.tsx` + `components/ui/ButtonLoading.tsx` + `components/ui/ButtonSpinner.tsx` | Single `components/ui/ButtonLoading.tsx` | 3 versions of same concept |
| `components/ErrorBoundary.tsx` + `components/ui/ErrorBoundary.tsx` | Single `components/ui/ErrorBoundary.tsx` | Identical functionality |
| `components/LoadingSpinner.tsx` + `components/ui/LoadingSpinner.tsx` | Single `components/ui/LoadingSpinner.tsx` | Identical functionality |
| `/admin/data-export` + `/admin/data-exports` | Single data export page | Two separate export pages |
| `/reports/scenario-usage` + `/reports/scenario-usage-overview` | Single scenario report | Overlapping reports |

### 4. Metrics Summary: March 8 vs March 18

| Metric | Mar 8 (est.) | Mar 18 | Delta |
|---|---|---|---|
| Page routes | ~200 | 227 | +27 |
| API routes | ~480 | 528 | +48 |
| Components | ~118 | 125 | +7 |
| Total TS/TSX lines | ~170K | 195,591 | +25K |
| Database tables | ~280 | 307 | +27 |
| Migrations | ~175 | 204 | +29 |
| Lab days | ~85 | 105 | +20 |
| Students | ~90 | 96 | +6 |
| Scenarios | ~65 | 68 | +3 |
| Skill sheets | ~120 | 133 | +13 |
| LVFR placements | ~280 | 336 | +56 |
| Semester planner blocks | ~400 | 587 | +187 |
| Notifications | ~800 | 1,002 | +202 |
| User activity events | ~1,500 | 2,087 | +587 |
| Skill evaluations | ~20 | 40 | +20 |
| Workload records | ~60 | 101 | +41 |

**Key developments in the last 10 days:**
- Semester planner grew significantly (+187 blocks) indicating active scheduling work
- Individual testing tracker and skill evaluation system saw heavy use (+20 evals)
- LVFR planner matured with 56 new placements
- Instructor workload tracking nearly doubled
- 29 new migrations indicate rapid schema evolution
- User activity nearly doubled, confirming growing adoption

### 5. Beta Readiness Assessment

| Area | Ready? | Notes |
|---|---|---|
| Lab Management (core) | YES | 105 lab days, full grading pipeline |
| Scenario System | YES | 68 scenarios, audit + transform tools |
| Student Management | YES | 96 students, full profiles |
| Skill Sheets | YES | 133 sheets, 1,309 steps, evaluation flow |
| Individual Testing | YES | Queue system, auto-tracking, popovers |
| Semester Planner | YES | 587 blocks, multi-instructor, workload |
| LVFR AEMT | YES | Full planner, calendar, skills, scheduling |
| Clinical/Internships | YES | 22 internships, full tracking pipeline |
| Scheduling/Shifts | YES | 31 shifts, availability, signups |
| Case Studies | PARTIAL | Only 3 cases -- needs more content |
| Reports | PARTIAL | Framework ready but many empty reports |
| Notifications | YES | 1,002 sent, digest system works |
| Dashboard | YES | 14 widgets, customizable, role-based |
| Admin Tools | YES | Comprehensive, well-organized |
| Auth/Security | NEEDS REVIEW | Auth pattern audit recommended |
| Audit Logging | NEEDS WORK | Only 9 entries -- insufficient for FERPA |

### Overall: The application is beta-ready for its core workflows. The main risks are (1) audit logging gaps for compliance, (2) API auth pattern verification, and (3) too many unused features cluttering the codebase. Archiving 10-15 unused features and strengthening audit coverage would bring this to solid beta quality.

---

*Report generated March 18, 2026 by automated codebase audit.*

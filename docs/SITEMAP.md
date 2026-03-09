# PMI EMS Scheduler -- Site Map
> Auto-generated from codebase scan -- March 8, 2026

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
| 0 | `pending` | Awaiting approval -- minimal access |

---

## Table of Contents

1. [Root / General](#root--general)
2. [Admin](#admin)
3. [Auth](#auth)
4. [Calendar](#calendar)
5. [Cases](#cases)
6. [Clinical](#clinical)
7. [Feedback](#feedback)
8. [Instructor](#instructor)
9. [Lab Management](#lab-management)
10. [Notifications](#notifications)
11. [Onboarding](#onboarding)
12. [OSCE](#osce)
13. [Poll / Scheduler (Legacy)](#poll--scheduler-legacy)
14. [Reports](#reports)
15. [Resources](#resources)
16. [Scheduling](#scheduling)
17. [Settings](#settings)
18. [Skill Sheets](#skill-sheets)
19. [Student Portal](#student-portal)
20. [Tasks](#tasks)
21. [Public / Token-Based](#public--token-based)
22. [API Routes](#api-routes)
23. [Deprecated Routes / Redirects](#deprecated-routes--redirects)
24. [Route Counts](#route-counts)

---

# PAGE ROUTES

## Root / General

| Route | Description | Min Role |
|-------|-------------|----------|
| `/` | Home dashboard with role-based widgets, quick links, and customizable layout | authenticated |
| `/help` | Documentation and help resources for the application | authenticated |
| `/notifications` | User notification center with read/unread tracking and archive | authenticated |
| `/request-access` | Self-service form for new @pmi.edu users to request volunteer instructor access | authenticated (pending) |

**Page count: 4**

---

## Admin

All admin pages require `admin` role or higher unless noted otherwise.

| Route | Description | Min Role |
|-------|-------------|----------|
| `/admin` | Admin hub with categorized links to all administration tools | admin |
| `/admin/access-requests` | Review and approve/deny volunteer instructor signup requests | admin |
| `/admin/alumni` | Track graduates: employment status, contact info, continuing education | admin |
| `/admin/announcements` | Post and manage system-wide announcements for instructors and students | admin |
| `/admin/attendance-appeals` | Review and action student attendance absence appeal requests | admin |
| `/admin/audit-log` | FERPA audit log -- view access logs for protected educational records | superadmin |
| `/admin/broadcast` | Send targeted in-app or email notifications to users, roles, cohorts, or individuals | admin |
| `/admin/bulk-operations` | Execute bulk data operations (updates/deletes) with rollback support | admin |
| `/admin/calendar-sync` | Monitor Google Calendar connections and sync status for instructors | admin |
| `/admin/cases/generate` | AI-assisted case study generation with prompt templates | admin |
| `/admin/certifications` | Bulk import instructor certifications from CSV and monitor expirations | admin |
| `/admin/certifications/compliance` | View compliance status for all instructor certifications and identify gaps | admin |
| `/admin/certifications/verification` | Verify and review individual instructor certification credentials | admin |
| `/admin/config` | Centralized config panel: email, notifications, security, features, branding, legal | superadmin |
| `/admin/dashboard-defaults` | Configure which widgets appear by default on the dashboard for each role | admin |
| `/admin/data-export` | Export cohort, student, lab, clinical, and assessment data as CSV or JSON | admin |
| `/admin/data-import` | Import historical student data from CSV files with preview and validation | admin |
| `/admin/database-tools` | Clear old audit logs, notifications, orphaned records; view database statistics | superadmin |
| `/admin/deep-links` | Generate and manage deep links and QR codes for direct page access | admin |
| `/admin/deletion-requests` | Review and approve deletion requests submitted by instructors | admin |
| `/admin/email-templates` | Customize notification email templates sent by the system | admin |
| `/admin/equipment` | Track lab equipment inventory, availability, conditions, and check-out/check-in | admin |
| `/admin/equipment/maintenance` | Schedule and track equipment maintenance, repairs, and calibration records | admin |
| `/admin/guests` | Create and manage guest access for external/volunteer instructors | admin |
| `/admin/incidents` | Log and track safety incidents in lab and clinical settings (OSHA compliance) | admin |
| `/admin/lab-templates` | Create and manage reusable lab day templates by program, semester, and week | admin |
| `/admin/lab-templates/import` | Import lab templates from JSON files with seed data for quick setup | admin |
| `/admin/osce-events` | Create and manage OSCE evaluator signup events per semester | admin |
| `/admin/osce-events/[id]` | Detailed OSCE event management: observers, schedule, time blocks | admin |
| `/admin/osce-observers` | Redirect to latest OSCE event observers page | admin |
| `/admin/poll/[id]` | Admin view and management of a specific scheduling poll | admin |
| `/admin/program-requirements` | Configure required clinical hours, skills, and scenarios per program | admin |
| `/admin/qa-checklist` | Comprehensive QA checklist for testing all major features across roles | admin |
| `/admin/roles` | View role hierarchy and permission matrix | superadmin |
| `/admin/rubrics` | Build and manage scenario grading rubrics with criteria and rating scales | admin |
| `/admin/scenarios` | Scenario hub -- overview of scenario management, audit, and transform tools | admin |
| `/admin/scenarios/audit` | Analyze scenario data structure, find missing fields and quality issues | admin |
| `/admin/scenarios/bulk-import` | Bulk import scenarios from JSON/CSV files | admin |
| `/admin/scenarios/transform` | Bulk-convert old-format scenarios to the new phase-based structure | admin |
| `/admin/scheduled-exports` | Configure automatic weekly or monthly report exports delivered by email | admin |
| `/admin/settings` | Configure system-wide settings and preferences | superadmin |
| `/admin/skill-sheets/import` | Import skill sheet definitions from structured data files | admin |
| `/admin/system-alerts` | Monitor system health alerts for storage, errors, cron jobs, and performance | admin |
| `/admin/system-health` | Database metrics, row counts, activity, and scheduled job status | superadmin |
| `/admin/time-clock` | Review, approve, and export instructor time entries for payroll | admin |
| `/admin/user-activity` | View page views, active users, top pages, and usage patterns | admin |
| `/admin/users` | Manage user accounts, approve registrations, and assign roles | admin |
| `/admin/webhooks` | Configure outbound webhooks to notify external systems of events | superadmin |

**Page count: 47**

---

## Auth

| Route | Description | Min Role |
|-------|-------------|----------|
| `/auth/signin` | Google OAuth sign-in page restricted to @pmi.edu domain | public |
| `/auth/error` | Authentication error display page | public |

**Page count: 2**

---

## Calendar

| Route | Description | Min Role |
|-------|-------------|----------|
| `/calendar` | Unified calendar view showing lab days, shifts, and Google Calendar events | volunteer_instructor |

**Page count: 1**

---

## Cases

| Route | Description | Min Role |
|-------|-------------|----------|
| `/cases` | Case study library -- browse, search, filter, and favorite case studies | instructor |
| `/cases/new` | Create a new case study with AI generation or manual entry | instructor |
| `/cases/leaderboard` | Student leaderboard for case study practice scores by cohort | instructor |
| `/cases/[id]` | Case study detail view with questions, rubric, and metadata | instructor (view); admin (edit/delete) |
| `/cases/[id]/edit` | Edit an existing case study | instructor (owner); admin |
| `/cases/[id]/practice` | Interactive practice mode for a case study with AI feedback | student+ |
| `/cases/session/[code]/instructor` | Instructor control panel for a live case session | instructor |
| `/cases/session/[code]/join` | Join a live case session by entering session code | authenticated |
| `/cases/session/[code]/student` | Student view of a live case session with response submission | student+ |
| `/cases/session/[code]/tv` | TV/projector display for a live case session leaderboard | public (code) |

**Page count: 10**

---

## Clinical

All clinical pages require `lead_instructor` or higher (canAccessClinical) unless noted.

| Route | Description | Min Role |
|-------|-------------|----------|
| `/clinical` | Clinical & Internship dashboard with quick stats and navigation | lead_instructor |
| `/clinical/aemt-tracking` | Track AEMT student clinical milestones and competencies | lead_instructor |
| `/clinical/affiliations` | Manage clinical affiliation agreements with hospitals and agencies | program_director (canAccessAffiliations) |
| `/clinical/agencies` | Manage EMS agencies and hospital clinical site contacts | lead_instructor |
| `/clinical/capacity` | View and manage clinical site student capacity limits | admin |
| `/clinical/compliance` | Track student compliance document status (immunizations, BG checks) | lead_instructor |
| `/clinical/compliance-tracker` | Detailed per-student compliance tracking with document uploads | lead_instructor |
| `/clinical/emt-tracking` | Track EMT student clinical milestones and competencies | lead_instructor |
| `/clinical/hours` | Log and track student clinical hours by site and department | lead_instructor |
| `/clinical/internships` | Manage student field internship placements with phase tracking | lead_instructor |
| `/clinical/internships/[id]` | Detailed internship view with phases, meetings, preceptors, closeout | lead_instructor |
| `/clinical/mce` | Track mandatory continuing education (mCE) module clearances | lead_instructor |
| `/clinical/overview` | High-level clinical program statistics and completion dashboard | lead_instructor |
| `/clinical/planning-calendar` | Calendar for planning clinical rotations and site visits | lead_instructor |
| `/clinical/preceptors` | Preceptor directory -- manage field preceptor records and evaluations | lead_instructor |
| `/clinical/rotation-scheduler` | Schedule student clinical rotations across sites | lead_instructor |
| `/clinical/site-visits` | Log and track clinical site visits with checklists | lead_instructor |
| `/clinical/site-visit-settings` | Configure site visit notification and reminder settings | lead_instructor |
| `/clinical/summative-evaluations` | Manage summative evaluation sessions for final assessments | lead_instructor |
| `/clinical/summative-evaluations/[id]/grade` | Grade individual students on summative evaluation scenarios | lead_instructor |

**Page count: 20**

---

## Feedback

| Route | Description | Min Role |
|-------|-------------|----------|
| `/feedback/my-submissions` | View personal feedback and bug report submissions | authenticated |

**Page count: 1**

---

## Instructor

All instructor pages require `instructor` role or higher.

| Route | Description | Min Role |
|-------|-------------|----------|
| `/instructor` | Instructor dashboard with certifications, upcoming labs, and stats | instructor |
| `/instructor/ce` | Track continuing education hours and requirements | instructor |
| `/instructor/certifications` | View and manage personal certification records and card images | instructor |
| `/instructor/history` | View past lab day teaching assignments and history | instructor |
| `/instructor/my-stats` | Personal teaching performance analytics and metrics | instructor |
| `/instructor/teaching` | Teaching log -- record and review teaching activities | instructor |
| `/instructor/time-clock` | Clock in/out for lab day hours with entry management | instructor |

**Page count: 7**

---

## Lab Management

| Route | Description | Min Role |
|-------|-------------|----------|
| `/lab-management` | Lab management dashboard with role-based widgets and quick stats | instructor |
| `/lab-management/admin` | Lab management admin hub (certifications, cohorts, feedback, timers) | admin |
| `/lab-management/admin/certifications` | Admin view of all instructor certification records | admin |
| `/lab-management/admin/cohorts` | Create, edit, and archive student cohorts | admin |
| `/lab-management/admin/feedback` | View and manage user feedback submissions and bug reports | admin |
| `/lab-management/admin/timer-displays` | Manage lab timer display tokens and room assignments | admin |
| `/lab-management/cohorts/[id]` | Cohort hub -- students, stats, calendar, completion overview | instructor |
| `/lab-management/cohorts/[id]/calendar` | Calendar view filtered to a specific cohort's lab days | instructor |
| `/lab-management/cohorts/[id]/completion` | Cohort completion tracking -- skill, scenario, and station progress | instructor |
| `/lab-management/cohorts/[id]/groups` | Manage lab groups within a cohort | instructor |
| `/lab-management/ekg-warmup` | Track and log EKG rhythm identification warmup scores | instructor |
| `/lab-management/flags` | View flagged student notes, assessments, and at-risk indicators | instructor |
| `/lab-management/grade/station/[id]` | Grade students at a specific lab station during a lab day | instructor |
| `/lab-management/groups` | Manage lab groups, assign students, set team leads | instructor |
| `/lab-management/mentorship` | Student mentorship pair management and activity logs | instructor |
| `/lab-management/my-certifications` | View own instructor certifications (read-only) | instructor |
| `/lab-management/peer-evals` | Instructor view of student peer evaluation submissions | instructor |
| `/lab-management/protocol-tracking` | Track student protocol case card completions by category | instructor |
| `/lab-management/reports` | Lab management reports index -- links to all report types | instructor |
| `/lab-management/reports/clinical-hours` | Report on student clinical hours by site and department | instructor |
| `/lab-management/reports/internship-status` | Report on internship placement status across cohorts | instructor |
| `/lab-management/reports/lab-progress` | Report on lab completion progress by cohort | instructor |
| `/lab-management/reports/onboarding-status` | Report on instructor onboarding progress | admin |
| `/lab-management/reports/student-progress` | Detailed student progress report with filters and exports | instructor |
| `/lab-management/reports/team-leads` | Report on team lead rotation assignments and history | instructor |
| `/lab-management/scenario-library` | Browse, search, rate, and favorite scenarios from the shared library | instructor |
| `/lab-management/scenarios` | List and manage EMS training scenarios with create/edit/delete | instructor |
| `/lab-management/scenarios/new` | Create a new EMS training scenario with phase-based structure | instructor |
| `/lab-management/scenarios/[id]` | View or edit an existing scenario with print support and versioning | instructor |
| `/lab-management/schedule` | Master lab schedule with calendar and list views, filtering | instructor |
| `/lab-management/schedule/new` | Create a new lab day with stations, instructors, and attendance | instructor |
| `/lab-management/schedule/[id]` | Lab day detail view with timer, stations, attendance, debrief | instructor |
| `/lab-management/schedule/[id]/edit` | Edit an existing lab day configuration | instructor |
| `/lab-management/schedule/[id]/stations/new` | Add a new station to an existing lab day | instructor |
| `/lab-management/seating/charts` | Browse and manage seating chart configurations | instructor |
| `/lab-management/seating/charts/[id]` | Visual drag-and-drop seating chart editor | instructor |
| `/lab-management/seating/learning-styles` | View and manage student learning style assessment data | instructor |
| `/lab-management/seating/preferences` | Configure seating arrangement preferences and rules | instructor |
| `/lab-management/skill-drills` | Browse and manage skill drill exercises with documents | instructor |
| `/lab-management/skill-sheets` | View skill sheets with step-by-step instructions | instructor |
| `/lab-management/skills/competencies` | Track student skill competency levels and sign-offs | instructor |
| `/lab-management/skills/competencies/report` | Generate skill competency reports by cohort | instructor |
| `/lab-management/stations/log` | Grading log for all lab stations with assessment history | instructor |
| `/lab-management/stations/pool` | Manage the pool of reusable station definitions | instructor |
| `/lab-management/students` | Student roster with search, filter, and bulk operations | instructor |
| `/lab-management/students/import` | Bulk import students from CSV files | admin |
| `/lab-management/students/new` | Manually add a new student record | instructor |
| `/lab-management/students/[id]` | Individual student profile with notes, ratings, and history | instructor |
| `/lab-management/students/[id]/learning-plan` | Student individualized learning plan with notes | instructor |
| `/lab-management/students/[id]/portfolio` | Student portfolio with completions, assessments, and documents | instructor |
| `/lab-management/templates` | Browse and apply lab day templates for quick lab creation | instructor |
| `/lab-management/templates/review` | List of template review sessions for collaborative review | instructor |
| `/lab-management/templates/review/[id]` | Template review detail with checklist items and status | instructor |
| `/lab-management/templates/review/[id]/item/[itemId]` | Individual review item with comments and resolution | instructor |
| `/lab-management/templates/weekly` | Weekly template planner for semester-wide lab scheduling | instructor |

**Page count: 55**

---

## Notifications

| Route | Description | Min Role |
|-------|-------------|----------|
| `/notifications` | Notification center with read/unread tracking and archive | authenticated |

**Page count: 1** (listed under Root/General above)

---

## Onboarding

| Route | Description | Min Role |
|-------|-------------|----------|
| `/onboarding` | Instructor onboarding workflow with task tracking and progress | authenticated |

**Page count: 1**

---

## OSCE

| Route | Description | Min Role |
|-------|-------------|----------|
| `/osce/[slug]` | Public OSCE evaluator signup page by event slug | public |
| `/osce-evaluator-signup` | OSCE evaluator signup landing page | public |

**Page count: 2**

---

## Poll / Scheduler (Legacy)

| Route | Description | Min Role |
|-------|-------------|----------|
| `/scheduler` | Scheduling polls hub for creating and managing polls | instructor |
| `/scheduler/create` | Create a new scheduling/availability poll | instructor |
| `/poll/create` | Create a new scheduling poll (alternate route) | instructor |
| `/poll/[id]` | View and respond to a scheduling poll | authenticated |

**Page count: 4**

---

## Reports

All reports require `instructor` role or higher unless noted.

| Route | Description | Min Role |
|-------|-------------|----------|
| `/reports` | Reports & Analytics hub with links to all reports | instructor |
| `/reports/attendance` | Lab day attendance analytics by cohort and date range | instructor |
| `/reports/availability-patterns` | Instructor availability pattern analysis | admin |
| `/reports/builder` | Custom report builder with flexible queries and saved templates | admin |
| `/reports/clinical-placements` | Clinical site utilization, student hours by site, internship pipeline | instructor |
| `/reports/closeout-surveys` | Aggregate clinical internship closeout survey analytics | admin |
| `/reports/cohort-comparison` | Compare metrics across multiple cohorts | instructor |
| `/reports/gradebook` | Unified gradebook with all student grades and assessment results | instructor |
| `/reports/instructor-analytics` | Teaching hours, evaluation volume, workload per instructor | instructor |
| `/reports/instructor-workload` | Lab day assignments and teaching hours per instructor | instructor |
| `/reports/lab-costs` | Track and analyze lab operational costs per cohort | admin |
| `/reports/program-outcomes` | Program-level outcomes, pass rates, accreditation metrics | admin |
| `/reports/program-overview` | Student counts, lab activity, top scenarios, skill pass rates | instructor |
| `/reports/scenario-analytics` | Pass rates and difficulty calibration for assessed scenarios | instructor |
| `/reports/scenario-usage` | Track which scenarios are used most by cohort and date | instructor |
| `/reports/scenario-usage-overview` | Scenario usage counts, difficulty distribution, category coverage | instructor |
| `/reports/student-dashboard` | Attendance, skill completion, clinical hours, at-risk identification | instructor |

**Page count: 17**

---

## Resources

| Route | Description | Min Role |
|-------|-------------|----------|
| `/resources` | Document and resource library with versioning | instructor |
| `/resources/medications` | Searchable medication reference database | instructor |

**Page count: 2**

---

## Scheduling

All scheduling pages require `volunteer_instructor` or higher (canAccessScheduling).

| Route | Description | Min Role |
|-------|-------------|----------|
| `/scheduling` | Part-timer scheduling hub with status overview | volunteer_instructor |
| `/scheduling/availability` | Submit personal availability windows for scheduling | volunteer_instructor |
| `/scheduling/availability/all` | View all instructor availability in grid/calendar format | admin |
| `/scheduling/reports` | Scheduling analytics and coverage reports | admin |
| `/scheduling/resource-bookings` | Book rooms, equipment, and simulation labs | instructor |
| `/scheduling/shifts` | Manage open shifts and instructor signups | admin |
| `/scheduling/shifts/new` | Create a new open shift for instructor sign-up | admin |
| `/scheduling/signups/pending` | Review and approve pending shift sign-ups | admin |
| `/scheduling/substitute-requests` | Request and manage substitute coverage for shifts | volunteer_instructor |
| `/scheduling/team-availability` | View team-level availability patterns and comparisons | admin |

**Page count: 10**

---

## Settings

| Route | Description | Min Role |
|-------|-------------|----------|
| `/settings` | User preference settings (theme, notifications, quick links, 2FA) | authenticated |
| `/settings/sessions` | Active session management, device tracking, and revocation | authenticated |

**Page count: 2**

---

## Skill Sheets

| Route | Description | Min Role |
|-------|-------------|----------|
| `/skill-sheets` | Browse all skill sheets by program and category | authenticated |
| `/skill-sheets/[id]` | Skill sheet detail with step-by-step instructions and evaluations | authenticated |

**Page count: 2**

---

## Student Portal

All student pages require `student` role.

| Route | Description | Min Role |
|-------|-------------|----------|
| `/student` | Student dashboard with progress overview and quick links | student |
| `/student/attendance-appeals` | Submit and track attendance absence appeal requests | student |
| `/student/available-labs` | Browse and sign up for available lab sessions | student |
| `/student/completions` | View station and scenario completions | student |
| `/student/documents` | Upload and manage personal documents (compliance, ID, etc.) | student |
| `/student/labs` | Read-only lab day attendance history with station details | student |
| `/student/my-progress` | Self-service progress portal: skills, scenarios, clinical, attendance | student |
| `/student/peer-eval` | Submit peer evaluations for lab group partners | student |
| `/student/profile` | View and edit personal profile information | student |
| `/student/skill-sheets` | Read-only view of skill signoff status and history | student |
| `/students/[id]/progress` | Instructor view of individual student progress | instructor |

**Page count: 11**

---

## Tasks

| Route | Description | Min Role |
|-------|-------------|----------|
| `/tasks` | Task management with Kanban board and list views | instructor |
| `/tasks/[id]` | Individual task detail view with comments and status | instructor |

**Page count: 2**

---

## Public / Token-Based

These pages do not require authentication; access is controlled by unique tokens.

| Route | Description | Auth |
|-------|-------------|------|
| `/checkin/[token]` | Student lab check-in via QR code token (no login required) | public (token) |
| `/guest` | Guest user landing page with lab day access via guest code | guest (code) |
| `/preceptor/evaluate/[token]` | External preceptor evaluation form for field internships | public (token) |
| `/timer-display/[token]` | Lab timer display for projection screens (read-only) | public (token) |
| `/timer-display/live/[labDayId]` | Live lab timer display with audio and controls | authenticated |

**Page count: 5**

---

# API ROUTES

## API -- Access Requests

| Route | Methods | Auth | Description |
|-------|---------|------|-------------|
| `/api/access-requests` | GET, POST | admin (GET); authenticated (POST) | List access requests; submit new request |
| `/api/access-requests/[id]` | PUT | admin | Approve or deny an access request |
| `/api/access-requests/status` | GET | authenticated | Check current user's access request status |

## API -- Admin

| Route | Methods | Auth | Description |
|-------|---------|------|-------------|
| `/api/admin/alumni` | GET, POST | admin | List alumni records; create new alumni entry |
| `/api/admin/alumni/[id]` | PUT, DELETE | admin | Update or delete an alumni record |
| `/api/admin/attendance-appeals` | GET | admin | List all attendance appeal submissions |
| `/api/admin/attendance-appeals/[id]` | PATCH | admin | Approve or deny an attendance appeal |
| `/api/admin/audit-log` | GET | superadmin | Query FERPA audit log entries |
| `/api/admin/broadcast` | POST | admin | Send broadcast notification to users |
| `/api/admin/broadcast/history` | GET | admin | View broadcast notification history |
| `/api/admin/bulk-operations` | GET, POST | admin | List or execute bulk data operations |
| `/api/admin/bulk-operations/[id]/rollback` | POST | admin | Rollback a completed bulk operation |
| `/api/admin/calendar-sync` | GET | admin | Get calendar sync status for all instructors |
| `/api/admin/calendar-sync/remind` | POST | admin | Send calendar sync reminder to instructor |
| `/api/admin/calendar-sync/status` | GET | admin | Get detailed calendar sync status |
| `/api/admin/cases/briefs` | GET, POST | admin | Manage case study brief templates |
| `/api/admin/cases/coverage` | GET | admin | Analyze case coverage across categories |
| `/api/admin/cases/prompt-template` | GET, PUT | admin | Get/update AI prompt template for case generation |
| `/api/admin/cases/seed-briefs` | POST | admin | Seed initial case brief templates |
| `/api/admin/cases/seed-prompt` | POST | admin | Seed the AI prompt template |
| `/api/admin/cases/seed-samples` | POST | admin | Seed sample case studies |
| `/api/admin/certification-compliance` | GET | admin | Get certification compliance summary |
| `/api/admin/certifications` | GET, POST | admin | List certifications; create new entry |
| `/api/admin/certifications/import` | POST | admin | Bulk import certifications from CSV |
| `/api/admin/certifications/verify` | POST | admin | Verify a certification record |
| `/api/admin/config` | GET, PUT | superadmin | Get/update system configuration |
| `/api/admin/dashboard-defaults` | GET, POST | admin | Get/set dashboard widget defaults by role |
| `/api/admin/database-tools/audit-logs` | DELETE | superadmin | Clear old audit log entries |
| `/api/admin/database-tools/cohorts` | DELETE | superadmin | Clean up orphaned cohort data |
| `/api/admin/database-tools/notifications` | DELETE | superadmin | Clear old notification records |
| `/api/admin/database-tools/orphans` | DELETE | superadmin | Remove orphaned database records |
| `/api/admin/database-tools/stats` | GET | superadmin | Get database statistics and row counts |
| `/api/admin/data-export` | POST | admin | Export data in CSV/JSON format |
| `/api/admin/data-import/execute` | POST | admin | Execute a previewed data import |
| `/api/admin/data-import/history` | GET | admin | View data import history |
| `/api/admin/data-import/preview` | POST | admin | Preview a data import before executing |
| `/api/admin/deletion-requests` | GET, PATCH | admin | List and process deletion requests |
| `/api/admin/document-requests` | GET | admin | List document upload requests |
| `/api/admin/document-requests/[id]` | PATCH | admin | Update a document request status |
| `/api/admin/email-stats` | GET | admin | Get email sending statistics |
| `/api/admin/email-templates` | GET, PUT | admin | Get/update email templates |
| `/api/admin/email-templates/test` | POST | admin | Send a test email from template |
| `/api/admin/endorsements` | GET, POST | admin | List/create role endorsements |
| `/api/admin/equipment` | GET, POST | admin | List equipment; add new equipment item |
| `/api/admin/equipment/checkout` | POST | admin | Check out equipment to a user |
| `/api/admin/equipment/maintenance` | GET, POST | admin | List/create maintenance records |
| `/api/admin/equipment/maintenance/[id]` | PATCH | admin | Update a maintenance record |
| `/api/admin/feedback/import` | POST | admin | Import feedback data |
| `/api/admin/guests` | GET, POST, DELETE | admin | Manage guest access tokens |
| `/api/admin/incidents` | GET, POST | admin | List/create incident reports |
| `/api/admin/incidents/[id]` | PATCH | admin | Update an incident report |
| `/api/admin/lab-templates` | GET, POST | admin | List/create lab templates |
| `/api/admin/lab-templates/[id]` | GET, PUT, DELETE | admin | Get/update/delete a lab template |
| `/api/admin/lab-templates/[id]/versions` | GET | admin | List template version history |
| `/api/admin/lab-templates/apply` | POST | admin | Apply a template to create a lab day |
| `/api/admin/lab-templates/compare` | POST | admin | Compare two template versions |
| `/api/admin/lab-templates/import` | POST | admin | Import templates from JSON |
| `/api/admin/lab-templates/seed` | POST | admin | Seed starter templates |
| `/api/admin/lab-templates/update-from-lab` | POST | admin | Update a template from an existing lab day |
| `/api/admin/program-requirements` | GET, POST | admin | Get/set program requirements |
| `/api/admin/rubrics` | GET, POST | admin | List/create assessment rubrics |
| `/api/admin/rubrics/[id]` | GET, PUT, DELETE | admin | Get/update/delete a rubric |
| `/api/admin/scenarios/audit` | GET | admin | Audit scenario data quality |
| `/api/admin/scenarios/auto-fill` | POST | admin | Auto-fill missing scenario fields |
| `/api/admin/scenarios/bulk-import` | POST | admin | Preview bulk scenario import |
| `/api/admin/scenarios/bulk-import/commit` | POST | admin | Commit a previewed bulk import |
| `/api/admin/scenarios/generate-content` | POST | admin | AI-generate scenario content |
| `/api/admin/scenarios/transform` | POST | admin | Bulk-transform scenario format |
| `/api/admin/scheduled-exports` | GET, POST | admin | List/create scheduled exports |
| `/api/admin/scheduled-exports/[id]` | PUT, DELETE | admin | Update/delete a scheduled export |
| `/api/admin/skill-drills/seed` | POST | admin | Seed skill drill data |
| `/api/admin/skill-sheets/counts` | GET | admin | Get skill sheet counts by program |
| `/api/admin/skill-sheets/import` | POST | admin | Import skill sheet definitions |
| `/api/admin/skill-sheets/seed-aliases` | POST | admin | Seed skill name aliases |
| `/api/admin/skill-sheets/seed-canonical` | POST | admin | Seed canonical skill sheet data |
| `/api/admin/skill-sheets/verify` | GET | admin | Verify skill sheet data integrity |
| `/api/admin/stats` | GET | admin | Get system-wide statistics |
| `/api/admin/system-alerts` | GET | admin | List active system alerts |
| `/api/admin/system-health` | GET | superadmin | Get system health metrics |
| `/api/admin/user-activity` | GET | admin | Query user activity analytics |
| `/api/admin/user-activity/log` | POST | admin | Log a user activity event |
| `/api/admin/users` | GET, POST, PATCH | admin | List users; create/update user records |
| `/api/admin/webhooks` | GET, POST | superadmin | List/create webhook configurations |
| `/api/admin/webhooks/[id]` | GET, PUT, DELETE | superadmin | Get/update/delete a webhook |
| `/api/admin/webhooks/[id]/logs` | GET | superadmin | View webhook delivery logs |
| `/api/admin/webhooks/[id]/test` | POST | superadmin | Send a test webhook event |

## API -- Announcements

| Route | Methods | Auth | Description |
|-------|---------|------|-------------|
| `/api/announcements` | GET, POST, PATCH, DELETE | admin (write); authenticated (read) | CRUD for announcements |
| `/api/announcements/[id]/read` | POST | authenticated | Mark an announcement as read |

## API -- Auth

| Route | Methods | Auth | Description |
|-------|---------|------|-------------|
| `/api/auth/[...nextauth]` | GET, POST | public | NextAuth.js authentication handler |

## API -- Calendar

| Route | Methods | Auth | Description |
|-------|---------|------|-------------|
| `/api/calendar/availability` | GET | authenticated | Get user calendar availability |
| `/api/calendar/calendars` | GET | authenticated | List user's Google calendars |
| `/api/calendar/callback` | GET | public | Google Calendar OAuth callback |
| `/api/calendar/connect` | GET | authenticated | Initiate Google Calendar connection |
| `/api/calendar/google-events` | GET | authenticated | Fetch events from Google Calendar |
| `/api/calendar/status` | GET | authenticated | Check Google Calendar connection status |

## API -- Cases

| Route | Methods | Auth | Description |
|-------|---------|------|-------------|
| `/api/cases` | GET, POST | instructor | List/create case studies |
| `/api/cases/[id]` | GET, PUT, DELETE | instructor (view); admin (delete) | CRUD for individual case |
| `/api/cases/[id]/duplicate` | POST | instructor | Duplicate a case study |
| `/api/cases/[id]/practice/complete` | POST | authenticated | Complete a practice session |
| `/api/cases/[id]/practice/history` | GET | authenticated | Get practice history for a case |
| `/api/cases/[id]/practice/progress` | GET | authenticated | Get practice progress |
| `/api/cases/[id]/practice/respond` | POST | authenticated | Submit a practice response |
| `/api/cases/[id]/practice/start` | POST | authenticated | Start a practice session |
| `/api/cases/achievements/[studentId]` | GET | authenticated | Get student achievements |
| `/api/cases/achievements/check` | POST | authenticated | Check for new achievements |
| `/api/cases/generate` | POST | admin | Generate a case via AI |
| `/api/cases/generate/bulk` | POST | admin | Bulk-generate cases via AI |
| `/api/cases/import` | POST | admin | Import cases from file |
| `/api/cases/leaderboard/[cohortId]` | GET | authenticated | Get leaderboard for a cohort |

## API -- Case Sessions

| Route | Methods | Auth | Description |
|-------|---------|------|-------------|
| `/api/case-sessions` | POST | instructor | Create a live case session |
| `/api/case-sessions/[code]` | GET | authenticated | Get session details by code |
| `/api/case-sessions/[code]/instructor` | GET, PATCH | instructor | Instructor session control |
| `/api/case-sessions/[code]/join` | POST | authenticated | Join a session |
| `/api/case-sessions/[code]/leaderboard` | GET | authenticated | Get session leaderboard |
| `/api/case-sessions/[code]/respond` | POST | authenticated | Submit a response in session |
| `/api/case-sessions/[code]/results` | GET | authenticated | Get session results |

## API -- Check-In

| Route | Methods | Auth | Description |
|-------|---------|------|-------------|
| `/api/checkin/[token]` | GET, POST | public (token) | Get check-in data; mark student checked in |

## API -- Clinical

| Route | Methods | Auth | Description |
|-------|---------|------|-------------|
| `/api/clinical/aemt-tracking` | GET, POST | lead_instructor | Track AEMT milestones |
| `/api/clinical/affiliations` | GET, POST, PATCH, DELETE | program_director | Manage affiliation agreements |
| `/api/clinical/agencies` | GET, POST | lead_instructor | List/create clinical agencies |
| `/api/clinical/agencies/[id]` | GET, PUT, DELETE | lead_instructor | CRUD for individual agency |
| `/api/clinical/capacity` | GET | admin | Get site capacity data |
| `/api/clinical/capacity/check` | GET | lead_instructor | Check capacity at a site |
| `/api/clinical/compliance` | GET, POST | lead_instructor | Manage compliance documents |
| `/api/clinical/emt-tracking` | GET, POST | lead_instructor | Track EMT milestones |
| `/api/clinical/hours` | GET, POST | lead_instructor | Log/query clinical hours |
| `/api/clinical/internships` | GET, POST | lead_instructor | List/create internships |
| `/api/clinical/internships/[id]` | GET, PUT | lead_instructor | Get/update internship detail |
| `/api/clinical/internships/[id]/closeout` | GET, POST | lead_instructor | Manage internship closeout |
| `/api/clinical/internships/[id]/closeout/documents` | GET, POST | lead_instructor | Manage closeout documents |
| `/api/clinical/internships/[id]/closeout/employment` | GET, POST | lead_instructor | Record post-graduation employment |
| `/api/clinical/internships/[id]/closeout/packet` | GET | lead_instructor | Generate closeout packet |
| `/api/clinical/internships/[id]/closeout/summary` | GET | lead_instructor | Get closeout summary |
| `/api/clinical/internships/[id]/closeout/surveys` | GET, POST | lead_instructor | Manage closeout surveys |
| `/api/clinical/internships/[id]/notify-nremt` | POST | lead_instructor | Send NREMT eligibility notification |
| `/api/clinical/internships/[id]/preceptors` | GET, POST | lead_instructor | Manage internship preceptors |
| `/api/clinical/internships/[id]/preceptors/[assignmentId]` | DELETE | lead_instructor | Remove preceptor assignment |
| `/api/clinical/mce` | GET, POST | lead_instructor | Manage mCE module clearances |
| `/api/clinical/overview-all` | GET | lead_instructor | Get clinical overview statistics |
| `/api/clinical/planning-calendar` | GET, POST | lead_instructor | Manage planning calendar entries |
| `/api/clinical/preceptor-eval/[token]` | GET, POST | public (token) | External preceptor evaluation |
| `/api/clinical/preceptor-eval/send` | POST | lead_instructor | Send preceptor evaluation link |
| `/api/clinical/preceptor-eval/tokens` | GET | lead_instructor | List evaluation tokens |
| `/api/clinical/preceptor-feedback` | GET, POST | lead_instructor | Manage preceptor feedback |
| `/api/clinical/preceptors` | GET, POST | lead_instructor | List/create preceptors |
| `/api/clinical/preceptors/[id]` | GET, PUT, DELETE | lead_instructor | CRUD for individual preceptor |
| `/api/clinical/rotations` | GET, POST | lead_instructor | List/create rotations |
| `/api/clinical/rotations/[id]` | GET, PUT, DELETE | lead_instructor | CRUD for individual rotation |
| `/api/clinical/sites` | GET, POST | lead_instructor | List/create clinical sites |
| `/api/clinical/sites/[id]` | GET, PUT | lead_instructor | Get/update a clinical site |
| `/api/clinical/sites/[id]/departments` | GET, POST | lead_instructor | Manage site departments |
| `/api/clinical/site-visits` | GET, POST | lead_instructor | List/create site visits |
| `/api/clinical/site-visits/[id]` | GET, PUT, DELETE | lead_instructor | CRUD for individual site visit |
| `/api/clinical/site-visits/coverage` | GET | lead_instructor | Get site visit coverage stats |
| `/api/clinical/site-visits/export` | GET | lead_instructor | Export site visits to CSV |
| `/api/clinical/summative-evaluations` | GET, POST | lead_instructor | List/create summative evaluations |
| `/api/clinical/summative-evaluations/[id]` | GET, PUT | lead_instructor | Get/update a summative evaluation |
| `/api/clinical/summative-evaluations/[id]/export` | GET | lead_instructor | Export evaluation results |
| `/api/clinical/summative-evaluations/[id]/scenario-print` | GET | lead_instructor | Print-friendly scenario view |
| `/api/clinical/summative-evaluations/[id]/scores` | GET, POST | lead_instructor | Manage evaluation scores |
| `/api/clinical/summative-scenarios` | GET | lead_instructor | List summative evaluation scenarios |

## API -- Compliance

| Route | Methods | Auth | Description |
|-------|---------|------|-------------|
| `/api/compliance` | GET | authenticated | Get compliance document status |

## API -- Config

| Route | Methods | Auth | Description |
|-------|---------|------|-------------|
| `/api/config/public` | GET | public | Get public system configuration |

## API -- Cron Jobs

All cron routes are secured via `CRON_SECRET` header validation.

| Route | Methods | Auth | Description |
|-------|---------|------|-------------|
| `/api/cron/affiliation-expiry` | GET | cron | Check for expiring affiliation agreements |
| `/api/cron/attendance-alerts` | GET | cron | Send attendance alert notifications |
| `/api/cron/availability-reminders` | GET | cron | Remind instructors to submit availability |
| `/api/cron/calendar-sync` | GET | cron | Sync lab days to Google Calendar |
| `/api/cron/cert-expiry` | GET | cron | Check for expiring certifications |
| `/api/cron/clinical-hours-reminder` | GET | cron | Remind students about clinical hour logging |
| `/api/cron/compliance-expiry` | GET | cron | Check for expiring compliance documents |
| `/api/cron/daily-digest` | GET | cron | Send daily digest emails |
| `/api/cron/internship-milestones` | GET | cron | Check internship milestone deadlines |
| `/api/cron/lab-reminder` | GET | cron | Send lab day reminder notifications |
| `/api/cron/scheduled-exports` | GET | cron | Execute scheduled data exports |
| `/api/cron/site-visit-reminders` | GET | cron | Send site visit reminder notifications |
| `/api/cron/system-health` | GET | cron | Run system health checks |
| `/api/cron/weekly-digest` | GET | cron | Send weekly digest emails |

## API -- Dashboard

| Route | Methods | Auth | Description |
|-------|---------|------|-------------|
| `/api/dashboard/cert-expiry` | GET | authenticated | Get certification expiry warnings |
| `/api/dashboard/layout` | GET, PUT | authenticated | Get/save dashboard widget layout |
| `/api/dashboard/quick-stats` | GET | authenticated | Get dashboard quick statistics |
| `/api/dashboard/recent-activity` | GET | authenticated | Get recent activity feed |

## API -- Deep Links

| Route | Methods | Auth | Description |
|-------|---------|------|-------------|
| `/api/deep-links` | GET, POST | admin | List/create deep link records |
| `/api/deep-links/qr` | POST | admin | Generate QR code for a deep link |

## API -- Errors

| Route | Methods | Auth | Description |
|-------|---------|------|-------------|
| `/api/errors/log` | POST | authenticated | Log client-side errors to server |

## API -- Feedback

| Route | Methods | Auth | Description |
|-------|---------|------|-------------|
| `/api/feedback` | GET, POST, PATCH | admin (GET all); authenticated (POST, PATCH own) | Manage feedback submissions |
| `/api/feedback/my-submissions` | GET | authenticated | Get current user's feedback submissions |

## API -- Guest

| Route | Methods | Auth | Description |
|-------|---------|------|-------------|
| `/api/guest/login` | POST | public | Authenticate guest with access code |

## API -- Instructor

| Route | Methods | Auth | Description |
|-------|---------|------|-------------|
| `/api/instructor/ce-records` | GET, POST | instructor | List/create CE hour records |
| `/api/instructor/ce-records/[id]` | PUT, DELETE | instructor | Update/delete a CE record |
| `/api/instructor/history` | GET | instructor | Get teaching history |
| `/api/instructor/me` | GET | authenticated | Get current instructor profile |
| `/api/instructor/my-stats` | GET | instructor | Get personal teaching statistics |
| `/api/instructor/teaching-log` | GET, POST | instructor | List/create teaching log entries |
| `/api/instructor/teaching-log/[id]` | PUT, DELETE | instructor | Update/delete a teaching log entry |
| `/api/instructor/time-clock` | GET, POST | instructor | List/create time clock entries |
| `/api/instructor/time-clock/[id]` | PUT, DELETE | instructor | Update/delete a time clock entry |
| `/api/instructor/upcoming-labs` | GET | instructor | Get upcoming assigned lab days |

## API -- Lab Management

| Route | Methods | Auth | Description |
|-------|---------|------|-------------|
| `/api/lab-management/assessments/scenario` | GET, POST | instructor | Manage scenario assessments |
| `/api/lab-management/assessments/skill` | GET, POST | instructor | Manage skill assessments |
| `/api/lab-management/attendance/at-risk` | GET | instructor | Get at-risk attendance students |
| `/api/lab-management/ce-records` | GET, POST | instructor | Manage CE records |
| `/api/lab-management/ce-records/[id]` | PUT, DELETE | instructor | Update/delete CE record |
| `/api/lab-management/ce-requirements` | GET | instructor | Get CE requirements |
| `/api/lab-management/certifications` | GET, POST | admin | Manage instructor certifications |
| `/api/lab-management/certifications/[id]` | PUT, DELETE | admin | Update/delete certification |
| `/api/lab-management/checklist-templates` | GET, POST | instructor | Manage lab day checklist templates |
| `/api/lab-management/cohorts` | GET, POST | instructor | List/create cohorts |
| `/api/lab-management/cohorts/[id]` | GET, PUT | instructor (GET); lead_instructor (PUT) | Get/update cohort |
| `/api/lab-management/cohorts/[id]/archive` | POST | lead_instructor | Archive a cohort |
| `/api/lab-management/cohorts/[id]/calendar` | GET | instructor | Get cohort calendar events |
| `/api/lab-management/cohorts/[id]/completion` | GET | instructor | Get cohort completion data |
| `/api/lab-management/cohorts/[id]/email` | POST | lead_instructor | Email all students in cohort |
| `/api/lab-management/cohorts/[id]/stats` | GET | instructor | Get cohort statistics |
| `/api/lab-management/competencies` | GET, POST | instructor | Manage skill competencies |
| `/api/lab-management/competencies/report` | GET | instructor | Get competency report data |
| `/api/lab-management/costs` | GET, POST | admin | Manage lab costs |
| `/api/lab-management/costs/[id]` | PUT, DELETE | admin | Update/delete a cost entry |
| `/api/lab-management/custom-skills` | GET, POST | instructor | Manage custom skill definitions |
| `/api/lab-management/daily-notes` | GET, POST | instructor | Manage daily lab notes |
| `/api/lab-management/field-trips` | GET, POST | instructor | Manage field trip records |
| `/api/lab-management/field-trips/attendance` | GET, POST | instructor | Manage field trip attendance |
| `/api/lab-management/flagged-items` | GET | instructor | Get flagged student items |
| `/api/lab-management/groups` | GET, POST | instructor | List/create lab groups |
| `/api/lab-management/groups/[id]` | PUT, DELETE | instructor | Update/delete a group |
| `/api/lab-management/groups/[id]/members` | GET, POST, DELETE | instructor | Manage group membership |
| `/api/lab-management/groups/generate` | POST | instructor | Auto-generate lab groups |
| `/api/lab-management/instructors` | GET | instructor | List available instructors |
| `/api/lab-management/lab-day-roles` | GET, POST | instructor | Manage lab day role assignments |
| `/api/lab-management/lab-days` | GET, POST | instructor | List/create lab days |
| `/api/lab-management/lab-days/[id]` | GET, PUT, DELETE | instructor | CRUD for individual lab day |
| `/api/lab-management/lab-days/[id]/attendance` | GET, POST | instructor | Manage lab day attendance |
| `/api/lab-management/lab-days/[id]/attendance/absences` | GET | instructor | Get absence records |
| `/api/lab-management/lab-days/[id]/checkin-token` | POST | instructor | Generate check-in QR token |
| `/api/lab-management/lab-days/[id]/checklist` | GET, PUT | instructor | Manage lab day checklist |
| `/api/lab-management/lab-days/[id]/debrief` | GET, PUT | instructor | Manage lab day debrief notes |
| `/api/lab-management/lab-days/[id]/duplicate` | POST | instructor | Duplicate a lab day |
| `/api/lab-management/lab-days/[id]/duplicate-bulk` | POST | instructor | Bulk duplicate lab days |
| `/api/lab-management/lab-days/[id]/equipment` | GET, POST | instructor | Manage lab day equipment |
| `/api/lab-management/lab-days/[id]/ratings` | GET, POST | instructor | Student ratings for lab day |
| `/api/lab-management/lab-days/[id]/roster` | GET | instructor | Get lab day student roster |
| `/api/lab-management/lab-days/templates` | GET | instructor | Get lab day from template |
| `/api/lab-management/lab-day-skills` | GET, POST | instructor | Manage lab day skill assignments |
| `/api/lab-management/learning-style-report` | GET | instructor | Get learning style report |
| `/api/lab-management/locations` | GET | instructor | List lab locations |
| `/api/lab-management/mentorship` | GET, POST | instructor | List/create mentorship pairs |
| `/api/lab-management/mentorship/[id]` | PUT, DELETE | instructor | Update/delete mentorship pair |
| `/api/lab-management/mentorship/[id]/logs` | GET, POST | instructor | Manage mentorship activity logs |
| `/api/lab-management/programs` | GET | instructor | List programs |
| `/api/lab-management/request-coverage` | POST | instructor | Request lab day coverage |
| `/api/lab-management/scenario-library` | GET | instructor | Browse scenario library |
| `/api/lab-management/scenario-library/clone` | POST | instructor | Clone a library scenario |
| `/api/lab-management/scenario-library/favorites` | GET, POST, DELETE | instructor | Manage scenario favorites |
| `/api/lab-management/scenario-library/ratings` | GET, POST | instructor | Rate library scenarios |
| `/api/lab-management/scenario-library/tags` | GET | instructor | Get scenario tags |
| `/api/lab-management/scenarios` | GET, POST | instructor | List/create scenarios |
| `/api/lab-management/scenarios/[id]` | GET, PUT, DELETE | instructor | CRUD for individual scenario |
| `/api/lab-management/scenarios/[id]/difficulty-recommendation` | GET | instructor | Get AI difficulty recommendation |
| `/api/lab-management/scenarios/[id]/duplicate` | POST | instructor | Duplicate a scenario |
| `/api/lab-management/scenarios/[id]/versions` | GET | instructor | List scenario version history |
| `/api/lab-management/scenarios/favorites` | GET, POST | instructor | Manage scenario favorites |
| `/api/lab-management/scenarios/import` | POST | admin | Import scenarios from file |
| `/api/lab-management/schedule/conflicts` | GET | instructor | Check schedule conflicts |
| `/api/lab-management/schedule/suggestions` | GET | instructor | Get scheduling suggestions |
| `/api/lab-management/skill-drills` | GET, POST | instructor | List/create skill drills |
| `/api/lab-management/skill-drills/[id]` | GET, PUT, DELETE | instructor | CRUD for individual skill drill |
| `/api/lab-management/skill-drills/[id]/documents` | GET, POST | instructor | Manage drill documents |
| `/api/lab-management/skills` | GET, POST | instructor | List/create skills |
| `/api/lab-management/skills/[id]/documents` | GET, POST | instructor | Manage skill documents |
| `/api/lab-management/skill-signoffs` | GET, POST | instructor | Manage skill sign-offs |
| `/api/lab-management/station-instructors` | GET, POST | instructor | Manage station instructor assignments |
| `/api/lab-management/stations` | GET, POST | instructor | List/create lab stations |
| `/api/lab-management/stations/[id]` | GET, PUT, DELETE | instructor | CRUD for individual station |
| `/api/lab-management/stations/[id]/documents` | GET, POST | instructor | Manage station documents |
| `/api/lab-management/station-skills` | GET, POST | instructor | Manage station-skill associations |
| `/api/lab-management/students` | GET, POST | instructor | List/create students |
| `/api/lab-management/students/[id]` | GET, PUT | instructor | Get/update student record |
| `/api/lab-management/students/[id]/clinical-tasks` | GET | instructor | Get student clinical tasks |
| `/api/lab-management/students/[id]/communications` | GET, POST | instructor | Manage student communications log |
| `/api/lab-management/students/[id]/learning-plan` | GET, PUT | instructor | Get/update learning plan |
| `/api/lab-management/students/[id]/learning-plan/notes` | GET, POST | instructor | Manage learning plan notes |
| `/api/lab-management/students/[id]/notes` | GET, POST | instructor | Manage student notes |
| `/api/lab-management/students/[id]/photo` | POST | instructor | Upload student photo |
| `/api/lab-management/students/[id]/portfolio` | GET | instructor | Get student portfolio data |
| `/api/lab-management/students/[id]/ratings` | GET | instructor | Get student ratings history |
| `/api/lab-management/students/check-duplicates` | POST | instructor | Check for duplicate students |
| `/api/lab-management/students/import` | POST | admin | Bulk import students from CSV |
| `/api/lab-management/students/notes-summary` | GET | instructor | Get student notes summary |
| `/api/lab-management/team-leads` | GET, POST | instructor | Manage team lead assignments |
| `/api/lab-management/template-reviews` | GET, POST | instructor | List/create template reviews |
| `/api/lab-management/template-reviews/[id]` | GET, PUT | instructor | Get/update a template review |
| `/api/lab-management/template-reviews/[id]/finalize` | POST | instructor | Finalize a template review |
| `/api/lab-management/template-reviews/[id]/items` | GET, POST | instructor | Manage review items |
| `/api/lab-management/template-reviews/[id]/items/[itemId]` | PUT | instructor | Update a review item |
| `/api/lab-management/template-reviews/[id]/items/[itemId]/comments` | GET, POST | instructor | Manage item comments |
| `/api/lab-management/templates` | GET, POST | instructor | List/create lab day templates |
| `/api/lab-management/templates/[id]` | GET, PUT, DELETE | instructor | CRUD for individual template |
| `/api/lab-management/timer` | GET, POST | instructor | Get/set lab timer state |
| `/api/lab-management/timer/active` | GET | instructor | Get active timer data |
| `/api/lab-management/timer/adjust` | POST | instructor | Adjust running timer |
| `/api/lab-management/timer/ready` | POST | instructor | Set timer to ready state |
| `/api/lab-management/timer-displays` | GET, POST | admin | List/create timer display tokens |
| `/api/lab-management/timer-displays/[id]` | DELETE | admin | Delete a timer display token |
| `/api/lab-management/users` | GET | instructor | List users for assignment |
| `/api/lab-management/weekly-templates` | GET, POST | instructor | Manage weekly template plans |
| `/api/lab-management/weekly-templates/generate` | POST | instructor | Generate weekly template from plan |

## API -- Notifications

| Route | Methods | Auth | Description |
|-------|---------|------|-------------|
| `/api/notifications` | GET, POST | authenticated | List/create notifications |
| `/api/notifications/archive` | POST | authenticated | Archive notifications |
| `/api/notifications/digest-preview` | GET | authenticated | Preview digest email |
| `/api/notifications/email-preferences` | GET, PUT | authenticated | Manage email notification preferences |
| `/api/notifications/preferences` | GET, PUT | authenticated | Manage notification preferences |
| `/api/notifications/read` | POST | authenticated | Mark notifications as read |

## API -- Onboarding

| Route | Methods | Auth | Description |
|-------|---------|------|-------------|
| `/api/onboarding/assignments` | GET, POST | authenticated | Manage onboarding task assignments |
| `/api/onboarding/dashboard` | GET | authenticated | Get onboarding dashboard data |
| `/api/onboarding/tasks/[id]/progress` | PUT | authenticated | Update task progress |
| `/api/onboarding/templates` | GET, POST | admin | Manage onboarding templates |

## API -- OSCE

| Route | Methods | Auth | Description |
|-------|---------|------|-------------|
| `/api/osce/admin/schedule` | POST | admin | Generate OSCE schedule |
| `/api/osce/admin/students/reorder` | POST | admin | Reorder students in OSCE |
| `/api/osce/events` | GET, POST | admin | List/create OSCE events |
| `/api/osce/events/[id]` | GET, PUT, DELETE | admin | CRUD for individual OSCE event |
| `/api/osce/events/[id]/calendar-invites` | POST | admin | Send calendar invites for event |
| `/api/osce/events/[id]/observers` | GET, POST | admin | Manage event observers |
| `/api/osce/events/[id]/observers/[observerId]` | PUT, DELETE | admin | Update/remove observer |
| `/api/osce/events/[id]/observers/export` | GET | admin | Export observers to CSV |
| `/api/osce/events/[id]/schedule` | GET, POST | admin | Get/generate event schedule |
| `/api/osce/events/[id]/student-agencies` | GET, POST | admin | Manage student agency assignments |
| `/api/osce/events/[id]/students/reorder` | POST | admin | Reorder students in event |
| `/api/osce/events/[id]/time-blocks` | GET, POST | admin | Manage event time blocks |
| `/api/osce/observers` | GET, POST | authenticated | List/register as observer |
| `/api/osce/observers/[id]` | PUT, DELETE | admin | Update/delete observer record |
| `/api/osce/observers/export` | GET | admin | Export all observers |
| `/api/osce/public/[slug]` | GET | public | Get public OSCE event details |
| `/api/osce/public/[slug]/register` | POST | public | Register as observer for event |
| `/api/osce/register` | POST | public | Observer self-registration |
| `/api/osce/student-agencies` | GET, POST | admin | Manage student-agency mappings |
| `/api/osce/time-blocks` | GET | admin | List all time blocks |

## API -- Peer Evaluations

| Route | Methods | Auth | Description |
|-------|---------|------|-------------|
| `/api/peer-evaluations` | GET, POST | student (POST); instructor (GET) | Submit/list peer evaluations |
| `/api/peer-evaluations/aggregate` | GET | instructor | Get aggregated peer evaluation data |

## API -- Polls

| Route | Methods | Auth | Description |
|-------|---------|------|-------------|
| `/api/polls` | GET, POST | instructor | List/create scheduling polls |

## API -- Reports

| Route | Methods | Auth | Description |
|-------|---------|------|-------------|
| `/api/reports/attendance` | GET | instructor | Get attendance report data |
| `/api/reports/availability-patterns` | GET | admin | Get availability pattern data |
| `/api/reports/builder` | GET, POST | admin | List/create custom reports |
| `/api/reports/builder/[id]` | GET, PUT, DELETE | admin | CRUD for custom report |
| `/api/reports/clinical-hours` | GET | instructor | Get clinical hours report |
| `/api/reports/clinical-placements` | GET | instructor | Get clinical placements report |
| `/api/reports/closeout-surveys` | GET | admin | Get closeout survey analytics |
| `/api/reports/cohort-comparison` | GET | instructor | Get cohort comparison data |
| `/api/reports/gradebook` | GET | instructor | Get gradebook data |
| `/api/reports/instructor-analytics` | GET | instructor | Get instructor analytics |
| `/api/reports/instructor-workload` | GET | instructor | Get instructor workload data |
| `/api/reports/internship-status` | GET | instructor | Get internship status report |
| `/api/reports/lab-progress` | GET | instructor | Get lab progress report |
| `/api/reports/onboarding-status` | GET | admin | Get onboarding status report |
| `/api/reports/program-outcomes` | GET | admin | Get program outcomes data |
| `/api/reports/program-overview` | GET | instructor | Get program overview data |
| `/api/reports/scenario-analytics` | GET | instructor | Get scenario analytics |
| `/api/reports/scenario-usage` | GET | instructor | Get scenario usage data |
| `/api/reports/scenario-usage-overview` | GET | instructor | Get scenario usage overview |
| `/api/reports/student-dashboard` | GET | instructor | Get student dashboard data |
| `/api/reports/student-progress` | GET | instructor | Get student progress data |
| `/api/reports/team-leads` | GET | instructor | Get team leads report data |

## API -- Resources

| Route | Methods | Auth | Description |
|-------|---------|------|-------------|
| `/api/resources` | GET, POST | instructor | List/create resource documents |
| `/api/resources/medications` | GET, POST | instructor | List/create medication entries |
| `/api/resources/medications/[id]` | PUT, DELETE | instructor | Update/delete medication entry |
| `/api/resources/versions` | GET | instructor | List resource version history |

## API -- Scheduling

| Route | Methods | Auth | Description |
|-------|---------|------|-------------|
| `/api/scheduling/availability` | GET, POST | volunteer_instructor | Get/submit availability |
| `/api/scheduling/availability/[id]` | DELETE | volunteer_instructor | Delete an availability entry |
| `/api/scheduling/availability/all` | GET | admin | Get all instructor availability |
| `/api/scheduling/availability/bulk` | POST | volunteer_instructor | Submit bulk availability |
| `/api/scheduling/availability/suggestions` | GET | volunteer_instructor | Get availability suggestions |
| `/api/scheduling/availability-status` | GET | admin | Get availability submission status |
| `/api/scheduling/part-timer-status` | GET | admin | Get part-timer status overview |
| `/api/scheduling/reports` | GET | admin | Get scheduling reports data |
| `/api/scheduling/resource-bookings` | GET, POST | instructor | List/create resource bookings |
| `/api/scheduling/resource-bookings/[id]` | PUT, DELETE | instructor | Update/cancel a booking |
| `/api/scheduling/resource-bookings/resources` | GET | instructor | List bookable resources |
| `/api/scheduling/send-availability-reminders` | POST | admin | Send availability reminder emails |
| `/api/scheduling/shifts` | GET, POST | admin (POST); volunteer_instructor (GET) | List/create shifts |
| `/api/scheduling/shifts/[id]` | GET, PUT, DELETE | admin | CRUD for individual shift |
| `/api/scheduling/shifts/[id]/signup` | POST | volunteer_instructor | Sign up for a shift |
| `/api/scheduling/shifts/[id]/signup/[signupId]` | PUT, DELETE | admin | Manage a shift signup |
| `/api/scheduling/signups/pending` | GET | admin | List pending shift signups |
| `/api/scheduling/substitute-requests` | GET, POST | volunteer_instructor | List/create sub requests |
| `/api/scheduling/substitute-requests/[id]` | PUT | volunteer_instructor | Update a sub request |
| `/api/scheduling/swaps/[id]/assign` | POST | admin | Assign swap coverage |
| `/api/scheduling/swaps/[id]/interest` | POST | volunteer_instructor | Express interest in swap |
| `/api/scheduling/team-availability` | GET | admin | Get team availability data |
| `/api/scheduling/team-availability/saved` | GET, POST | admin | Manage saved availability views |
| `/api/scheduling/trades` | GET, POST | volunteer_instructor | List/create shift trades |

## API -- Search

| Route | Methods | Auth | Description |
|-------|---------|------|-------------|
| `/api/search` | GET | authenticated | Global search across entities |

## API -- Seating

| Route | Methods | Auth | Description |
|-------|---------|------|-------------|
| `/api/seating/charts` | GET, POST | instructor | List/create seating charts |
| `/api/seating/charts/[id]` | GET, PUT, DELETE | instructor | CRUD for individual chart |
| `/api/seating/charts/[id]/assignments` | GET, POST | instructor | Manage seat assignments |
| `/api/seating/charts/[id]/generate` | POST | instructor | Auto-generate seating chart |
| `/api/seating/classrooms` | GET, POST | instructor | Manage classroom definitions |
| `/api/seating/learning-styles` | GET, POST | instructor | Manage learning style data |
| `/api/seating/preferences` | GET, PUT | instructor | Manage seating preferences |

## API -- Settings

| Route | Methods | Auth | Description |
|-------|---------|------|-------------|
| `/api/settings/2fa/disable` | POST | authenticated | Disable two-factor authentication |
| `/api/settings/2fa/setup` | POST | authenticated | Begin 2FA setup |
| `/api/settings/2fa/status` | GET | authenticated | Check 2FA status |
| `/api/settings/2fa/verify` | POST | authenticated | Verify 2FA token |
| `/api/settings/calendar-sync` | GET, PUT | authenticated | Manage calendar sync settings |
| `/api/settings/notifications` | GET, PUT | authenticated | Manage notification settings |
| `/api/settings/sessions` | GET | authenticated | List active sessions |
| `/api/settings/sessions/[id]` | DELETE | authenticated | Revoke a session |
| `/api/settings/sessions/revoke-all` | POST | authenticated | Revoke all sessions |

## API -- Skill Sheets

| Route | Methods | Auth | Description |
|-------|---------|------|-------------|
| `/api/skill-sheets` | GET, POST | instructor | List/create skill sheets |
| `/api/skill-sheets/[id]` | GET, PUT, DELETE | instructor | CRUD for individual skill sheet |
| `/api/skill-sheets/[id]/evaluate` | POST | instructor | Submit skill sheet evaluation |
| `/api/skill-sheets/by-skill-name` | GET | instructor | Look up skill sheet by name |
| `/api/skill-sheets/by-skill-name/bulk` | POST | instructor | Bulk lookup by skill names |
| `/api/skill-sheets/evaluations-by-lab-day` | GET | instructor | Get evaluations grouped by lab day |

## API -- Stations

| Route | Methods | Auth | Description |
|-------|---------|------|-------------|
| `/api/stations/completions` | GET, POST | instructor | Manage station completions |
| `/api/stations/completions/bulk` | POST | instructor | Bulk record station completions |
| `/api/stations/pool` | GET, POST | instructor | List/create pool station definitions |
| `/api/stations/pool/[id]` | PUT, DELETE | instructor | Update/delete pool station |
| `/api/stations/pool/favorites` | GET, POST | instructor | Manage station pool favorites |

## API -- Student

| Route | Methods | Auth | Description |
|-------|---------|------|-------------|
| `/api/student/attendance-appeals` | GET, POST | student | List/submit attendance appeals |
| `/api/student/available-labs` | GET | student | List available lab sessions |
| `/api/student/available-labs/cancel` | POST | student | Cancel a lab signup |
| `/api/student/available-labs/my-signups` | GET | student | Get own lab signups |
| `/api/student/available-labs/signup` | POST | student | Sign up for a lab |
| `/api/student/communication-preferences` | GET, PUT | student | Manage communication preferences |
| `/api/student/completions` | GET | student | Get own completions |
| `/api/student/documents` | GET, POST | student | List/upload documents |
| `/api/student/documents/[id]` | DELETE | student | Delete a document |
| `/api/student/documents/requests` | GET | student | Get document upload requests |
| `/api/student/ekg-scenarios` | GET | student | Get EKG scenario data |
| `/api/student/labs` | GET | student | Get lab attendance history |
| `/api/student/my-progress` | GET | student | Get personal progress data |
| `/api/student/profile` | GET, PUT | student | Get/update student profile |
| `/api/student/skill-sheets` | GET | student | Get skill signoff status |

## API -- Students (Instructor View)

| Route | Methods | Auth | Description |
|-------|---------|------|-------------|
| `/api/students` | GET | instructor | List all students |
| `/api/students/[id]/progress` | GET | instructor | Get individual student progress |
| `/api/students/[id]/skill-evaluations` | GET | instructor | Get student skill evaluations |

## API -- Submissions

| Route | Methods | Auth | Description |
|-------|---------|------|-------------|
| `/api/submissions` | GET, POST | authenticated | Manage form submissions |

## API -- Tasks

| Route | Methods | Auth | Description |
|-------|---------|------|-------------|
| `/api/tasks` | GET, POST | instructor | List/create tasks |
| `/api/tasks/[id]` | GET, PUT, DELETE | instructor | CRUD for individual task |
| `/api/tasks/[id]/comments` | GET, POST | instructor | Manage task comments |
| `/api/tasks/bulk` | POST | instructor | Bulk task operations |

## API -- Timer Display

| Route | Methods | Auth | Description |
|-------|---------|------|-------------|
| `/api/timer-display` | POST | instructor | Create timer display token |
| `/api/timer-display/[token]` | GET | public (token) | Get timer data by token |

## API -- Tracking

| Route | Methods | Auth | Description |
|-------|---------|------|-------------|
| `/api/tracking/ekg-scores` | GET, POST | instructor | Manage EKG warmup scores |
| `/api/tracking/protocol-completions` | GET, POST | instructor | Manage protocol completions |
| `/api/tracking/scenarios` | GET, POST | instructor | Track scenario usage |

## API -- User

| Route | Methods | Auth | Description |
|-------|---------|------|-------------|
| `/api/user/preferences` | GET, PUT | authenticated | Manage user preferences |
| `/api/user-preferences/tour` | GET, POST | authenticated | Manage onboarding tour state |
| `/api/users/list` | GET | instructor | List users for dropdowns |

---

# Deprecated Routes / Redirects

| Route | Type | Target | Notes |
|-------|------|--------|-------|
| `/lab-management/emt-tracker` | Redirect | `/clinical/emt-tracking` | Moved to clinical section |
| `/lab-management/aemt-tracker` | Redirect | `/clinical/aemt-tracking` | Moved to clinical section |
| `/admin/osce-observers` | Redirect | `/admin/osce-events/[latest]/...` | Redirects to latest OSCE event |

---

# Route Counts

## Page Routes by Section

| Section | Count |
|---------|-------|
| Root / General | 4 |
| Admin | 47 |
| Auth | 2 |
| Calendar | 1 |
| Cases | 10 |
| Clinical | 20 |
| Feedback | 1 |
| Instructor | 7 |
| Lab Management | 55 |
| Onboarding | 1 |
| OSCE | 2 |
| Poll / Scheduler (Legacy) | 4 |
| Reports | 17 |
| Resources | 2 |
| Scheduling | 10 |
| Settings | 2 |
| Skill Sheets | 2 |
| Student Portal | 11 |
| Tasks | 2 |
| Public / Token-Based | 5 |
| **Total Page Routes** | **205** |

## API Routes by Section

| Section | Count |
|---------|-------|
| Access Requests | 3 |
| Admin | 85 |
| Announcements | 2 |
| Auth | 1 |
| Calendar | 6 |
| Cases | 14 |
| Case Sessions | 7 |
| Check-In | 1 |
| Clinical | 44 |
| Compliance | 1 |
| Config | 1 |
| Cron Jobs | 14 |
| Dashboard | 4 |
| Deep Links | 2 |
| Errors | 1 |
| Feedback | 2 |
| Guest | 1 |
| Instructor | 10 |
| Lab Management | 105 |
| Notifications | 6 |
| Onboarding | 4 |
| OSCE | 20 |
| Peer Evaluations | 2 |
| Polls | 1 |
| Reports | 22 |
| Resources | 4 |
| Scheduling | 24 |
| Search | 1 |
| Seating | 7 |
| Settings | 9 |
| Skill Sheets | 6 |
| Stations | 5 |
| Student | 15 |
| Students (Instructor) | 3 |
| Submissions | 1 |
| Tasks | 4 |
| Timer Display | 2 |
| Tracking | 3 |
| User | 3 |
| **Total API Routes** | **443** |

## Grand Total

| Type | Count |
|------|-------|
| Page Routes | 205 |
| API Routes | 443 |
| Redirects | 3 |
| **Grand Total** | **651** |

# PMI EMS Scheduler - Sitemap

> Auto-generated from codebase scan on 2026-03-04

## Root / General

| Route | Page Title | Auth | Description |
|-------|-----------|------|-------------|
| `/` | PMI Paramedic Tools | Authenticated | Home dashboard with role-based widgets and quick links |
| `/auth/signin` | PMI EMS Scheduler | Public | Google OAuth sign-in page restricted to @pmi.edu |
| `/request-access` | Request Access | Authenticated (pending) | Form for new users to request role access |
| `/calendar` | Calendar | Authenticated | Unified calendar view for lab days, shifts, and events |
| `/help` | Help Center | Authenticated | Documentation and help resources for the application |
| `/notifications` | Notifications | Authenticated | User notification center with read/unread tracking |
| `/onboarding` | Onboarding | Authenticated | Instructor onboarding workflow with task tracking |
| `/settings` | Settings | Authenticated | User preference settings (theme, notifications, quick links) |
| `/settings/sessions` | Sessions | Authenticated | Active session management and device tracking |

## Admin

All admin pages require `admin` or `superadmin` role unless noted.

| Route | Page Title | Auth | Description |
|-------|-----------|------|-------------|
| `/admin` | Admin Settings | admin+ | Admin hub with links to all admin tools |
| `/admin/access-requests` | Access Requests | admin+ | Review and approve/deny user access requests |
| `/admin/alumni` | Alumni | admin+ | Alumni tracking with employment and contact info |
| `/admin/announcements` | Announcements | admin+ | Create and manage system-wide announcements |
| `/admin/attendance-appeals` | Attendance Appeals | admin+ | Review student attendance appeal submissions |
| `/admin/audit-log` | Audit Log | admin+ | View system audit trail of sensitive operations |
| `/admin/broadcast` | Broadcast Notifications | admin+ | Send targeted notifications to user groups |
| `/admin/bulk-operations` | Bulk Data Operations | admin+ | Perform bulk updates/deletes on database records |
| `/admin/certifications` | Certifications Import | admin+ | Import instructor certification data from CSV |
| `/admin/certifications/compliance` | Certification Compliance | admin+ | Dashboard showing instructor certification status |
| `/admin/certifications/verification` | Certification Verification | admin+ | Verify and approve instructor certifications |
| `/admin/config` | System Configuration | superadmin | Manage system-wide configuration settings |
| `/admin/create` | Create Poll | admin+ | Poll creation wizard (type selection and details) |
| `/admin/dashboard-defaults` | Dashboard Defaults | admin+ | Set default dashboard widget layouts by role |
| `/admin/data-export` | Data Export | admin+ | Export system data in CSV/JSON formats |
| `/admin/database-tools` | Database Cleanup Utilities | superadmin | Database maintenance and cleanup operations |
| `/admin/deep-links` | Deep Links | admin+ | Manage mobile/app deep link configurations |
| `/admin/deletion-requests` | Deletion Requests | admin+ | Process user data deletion requests |
| `/admin/email-templates` | Email Templates | admin+ | Manage and customize email notification templates |
| `/admin/equipment` | Equipment Inventory | admin+ | Track lab equipment inventory and status |
| `/admin/equipment/maintenance` | Maintenance Log | admin+ | Equipment maintenance scheduling and history |
| `/admin/guests` | Guest Access | admin+ | Manage guest user access and sessions |
| `/admin/incidents` | Incidents | admin+ | Log and track safety/behavioral incidents |
| `/admin/lab-templates` | Lab Templates | admin+ | Create and manage reusable lab day templates |
| `/admin/lab-templates/import` | Lab Template Import | admin+ | Import lab templates from JSON |
| `/admin/page` | Admin Settings | admin+ | Main admin dashboard hub |
| `/admin/poll/[id]` | Poll Admin | admin+ | Admin view of a specific scheduling poll |
| `/admin/program-requirements` | Program Requirements | admin+ | Configure clinical hours and skills requirements |
| `/admin/qa-checklist` | QA Checklist Generator | admin+ | Generate QA checklists for system verification |
| `/admin/roles` | Role Permissions | admin+ | View and manage role-based permissions |
| `/admin/rubrics` | Assessment Rubrics | admin+ | Create and manage scenario assessment rubrics |
| `/admin/scenarios` | Scenario Management | admin+ | Hub for scenario administration tools |
| `/admin/scenarios/audit` | Scenario Audit | admin+ | Audit scenario data quality and completeness |
| `/admin/scenarios/transform` | Scenario Transform | admin+ | Bulk transform/migrate scenario data |
| `/admin/scheduled-exports` | Scheduled Exports | admin+ | Configure automatic recurring data exports |
| `/admin/settings` | System Settings | admin+ | System-level settings and configuration |
| `/admin/skill-sheets/import` | Skill Sheets Import | admin+ | Import skill sheet data from structured files |
| `/admin/system-alerts` | System Alerts | admin+ | View and manage system alert notifications |
| `/admin/system-health` | System Health | admin+ | Database and system health monitoring dashboard |
| `/admin/time-clock` | Time Clock Admin | admin+ | Review and approve instructor time entries |
| `/admin/user-activity` | User Activity | admin+ | View user login and page visit analytics |
| `/admin/users` | User Management | superadmin | Manage user accounts, roles, and permissions |
| `/admin/webhooks` | Integration Webhooks | admin+ | Configure webhook integrations for events |

## Lab Management

| Route | Page Title | Auth | Description |
|-------|-----------|------|-------------|
| `/lab-management` | Lab Management Dashboard | instructor+ | Main lab management hub with quick stats |
| `/lab-management/admin` | Admin Settings | admin+ | Lab management admin settings |
| `/lab-management/admin/certifications` | Instructor Certifications | admin+ | Manage instructor certification records |
| `/lab-management/admin/cohorts` | Manage Cohorts | admin+ | Create, edit, and archive student cohorts |
| `/lab-management/admin/feedback` | Feedback Reports | admin+ | View and manage user feedback submissions |
| `/lab-management/admin/timer-displays` | Timer Displays Admin | admin+ | Manage lab timer display tokens and rooms |
| `/lab-management/aemt-tracker` | (Redirect) | instructor+ | Redirects to clinical AEMT tracking |
| `/lab-management/cohorts/[id]` | Cohort Hub | instructor+ | Cohort detail view with students and stats |
| `/lab-management/cohorts/[id]/calendar` | Cohort Calendar | instructor+ | Calendar view filtered to a specific cohort |
| `/lab-management/cohorts/[id]/completion` | Cohort Completion | instructor+ | Cohort completion tracking and progress |
| `/lab-management/cohorts/[id]/groups` | Lab Groups | instructor+ | Manage lab groups within a cohort |
| `/lab-management/ekg-warmup` | EKG Warmup Scores | instructor+ | Track and log EKG rhythm identification scores |
| `/lab-management/emt-tracker` | (Redirect) | instructor+ | Redirects to clinical EMT tracking |
| `/lab-management/flags` | Flagged Items | instructor+ | View flagged student notes and assessments |
| `/lab-management/grade/station/[id]` | Grade Station | instructor+ | Grade students at a specific lab station |
| `/lab-management/groups` | Group Management | instructor+ | Manage lab groups, assign students, set leads |
| `/lab-management/mentorship` | Mentorship | instructor+ | Student mentorship pair management |
| `/lab-management/my-certifications` | My Certifications | instructor+ | View own instructor certifications |
| `/lab-management/peer-evals` | Peer Evaluations (Instructor) | instructor+ | Instructor view of student peer evaluations |
| `/lab-management/protocol-tracking` | Protocol Case Cards | instructor+ | Track student protocol case completions |
| `/lab-management/reports` | Reports | instructor+ | Lab management reports index page |
| `/lab-management/reports/clinical-hours` | Clinical Hours Report | instructor+ | Report on student clinical hours |
| `/lab-management/reports/internship-status` | Internship Status Report | instructor+ | Report on internship placement status |
| `/lab-management/reports/lab-progress` | Lab Progress Report | instructor+ | Report on lab completion progress |
| `/lab-management/reports/onboarding-status` | Onboarding Status Report | admin+ | Report on instructor onboarding progress |
| `/lab-management/reports/student-progress` | Student Progress Report | instructor+ | Detailed student progress report |
| `/lab-management/reports/team-leads` | Team Lead Rotations Report | instructor+ | Report on team lead rotation assignments |
| `/lab-management/scenario-library` | Scenario Library | instructor+ | Browse and search the full scenario library |
| `/lab-management/scenarios` | Scenario Library | instructor+ | List and manage EMS training scenarios |
| `/lab-management/scenarios/new` | Scenario Editor | instructor+ | Create a new EMS scenario |
| `/lab-management/scenarios/[id]` | Scenario Editor | instructor+ | View/edit an existing scenario with print support |
| `/lab-management/schedule` | Lab Schedule | instructor+ | Master lab schedule with calendar and list views |
| `/lab-management/schedule/new` | Schedule New Lab Day | instructor+ | Create a new lab day with stations and instructors |
| `/lab-management/schedule/[id]` | Lab Day | instructor+ | Lab day detail view with timer, stations, attendance |
| `/lab-management/schedule/[id]/edit` | Edit Lab Day | instructor+ | Edit an existing lab day configuration |
| `/lab-management/schedule/[id]/stations/new` | Add New Station | instructor+ | Add a new station to a lab day |
| `/lab-management/seating/charts` | Seating Charts | instructor+ | Browse and manage seating chart configurations |
| `/lab-management/seating/charts/[id]` | Seating Chart Builder | instructor+ | Visual seating chart editor |
| `/lab-management/seating/learning-styles` | Learning Styles | instructor+ | View and manage student learning style data |
| `/lab-management/seating/preferences` | Seating Preferences | instructor+ | Configure seating arrangement preferences |
| `/lab-management/skill-drills` | Skill Drills Library | instructor+ | Browse and manage skill drill exercises |
| `/lab-management/skill-sheets` | Skill Sheets | instructor+ | View skill sheets with step-by-step instructions |
| `/lab-management/skills/competencies` | Skill Competencies | instructor+ | Track student skill competency levels |
| `/lab-management/skills/competencies/report` | Competency Report | instructor+ | Generate skill competency reports |
| `/lab-management/stations/log` | Station Log | instructor+ | View grading log for lab stations |
| `/lab-management/stations/pool` | Station Pool | instructor+ | Manage the pool of reusable station definitions |
| `/lab-management/students` | Student Roster | instructor+ | Student list with search and filter |
| `/lab-management/students/import` | Import Students | admin+ | Bulk import students from CSV |
| `/lab-management/students/new` | Add Student | instructor+ | Manually add a new student record |
| `/lab-management/students/[id]` | Student Detail | instructor+ | Individual student profile with tabs |
| `/lab-management/students/[id]/learning-plan` | Learning Plan | instructor+ | Student individualized learning plan |
| `/lab-management/students/[id]/portfolio` | Student Portfolio | instructor+ | Student portfolio with completions and assessments |
| `/lab-management/templates` | Lab Day Templates | instructor+ | Browse and apply lab day templates |

## Clinical

| Route | Page Title | Auth | Description |
|-------|-----------|------|-------------|
| `/clinical` | Clinical & Internship | instructor+ | Clinical management hub with quick navigation |
| `/clinical/aemt-tracking` | AEMT Student Tracking | instructor+ (canEditClinical) | Track AEMT student clinical milestones |
| `/clinical/agencies` | Agencies | instructor+ (canEditClinical) | Manage EMS agencies and hospital contacts |
| `/clinical/capacity` | Site Capacity | admin+ | View and manage clinical site student capacity |
| `/clinical/compliance` | Compliance Docs Tracker | instructor+ | Track student compliance document status |
| `/clinical/compliance-tracker` | Student Compliance Tracker | instructor+ | Detailed compliance tracking per student |
| `/clinical/emt-tracking` | EMT Student Tracking | instructor+ (canEditClinical) | Track EMT student clinical milestones |
| `/clinical/hours` | Clinical Hours Tracker | instructor+ | Log and track student clinical hours |
| `/clinical/internships` | Internship Tracker | instructor+ (canEditClinical) | Manage student field internship placements |
| `/clinical/internships/[id]` | Internship Detail | instructor+ | Detailed internship view with phases and meetings |
| `/clinical/mce` | mCE Module Tracker | instructor+ | Track mandatory continuing education modules |
| `/clinical/overview` | Clinical Overview | instructor+ | High-level clinical program statistics |
| `/clinical/planning-calendar` | Clinical Planning Calendar | instructor+ | Calendar for planning clinical rotations |
| `/clinical/preceptors` | Preceptor Directory | instructor+ (canEditClinical) | Manage field preceptor records |
| `/clinical/rotation-scheduler` | Rotation Scheduler | instructor+ | Schedule student clinical rotations |
| `/clinical/site-visits` | Site Visits | instructor+ | Log and track clinical site visits |
| `/clinical/summative-evaluations` | Summative Evaluations | instructor+ | Manage summative evaluation sessions |
| `/clinical/summative-evaluations/[id]/grade` | Summative Grading | instructor+ | Grade individual students on summative evaluations |

## Scheduling (Part-Timer)

| Route | Page Title | Auth | Description |
|-------|-----------|------|-------------|
| `/scheduling` | Part-Timer Scheduling | admin+/director | Scheduling hub for part-time instructors |
| `/scheduling/availability` | My Availability | instructor+ | Submit personal availability windows |
| `/scheduling/availability/all` | All Availability | admin+/director | View all instructor availability in grid format |
| `/scheduling/reports` | Scheduling Reports | admin+ | Scheduling analytics and coverage reports |
| `/scheduling/resource-bookings` | Resource Bookings | instructor+ | Book rooms, equipment, and sim labs |
| `/scheduling/shifts` | Shifts | admin+/director | Manage open shifts and instructor signups |
| `/scheduling/shifts/new` | Create New Shift | admin+/director | Create a new open shift for sign-up |
| `/scheduling/signups/pending` | Pending Signups | admin+ | Review and approve pending shift sign-ups |
| `/scheduling/substitute-requests` | Substitute Requests | instructor+ | Request and manage substitute coverage |
| `/scheduling/team-availability` | Team Availability | admin+ | View team-level availability patterns |

## Scheduling Polls (Legacy)

| Route | Page Title | Auth | Description |
|-------|-----------|------|-------------|
| `/scheduler` | Scheduling Polls | instructor+ | Hub for creating and managing scheduling polls |
| `/poll/create` | Create New Poll | instructor+ | Create a new scheduling/availability poll |
| `/poll/[id]` | Poll View | Authenticated | View and respond to a scheduling poll |

## Instructor

| Route | Page Title | Auth | Description |
|-------|-----------|------|-------------|
| `/instructor` | Instructor Portal | instructor+ | Instructor dashboard with teaching stats |
| `/instructor/ce` | CE Hours Tracker | instructor+ | Track continuing education hours |
| `/instructor/certifications` | My Certifications | instructor+ | View and manage personal certifications |
| `/instructor/history` | Teaching History | instructor+ | View past lab day teaching assignments |
| `/instructor/my-stats` | My Performance | instructor+ | Personal teaching performance analytics |
| `/instructor/teaching` | Teaching Log | instructor+ | Log and review teaching activities |
| `/instructor/time-clock` | Time Clock | instructor+ | Clock in/out for lab day hours |

## Student Portal

| Route | Page Title | Auth | Description |
|-------|-----------|------|-------------|
| `/student` | Student Dashboard | user (student) | Student home with progress overview |
| `/student/attendance-appeals` | Attendance Appeals | user (student) | Submit and track attendance appeal requests |
| `/student/available-labs` | Lab Sign-Ups | user (student) | Browse and sign up for available lab sessions |
| `/student/completions` | Student Completions | user (student) | View station and scenario completions |
| `/student/documents` | My Documents | user (student) | Upload and manage personal documents |
| `/student/my-progress` | My Progress | user (student) | View personal academic progress |
| `/student/peer-eval` | Peer Evaluations | user (student) | Submit peer evaluations for lab partners |
| `/student/profile` | Student Profile | user (student) | View and edit personal profile information |
| `/students/[id]/progress` | Student Progress | instructor+ | Instructor view of individual student progress |

## Reports

| Route | Page Title | Auth | Description |
|-------|-----------|------|-------------|
| `/reports/attendance` | Attendance Report | instructor+ | Lab day attendance analytics |
| `/reports/availability-patterns` | Availability Patterns | admin+ | Instructor availability pattern analysis |
| `/reports/builder` | Custom Report Builder | admin+ | Build custom reports from available data sources |
| `/reports/closeout-surveys` | Closeout Survey Results | admin+ | Aggregate closeout survey analytics |
| `/reports/cohort-comparison` | Cohort Comparison | instructor+ | Compare metrics across cohorts |
| `/reports/gradebook` | Gradebook | instructor+ | Unified gradebook with all scores |
| `/reports/instructor-workload` | Instructor Workload Analytics | admin+ | Analyze instructor teaching loads |
| `/reports/lab-costs` | Lab Cost Report | admin+ | Track and analyze lab operational costs |
| `/reports/program-outcomes` | Program Outcomes | admin+ | Program-level outcome metrics (graduation rate, etc.) |
| `/reports/scenario-analytics` | Scenario Analytics | instructor+ | Scenario usage and performance analytics |
| `/reports/scenario-usage` | Scenario Usage Report | instructor+ | Track which scenarios are used most |

## Resources

| Route | Page Title | Auth | Description |
|-------|-----------|------|-------------|
| `/resources` | Resources | instructor+ | Document and resource library |
| `/resources/medications` | Medication Reference | instructor+ | Searchable medication reference database |

## Skill Sheets

| Route | Page Title | Auth | Description |
|-------|-----------|------|-------------|
| `/skill-sheets` | Skill Sheets Browse | Authenticated | Browse all skill sheets by program |
| `/skill-sheets/[id]` | Skill Sheet Detail | Authenticated | Detailed skill sheet with steps and evaluations |

## Tasks

| Route | Page Title | Auth | Description |
|-------|-----------|------|-------------|
| `/tasks` | Tasks | instructor+ | Task management with Kanban and list views |
| `/tasks/[id]` | Task Detail | instructor+ | Individual task view with comments |

## Feedback

| Route | Page Title | Auth | Description |
|-------|-----------|------|-------------|
| `/feedback/my-submissions` | My Feedback | Authenticated | View personal feedback/bug report submissions |

## Public / Token-Based (No Auth)

| Route | Page Title | Auth | Description |
|-------|-----------|------|-------------|
| `/checkin/[token]` | Lab Check-In | Public (token) | Student lab check-in via QR code token |
| `/timer-display/[token]` | Timer Display | Public (token) | Lab timer display for projection screens |
| `/preceptor/evaluate/[token]` | Preceptor Evaluation | Public (token) | External preceptor evaluation form |
| `/guest` | Guest Portal | Guest session | Guest user landing page |

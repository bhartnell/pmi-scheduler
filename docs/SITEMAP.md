# PMI EMS Scheduler - Complete Route Sitemap

## Overview

This document maps all routes in the PMI EMS Scheduler Next.js application, organized by feature area with permission requirements.

## Role Hierarchy

| Level | Role | Access |
|-------|------|--------|
| 5 | `superadmin` | Full system access, protected accounts |
| 4 | `admin` | User management, system admin |
| 3 | `lead_instructor` | Content management, lab admin |
| 2 | `instructor` | Standard access |
| 1 | `guest` | View-only, temporary |
| 0 | `pending` | No access until approved |

---

## Authentication & Public Routes

| Route | Description | Access |
|-------|-------------|--------|
| `/auth/signin` | Google OAuth sign-in (restricted to @pmi.edu) | Public |
| `/guest` | Guest access login page | Public |
| `/timer-display/[token]` | Public timer display (token-based) | Public |

---

## Dashboard (`/`)

| Route | Description | Access |
|-------|-------------|--------|
| `/` | Customizable widget dashboard | Authenticated |
| `/notifications` | All notifications view | Authenticated |
| `/settings` | Personal notification preferences | Authenticated |

---

## Clinical & Internship (`/clinical/*`)

| Route | Description | Access |
|-------|-------------|--------|
| `/clinical` | Clinical dashboard | lead_instructor+ |
| `/clinical/overview` | Overview dashboard | lead_instructor+ |
| `/clinical/preceptors` | Preceptor directory | instructor+ |
| `/clinical/internships` | Internship tracker | lead_instructor+ |
| `/clinical/internships/[id]` | Individual internship details | lead_instructor+ |
| `/clinical/compliance` | Compliance docs tracker | lead_instructor+ |
| `/clinical/hours` | Clinical hours tracker | lead_instructor+ |
| `/clinical/mce` | mCE module tracker | lead_instructor+ |
| `/clinical/emt-tracking` | EMT student tracking | lead_instructor+ |
| `/clinical/aemt-tracking` | AEMT student tracking | lead_instructor+ |
| `/clinical/summative-evaluations` | Summative evaluations list | lead_instructor+ |
| `/clinical/summative-evaluations/[id]/grade` | Grade evaluation | lead_instructor+ |
| `/clinical/site-visits` | Site visit logging | lead_instructor+ |

### Clinical API Routes

| Route | Methods | Description |
|-------|---------|-------------|
| `/api/clinical/overview` | GET | Clinical overview data |
| `/api/clinical/overview-all` | GET | All clinical data |
| `/api/clinical/preceptors` | GET, POST | Preceptor management |
| `/api/clinical/preceptors/[id]` | GET, PATCH, DELETE | Single preceptor |
| `/api/clinical/internships` | GET, POST | Internship management |
| `/api/clinical/internships/[id]` | GET, PATCH, DELETE | Single internship |
| `/api/clinical/internships/[id]/preceptors` | GET, POST, DELETE | Internship preceptors |
| `/api/clinical/compliance` | GET, POST | Compliance documents |
| `/api/clinical/hours` | GET, POST | Clinical hours |
| `/api/clinical/mce` | GET, PUT | mCE tracking |
| `/api/clinical/emt-tracking` | GET, PUT | EMT tracking |
| `/api/clinical/aemt-tracking` | GET, PUT | AEMT tracking |
| `/api/clinical/summative-evaluations` | GET, POST | Summative evaluations |
| `/api/clinical/summative-evaluations/[id]` | GET, PATCH, DELETE | Single evaluation |
| `/api/clinical/summative-evaluations/[id]/scores` | GET, POST, PATCH | Evaluation scores |
| `/api/clinical/summative-evaluations/[id]/export` | GET | Export evaluation |
| `/api/clinical/summative-scenarios` | GET | Summative scenarios |
| `/api/clinical/site-visits` | GET, POST | Site visits |
| `/api/clinical/site-visits/[id]` | GET, PATCH, DELETE | Single visit |
| `/api/clinical/site-visits/coverage` | GET | Coverage alerts |
| `/api/clinical/site-visits/export` | GET | Export visits |
| `/api/clinical/agencies` | GET, POST | EMS agencies |
| `/api/clinical/agencies/[id]` | GET, PATCH, DELETE | Single agency |
| `/api/clinical/sites` | GET, POST | Clinical sites |
| `/api/clinical/sites/[id]` | GET, PATCH, DELETE | Single site |
| `/api/clinical/sites/[id]/departments` | GET, POST, DELETE | Site departments |
| `/api/clinical/preceptor-assignments` | GET, POST, DELETE | Preceptor assignments |

---

## Lab Management (`/lab-management/*`)

### Main Pages

| Route | Description | Access |
|-------|-------------|--------|
| `/lab-management` | Dashboard | Authenticated |
| `/lab-management/schedule` | Lab schedule list | Authenticated |
| `/lab-management/schedule/new` | Create new lab day | lead_instructor+ |
| `/lab-management/schedule/[id]` | Lab day details | lead_instructor+ |
| `/lab-management/schedule/[id]/edit` | Edit lab day | lead_instructor+ |
| `/lab-management/schedule/[id]/stations/new` | Create station | lead_instructor+ |
| `/lab-management/scenarios` | Scenarios library | Authenticated |
| `/lab-management/scenarios/new` | Create scenario | instructor+ |
| `/lab-management/scenarios/[id]` | Scenario details | Authenticated |
| `/lab-management/skill-sheets` | Skill sheets | Authenticated |
| `/lab-management/students` | Student roster | Authenticated |
| `/lab-management/students/new` | Add new student | lead_instructor+ |
| `/lab-management/students/import` | Import students | lead_instructor+ |
| `/lab-management/students/[id]` | Student profile | Authenticated |
| `/lab-management/my-certifications` | My certifications | Authenticated |
| `/lab-management/cohorts/[id]` | Cohort details | lead_instructor+ |
| `/lab-management/cohorts/[id]/groups` | Cohort groups | lead_instructor+ |
| `/lab-management/grade/station/[id]` | Grade station | instructor+ |
| `/lab-management/flags` | Flagged items | Authenticated |
| `/lab-management/emt-tracker` | EMT tracking | Authenticated |
| `/lab-management/aemt-tracker` | AEMT tracking | Authenticated |

### Seating

| Route | Description | Access |
|-------|-------------|--------|
| `/lab-management/seating/charts` | Seating charts | lead_instructor+ |
| `/lab-management/seating/charts/[id]` | Chart details | lead_instructor+ |
| `/lab-management/seating/preferences` | Seating preferences | Authenticated |
| `/lab-management/seating/learning-styles` | Learning styles | lead_instructor+ |

### Reports

| Route | Description | Access |
|-------|-------------|--------|
| `/lab-management/reports` | Reports hub | lead_instructor+ |
| `/lab-management/reports/clinical-hours` | Clinical hours report | lead_instructor+ |
| `/lab-management/reports/internship-status` | Internship status | lead_instructor+ |
| `/lab-management/reports/lab-progress` | Lab progress | lead_instructor+ |
| `/lab-management/reports/onboarding-status` | Onboarding status | lead_instructor+ |
| `/lab-management/reports/student-progress` | Student progress | lead_instructor+ |
| `/lab-management/reports/team-leads` | Team leads report | lead_instructor+ |

### Lab Admin

| Route | Description | Access |
|-------|-------------|--------|
| `/lab-management/admin` | Lab admin dashboard | lead_instructor+ |
| `/lab-management/admin/cohorts` | Manage cohorts | lead_instructor+ |
| `/lab-management/admin/certifications` | Certification records | lead_instructor+ |
| `/lab-management/admin/feedback` | Feedback management | lead_instructor+ |
| `/lab-management/admin/timer-displays` | Timer displays | lead_instructor+ |
| `/lab-management/admin/users` | **DEPRECATED** - Use `/admin/users` | lead_instructor+ |
| `/lab-management/admin/deletion-requests` | **DEPRECATED** - Use `/admin/deletion-requests` | lead_instructor+ |

### Lab Management API Routes

| Route | Methods | Description |
|-------|---------|-------------|
| `/api/lab-management/lab-days` | GET, POST | Lab day management |
| `/api/lab-management/lab-days/[id]` | GET, PATCH, DELETE | Single lab day |
| `/api/lab-management/scenarios` | GET, POST | Scenarios |
| `/api/lab-management/scenarios/[id]` | GET, PATCH, DELETE | Single scenario |
| `/api/lab-management/scenarios/import` | POST | Import scenarios |
| `/api/lab-management/skills` | GET, POST | Skills library |
| `/api/lab-management/skills/[id]/documents` | GET, POST, DELETE | Skill documents |
| `/api/lab-management/students` | GET, POST | Students |
| `/api/lab-management/students/[id]` | GET, PATCH, DELETE | Single student |
| `/api/lab-management/students/[id]/photo` | POST | Student photo |
| `/api/lab-management/students/[id]/clinical-tasks` | GET | Clinical tasks |
| `/api/lab-management/students/import` | POST | Import students |
| `/api/lab-management/cohorts` | GET, POST | Cohorts |
| `/api/lab-management/cohorts/[id]` | GET, PATCH, DELETE | Single cohort |
| `/api/lab-management/cohorts/[id]/stats` | GET | Cohort statistics |
| `/api/lab-management/certifications` | GET, POST | Certifications |
| `/api/lab-management/certifications/[id]` | GET, PATCH, DELETE | Single certification |
| `/api/lab-management/programs` | GET | Programs |
| `/api/lab-management/locations` | GET | Locations |
| `/api/lab-management/stations` | GET, POST | Stations |
| `/api/lab-management/station-skills` | GET, POST | Station skills |
| `/api/lab-management/station-instructors` | GET, POST, DELETE | Station instructors |
| `/api/lab-management/groups` | GET, POST | Lab groups |
| `/api/lab-management/groups/[id]` | PATCH, DELETE | Single group |
| `/api/lab-management/groups/[id]/members` | GET, POST, DELETE | Group members |
| `/api/lab-management/groups/generate` | POST | Auto-generate groups |
| `/api/lab-management/lab-groups` | GET | Lab groups (legacy) |
| `/api/lab-management/lab-groups/history` | GET | Group history |
| `/api/lab-management/lab-groups/members` | GET, POST | Group members |
| `/api/lab-management/instructors` | GET | Instructors list |
| `/api/lab-management/team-leads` | GET | Team lead tracking |
| `/api/lab-management/custom-skills` | GET, POST | Custom skills |
| `/api/lab-management/ce-requirements` | GET | CE requirements |
| `/api/lab-management/ce-records` | GET, POST | CE records |
| `/api/lab-management/field-trips` | GET, POST | Field trips |
| `/api/lab-management/field-trips/attendance` | GET, POST | Attendance |
| `/api/lab-management/timer` | GET, POST | Timer state |
| `/api/lab-management/timer/active` | GET | Active timer |
| `/api/lab-management/timer/ready` | GET, POST | Ready status |
| `/api/lab-management/timer-displays` | GET, POST | Display tokens |
| `/api/lab-management/timer-displays/[id]` | GET, PATCH, DELETE | Single token |
| `/api/lab-management/lab-day-roles` | GET, POST | Lab day roles |
| `/api/lab-management/lab-day-skills` | GET | Lab day skills |
| `/api/lab-management/assessments/skill` | GET, POST | Skill assessments |
| `/api/lab-management/assessments/scenario` | GET, POST | Scenario assessments |
| `/api/lab-management/flagged-items` | GET | Flagged items |
| `/api/lab-management/deletion-requests` | GET, POST | Deletion requests |
| `/api/lab-management/users` | GET | Lab users |

---

## Instructor Portal (`/instructor/*`)

| Route | Description | Access |
|-------|-------------|--------|
| `/instructor` | Instructor dashboard | Authenticated |
| `/instructor/certifications` | My certifications | Authenticated |
| `/instructor/ce` | CE tracking | Authenticated |
| `/instructor/teaching` | Teaching log | Authenticated |

### Instructor API Routes

| Route | Methods | Description |
|-------|---------|-------------|
| `/api/instructor/me` | GET | Current user profile |
| `/api/instructor/ce-records` | GET, POST | CE records |
| `/api/instructor/ce-records/[id]` | DELETE | Delete CE record |
| `/api/instructor/teaching-log` | GET, POST | Teaching log |
| `/api/instructor/teaching-log/[id]` | DELETE | Delete log entry |
| `/api/instructor/upcoming-labs` | GET | Upcoming assignments |

---

## Scheduling & Availability (`/scheduling/*`)

| Route | Description | Access |
|-------|-------------|--------|
| `/scheduling` | Scheduling dashboard | Authenticated |
| `/scheduling/availability` | My availability | Authenticated |
| `/scheduling/availability/all` | All availability | lead_instructor+ |
| `/scheduling/shifts` | Shifts list | Authenticated |
| `/scheduling/shifts/new` | Create shift | lead_instructor+ |
| `/scheduling/signups/pending` | Pending signups | lead_instructor+ |
| `/scheduling/reports` | Scheduling reports | lead_instructor+ |

### Scheduling API Routes

| Route | Methods | Description |
|-------|---------|-------------|
| `/api/scheduling/availability` | GET, POST | Availability |
| `/api/scheduling/availability/[id]` | DELETE | Delete availability |
| `/api/scheduling/availability/bulk` | POST | Bulk availability |
| `/api/scheduling/shifts` | GET, POST | Shifts |
| `/api/scheduling/shifts/[id]` | GET, PATCH, DELETE | Single shift |
| `/api/scheduling/shifts/[id]/signup` | POST | Sign up for shift |
| `/api/scheduling/shifts/[id]/signup/[signupId]` | PATCH, DELETE | Manage signup |
| `/api/scheduling/signups/pending` | GET | Pending signups |
| `/api/scheduling/reports` | GET | Reports data |

---

## Tasks (`/tasks/*`)

| Route | Description | Access |
|-------|-------------|--------|
| `/tasks` | Tasks board (Kanban) | Authenticated |
| `/tasks/[id]` | Task details | Authenticated |

### Tasks API Routes

| Route | Methods | Description |
|-------|---------|-------------|
| `/api/tasks` | GET, POST | Tasks |
| `/api/tasks/[id]` | GET, PATCH, DELETE | Single task |
| `/api/tasks/[id]/comments` | GET, POST | Task comments |

---

## Polling & Scheduling Polls (`/poll/*`, `/scheduler/*`)

| Route | Description | Access |
|-------|-------------|--------|
| `/scheduler` | Scheduling polls home | Authenticated |
| `/poll/create` | Create new poll | Authenticated |
| `/poll/[id]` | Poll details | Public (shareable) |
| `/admin/poll/[id]` | Poll results/admin | Poll creator |
| `/admin/create` | **SHOULD MOVE** to `/scheduler/create` | Authenticated |

### Poll API Routes

| Route | Methods | Description |
|-------|---------|-------------|
| `/api/polls` | GET, POST | Polls |
| `/api/submissions` | POST | Poll submissions |

---

## Admin (`/admin/*`)

| Route | Description | Access |
|-------|-------------|--------|
| `/admin` | Admin dashboard | admin+ |
| `/admin/users` | **AUTHORITATIVE** User management | admin+ |
| `/admin/guests` | Guest access management | admin+ |
| `/admin/roles` | Role permissions reference | admin+ |
| `/admin/certifications` | Certification compliance | admin+ |
| `/admin/deletion-requests` | **AUTHORITATIVE** Deletion requests | admin+ |
| `/admin/audit-log` | FERPA audit log | superadmin |
| `/admin/settings` | System settings | superadmin |

### Admin API Routes

| Route | Methods | Description |
|-------|---------|-------------|
| `/api/admin/users` | GET, POST, PATCH | User management |
| `/api/admin/guests` | GET, POST, DELETE | Guest access |
| `/api/admin/deletion-requests` | GET, POST | Deletion requests |
| `/api/admin/certification-compliance` | GET | Compliance overview |
| `/api/admin/audit-log` | GET | Audit log entries |
| `/api/admin/stats` | GET | System statistics |
| `/api/admin/endorsements` | GET, POST | Endorsements |
| `/api/admin/feedback/import` | POST | Import feedback |

---

## Onboarding (`/onboarding/*`)

| Route | Description | Access |
|-------|-------------|--------|
| `/onboarding` | Onboarding dashboard | admin+ or assigned users |

### Onboarding API Routes

| Route | Methods | Description |
|-------|---------|-------------|
| `/api/onboarding/dashboard` | GET | Dashboard data |
| `/api/onboarding/assignments` | GET, POST | Assignments |
| `/api/onboarding/templates` | GET, POST | Templates |
| `/api/onboarding/tasks/[id]/progress` | PATCH | Task progress |

---

## Seating API Routes

| Route | Methods | Description |
|-------|---------|-------------|
| `/api/seating/charts` | GET, POST | Seating charts |
| `/api/seating/charts/[id]` | GET, PATCH, DELETE | Single chart |
| `/api/seating/charts/[id]/assignments` | GET, POST | Assignments |
| `/api/seating/charts/[id]/generate` | POST | Auto-generate |
| `/api/seating/preferences` | GET, POST | Preferences |
| `/api/seating/learning-styles` | GET, POST | Learning styles |
| `/api/seating/classrooms` | GET | Classrooms |

---

## Reports API Routes

| Route | Methods | Description |
|-------|---------|-------------|
| `/api/reports/clinical-hours` | GET | Clinical hours |
| `/api/reports/internship-status` | GET | Internship status |
| `/api/reports/lab-progress` | GET | Lab progress |
| `/api/reports/onboarding-status` | GET | Onboarding status |
| `/api/reports/student-progress` | GET | Student progress |
| `/api/reports/team-leads` | GET | Team leads |

---

## Notification API Routes

| Route | Methods | Description |
|-------|---------|-------------|
| `/api/notifications` | GET, POST | Notifications |
| `/api/notifications/preferences` | GET, PUT | In-app preferences |
| `/api/notifications/email-preferences` | GET, PUT | Email preferences |
| `/api/notifications/read` | POST | Mark as read |
| `/api/notifications/send-email` | POST | Send email |

---

## Other API Routes

| Route | Methods | Description |
|-------|---------|-------------|
| `/api/auth/[...nextauth]` | * | NextAuth |
| `/api/user/preferences` | GET, PUT, DELETE | User preferences |
| `/api/feedback` | GET, POST, PATCH | Feedback reports |
| `/api/calendar/create-event` | POST | Calendar events |
| `/api/students` | GET | General students |
| `/api/users/list` | GET | User directory |
| `/api/timer-display` | GET | Timer display |
| `/api/timer-display/[token]` | GET | Token validation |

---

## Route Statistics

| Category | Page Routes | API Routes |
|----------|-------------|------------|
| Clinical | 13 | 28 |
| Lab Management | 25 | 45 |
| Instructor | 4 | 5 |
| Scheduling | 6 | 10 |
| Tasks | 2 | 4 |
| Polling | 4 | 2 |
| Admin | 8 | 8 |
| Onboarding | 1 | 4 |
| Settings/Notifications | 2 | 5 |
| Reports | 6 | 6 |
| Other | 3 | 8 |
| **Total** | **74** | **125** |

---

## Deprecated Routes (to be redirected)

| Old Route | Redirect To | Reason |
|-----------|-------------|--------|
| `/lab-management/admin/users` | `/admin/users` | Duplicate, incomplete |
| `/lab-management/admin/deletion-requests` | `/admin/deletion-requests` | Duplicate |
| `/admin/create` | `/scheduler/create` | Wrong location |

---

*Generated: 2026-02-17*

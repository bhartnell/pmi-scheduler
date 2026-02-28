# PMI EMS Scheduler - API Reference

> **Base URL:** All routes are relative to the application root (e.g., `https://your-domain.com/api/...`)

## Table of Contents

1. [Authentication & Users](#1-authentication--users)
2. [Dashboard](#2-dashboard)
3. [Search](#3-search)
4. [Lab Management](#4-lab-management)
   - [Cohorts](#41-cohorts)
   - [Lab Days](#42-lab-days)
   - [Students](#43-students)
   - [Scenarios](#44-scenarios)
   - [Skill Sign-offs](#45-skill-sign-offs)
   - [Stations](#46-stations)
   - [Student Check-in (QR)](#47-student-check-in-qr)
5. [Clinical](#5-clinical)
   - [Internships](#51-internships)
   - [Clinical Hours](#52-clinical-hours)
   - [Compliance](#53-compliance)
   - [Preceptor Evaluations](#54-preceptor-evaluations)
   - [Sites](#55-sites)
   - [Preceptors](#56-preceptors)
6. [Scheduling](#6-scheduling)
   - [Shifts](#61-shifts)
   - [Availability](#62-availability)
   - [Shift Swaps](#63-shift-swaps)
7. [Tasks](#7-tasks)
8. [Notifications](#8-notifications)
9. [Reports](#9-reports)
10. [Admin](#10-admin)
    - [Users](#101-users)
    - [Data Export](#102-data-export)
    - [System Alerts](#103-system-alerts)
    - [Stats](#104-stats)
    - [Database Tools](#105-database-tools)
    - [Audit Log](#106-audit-log)
    - [Email Templates](#107-email-templates)
    - [Lab Templates](#108-lab-templates)
    - [Certifications Import](#109-certifications-import)
11. [Settings & Preferences](#11-settings--preferences)
    - [User Preferences](#111-user-preferences)
    - [Notification Preferences](#112-notification-preferences)
    - [Email Preferences](#113-email-preferences)
12. [Onboarding](#12-onboarding)
13. [Cron Jobs](#13-cron-jobs)
14. [Error Logging](#14-error-logging)
15. [Access Requests](#15-access-requests)

---

## Special Endpoint Notes

### Rate-Limited Endpoints

| Endpoint | Limit | Window | Key |
|----------|-------|--------|-----|
| `POST /api/guest/login` | 10 requests | 60 seconds | IP address |
| `POST /api/access-requests` | 5 requests | 60 seconds | IP address |
| `POST /api/checkin/[token]` | 20 requests | 60 seconds | IP address |
| `POST /api/errors/log` | 10 requests | 60 seconds | User email or IP |

### Public Endpoints (No Authentication Required)

| Endpoint | Description |
|----------|-------------|
| `GET /api/checkin/[token]` | Validate check-in QR code token |
| `POST /api/checkin/[token]` | Submit student self check-in |
| `GET /api/clinical/preceptor-eval/[token]` | Validate preceptor evaluation token |
| `POST /api/clinical/preceptor-eval/[token]` | Submit preceptor evaluation |
| `POST /api/guest/login` | Guest login with name or access code |

### File Upload Endpoints

| Endpoint | Description |
|----------|-------------|
| `POST /api/lab-management/students/import` | CSV import of students |
| `POST /api/lab-management/scenarios/import` | CSV/JSON import of scenarios |
| `POST /api/admin/certifications/import` | CSV import of certifications |
| `POST /api/admin/feedback/import` | CSV import of feedback data |

### Email-Sending Endpoints

| Endpoint | Trigger |
|----------|---------|
| `POST /api/clinical/preceptor-eval/send` | Sends evaluation link to preceptor |
| `GET /api/cron/daily-digest` | Sends digest emails via Resend to opted-in users |
| `POST /api/admin/email-templates/[key]/test` | Sends test email using template |
| `POST /api/tasks` | Sends in-app notifications on task creation |
| `POST /api/tasks/[id]/comments` | Sends in-app notifications to task participants |
| `GET /api/cron/lab-reminder` | Sends in-app notifications about tomorrow's labs |
| `GET /api/cron/cert-expiry` | Sends in-app notifications for expiring certs |
| `GET /api/cron/compliance-expiry` | Sends in-app notifications for expiring compliance docs |
| `GET /api/cron/internship-milestones` | Sends in-app notifications for internship milestones |

---

## Role Hierarchy

```
superadmin > admin > lead_instructor > instructor > volunteer_instructor > user > guest
```

Roles referenced in this document:
- **Any authenticated user** - must have a valid session
- **instructor+** - instructor, lead_instructor, admin, superadmin
- **lead_instructor+** - lead_instructor, admin, superadmin
- **admin+** - admin, superadmin
- **superadmin** - superadmin only

---

## Standard Response Shapes

**Success:**
```json
{ "success": true, "data": { ... } }
```

**Error:**
```json
{ "success": false, "error": "Human-readable message" }
{ "error": "Human-readable message" }
```

**Paginated:**
```json
{
  "data": [...],
  "total": 100,
  "limit": 20,
  "offset": 0
}
```

---

## 1. Authentication & Users

### NextAuth Handler

```
GET  /api/auth/[...nextauth]
POST /api/auth/[...nextauth]
```

Handled entirely by NextAuth.js. Manages Google OAuth flow restricted to `@pmi.edu` accounts. No custom request/response shape — follows NextAuth conventions.

---

### Guest Login

> **Rate-limited:** 10 requests/minute per IP
> **Public:** No authentication required

```
POST /api/guest/login
```

Allows lab guests (observers, ride-alongs) to check in using their name or a lab access code.

**Request Body:**
```json
{
  "input": "John Smith"
}
```
`input` is matched against guest names or the lab day's access code.

**Response:**
```json
{
  "success": true,
  "guest": {
    "id": "uuid",
    "name": "John Smith",
    "lab_day_id": "uuid"
  },
  "labDay": {
    "id": "uuid",
    "date": "2026-02-28",
    "title": "Lab 12"
  },
  "stations": [...]
}
```

---

## 2. Dashboard

### Quick Stats

```
GET /api/dashboard/quick-stats
```

**Auth:** Any authenticated user

Returns summary statistics for the current user's dashboard.

**Response:**
```json
{
  "success": true,
  "stats": {
    "activeStudents": 45,
    "labsThisMonth": 8,
    "openTasks": 3,
    "completionRate": 75
  }
}
```

`completionRate` is the percentage of tasks assigned to the current user this month that have been completed (0 if no tasks).

---

### Dashboard Layout

```
GET    /api/dashboard/layout
PUT    /api/dashboard/layout
DELETE /api/dashboard/layout
```

**Auth:** Any authenticated user

Manages the current user's widget layout. GET falls back to role-based defaults if no custom layout exists.

**PUT Request Body:**
```json
{
  "layout": [
    { "id": "quick-stats", "x": 0, "y": 0, "w": 4, "h": 2, "visible": true },
    { "id": "recent-activity", "x": 4, "y": 0, "w": 8, "h": 4, "visible": true }
  ]
}
```

**DELETE:** Resets layout to role-based defaults.

---

### Certificate Expiry Widget

```
GET /api/dashboard/cert-expiry
```

**Auth:** Any authenticated user

Returns instructor certifications expiring within the next 90 days.

**Response:**
```json
{
  "success": true,
  "certs": [
    {
      "id": "uuid",
      "instructor_name": "Jane Doe",
      "cert_type": "ACLS",
      "expiry_date": "2026-04-01",
      "days_remaining": 32
    }
  ]
}
```

---

### Recent Activity

```
GET /api/dashboard/recent-activity
```

**Auth:** Any authenticated user

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | number | 8 | Max results |
| `offset` | number | 0 | Pagination offset |
| `category` | string | `all` | Filter: `all`, `tasks`, `labs`, `shifts`, `students`, `clinical` |

**Response:**
```json
{
  "success": true,
  "activities": [
    {
      "id": "uuid",
      "type": "task_completed",
      "category": "tasks",
      "title": "Completed: Scenario Review",
      "timestamp": "2026-02-28T14:30:00Z",
      "link": "/tasks/uuid"
    }
  ],
  "total": 42,
  "limit": 8,
  "offset": 0
}
```

---

## 3. Search

### Global Search

```
GET /api/search
```

**Auth:** Any authenticated user

Searches across students, scenarios, tasks, lab days, and instructors in parallel.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `q` | string | — | Search query (minimum 2 characters) |
| `limit` | number | 5 | Max results per category (max 20) |

**Response:**
```json
{
  "results": {
    "students": [
      { "id": "uuid", "name": "John Smith", "email": "jsmith@email.com", "cohortName": "Cohort 12", "type": "student" }
    ],
    "scenarios": [
      { "id": "uuid", "title": "Chest Pain", "category": "Cardiac", "chiefComplaint": "Chest pain", "difficulty": "intermediate", "type": "scenario" }
    ],
    "tasks": [
      { "id": "uuid", "title": "Review attendance", "status": "pending", "priority": "high", "type": "task" }
    ],
    "labDays": [
      { "id": "uuid", "date": "2026-02-28", "title": "Lab 12", "status": "scheduled", "cohortName": "Cohort 12", "type": "lab_day" }
    ],
    "instructors": [
      { "id": "uuid", "name": "Jane Doe", "email": "jdoe@pmi.edu", "role": "instructor", "type": "instructor" }
    ]
  },
  "totalCount": 7
}
```

Returns empty results (not an error) if `q` is fewer than 2 characters.

---

## 4. Lab Management

### 4.1 Cohorts

```
GET  /api/lab-management/cohorts
POST /api/lab-management/cohorts
```

**Auth:** Any authenticated user (GET), instructor+ (POST)

**GET Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `programId` | string | Filter by program |
| `activeOnly` | boolean | Exclude archived cohorts |
| `include_archived` | boolean | Include archived cohorts |

**POST Request Body:**
```json
{
  "program_id": "uuid",
  "cohort_number": 12,
  "start_date": "2026-01-15",
  "expected_end_date": "2026-12-15",
  "current_semester": 1
}
```

---

```
GET    /api/lab-management/cohorts/[id]
PATCH  /api/lab-management/cohorts/[id]
DELETE /api/lab-management/cohorts/[id]
```

**Auth:** Any authenticated user (GET), instructor+ (PATCH/DELETE)

DELETE is blocked if the cohort has enrolled students.

---

### 4.2 Lab Days

```
GET  /api/lab-management/lab-days
POST /api/lab-management/lab-days
```

**Auth:** Any authenticated user (GET), instructor+ (POST)

**GET Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `cohortId` | string | Filter by cohort |
| `startDate` | string | ISO date filter (inclusive) |
| `endDate` | string | ISO date filter (inclusive) |
| `limit` | number | Max results |
| `offset` | number | Pagination offset |
| `detail` | boolean | Include stations and attendance data |

**POST Request Body:**
```json
{
  "cohort_id": "uuid",
  "date": "2026-03-15",
  "title": "Lab 13",
  "notes": "Focus on airway management",
  "status": "scheduled",
  "stations": [
    { "station_number": 1, "station_type": "skills", "scenario_id": "uuid" }
  ]
}
```

---

#### Lab Day Attendance

```
GET  /api/lab-management/lab-days/[id]/attendance
PUT  /api/lab-management/lab-days/[id]/attendance
POST /api/lab-management/lab-days/[id]/attendance
```

**Auth:** instructor+

**PUT** - Single attendance record upsert:
```json
{
  "student_id": "uuid",
  "status": "present",
  "notes": "Arrived 10 min late"
}
```

**POST** - Bulk attendance upsert:
```json
{
  "records": [
    { "student_id": "uuid", "status": "present" },
    { "student_id": "uuid2", "status": "absent", "notes": "Called out sick" }
  ]
}
```

`status` values: `present`, `absent`, `excused`, `late`

---

#### Check-in Token Management

```
POST   /api/lab-management/lab-days/[id]/checkin-token
DELETE /api/lab-management/lab-days/[id]/checkin-token
```

**Auth:** instructor+

**POST** - Generates a UUID check-in token for the lab day and enables student self check-in via QR code.

**Response:**
```json
{
  "success": true,
  "token": "uuid-token",
  "checkin_url": "https://your-domain.com/checkin/uuid-token"
}
```

**DELETE** - Disables check-in by clearing the token.

---

### 4.3 Students

```
GET  /api/lab-management/students
POST /api/lab-management/students
```

**Auth:** instructor+

**GET Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `cohortId` | string | Filter by cohort |
| `status` | string | `active`, `inactive`, `graduated` |
| `search` | string | Name or email search |
| `limit` | number | Max results |
| `offset` | number | Pagination offset |

**POST Request Body:**
```json
{
  "first_name": "John",
  "last_name": "Smith",
  "email": "jsmith@email.com",
  "cohort_id": "uuid",
  "agency": "Tucson Fire",
  "photo_url": "https://...",
  "notes": "Prior EMT experience"
}
```

---

### 4.4 Scenarios

```
GET  /api/lab-management/scenarios
POST /api/lab-management/scenarios
```

**Auth:** Any authenticated user (GET), any authenticated user (POST)

**GET Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `category` | string | Filter by category (e.g., `Cardiac`, `Trauma`) |
| `difficulty` | string | `beginner`, `intermediate`, `advanced` |
| `program` | string | Filter by program |
| `search` | string | Title/complaint search |
| `activeOnly` | boolean | Only return active scenarios |
| `limit` | number | Max results |
| `offset` | number | Pagination offset |

**POST Request Body:**
```json
{
  "title": "Chest Pain - STEMI",
  "chief_complaint": "Chest pain, diaphoresis",
  "category": "Cardiac",
  "difficulty": "intermediate",
  "is_active": true,
  "phases": [...],
  "vitals": {...}
}
```

---

### 4.5 Skill Sign-offs

```
GET /api/lab-management/skill-signoffs
POST /api/lab-management/skill-signoffs
PUT  /api/lab-management/skill-signoffs
```

**Auth:** instructor+ (GET, POST), lead_instructor+ (PUT/revoke)

**GET Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `student_id` | string | Filter by student |
| `lab_day_id` | string | Filter by lab day |
| `skill_id` | string | Filter by specific skill |

**POST** - Sign off a skill for one or multiple students:
```json
{
  "student_id": "uuid",
  "skill_id": "uuid",
  "lab_day_id": "uuid",
  "notes": "Performed 3 successful intubations"
}
```

Or bulk sign-off:
```json
{
  "student_ids": ["uuid1", "uuid2"],
  "skill_id": "uuid",
  "lab_day_id": "uuid"
}
```

**PUT** - Revoke a sign-off (lead_instructor+ only):
```json
{
  "id": "uuid",
  "revoked": true,
  "revoke_reason": "Skill not performed correctly"
}
```

---

### 4.6 Stations

```
GET  /api/lab-management/stations
POST /api/lab-management/stations
```

**Auth:** Any authenticated user

**GET Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `labDayId` | string | Filter by lab day |
| `instructor` | string | Filter by assigned instructor |
| `open` | boolean | Only open/available stations |
| `upcoming` | boolean | Only upcoming stations |
| `stationType` | string | Filter by type |
| `limit` | number | Max results |

**POST Request Body:**
```json
{
  "lab_day_id": "uuid",
  "station_number": 1,
  "station_type": "skills",
  "scenario_id": "uuid",
  "instructor_id": "uuid",
  "max_students": 4,
  "notes": ""
}
```

---

### 4.7 Student Check-in (QR)

> **Public:** No authentication required
> **Rate-limited:** 20 requests/minute per IP (POST)

```
GET  /api/checkin/[token]
POST /api/checkin/[token]
```

Used for student self check-in via QR code displayed in lab.

**GET** - Validate token and return lab day info:
```json
{
  "success": true,
  "labDay": {
    "id": "uuid",
    "date": "2026-02-28",
    "title": "Lab 12",
    "cohort_name": "Cohort 12"
  },
  "valid": true
}
```

Returns `{ "valid": false }` if token is expired or not found.

**POST Request Body:**
```json
{
  "student_id": "uuid"
}
```

**POST Response:**
```json
{
  "success": true,
  "message": "Check-in successful",
  "student_name": "John Smith",
  "checkin_time": "2026-02-28T14:30:00Z"
}
```

---

## 5. Clinical

### 5.1 Internships

```
GET  /api/clinical/internships
POST /api/clinical/internships
```

**Auth:** lead_instructor+

**GET Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `cohortId` | string | Filter by cohort |
| `status` | string | `active`, `completed`, `pending` |
| `phase` | string | `phase1`, `phase2`, `closeout` |
| `agencyId` | string | Filter by clinical agency |

**POST Request Body:**
```json
{
  "student_id": "uuid",
  "cohort_id": "uuid",
  "preceptor_id": "uuid",
  "agency_id": "uuid",
  "start_date": "2026-03-01",
  "expected_end_date": "2026-08-31",
  "phase": "phase1"
}
```

---

```
GET    /api/clinical/internships/[id]
PUT    /api/clinical/internships/[id]
DELETE /api/clinical/internships/[id]
```

**Auth:** lead_instructor+

**PUT** accepts an extensive field set for tracking all internship phases including:
- Phase transition dates
- Evaluation completion dates
- Closeout documentation
- Patient contact counts
- ALS/BLS call tallies

---

### 5.2 Clinical Hours

```
GET  /api/clinical/hours
POST /api/clinical/hours
```

**Auth:** lead_instructor+

**GET Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `cohortId` | string | Filter by cohort |

**POST** - Upsert hours for a student (creates or updates):
```json
{
  "student_id": "uuid",
  "cohort_id": "uuid",
  "hospital_hours": 120,
  "field_hours": 240,
  "total_hours": 360
}
```

---

### 5.3 Compliance

```
GET  /api/clinical/compliance
POST /api/clinical/compliance
```

**Auth:** lead_instructor+

Tracks student compliance documents (immunizations, background checks, etc.).

**GET Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `cohortId` | string | Filter by cohort |

**POST** - Update a single compliance field:
```json
{
  "student_id": "uuid",
  "field": "background_check",
  "value": "2026-01-15"
}
```

---

### 5.4 Preceptor Evaluations

> **Public endpoints:** Token-based, no authentication required

```
GET  /api/clinical/preceptor-eval/[token]
POST /api/clinical/preceptor-eval/[token]
```

**GET** - Validate evaluation token:
```json
{
  "success": true,
  "valid": true,
  "internship": {
    "student_name": "John Smith",
    "agency_name": "Tucson Medical Center",
    "preceptor_name": "Dr. Jane Doe"
  }
}
```

Returns `{ "valid": false, "error": "Token expired" }` if token is invalid or expired (7-day TTL).

**POST** - Submit evaluation:
```json
{
  "overall_rating": 4,
  "clinical_knowledge": 5,
  "patient_care": 4,
  "professionalism": 5,
  "communication": 4,
  "comments": "Strong performance overall"
}
```

All ratings are 1-5 scale. The system automatically flags evaluations where any rating is <= 2 for instructor review.

---

```
POST /api/clinical/preceptor-eval/send
```

**Auth:** lead_instructor+
**Sends email** to preceptor with evaluation link

**Request Body:**
```json
{
  "internship_id": "uuid",
  "preceptor_email": "preceptor@hospital.com"
}
```

**Response:**
```json
{
  "success": true,
  "eval_link": "https://your-domain.com/clinical/preceptor-eval/uuid-token",
  "expires_at": "2026-03-07T00:00:00Z"
}
```

Token is valid for 7 days.

---

### 5.5 Sites

```
GET  /api/clinical/sites
POST /api/clinical/sites
```

**Auth:** Any authenticated user (GET), any authenticated user (POST)

**GET Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `activeOnly` | boolean | Only active sites |
| `includeDepartments` | boolean | Include department list |
| `includeAgencies` | boolean | Include agency associations |

**POST Request Body:**
```json
{
  "name": "Tucson Medical Center",
  "abbreviation": "TMC",
  "system": "TMC Health",
  "address": "5301 E Grant Rd, Tucson, AZ 85712",
  "phone": "520-327-5461",
  "departments": ["Emergency", "ICU", "Cardiac"]
}
```

---

### 5.6 Preceptors

```
GET  /api/clinical/preceptors
POST /api/clinical/preceptors
```

**Auth:** Any authenticated user (GET), lead_instructor+ (POST)

**GET Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `agencyId` | string | Filter by agency |
| `search` | string | Name search |
| `activeOnly` | boolean | Only active preceptors |

**POST Request Body:**
```json
{
  "name": "Dr. Jane Doe",
  "email": "jdoe@hospital.com",
  "phone": "520-555-1234",
  "agency_id": "uuid",
  "credentials": "MD, FACEP",
  "snhd_cert_expiry": "2027-01-01"
}
```

---

## 6. Scheduling

### 6.1 Shifts

```
GET  /api/scheduling/shifts
POST /api/scheduling/shifts
```

**Auth:** Any authenticated user (GET), admin+ (POST)

**GET Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `start_date` | string | ISO date (inclusive) |
| `end_date` | string | ISO date (inclusive) |
| `department` | string | Filter by department |
| `include_filled` | boolean | Include fully staffed shifts |
| `include_cancelled` | boolean | Include cancelled shifts |

**POST Request Body:**

Single shift:
```json
{
  "title": "Saturday Lab Coverage",
  "date": "2026-03-15",
  "start_time": "08:00",
  "end_time": "17:00",
  "department": "Lab",
  "max_staff": 3,
  "notes": ""
}
```

Recurring shift (generates multiple shifts):
```json
{
  "title": "Weekly Lab",
  "dates": ["2026-03-15", "2026-03-22"],
  "start_time": "08:00",
  "end_time": "17:00",
  "repeat": "weekly",
  "repeat_until": "2026-06-30"
}
```

---

### 6.2 Availability

```
GET  /api/scheduling/availability
POST /api/scheduling/availability
```

**Auth:** Any authenticated user

**GET Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `instructor_id` | string | View a specific instructor's availability |
| `start_date` | string | ISO date filter |
| `end_date` | string | ISO date filter |
| `view_all` | boolean | Admin/lead_instructor: view all instructors |

**POST Request Body:**
```json
{
  "date": "2026-03-15",
  "start_time": "08:00",
  "end_time": "17:00",
  "is_all_day": false,
  "notes": "Available for morning lab only"
}
```

---

### 6.3 Shift Swaps

```
GET    /api/scheduling/swaps/[id]/interest
POST   /api/scheduling/swaps/[id]/interest
DELETE /api/scheduling/swaps/[id]/interest
```

**Auth:** Any authenticated user

Manage interest in a posted shift swap.

**POST** - Express interest in a swap:
```json
{
  "notes": "I can cover this shift"
}
```

Sends an in-app notification to the shift owner.

**DELETE** - Withdraw interest (no body required).

---

## 7. Tasks

### List and Create Tasks

```
GET  /api/tasks
POST /api/tasks
```

**Auth:** Any authenticated user

**GET Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `filter` | string | `all` | `all`, `assigned_to_me`, `assigned_by_me` |
| `status` | string | — | `pending`, `in_progress`, `completed`, `cancelled` |
| `priority` | string | — | `low`, `medium`, `high`, `urgent` |
| `sortBy` | string | `created_at` | `created_at`, `due_date`, `priority` |
| `sortOrder` | string | `desc` | `asc`, `desc` |
| `limit` | number | 20 | Max results |
| `offset` | number | 0 | Pagination offset |

**POST Request Body:**

Single assignee:
```json
{
  "title": "Review attendance records",
  "description": "Check last week's lab attendance for discrepancies",
  "assigned_to": "uuid",
  "due_date": "2026-03-05",
  "priority": "high",
  "related_link": "/lab-management/lab-days/uuid"
}
```

Multiple assignees (creates one task per assignee):
```json
{
  "title": "Complete scenario review",
  "assignee_ids": ["uuid1", "uuid2", "uuid3"],
  "completion_mode": "any_one",
  "due_date": "2026-03-10",
  "priority": "medium"
}
```

`completion_mode`: `any_one` (task complete when any assignee finishes) or `all` (all must finish).

Sends in-app notifications to all assignees on creation.

---

### Task Detail

```
GET    /api/tasks/[id]
PATCH  /api/tasks/[id]
DELETE /api/tasks/[id]
```

**Auth:** Any authenticated user (with ownership/assignment checks)

**PATCH Request Body:**
```json
{
  "status": "completed",
  "notes": "All records verified"
}
```

`status` values: `pending`, `in_progress`, `completed`, `cancelled`

Only the task creator (assigner) can delete or cancel tasks. Sends notifications to relevant parties on status change.

**DELETE** - Only available to the task creator.

---

### Task Comments

```
GET  /api/tasks/[id]/comments
POST /api/tasks/[id]/comments
```

**Auth:** Any authenticated user (task participants only)

**POST Request Body:**
```json
{
  "comment": "I reviewed the records - found 2 discrepancies in Lab 11."
}
```

Sends in-app notifications to all task participants.

---

### Bulk Task Operations

```
PATCH  /api/tasks/bulk
DELETE /api/tasks/bulk
```

**Auth:** Any authenticated user (with ownership checks)

Maximum 50 tasks per request.

**PATCH** - Bulk complete tasks:
```json
{
  "ids": ["uuid1", "uuid2", "uuid3"]
}
```

**DELETE** - Bulk delete tasks:
```json
{
  "ids": ["uuid1", "uuid2"]
}
```

---

## 8. Notifications

### List, Create, and Delete Notifications

```
GET    /api/notifications
POST   /api/notifications
DELETE /api/notifications
```

**Auth:** Any authenticated user (GET, DELETE), admin/system (POST)

**GET Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `unread` | boolean | — | Only unread notifications |
| `limit` | number | 20 | Max results |
| `offset` | number | 0 | Pagination offset |
| `category` | string | `all` | `tasks`, `labs`, `scheduling`, `feedback`, `clinical`, `system` |
| `applyPrefs` | boolean | false | Filter by user category preferences |
| `archived` | boolean | false | Show archived notifications |
| `search` | string | — | Search notification content |

**POST** - Create a notification (admin/system use):
```json
{
  "user_email": "instructor@pmi.edu",
  "title": "New task assigned",
  "message": "You have a new task: Review attendance",
  "type": "info",
  "category": "tasks",
  "link_url": "/tasks/uuid",
  "reference_type": "task",
  "reference_id": "uuid"
}
```

`type` values: `info`, `success`, `warning`, `error`

**DELETE** - Delete notifications:
```json
{ "all": true }
```
or
```json
{ "id": "uuid" }
```

---

### Mark Notifications as Read

```
PUT /api/notifications/read
```

**Auth:** Any authenticated user

**Request Body:**
```json
{ "id": "uuid" }
```
or mark all as read:
```json
{ "all": true }
```

---

### Archive Notifications

```
PUT /api/notifications/archive
```

**Auth:** Any authenticated user

**Request Body:**
```json
{
  "notification_ids": ["uuid1", "uuid2"],
  "action": "archive"
}
```

Set `"action": "unarchive"` to restore notifications.

---

### Digest Preview

```
GET /api/notifications/digest-preview
```

**Auth:** Any authenticated user

Returns an HTML preview of the daily digest email that would be sent to the current user based on their unread notifications.

---

## 9. Reports

### Attendance Report

```
GET /api/reports/attendance
```

**Auth:** instructor+

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `cohortId` | string | Filter by cohort |
| `startDate` | string | ISO date (inclusive) |
| `endDate` | string | ISO date (inclusive) |
| `studentId` | string | Single student report |
| `format` | string | `json` (default) or `csv` |

**Response:**
```json
{
  "success": true,
  "report": {
    "cohort_name": "Cohort 12",
    "period": { "start": "2026-01-01", "end": "2026-02-28" },
    "students": [
      {
        "id": "uuid",
        "name": "John Smith",
        "present": 8,
        "absent": 1,
        "excused": 1,
        "late": 0,
        "total_labs": 10,
        "attendance_rate": 80
      }
    ]
  }
}
```

---

## 10. Admin

### 10.1 Users

```
GET    /api/admin/users
POST   /api/admin/users
PATCH  /api/admin/users
DELETE /api/admin/users
```

**Auth:** admin+ (GET, POST, PATCH), superadmin (DELETE)

**GET Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `role` | string | Filter by role |
| `activeOnly` | boolean | Only active users |
| `limit` | number | Max results |
| `offset` | number | Pagination offset |

**POST** - Create a user:
```json
{
  "email": "newinstructor@pmi.edu",
  "name": "New Instructor",
  "role": "instructor"
}
```

**PATCH** - Update a user:
```json
{
  "userId": "uuid",
  "role": "lead_instructor",
  "is_active": true
}
```

**DELETE** - `?userId=uuid` (superadmin only)

---

### 10.2 Data Export

> **Logs to audit log**

```
GET  /api/admin/data-export
POST /api/admin/data-export
```

**Auth:** admin+

**GET** - Export data:

| Parameter | Type | Description |
|-----------|------|-------------|
| `type` | string | `cohort`, `students`, `labs`, `clinical`, `assessments`, `full_backup` |
| `format` | string | `csv` or `json` |
| `cohort_id` | string | Scope export to a cohort |
| `start_date` | string | Date range filter |
| `end_date` | string | Date range filter |

Returns file download (CSV or JSON).

**POST** - Returns recent export history:
```json
{
  "success": true,
  "exports": [
    {
      "id": "uuid",
      "type": "students",
      "format": "csv",
      "exported_by": "admin@pmi.edu",
      "exported_at": "2026-02-28T10:00:00Z",
      "row_count": 45
    }
  ]
}
```

---

### 10.3 System Alerts

```
GET   /api/admin/system-alerts
PATCH /api/admin/system-alerts
```

**Auth:** admin+

**GET Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `type` | string | Alert type filter |
| `severity` | string | `info`, `warning`, `error`, `critical` |
| `resolved` | boolean | Show resolved/unresolved |

**PATCH** - Resolve an alert:
```json
{
  "id": "uuid",
  "resolved": true
}
```

---

### 10.4 Stats

```
GET /api/admin/stats
```

**Auth:** superadmin

Returns system-wide counts:
```json
{
  "success": true,
  "stats": {
    "total_users": 42,
    "total_scenarios": 187,
    "total_students": 234,
    "total_lab_days": 96,
    "total_certifications": 58
  }
}
```

---

### 10.5 Database Tools

```
GET /api/admin/database-tools/stats
```

**Auth:** superadmin

Returns per-table row counts and storage sizes. Calls the `get_table_stats` PostgreSQL RPC function; falls back to manual COUNT queries if the RPC is unavailable.

**Response:**
```json
{
  "success": true,
  "tables": [
    {
      "table_name": "audit_log",
      "row_count": 15420,
      "total_size": "24 MB",
      "index_size": "4 MB",
      "table_size": "20 MB"
    }
  ],
  "source": "pg_stats"
}
```

`source` is `"pg_stats"` when using the RPC, or `"fallback"` when using manual counts (sizes will be `null` in fallback mode).

---

### 10.6 Audit Log

```
GET    /api/admin/audit-log
DELETE /api/admin/audit-log
```

**Auth:** superadmin

**GET Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `mode` | string | `default` | `default`, `stats`, `export` |
| `userEmail` | string | — | Filter by actor |
| `action` | string | — | Filter by action type |
| `resourceType` | string | — | Filter by resource (e.g., `student`, `lab_day`) |
| `startDate` | string | — | ISO date filter |
| `endDate` | string | — | ISO date filter |
| `search` | string | — | Full-text search |
| `page` | number | 1 | Page number |
| `limit` | number | 50 | Results per page |

`mode=stats` returns aggregate counts by action type and user.
`mode=export` returns all matching records as a downloadable file.

**DELETE** - Purge old audit records:

`?days=365` - Delete records older than N days (minimum 30 days).

---

### 10.7 Email Templates

```
GET    /api/admin/email-templates
PUT    /api/admin/email-templates
DELETE /api/admin/email-templates
```

**Auth:** admin+

Manages custom overrides for system email templates. Available template keys:

| Key | Description |
|-----|-------------|
| `task_assigned` | Notification when a task is assigned |
| `task_completed` | Notification when a task is marked complete |
| `lab_assigned` | Notification about a new lab day assignment |
| `lab_reminder` | Day-before lab reminder |
| `shift_available` | New open shift notification |
| `shift_confirmed` | Shift assignment confirmation |
| `site_visit_due` | Clinical site visit reminder |
| `daily_digest` | Daily digest email wrapper |

**PUT Request Body:**
```json
{
  "key": "task_assigned",
  "subject": "You have a new task: {{title}}",
  "body_html": "<p>Hello {{name}},</p>..."
}
```

**DELETE:** `?key=template_key` - Resets template to system default.

---

> **Email-sending:** `POST /api/admin/email-templates/[key]/test` sends a test email using the specified template.

---

### 10.8 Lab Templates

```
GET  /api/admin/lab-templates
POST /api/admin/lab-templates
```

**Auth:** lead_instructor+ (GET), admin+ (POST)

Pre-built lab day templates that can be applied when creating new lab days.

**GET Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `program` | string | Filter by program |
| `semester` | number | Filter by semester |

**POST Request Body:**
```json
{
  "program": "Paramedic",
  "semester": 2,
  "week_number": 6,
  "name": "Advanced Airway Week",
  "description": "Focus on RSI and surgical airway",
  "stations": [
    { "station_number": 1, "station_type": "skills", "scenario_id": "uuid" }
  ]
}
```

---

### 10.9 Certifications Import

> **File Upload**

```
POST /api/admin/certifications/import
```

**Auth:** admin+

Accepts a CSV file upload. Expected columns: `instructor_email`, `cert_type`, `issue_date`, `expiry_date`, `cert_number`.

Returns import summary with success/error counts.

---

## 11. Settings & Preferences

### 11.1 User Preferences

```
GET    /api/user/preferences
PUT    /api/user/preferences
DELETE /api/user/preferences
```

**Auth:** Any authenticated user

Stores per-user UI preferences.

**PUT Request Body:**
```json
{
  "dashboard_widgets": ["quick-stats", "recent-activity", "cert-expiry"],
  "quick_links": [
    { "label": "Today's Lab", "url": "/lab-management" }
  ],
  "notification_settings": {
    "sound": true,
    "desktop": false
  }
}
```

**DELETE** - Resets all preferences to defaults.

---

### 11.2 Notification Preferences

```
GET    /api/notifications/preferences
PUT    /api/notifications/preferences
DELETE /api/notifications/preferences
```

**Auth:** Any authenticated user

Controls which notification categories appear in the notification feed.

**PUT Request Body:**
```json
{
  "tasks": true,
  "labs": true,
  "scheduling": true,
  "feedback": false,
  "clinical": true,
  "system": true
}
```

**DELETE** - Resets to defaults (all categories enabled).

---

### 11.3 Email Preferences

```
GET /api/notifications/email-preferences
PUT /api/notifications/email-preferences
```

**Auth:** Any authenticated user

Controls whether and how notification emails are sent.

**PUT Request Body:**
```json
{
  "enabled": true,
  "mode": "daily_digest",
  "digest_time": "08:00",
  "categories": {
    "tasks": true,
    "labs": true,
    "scheduling": false,
    "clinical": true,
    "system": true
  }
}
```

`mode` values:
- `immediate` - Send email for each notification
- `daily_digest` - Bundle into one daily email
- `off` - No emails

---

## 12. Onboarding

### Task Progress

```
GET   /api/onboarding/tasks/[id]/progress
PATCH /api/onboarding/tasks/[id]/progress
```

**Auth:** instructor, mentor, or admin

Tracks completion of onboarding checklist items for new instructors.

**PATCH Request Body:**
```json
{
  "status": "completed",
  "notes": "Completed HIPAA training module"
}
```

The system enforces task dependencies — a task cannot be marked complete if its prerequisite tasks are unfinished. Tasks requiring sign-off cannot be self-completed; a mentor or admin must mark them complete.

**Response:**
```json
{
  "success": true,
  "task": {
    "id": "uuid",
    "title": "Complete HIPAA Training",
    "status": "completed",
    "completed_at": "2026-02-28T14:00:00Z",
    "signed_off_by": "mentor@pmi.edu"
  },
  "next_tasks": ["uuid2", "uuid3"]
}
```

---

## 13. Cron Jobs

All cron endpoints are protected by a `CRON_SECRET` Bearer token:

```
Authorization: Bearer <CRON_SECRET>
```

These are invoked by Vercel Cron or an external scheduler. All return HTTP 200 with a summary of actions taken.

---

### Lab Reminder

```
GET /api/cron/lab-reminder
```

**Schedule:** Daily at 5:00 PM UTC

Sends in-app notifications to students and instructors assigned to labs occurring the following day. Deduplicates within a 24-hour window to avoid repeat notifications.

**Response:**
```json
{
  "success": true,
  "notified": 12,
  "labs_tomorrow": 2,
  "skipped_duplicates": 0
}
```

---

### Daily Digest

> **Sends emails via Resend**

```
GET /api/cron/daily-digest
```

**Schedule:** Daily at 2:00 PM UTC (8:00 AM MST)

Sends digest emails to all users who have opted into `mode: "daily_digest"` email preferences. Bundles unread notifications from the past 24 hours into a single email.

**Response:**
```json
{
  "success": true,
  "emails_sent": 8,
  "users_skipped": 3,
  "errors": 0
}
```

---

### Certificate Expiry Check

```
GET /api/cron/cert-expiry
```

**Schedule:** Weekly, Mondays at 8:00 AM UTC

Checks preceptor SNHD certifications and instructor endorsements for upcoming expiration. Sends in-app notifications at the following thresholds: **90, 60, 30, and 14 days** before expiry.

**Response:**
```json
{
  "success": true,
  "checked": 45,
  "notifications_sent": 3
}
```

---

### Attendance Alerts

```
GET /api/cron/attendance-alerts
```

**Schedule:** Configurable (typically daily)

Identifies at-risk students based on absence patterns:
- **Warning:** 2 or more absences
- **Critical:** 3 or more total absences, OR 3 or more consecutive absences

**Response:**
```json
{
  "success": true,
  "at_risk_students": [
    {
      "student_id": "uuid",
      "student_name": "John Smith",
      "cohort": "Cohort 12",
      "absence_count": 3,
      "consecutive_absences": 2,
      "severity": "critical"
    }
  ]
}
```

---

### Compliance Expiry Check

```
GET /api/cron/compliance-expiry
```

**Schedule:** Daily at 8:00 AM UTC

Checks student clinical compliance documents (immunizations, background checks, etc.) for upcoming expiration. Sends notifications at **30, 14, and 7 days** before expiry.

**Response:**
```json
{
  "success": true,
  "documents_checked": 180,
  "notifications_sent": 4
}
```

---

### Internship Milestones

```
GET /api/cron/internship-milestones
```

**Schedule:** Daily at 9:00 AM UTC

Monitors active internships and sends notifications for upcoming milestones:

| Milestone | Trigger |
|-----------|---------|
| Phase 1 evaluation due | 30 days after internship start |
| Phase 2 evaluation due | 30 days before internship end |
| Closeout documentation due | 14, 7, and 3 days before end date |

**Response:**
```json
{
  "success": true,
  "internships_checked": 12,
  "notifications_sent": 2
}
```

---

### System Health Check

```
GET /api/cron/system-health
```

**Schedule:** Every hour

Performs automated system health checks and creates `system_alerts` records for any issues detected:

| Check | Description |
|-------|-------------|
| Storage | Monitors database storage usage |
| Cron health | Verifies recent cron job execution |
| Error rate | Checks `error_logs` for elevated error rates |
| Login anomalies | Detects unusual login patterns |
| Performance | Checks for slow query patterns |

**Response:**
```json
{
  "success": true,
  "checks_run": 5,
  "alerts_created": 0,
  "status": "healthy"
}
```

---

## 14. Error Logging

> **Rate-limited:** 10 requests/minute per user (or IP if unauthenticated)
> **Auth:** Optional (errors are logged from both authenticated and guest users)

```
POST /api/errors/log
```

Logs client-side errors caught by ErrorBoundary components. Always returns HTTP 200 to prevent the error reporter itself from causing cascading errors.

**Request Body:**
```json
{
  "error_message": "Cannot read property 'id' of undefined",
  "error_stack": "TypeError: Cannot read property...\n    at Component...",
  "component_name": "LabDayDetail",
  "url": "https://your-domain.com/lab-management/uuid"
}
```

Only `error_message` is required. Field length limits: `error_message` (2000 chars), `error_stack` (10000 chars), `url` and `component_name` (2000 and 255 chars respectively).

**Response:**
```json
{ "success": true }
```

Returns `{ "success": false, "error": "Rate limit exceeded" }` with HTTP 200 when rate-limited.

---

## 15. Access Requests

### List and Submit Requests

```
GET  /api/access-requests
POST /api/access-requests
```

**Auth:** admin+ (GET), public with rate limit (POST)

> **Rate-limited (POST):** 5 requests/minute per IP

**GET Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | string | `pending` (default) or `all` |

**POST** - Submit a new access request:
```json
{
  "email": "newuser@pmi.edu",
  "name": "New Instructor",
  "reason": "I am a new hire starting March 2026"
}
```

---

### Review a Request

```
PUT /api/access-requests/[id]
```

**Auth:** admin+

**Request Body:**
```json
{
  "action": "approve",
}
```

or to deny:
```json
{
  "action": "deny",
  "denial_reason": "Position not yet confirmed by HR"
}
```

Approving an access request creates the user account. Denying sends a notification to the requester.

---

### Check Your Request Status

```
GET /api/access-requests/status
```

**Auth:** Any authenticated user

Returns the current user's most recent access request and its status.

**Response:**
```json
{
  "success": true,
  "request": {
    "id": "uuid",
    "status": "pending",
    "submitted_at": "2026-02-20T09:00:00Z",
    "reviewed_at": null,
    "denial_reason": null
  }
}
```

---

*Last updated: 2026-02-28*

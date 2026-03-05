# Permission Audit Report

**Last Updated:** 2026-03-04
**Audited by:** Task 22 security audit

## Role Hierarchy

| Role | Level | Description |
|------|-------|-------------|
| superadmin | 5 | Full system access, deletion approvals, protected accounts |
| admin | 4 | User management (up to lead_instructor), system settings |
| lead_instructor | 3 | Clinical, cohort management, reports, compliance |
| instructor | 2 | Grading, scenarios, skills, students (read), lab operations |
| program_director | 1.75 | Affiliations CRUD only |
| volunteer_instructor | 1.5 | Own availability, view schedule |
| student | 1 | Own data only via Student Portal |
| guest | 1 | Minimal access |
| pending | 0 | Awaiting approval |

## Reusable Auth Utility

**File:** `lib/api-auth.ts`

```typescript
import { requireAuth } from '@/lib/api-auth';

export async function GET() {
  const auth = await requireAuth('instructor'); // specify minimum role
  if (auth instanceof NextResponse) return auth;
  const { user } = auth; // { id, name, email, role }
}
```

---

## API Routes

### Public / Token-Based (No Auth Required)

| Route | Methods | Purpose |
|-------|---------|---------|
| `/api/auth/[...nextauth]` | * | NextAuth OAuth callbacks |
| `/api/config/public` | GET | Public branding/feature flags |
| `/api/checkin/[token]` | GET, POST | Lab check-in (token validated) |
| `/api/clinical/preceptor-eval/[token]` | GET, POST | Preceptor evaluation (token validated) |
| `/api/preceptor/evaluate/[token]` | GET, POST | Preceptor evaluation form |
| `/api/timer-display/[token]` | GET | Timer display (token validated) |
| `/api/cron/*` | POST | Cron jobs (header token validated) |

### Student Only (role === 'student')

All routes under `/api/student/` filter by authenticated user's email. Students can only access their own data.

| Route | Methods | Data |
|-------|---------|------|
| `/api/student/my-progress` | GET | Own progress tracking |
| `/api/student/completions` | GET | Own station completions |
| `/api/student/profile` | GET, PUT | Own profile |
| `/api/student/available-labs` | GET | Labs open for signup |
| `/api/student/available-labs/signup` | POST | Sign up for lab |
| `/api/student/available-labs/cancel` | POST | Cancel signup |
| `/api/student/available-labs/my-signups` | GET | Own signups |
| `/api/student/documents` | GET | Own documents |
| `/api/student/documents/[id]` | PUT | Upload own document |
| `/api/student/documents/requests` | GET, POST | Own doc requests |
| `/api/student/attendance-appeals` | GET, POST | Own appeals |
| `/api/student/communication-preferences` | GET, PUT | Own preferences |
| `/api/student/ekg-scenarios` | GET | EKG practice scenarios |
| `/api/student/peer-eval` | GET, POST | Own peer evaluations |

### Any Authenticated User (session only)

Personal data scoped to current user — no role restriction needed.

| Route | Methods | Data |
|-------|---------|------|
| `/api/user/preferences` | GET, PUT, DELETE | Dashboard widget preferences |
| `/api/user-preferences/tour` | GET, POST | Tour completion state |
| `/api/settings/notifications` | GET, PUT | Notification preferences |
| `/api/settings/sessions` | GET | Own active sessions |
| `/api/settings/sessions/[id]` | DELETE | Revoke own session |
| `/api/settings/sessions/revoke-all` | POST | Revoke all own sessions |
| `/api/settings/2fa/*` | GET, POST | Own 2FA setup |
| `/api/notifications` | GET, PATCH | Own notifications |
| `/api/announcements` | GET | View announcements |
| `/api/announcements/[id]/read` | POST | Mark as read |
| `/api/instructor/me` | GET | Own user record |
| `/api/access-requests` | POST | Submit access request |
| `/api/access-requests/status` | GET | Own status only (admin can query any) |

### Instructor+ (level >= 2)

| Route | Methods | Min Role | Changed in Audit? |
|-------|---------|----------|-------------------|
| `/api/lab-management/cohorts` | GET | instructor | YES - was auth-only |
| `/api/lab-management/assessments/skill` | GET | instructor | YES - was auth-only |
| `/api/lab-management/assessments/scenario` | GET | instructor | YES - was auth-only |
| `/api/lab-management/attendance/at-risk` | GET | instructor | YES - was auth-only |
| `/api/lab-management/scenarios` | GET, POST | instructor | Existing |
| `/api/lab-management/scenarios/[id]` | GET, PUT, DELETE | instructor (DELETE=superadmin) | DELETE locked in Task 21 |
| `/api/lab-management/students` | GET | instructor | Existing |
| `/api/lab-management/students/[id]` | GET, PUT, DELETE | instructor (DELETE=superadmin) | DELETE locked in Task 21 |
| `/api/lab-management/lab-days` | GET, POST | instructor | Existing |
| `/api/lab-management/lab-days/[id]` | GET, PUT, DELETE | instructor (DELETE=superadmin) | DELETE locked in Task 21 |
| `/api/lab-management/stations/[id]` | GET, PUT, DELETE | instructor | Existing |
| `/api/skill-sheets/*` | GET, POST, PUT | instructor | Existing |
| `/api/stations/completions/*` | GET, POST | instructor | Existing |
| `/api/stations/pool/*` | GET, PUT | instructor | Existing |
| `/api/tasks` | GET, POST | instructor | Existing |
| `/api/tasks/[id]` | GET, PUT, DELETE | instructor | Existing |
| `/api/submissions` | POST | instructor | YES - was auth-only |
| `/api/users/list` | GET | instructor | YES - was auth-only |
| `/api/clinical/sites` | GET | instructor | YES - was auth-only |
| `/api/students/[id]/progress` | GET | instructor (students: own only) | Existing |

### Lead Instructor+ (level >= 3)

| Route | Methods | Min Role |
|-------|---------|----------|
| `/api/clinical/internships` | GET | lead_instructor |
| `/api/clinical/internships/[id]` | GET, PUT, DELETE | lead_instructor (DELETE=superadmin) |
| `/api/clinical/rotations` | GET, POST, PUT | lead_instructor |
| `/api/clinical/preceptors` | GET, POST | lead_instructor (GET open) |
| `/api/clinical/preceptors/[id]` | GET, PUT, DELETE | lead_instructor |
| `/api/clinical/site-visits/*` | GET, POST, PUT, DELETE | lead_instructor |
| `/api/clinical/summative-evaluations/*` | GET, POST, PUT | lead_instructor |
| `/api/clinical/capacity/check` | GET | lead_instructor | YES - was auth-only |
| `/api/clinical/overview-all` | GET | lead_instructor |
| `/api/clinical/planning-calendar` | GET | lead_instructor |
| `/api/lab-management/cohorts/[id]` | GET, PUT, DELETE | lead_instructor (DELETE=superadmin) |
| `/api/lab-management/competencies` | GET | lead_instructor |
| `/api/lab-management/custom-skills` | GET, POST, PUT, DELETE | lead_instructor |
| `/api/lab-management/ce-records/*` | GET, POST, PUT, DELETE | lead_instructor |
| `/api/admin/lab-templates/*` | GET, POST, PUT, DELETE | lead_instructor |

### Admin+ (level >= 4)

| Route | Methods | Min Role |
|-------|---------|----------|
| `/api/admin/users` | GET, POST, PATCH, DELETE | admin (DELETE=superadmin) |
| `/api/admin/alumni/*` | GET, POST, PUT, DELETE | admin |
| `/api/admin/broadcast/*` | GET, POST | admin |
| `/api/admin/bulk-operations/*` | GET, POST | admin |
| `/api/admin/certifications/*` | GET, POST, PUT | admin |
| `/api/admin/config` | GET, PUT | admin |
| `/api/admin/data-export` | GET, POST | admin |
| `/api/admin/deletion-requests` | GET, POST, PATCH | admin (PATCH=superadmin) |
| `/api/admin/document-requests/*` | GET, POST, PUT | admin |
| `/api/admin/email-templates/*` | GET, PUT, DELETE | admin |
| `/api/admin/endorsements` | GET, POST, DELETE | admin | YES - GET was auth-only |
| `/api/admin/equipment/*` | GET, POST, PUT, DELETE | admin |
| `/api/admin/incidents/*` | GET, POST, PUT | admin |
| `/api/admin/rubrics/*` | GET, POST, PUT, DELETE | admin |
| `/api/admin/scheduled-exports/*` | GET, POST, PUT, DELETE | admin |
| `/api/admin/system-alerts` | GET | admin |
| `/api/admin/user-activity/*` | GET | admin |
| `/api/admin/webhooks/*` | GET, POST, PUT, DELETE | admin |
| `/api/lab-management/certifications` | GET | admin | YES - was auth-only |

### Superadmin Only (level = 5)

| Route | Methods | Purpose |
|-------|---------|---------|
| `/api/admin/database-tools/*` | GET, PATCH, DELETE | DB maintenance |
| `/api/admin/audit-log` | DELETE | Clear audit logs |
| `/api/admin/deletion-requests` | PATCH | Approve/deny deletions |
| All core DELETE endpoints | DELETE | Students, cohorts, lab_days, scenarios, internships |

---

## Page Route Guards

| Page | Guard | Redirects To |
|------|-------|-------------|
| `/admin` | `canAccessAdmin` (admin+) | `/` |
| `/admin/users` | `canAccessAdmin` | `/` |
| `/admin/deletion-requests` | `canAccessAdmin` | `/` |
| `/clinical` | `canAccessClinical \|\| canAccessAffiliations` | `/` |
| `/clinical/affiliations` | `canAccessAffiliations` | `/` |
| `/lab-management` | `hasMinRole('instructor') \|\| canAccessScheduling` | `/` or `/lab-management/schedule` |
| `/lab-management/schedule` | `volunteer_instructor+` (level >= 1.5) | `/` |
| `/lab-management/students` | `instructor+` (level >= 2) | `/` |
| `/lab-management/scenarios` | `instructor+` (level >= 2) | `/` |
| `/scheduling` | `canAccessScheduling` | `/` |
| `/scheduler` | `hasMinRole('instructor')` | `/` |
| `/tasks` | `hasMinRole('instructor')` | `/` |
| `/calendar` | `canAccessScheduling` | `/` |
| `/instructor` | `hasMinRole('instructor')` | `/` |
| `/student` | `student \|\| admin+` (via layout.tsx) | `/` |
| `/reports/builder` | `hasMinRole('instructor')` | `/` |
| `/help` | Any authenticated user | `/` |
| `/resources` | Any authenticated user | `/` |
| `/settings` | Any authenticated user | `/` |
| `/onboarding` | Any authenticated (has own logic) | `/` |

---

## Security Changes Made in This Audit

### New Utility
- Created `lib/api-auth.ts` with `requireAuth(minRole)` helper

### API Routes Fixed (11 total)
1. `/api/lab-management/assessments/skill` - Added `instructor` guard
2. `/api/lab-management/assessments/scenario` - Added `instructor` guard
3. `/api/lab-management/attendance/at-risk` - Added `instructor` guard
4. `/api/lab-management/certifications` - Added `admin` guard
5. `/api/lab-management/cohorts` - Added `instructor` guard
6. `/api/clinical/capacity/check` - Added `lead_instructor` guard
7. `/api/access-requests/status` - Scoped to own email (admin can query any)
8. `/api/admin/endorsements` - Added `admin` guard on GET
9. `/api/clinical/sites` - Added `instructor` guard
10. `/api/submissions` - Added `instructor` guard
11. `/api/users/list` - Added `instructor` guard

### Page Guards Added (3 total)
1. `/lab-management/schedule` - Added `volunteer_instructor+` guard
2. `/lab-management/students` - Added `instructor+` guard
3. `/lab-management/scenarios` - Added `instructor+` guard

### Student Data Isolation (verified secure)
- All `/api/student/*` routes filter by authenticated user's email
- `/api/students/[id]/progress` validates student email match for non-instructor users

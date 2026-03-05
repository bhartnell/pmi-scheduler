# PMI EMS Scheduler -- API Permission Audit

Generated: 2026-03-05

## Summary

| Metric | Count |
|--------|-------|
| Total API routes | 359 |
| Routes with session/role auth | 352 |
| Cron/webhook routes (token-based) | 11 |
| Public/token routes (no session needed) | 6 |
| Routes WITHOUT any auth check | 1 |

## Role Distribution

| Min Role Required | Route Count |
|-------------------|-------------|
| superadmin | 33 |
| admin | 24 |
| lead_instructor | 42 |
| instructor | 51 |
| authenticated | 191 |
| cron_token | 11 |
| public (auth handler) | 1 |
| public (token-based) | 3 |
| NO AUTH | 3 |

## Route Details

### Admin (65 routes)

| Route | Methods | Current Auth | Min Role | Recommended | Notes |
|-------|---------|-------------|----------|-------------|-------|
| /api/admin/alumni/[id] | GET, PUT, DELETE | getServerSession | authenticated | admin | REVIEW - admin route with only session check |
| /api/admin/alumni | GET, POST | getServerSession | authenticated | admin | REVIEW - admin route with only session check |
| /api/admin/attendance-appeals/[id] | PUT | getServerSession | authenticated | admin | REVIEW - admin route with only session check |
| /api/admin/attendance-appeals | GET | getServerSession | authenticated | admin | REVIEW - admin route with only session check |
| /api/admin/audit-log | GET, DELETE | getServerSession, isSuperadmin | superadmin | admin | OK |
| /api/admin/broadcast/history | GET | getServerSession | authenticated | admin | REVIEW - admin route with only session check |
| /api/admin/broadcast | POST, GET | getServerSession | authenticated | admin | REVIEW - admin route with only session check |
| /api/admin/bulk-operations/[id]/rollback | POST | getServerSession | authenticated | admin | REVIEW - admin route with only session check |
| /api/admin/bulk-operations | GET, POST | getServerSession | authenticated | admin | REVIEW - admin route with only session check |
| /api/admin/certification-compliance | GET | getServerSession | authenticated | admin | REVIEW - admin route with only session check |
| /api/admin/certifications/import | POST | getServerSession | authenticated | admin | REVIEW - admin route with only session check |
| /api/admin/certifications | GET | getServerSession | authenticated | admin | REVIEW - admin route with only session check |
| /api/admin/certifications/verify | PUT | getServerSession | authenticated | admin | REVIEW - admin route with only session check |
| /api/admin/config | GET, PUT | getServerSession | authenticated | admin | REVIEW - admin route with only session check |
| /api/admin/dashboard-defaults | GET, PUT | getServerSession, hasMinRole('admin') | admin | admin | OK |
| /api/admin/data-export | GET, POST | getServerSession | authenticated | admin | REVIEW - admin route with only session check |
| /api/admin/database-tools/audit-logs | GET, DELETE | getServerSession, isSuperadmin | superadmin | admin | OK |
| /api/admin/database-tools/cohorts | GET, PATCH | getServerSession, isSuperadmin | superadmin | admin | OK |
| /api/admin/database-tools/notifications | GET, DELETE | getServerSession, isSuperadmin | superadmin | admin | OK |
| /api/admin/database-tools/orphans | GET, DELETE | getServerSession, isSuperadmin | superadmin | admin | OK |
| /api/admin/database-tools/stats | GET | getServerSession, isSuperadmin | superadmin | admin | OK |
| /api/admin/deletion-requests | GET, POST, PATCH | getServerSession, isSuperadmin | superadmin | admin | OK |
| /api/admin/document-requests/[id] | PUT | getServerSession | authenticated | admin | REVIEW - admin route with only session check |
| /api/admin/document-requests | GET, POST | getServerSession | authenticated | admin | REVIEW - admin route with only session check |
| /api/admin/email-templates | GET, PUT, DELETE | getServerSession | authenticated | admin | REVIEW - admin route with only session check |
| /api/admin/email-templates/test | POST | getServerSession | authenticated | admin | REVIEW - admin route with only session check |
| /api/admin/endorsements | GET, POST, DELETE | getServerSession, requireAuth, superadmin_check, admin_check | superadmin | admin | OK |
| /api/admin/equipment/checkout | GET, POST, PUT | getServerSession | authenticated | admin | REVIEW - admin route with only session check |
| /api/admin/equipment/maintenance/[id] | PUT, DELETE | getServerSession | authenticated | admin | REVIEW - admin route with only session check |
| /api/admin/equipment/maintenance | GET, POST | getServerSession | authenticated | admin | REVIEW - admin route with only session check |
| /api/admin/equipment | GET, POST, PATCH, DELETE | getServerSession | authenticated | admin | REVIEW - admin route with only session check |
| /api/admin/feedback/import | POST | getServerSession, superadmin_check, admin_check | superadmin | admin | OK |
| /api/admin/guests | GET, POST, PATCH, DELETE | getServerSession | authenticated | admin | REVIEW - admin route with only session check |
| /api/admin/incidents/[id] | GET, PUT | getServerSession | authenticated | admin | REVIEW - admin route with only session check |
| /api/admin/incidents | GET, POST | getServerSession | authenticated | admin | REVIEW - admin route with only session check |
| /api/admin/lab-templates/[id] | GET, PUT, DELETE | getServerSession, hasMinRole('lead_instructor') | lead_instructor | admin | OK |
| /api/admin/lab-templates/[id]/versions | GET, POST | getServerSession, hasMinRole('lead_instructor') | lead_instructor | admin | OK |
| /api/admin/lab-templates/apply | POST | getServerSession | authenticated | admin | REVIEW - admin route with only session check |
| /api/admin/lab-templates/compare | GET | getServerSession, hasMinRole('lead_instructor') | lead_instructor | admin | OK |
| /api/admin/lab-templates/import | POST | getServerSession | authenticated | admin | REVIEW - admin route with only session check |
| /api/admin/lab-templates | GET, POST | getServerSession, hasMinRole('lead_instructor') | lead_instructor | admin | OK |
| /api/admin/lab-templates/seed | POST | getServerSession | authenticated | admin | REVIEW - admin route with only session check |
| /api/admin/lab-templates/update-from-lab | POST | getServerSession | authenticated | admin | REVIEW - admin route with only session check |
| /api/admin/program-requirements | GET, POST | getServerSession, hasMinRole('admin') | admin | admin | OK |
| /api/admin/rubrics/[id] | GET, PUT, DELETE | getServerSession | authenticated | admin | REVIEW - admin route with only session check |
| /api/admin/rubrics | GET, POST | getServerSession | authenticated | admin | REVIEW - admin route with only session check |
| /api/admin/scenarios/audit | GET | getServerSession | authenticated | admin | REVIEW - admin route with only session check |
| /api/admin/scenarios/transform | GET, POST | getServerSession | authenticated | admin | REVIEW - admin route with only session check |
| /api/admin/scheduled-exports/[id] | PUT, DELETE | getServerSession | authenticated | admin | REVIEW - admin route with only session check |
| /api/admin/scheduled-exports | GET, POST | getServerSession | authenticated | admin | REVIEW - admin route with only session check |
| /api/admin/skill-drills/seed | POST | getServerSession | authenticated | admin | REVIEW - admin route with only session check |
| /api/admin/skill-sheets/counts | GET | getServerSession | authenticated | admin | REVIEW - admin route with only session check |
| /api/admin/skill-sheets/import | POST | getServerSession | authenticated | admin | REVIEW - admin route with only session check |
| /api/admin/skill-sheets/seed-aliases | POST | getServerSession | authenticated | admin | REVIEW - admin route with only session check |
| /api/admin/skill-sheets/seed-canonical | POST | getServerSession | authenticated | admin | REVIEW - admin route with only session check |
| /api/admin/stats | GET | getServerSession, superadmin_check | superadmin | admin | OK |
| /api/admin/system-alerts | GET, PATCH | getServerSession | authenticated | admin | REVIEW - admin route with only session check |
| /api/admin/system-health | GET | getServerSession, hasMinRole('admin') | admin | admin | OK |
| /api/admin/user-activity/log | POST | getServerSession | authenticated | admin | REVIEW - admin route with only session check |
| /api/admin/user-activity | GET | getServerSession | authenticated | admin | REVIEW - admin route with only session check |
| /api/admin/users | GET, POST, PATCH, DELETE | getServerSession, superadmin_check, admin_check | superadmin | admin | OK |
| /api/admin/webhooks/[id]/logs | GET | getServerSession | authenticated | admin | REVIEW - admin route with only session check |
| /api/admin/webhooks/[id] | GET, PUT, DELETE | getServerSession | authenticated | admin | REVIEW - admin route with only session check |
| /api/admin/webhooks/[id]/test | POST | getServerSession | authenticated | admin | REVIEW - admin route with only session check |
| /api/admin/webhooks | GET, POST | getServerSession | authenticated | admin | REVIEW - admin route with only session check |

### Clinical (43 routes)

| Route | Methods | Current Auth | Min Role | Recommended | Notes |
|-------|---------|-------------|----------|-------------|-------|
| /api/clinical/aemt-tracking | GET, POST | getServerSession, hasMinRole('lead_instructor') | lead_instructor | instructor | OK |
| /api/clinical/affiliations | GET, POST, PUT, DELETE | getServerSession | authenticated | instructor | OK |
| /api/clinical/agencies/[id] | GET, PUT, DELETE | getServerSession | authenticated | instructor | OK |
| /api/clinical/agencies | GET, POST | getServerSession | authenticated | instructor | OK |
| /api/clinical/capacity/check | GET | requireAuth | authenticated | instructor | OK |
| /api/clinical/capacity | GET, PATCH | getServerSession, hasMinRole('lead_instructor'), hasMinRole('admin') | admin | instructor | OK |
| /api/clinical/compliance | GET, POST | getServerSession, hasMinRole('lead_instructor') | lead_instructor | instructor | OK |
| /api/clinical/emt-tracking | GET, POST | getServerSession, hasMinRole('lead_instructor') | lead_instructor | instructor | OK |
| /api/clinical/hours | GET, POST | getServerSession, hasMinRole('lead_instructor') | lead_instructor | instructor | OK |
| /api/clinical/internships/[id]/closeout/documents | POST, DELETE | getServerSession, hasMinRole('lead_instructor') | lead_instructor | lead_instructor | OK |
| /api/clinical/internships/[id]/closeout/employment | GET, POST, PUT, DELETE | getServerSession, hasMinRole('lead_instructor'), hasMinRole('admin') | admin | lead_instructor | OK |
| /api/clinical/internships/[id]/closeout | GET, PATCH, POST | getServerSession, hasMinRole('lead_instructor'), hasMinRole('admin') | admin | lead_instructor | OK |
| /api/clinical/internships/[id]/closeout/summary | GET | getServerSession, hasMinRole('lead_instructor') | lead_instructor | lead_instructor | OK |
| /api/clinical/internships/[id]/closeout/surveys | GET, POST, PUT, DELETE | getServerSession, hasMinRole('lead_instructor') | lead_instructor | lead_instructor | OK |
| /api/clinical/internships/[id]/notify-nremt | POST | getServerSession, hasMinRole('lead_instructor') | lead_instructor | lead_instructor | OK |
| /api/clinical/internships/[id]/preceptors/[assignmentId] | PUT, DELETE | getServerSession | authenticated | lead_instructor | OK |
| /api/clinical/internships/[id]/preceptors | GET, POST, PATCH | getServerSession | authenticated | lead_instructor | OK |
| /api/clinical/internships/[id] | GET, PUT, DELETE | getServerSession, hasMinRole('lead_instructor'), isSuperadmin | superadmin | lead_instructor | OK |
| /api/clinical/internships | GET, POST | getServerSession, hasMinRole('lead_instructor') | lead_instructor | lead_instructor | OK |
| /api/clinical/mce | GET, POST | getServerSession, hasMinRole('lead_instructor') | lead_instructor | instructor | OK |
| /api/clinical/overview-all | GET | getServerSession, hasMinRole('lead_instructor') | lead_instructor | instructor | OK |
| /api/clinical/planning-calendar | GET, POST, PUT, DELETE | getServerSession, hasMinRole('lead_instructor') | lead_instructor | instructor | OK |
| /api/clinical/preceptor-eval/[token] | GET, POST | none | public (token-based) | public (token-based) | Token-based access |
| /api/clinical/preceptor-eval/send | POST | getServerSession, hasMinRole('lead_instructor') | lead_instructor | lead_instructor | OK |
| /api/clinical/preceptor-eval/tokens | GET | getServerSession, hasMinRole('lead_instructor') | lead_instructor | lead_instructor | OK |
| /api/clinical/preceptor-feedback | GET, POST, PUT | getServerSession, hasMinRole('instructor') | instructor | lead_instructor | OK |
| /api/clinical/preceptors/[id] | GET, PUT, DELETE | getServerSession | authenticated | lead_instructor | OK |
| /api/clinical/preceptors | GET, POST | getServerSession, hasMinRole('lead_instructor') | lead_instructor | lead_instructor | OK |
| /api/clinical/rotations/[id] | DELETE, PATCH | getServerSession, requireRole('lead_instructor') | lead_instructor | instructor | OK |
| /api/clinical/rotations | GET, POST | getServerSession, requireRole('lead_instructor') | lead_instructor | instructor | OK |
| /api/clinical/site-visits/[id] | GET, PUT, DELETE | getServerSession | authenticated | instructor | OK |
| /api/clinical/site-visits/coverage | GET, POST | getServerSession | authenticated | instructor | OK |
| /api/clinical/site-visits/export | GET | getServerSession | authenticated | instructor | OK |
| /api/clinical/site-visits | GET, POST | getServerSession, hasMinRole('lead_instructor') | lead_instructor | instructor | OK |
| /api/clinical/sites/[id]/departments | GET, POST, DELETE | getServerSession | authenticated | instructor | OK |
| /api/clinical/sites/[id] | GET, PUT, DELETE | getServerSession | authenticated | instructor | OK |
| /api/clinical/sites | GET, POST | getServerSession, requireAuth | authenticated | instructor | OK |
| /api/clinical/summative-evaluations/[id]/export | GET | getServerSession | authenticated | instructor | OK |
| /api/clinical/summative-evaluations/[id] | GET, PATCH, DELETE | getServerSession | authenticated | instructor | OK |
| /api/clinical/summative-evaluations/[id]/scenario-print | GET | getServerSession | authenticated | instructor | OK |
| /api/clinical/summative-evaluations/[id]/scores | POST, PATCH, DELETE | getServerSession | authenticated | instructor | OK |
| /api/clinical/summative-evaluations | GET, POST | getServerSession, hasMinRole('lead_instructor') | lead_instructor | instructor | OK |
| /api/clinical/summative-scenarios | GET | getServerSession | authenticated | instructor | OK |

### Lab Management (99 routes)

| Route | Methods | Current Auth | Min Role | Recommended | Notes |
|-------|---------|-------------|----------|-------------|-------|
| /api/lab-management/assessments/scenario | GET, POST | getServerSession, requireAuth | authenticated | instructor | OK |
| /api/lab-management/assessments/skill | GET, POST | getServerSession, requireAuth | authenticated | instructor | OK |
| /api/lab-management/attendance/at-risk | GET | requireAuth | authenticated | instructor | OK |
| /api/lab-management/ce-records/[id] | DELETE | getServerSession, superadmin_check, admin_check | superadmin | instructor | OK |
| /api/lab-management/ce-records | GET, POST | getServerSession, superadmin_check, admin_check | superadmin | instructor | OK |
| /api/lab-management/ce-requirements | GET | getServerSession | authenticated | instructor | OK |
| /api/lab-management/certifications/[id] | GET, PATCH, DELETE | getServerSession | authenticated | instructor | OK |
| /api/lab-management/certifications | GET, POST | getServerSession, requireAuth, admin_check | admin | instructor | OK |
| /api/lab-management/checklist-templates | GET, POST, PUT, DELETE | requireAuth | authenticated | instructor | OK |
| /api/lab-management/cohorts/[id]/archive | POST, DELETE | getServerSession, hasMinRole('admin') | admin | instructor | OK |
| /api/lab-management/cohorts/[id]/calendar | GET | getServerSession, hasMinRole('instructor') | instructor | instructor | OK |
| /api/lab-management/cohorts/[id]/completion | GET | getServerSession, hasMinRole('lead_instructor') | lead_instructor | instructor | OK |
| /api/lab-management/cohorts/[id]/email | POST | getServerSession, hasMinRole('lead_instructor') | lead_instructor | instructor | OK |
| /api/lab-management/cohorts/[id] | GET, PATCH, DELETE | getServerSession, isSuperadmin | superadmin | instructor | OK |
| /api/lab-management/cohorts/[id]/stats | GET | getServerSession | authenticated | instructor | OK |
| /api/lab-management/cohorts | GET, POST | getServerSession, requireAuth | authenticated | instructor | OK |
| /api/lab-management/competencies/report | GET | getServerSession, hasMinRole('instructor') | instructor | instructor | OK |
| /api/lab-management/competencies | GET, POST | getServerSession, hasMinRole('instructor') | instructor | instructor | OK |
| /api/lab-management/costs/[id] | PUT, DELETE | getServerSession, hasMinRole('instructor') | instructor | instructor | OK |
| /api/lab-management/costs | GET, POST | getServerSession, hasMinRole('instructor') | instructor | instructor | OK |
| /api/lab-management/custom-skills | GET, POST, DELETE | getServerSession | authenticated | instructor | OK |
| /api/lab-management/daily-notes | GET, POST | getServerSession | authenticated | instructor | OK |
| /api/lab-management/field-trips/attendance | GET, POST, PATCH | getServerSession | authenticated | instructor | OK |
| /api/lab-management/field-trips | GET, POST, DELETE | getServerSession | authenticated | instructor | OK |
| /api/lab-management/flagged-items | GET, PATCH | getServerSession | authenticated | instructor | OK |
| /api/lab-management/groups/[id]/members | GET, PUT, POST, DELETE | getServerSession | authenticated | instructor | OK |
| /api/lab-management/groups/[id] | GET, PUT, DELETE | getServerSession | authenticated | instructor | OK |
| /api/lab-management/groups/generate | POST | getServerSession | authenticated | instructor | OK |
| /api/lab-management/groups | GET, POST, PUT | getServerSession | authenticated | instructor | OK |
| /api/lab-management/instructors | GET | getServerSession | authenticated | instructor | OK |
| /api/lab-management/lab-day-roles | GET, POST, DELETE | getServerSession | authenticated | instructor | OK |
| /api/lab-management/lab-day-skills | GET | getServerSession | authenticated | instructor | OK |
| /api/lab-management/lab-days/[id]/attendance/absences | GET | getServerSession, hasMinRole('instructor') | instructor | instructor | OK |
| /api/lab-management/lab-days/[id]/attendance | GET, PUT, POST | getServerSession, hasMinRole('instructor') | instructor | instructor | OK |
| /api/lab-management/lab-days/[id]/checkin-token | POST, DELETE | getServerSession, hasMinRole('instructor') | instructor | instructor | OK |
| /api/lab-management/lab-days/[id]/checklist | GET, POST, PUT, DELETE | getServerSession, hasMinRole('instructor') | instructor | instructor | OK |
| /api/lab-management/lab-days/[id]/debrief | GET, POST, PUT | getServerSession, hasMinRole('instructor') | instructor | instructor | OK |
| /api/lab-management/lab-days/[id]/duplicate-bulk | POST | getServerSession, hasMinRole('instructor') | instructor | instructor | OK |
| /api/lab-management/lab-days/[id]/duplicate | POST | getServerSession, hasMinRole('instructor') | instructor | instructor | OK |
| /api/lab-management/lab-days/[id]/equipment | GET, POST, PUT, DELETE | getServerSession, hasMinRole('instructor') | instructor | instructor | OK |
| /api/lab-management/lab-days/[id]/ratings | GET, POST | getServerSession, hasMinRole('instructor') | instructor | instructor | OK |
| /api/lab-management/lab-days/[id]/roster | GET | getServerSession, hasMinRole('instructor') | instructor | instructor | OK |
| /api/lab-management/lab-days/[id] | GET, PATCH, DELETE | getServerSession, hasMinRole('instructor'), isSuperadmin | superadmin | instructor | OK |
| /api/lab-management/lab-days | GET, POST | getServerSession, hasMinRole('instructor') | instructor | instructor | OK |
| /api/lab-management/lab-days/templates | GET | getServerSession, hasMinRole('instructor') | instructor | instructor | OK |
| /api/lab-management/learning-style-report | GET | getServerSession, hasMinRole('instructor') | instructor | instructor | OK |
| /api/lab-management/locations | GET | getServerSession | authenticated | instructor | OK |
| /api/lab-management/mentorship/[id]/logs | GET, POST | getServerSession, hasMinRole('instructor') | instructor | instructor | OK |
| /api/lab-management/mentorship/[id] | GET, PUT | getServerSession, hasMinRole('instructor') | instructor | instructor | OK |
| /api/lab-management/mentorship | GET, POST | getServerSession, hasMinRole('instructor') | instructor | instructor | OK |
| /api/lab-management/programs | GET | getServerSession | authenticated | instructor | OK |
| /api/lab-management/request-coverage | POST | getServerSession | authenticated | instructor | OK |
| /api/lab-management/scenario-library/clone | POST | getServerSession | authenticated | instructor | OK |
| /api/lab-management/scenario-library/favorites | POST, DELETE | none | NO AUTH | instructor | SECURITY GAP |
| /api/lab-management/scenario-library/ratings | POST, DELETE | getServerSession | authenticated | instructor | OK |
| /api/lab-management/scenario-library | GET | getServerSession | authenticated | instructor | OK |
| /api/lab-management/scenario-library/tags | GET, POST, DELETE | getServerSession | authenticated | instructor | OK |
| /api/lab-management/scenarios/[id]/difficulty-recommendation | GET, POST | getServerSession, hasMinRole('instructor'), hasMinRole('lead_instructor') | lead_instructor | instructor | OK |
| /api/lab-management/scenarios/[id]/duplicate | POST | getServerSession | authenticated | instructor | OK |
| /api/lab-management/scenarios/[id] | GET, PATCH, DELETE | getServerSession, isSuperadmin | superadmin | instructor | OK |
| /api/lab-management/scenarios/[id]/versions | GET, POST, PUT | getServerSession, hasMinRole('instructor'), hasMinRole('lead_instructor') | lead_instructor | instructor | OK |
| /api/lab-management/scenarios/favorites | GET, POST, DELETE | getServerSession | authenticated | instructor | OK |
| /api/lab-management/scenarios/import | POST | getServerSession | authenticated | instructor | OK |
| /api/lab-management/scenarios | GET, POST | getServerSession | authenticated | instructor | OK |
| /api/lab-management/schedule/conflicts | POST | getServerSession, hasMinRole('instructor') | instructor | instructor | OK |
| /api/lab-management/schedule/suggestions | GET | getServerSession | authenticated | instructor | OK |
| /api/lab-management/skill-drills/[id]/documents | GET, POST, DELETE, PATCH | getServerSession | authenticated | instructor | OK |
| /api/lab-management/skill-drills/[id] | GET, PUT, DELETE | getServerSession, hasMinRole('instructor'), hasMinRole('admin') | admin | instructor | OK |
| /api/lab-management/skill-drills | GET, POST | getServerSession, hasMinRole('instructor') | instructor | instructor | OK |
| /api/lab-management/skill-signoffs | GET, POST, PUT | getServerSession, hasMinRole('instructor'), hasMinRole('lead_instructor') | lead_instructor | instructor | OK |
| /api/lab-management/skills/[id]/documents | GET, POST, DELETE, PATCH | getServerSession | authenticated | instructor | OK |
| /api/lab-management/skills | GET, POST | getServerSession | authenticated | instructor | OK |
| /api/lab-management/station-instructors | GET, POST, DELETE | getServerSession | authenticated | instructor | OK |
| /api/lab-management/station-skills | GET, POST, DELETE | getServerSession | authenticated | instructor | OK |
| /api/lab-management/stations/[id]/documents | POST, DELETE | getServerSession | authenticated | instructor | OK |
| /api/lab-management/stations/[id] | GET, PATCH, DELETE | getServerSession | authenticated | instructor | OK |
| /api/lab-management/stations | GET, POST | getServerSession | authenticated | instructor | OK |
| /api/lab-management/students/[id]/clinical-tasks | GET | getServerSession | authenticated | instructor | OK |
| /api/lab-management/students/[id]/communications | GET, POST, PATCH | getServerSession, hasMinRole('instructor') | instructor | instructor | OK |
| /api/lab-management/students/[id]/learning-plan/notes | POST | getServerSession, hasMinRole('lead_instructor') | lead_instructor | instructor | OK |
| /api/lab-management/students/[id]/learning-plan | GET, POST | getServerSession, hasMinRole('lead_instructor') | lead_instructor | instructor | OK |
| /api/lab-management/students/[id]/notes | GET, POST, PUT, DELETE | getServerSession, hasMinRole('instructor'), hasMinRole('lead_instructor') | lead_instructor | instructor | OK |
| /api/lab-management/students/[id]/photo | POST, DELETE | getServerSession | authenticated | instructor | OK |
| /api/lab-management/students/[id]/portfolio | GET | getServerSession, hasMinRole('instructor') | instructor | instructor | OK |
| /api/lab-management/students/[id]/ratings | GET | getServerSession, hasMinRole('instructor') | instructor | instructor | OK |
| /api/lab-management/students/[id] | GET, PATCH, DELETE | getServerSession, hasMinRole('instructor'), isSuperadmin | superadmin | instructor | OK |
| /api/lab-management/students/check-duplicates | POST | getServerSession | authenticated | instructor | OK |
| /api/lab-management/students/import | GET, POST | getServerSession, hasMinRole('instructor') | instructor | instructor | OK |
| /api/lab-management/students/notes-summary | GET | getServerSession, hasMinRole('instructor') | instructor | instructor | OK |
| /api/lab-management/students | GET, POST | getServerSession, hasMinRole('instructor') | instructor | instructor | OK |
| /api/lab-management/team-leads | GET, POST | getServerSession, hasMinRole('instructor') | instructor | instructor | OK |
| /api/lab-management/templates/[id] | GET, PUT, DELETE | getServerSession | authenticated | instructor | OK |
| /api/lab-management/templates | GET, POST | getServerSession | authenticated | instructor | OK |
| /api/lab-management/timer-displays/[id] | PATCH, DELETE | getServerSession | authenticated | instructor | OK |
| /api/lab-management/timer-displays | GET, POST | getServerSession | authenticated | instructor | OK |
| /api/lab-management/timer/active | GET | getServerSession | authenticated | instructor | OK |
| /api/lab-management/timer/ready | GET, POST, PATCH, DELETE | getServerSession | authenticated | instructor | OK |
| /api/lab-management/timer | GET, POST, DELETE, PATCH | getServerSession | authenticated | instructor | OK |
| /api/lab-management/users | GET, POST, PATCH | getServerSession, superadmin_check, admin_check | superadmin | instructor | OK |

### Scheduling (23 routes)

| Route | Methods | Current Auth | Min Role | Recommended | Notes |
|-------|---------|-------------|----------|-------------|-------|
| /api/scheduling/availability-status | GET | getServerSession, hasMinRole('lead_instructor') | lead_instructor | authenticated | OK |
| /api/scheduling/availability/[id] | PUT, DELETE | getServerSession | authenticated | authenticated | OK |
| /api/scheduling/availability/all | GET | getServerSession, hasMinRole('lead_instructor') | lead_instructor | authenticated | OK |
| /api/scheduling/availability/bulk | POST, DELETE | getServerSession | authenticated | authenticated | OK |
| /api/scheduling/availability | GET, POST | getServerSession | authenticated | authenticated | OK |
| /api/scheduling/availability/suggestions | GET | getServerSession | authenticated | authenticated | OK |
| /api/scheduling/reports | GET | getServerSession | authenticated | authenticated | OK |
| /api/scheduling/resource-bookings/[id] | PUT, DELETE | getServerSession, hasMinRole('admin') | admin | authenticated | OK |
| /api/scheduling/resource-bookings/resources | GET, POST, PATCH | getServerSession, hasMinRole('admin') | admin | authenticated | OK |
| /api/scheduling/resource-bookings | GET, POST | getServerSession, hasMinRole('instructor') | instructor | authenticated | OK |
| /api/scheduling/send-availability-reminders | POST | getServerSession, hasMinRole('lead_instructor') | lead_instructor | authenticated | OK |
| /api/scheduling/shifts/[id] | GET, PUT, DELETE | getServerSession, superadmin_check, admin_check | superadmin | authenticated | OK |
| /api/scheduling/shifts/[id]/signup/[signupId] | POST | getServerSession, superadmin_check, admin_check | superadmin | authenticated | OK |
| /api/scheduling/shifts/[id]/signup | POST, DELETE | getServerSession | authenticated | authenticated | OK |
| /api/scheduling/shifts | GET, POST | getServerSession, superadmin_check, admin_check | superadmin | authenticated | OK |
| /api/scheduling/signups/pending | GET | getServerSession, superadmin_check, admin_check | superadmin | authenticated | OK |
| /api/scheduling/substitute-requests/[id] | PUT, DELETE | getServerSession, hasMinRole('instructor'), hasMinRole('lead_instructor'), hasMinRole('admin') | admin | authenticated | OK |
| /api/scheduling/substitute-requests | GET, POST | getServerSession, hasMinRole('lead_instructor'), hasMinRole('instructor') | lead_instructor | authenticated | OK |
| /api/scheduling/swaps/[id]/assign | PUT | getServerSession, superadmin_check, admin_check | superadmin | authenticated | OK |
| /api/scheduling/swaps/[id]/interest | GET, POST, DELETE | getServerSession | authenticated | authenticated | OK |
| /api/scheduling/team-availability | GET, POST | getServerSession | authenticated | authenticated | OK |
| /api/scheduling/team-availability/saved | GET, DELETE | getServerSession | authenticated | authenticated | OK |
| /api/scheduling/trades | GET, POST, PUT | getServerSession, superadmin_check, admin_check | superadmin | authenticated | OK |

### Reports (17 routes)

| Route | Methods | Current Auth | Min Role | Recommended | Notes |
|-------|---------|-------------|----------|-------------|-------|
| /api/reports/attendance | GET | getServerSession, hasMinRole('lead_instructor') | lead_instructor | instructor | OK |
| /api/reports/availability-patterns | GET | getServerSession, hasMinRole('lead_instructor') | lead_instructor | instructor | OK |
| /api/reports/builder/[id] | GET | getServerSession, hasMinRole('instructor'), hasMinRole('admin') | admin | instructor | OK |
| /api/reports/builder | GET, POST, PUT, DELETE | getServerSession, hasMinRole('instructor'), hasMinRole('admin') | admin | instructor | OK |
| /api/reports/clinical-hours | GET | getServerSession | authenticated | instructor | OK |
| /api/reports/closeout-surveys | GET | getServerSession, hasMinRole('admin') | admin | instructor | OK |
| /api/reports/cohort-comparison | POST | getServerSession, hasMinRole('lead_instructor') | lead_instructor | instructor | OK |
| /api/reports/gradebook | GET | getServerSession, hasMinRole('instructor') | instructor | instructor | OK |
| /api/reports/instructor-workload | GET | getServerSession, hasMinRole('lead_instructor') | lead_instructor | instructor | OK |
| /api/reports/internship-status | GET | getServerSession | authenticated | instructor | OK |
| /api/reports/lab-progress | GET | getServerSession | authenticated | instructor | OK |
| /api/reports/onboarding-status | GET | getServerSession | authenticated | instructor | OK |
| /api/reports/program-outcomes | GET, POST, DELETE | getServerSession, hasMinRole('lead_instructor'), hasMinRole('admin') | admin | instructor | OK |
| /api/reports/scenario-analytics | GET | getServerSession, hasMinRole('lead_instructor') | lead_instructor | instructor | OK |
| /api/reports/scenario-usage | GET | getServerSession, hasMinRole('lead_instructor') | lead_instructor | instructor | OK |
| /api/reports/student-progress | GET | getServerSession | authenticated | instructor | OK |
| /api/reports/team-leads | GET | getServerSession | authenticated | instructor | OK |

### Instructor (10 routes)

| Route | Methods | Current Auth | Min Role | Recommended | Notes |
|-------|---------|-------------|----------|-------------|-------|
| /api/instructor/ce-records/[id] | DELETE | getServerSession, superadmin_check, admin_check | superadmin | instructor | OK |
| /api/instructor/ce-records | GET, POST | getServerSession, superadmin_check, admin_check | superadmin | instructor | OK |
| /api/instructor/history | GET | getServerSession | authenticated | instructor | OK |
| /api/instructor/me | GET | getServerSession | authenticated | instructor | OK |
| /api/instructor/my-stats | GET | getServerSession, hasMinRole('instructor') | instructor | instructor | OK |
| /api/instructor/teaching-log/[id] | DELETE | getServerSession, superadmin_check, admin_check | superadmin | instructor | OK |
| /api/instructor/teaching-log | GET, POST | getServerSession, superadmin_check, admin_check | superadmin | instructor | OK |
| /api/instructor/time-clock/[id] | PUT, DELETE | getServerSession, hasMinRole('instructor') | instructor | instructor | OK |
| /api/instructor/time-clock | GET, POST, PUT | getServerSession, hasMinRole('instructor') | instructor | instructor | OK |
| /api/instructor/upcoming-labs | GET | getServerSession | authenticated | instructor | OK |

### Student (13 routes)

| Route | Methods | Current Auth | Min Role | Recommended | Notes |
|-------|---------|-------------|----------|-------------|-------|
| /api/student/attendance-appeals | GET, POST | getServerSession | authenticated | authenticated | OK |
| /api/student/available-labs/cancel | POST | getServerSession | authenticated | authenticated | OK |
| /api/student/available-labs/my-signups | GET | getServerSession | authenticated | authenticated | OK |
| /api/student/available-labs | GET | getServerSession | authenticated | authenticated | OK |
| /api/student/available-labs/signup | POST | getServerSession | authenticated | authenticated | OK |
| /api/student/communication-preferences | GET, PUT | getServerSession | authenticated | authenticated | OK |
| /api/student/completions | GET | getServerSession | authenticated | authenticated | OK |
| /api/student/documents/[id] | GET, DELETE | getServerSession | authenticated | authenticated | OK |
| /api/student/documents/requests | GET, POST | getServerSession | authenticated | authenticated | OK |
| /api/student/documents | GET, POST | getServerSession | authenticated | authenticated | OK |
| /api/student/ekg-scenarios | GET | getServerSession | authenticated | authenticated | OK |
| /api/student/my-progress | GET | getServerSession | authenticated | authenticated | OK |
| /api/student/profile | GET, PUT | getServerSession | authenticated | authenticated | OK |

### Students (Shared) (2 routes)

| Route | Methods | Current Auth | Min Role | Recommended | Notes |
|-------|---------|-------------|----------|-------------|-------|
| /api/students/[id]/progress | GET | getServerSession, hasMinRole('instructor') | instructor | instructor | OK |
| /api/students/[id]/skill-evaluations | GET | getServerSession, hasMinRole('instructor') | instructor | instructor | OK |

### Onboarding (4 routes)

| Route | Methods | Current Auth | Min Role | Recommended | Notes |
|-------|---------|-------------|----------|-------------|-------|
| /api/onboarding/assignments | GET, POST, DELETE | getServerSession, superadmin_check, admin_check | superadmin | instructor | OK |
| /api/onboarding/dashboard | GET | getServerSession, superadmin_check, admin_check | superadmin | instructor | OK |
| /api/onboarding/tasks/[id]/progress | GET, PATCH | getServerSession, superadmin_check, admin_check | superadmin | instructor | OK |
| /api/onboarding/templates | GET | getServerSession | authenticated | instructor | OK |

### Notifications (5 routes)

| Route | Methods | Current Auth | Min Role | Recommended | Notes |
|-------|---------|-------------|----------|-------------|-------|
| /api/notifications/archive | PUT | getServerSession | authenticated | authenticated | OK |
| /api/notifications/digest-preview | GET | getServerSession | authenticated | authenticated | OK |
| /api/notifications/email-preferences | GET, PUT | getServerSession | authenticated | authenticated | OK |
| /api/notifications/preferences | GET, PUT, DELETE | getServerSession | authenticated | authenticated | OK |
| /api/notifications/read | PUT | getServerSession | authenticated | authenticated | OK |

### Settings (8 routes)

| Route | Methods | Current Auth | Min Role | Recommended | Notes |
|-------|---------|-------------|----------|-------------|-------|
| /api/settings/2fa/disable | POST | getServerSession | authenticated | authenticated | OK |
| /api/settings/2fa/setup | POST | getServerSession | authenticated | authenticated | OK |
| /api/settings/2fa/status | GET | getServerSession | authenticated | authenticated | OK |
| /api/settings/2fa/verify | POST | getServerSession | authenticated | authenticated | OK |
| /api/settings/notifications | GET, PUT | getServerSession | authenticated | authenticated | OK |
| /api/settings/sessions/[id] | DELETE | getServerSession | authenticated | authenticated | OK |
| /api/settings/sessions/revoke-all | POST | getServerSession | authenticated | authenticated | OK |
| /api/settings/sessions | GET, POST | getServerSession | authenticated | authenticated | OK |

### Dashboard (4 routes)

| Route | Methods | Current Auth | Min Role | Recommended | Notes |
|-------|---------|-------------|----------|-------------|-------|
| /api/dashboard/cert-expiry | GET | getServerSession | authenticated | authenticated | OK |
| /api/dashboard/layout | GET, PUT, DELETE | getServerSession | authenticated | authenticated | OK |
| /api/dashboard/quick-stats | GET | requireAuth, hasMinRole('lead_instructor') | lead_instructor | authenticated | OK |
| /api/dashboard/recent-activity | GET | getServerSession | authenticated | authenticated | OK |

### User/Preferences (3 routes)

| Route | Methods | Current Auth | Min Role | Recommended | Notes |
|-------|---------|-------------|----------|-------------|-------|
| /api/user-preferences/tour | GET, POST | getServerSession | authenticated | authenticated | OK |
| /api/user/preferences | GET, PUT, DELETE | getServerSession | authenticated | authenticated | OK |
| /api/users/list | GET | requireAuth | authenticated | authenticated | OK |

### Skill Sheets (4 routes)

| Route | Methods | Current Auth | Min Role | Recommended | Notes |
|-------|---------|-------------|----------|-------------|-------|
| /api/skill-sheets/[id]/evaluate | POST | getServerSession, hasMinRole('instructor') | instructor | instructor | OK |
| /api/skill-sheets/[id] | GET | getServerSession, hasMinRole('instructor') | instructor | instructor | OK |
| /api/skill-sheets/by-skill-name | GET | getServerSession | authenticated | instructor | OK |
| /api/skill-sheets/evaluations-by-lab-day | GET | getServerSession, hasMinRole('instructor') | instructor | instructor | OK |

### Stations (5 routes)

| Route | Methods | Current Auth | Min Role | Recommended | Notes |
|-------|---------|-------------|----------|-------------|-------|
| /api/stations/completions/bulk | POST | getServerSession, hasMinRole('instructor') | instructor | instructor | OK |
| /api/stations/completions | GET, POST | getServerSession, hasMinRole('instructor') | instructor | instructor | OK |
| /api/stations/pool/[id] | GET, PATCH, DELETE | getServerSession, hasMinRole('instructor'), hasMinRole('admin') | admin | instructor | OK |
| /api/stations/pool/favorites | GET, POST, DELETE | getServerSession | authenticated | instructor | OK |
| /api/stations/pool | GET, POST | getServerSession, hasMinRole('instructor') | instructor | instructor | OK |

### Seating (7 routes)

| Route | Methods | Current Auth | Min Role | Recommended | Notes |
|-------|---------|-------------|----------|-------------|-------|
| /api/seating/charts/[id]/assignments | GET, PUT, DELETE | getServerSession | authenticated | instructor | OK |
| /api/seating/charts/[id]/generate | POST | getServerSession | authenticated | instructor | OK |
| /api/seating/charts/[id] | GET, PUT, DELETE | getServerSession | authenticated | instructor | OK |
| /api/seating/charts | GET, POST | getServerSession | authenticated | instructor | OK |
| /api/seating/classrooms | GET | getServerSession | authenticated | instructor | OK |
| /api/seating/learning-styles | GET, POST, DELETE | getServerSession | authenticated | instructor | OK |
| /api/seating/preferences | GET, POST, DELETE | getServerSession | authenticated | instructor | OK |

### Tasks (3 routes)

| Route | Methods | Current Auth | Min Role | Recommended | Notes |
|-------|---------|-------------|----------|-------------|-------|
| /api/tasks/[id]/comments | GET, POST | getServerSession | authenticated | authenticated | OK |
| /api/tasks/[id] | GET, PATCH, DELETE | getServerSession | authenticated | authenticated | OK |
| /api/tasks/bulk | PATCH, DELETE | getServerSession | authenticated | authenticated | OK |

### Tracking (3 routes)

| Route | Methods | Current Auth | Min Role | Recommended | Notes |
|-------|---------|-------------|----------|-------------|-------|
| /api/tracking/ekg-scores | GET, POST | getServerSession, hasMinRole('instructor') | instructor | instructor | OK |
| /api/tracking/protocol-completions | GET, POST | getServerSession, hasMinRole('instructor') | instructor | instructor | OK |
| /api/tracking/scenarios | GET, POST | getServerSession, hasMinRole('instructor') | instructor | instructor | OK |

### Resources (3 routes)

| Route | Methods | Current Auth | Min Role | Recommended | Notes |
|-------|---------|-------------|----------|-------------|-------|
| /api/resources/medications/[id] | PUT, DELETE | getServerSession, hasMinRole('admin') | admin | authenticated | OK |
| /api/resources/medications | GET, POST | getServerSession, hasMinRole('admin') | admin | authenticated | OK |
| /api/resources/versions | GET | getServerSession, hasMinRole('instructor') | instructor | authenticated | OK |

### Peer Evaluations (1 routes)

| Route | Methods | Current Auth | Min Role | Recommended | Notes |
|-------|---------|-------------|----------|-------------|-------|
| /api/peer-evaluations/aggregate | GET | getServerSession, hasMinRole('instructor') | instructor | authenticated | OK |

### Announcements (1 routes)

| Route | Methods | Current Auth | Min Role | Recommended | Notes |
|-------|---------|-------------|----------|-------------|-------|
| /api/announcements/[id]/read | POST | getServerSession | authenticated | authenticated | OK |

### Feedback (1 routes)

| Route | Methods | Current Auth | Min Role | Recommended | Notes |
|-------|---------|-------------|----------|-------------|-------|
| /api/feedback/my-submissions | GET | getServerSession | authenticated | authenticated | OK |

### Access Requests (2 routes)

| Route | Methods | Current Auth | Min Role | Recommended | Notes |
|-------|---------|-------------|----------|-------------|-------|
| /api/access-requests/[id] | PUT | getServerSession | authenticated | authenticated | OK |
| /api/access-requests/status | GET | getServerSession, hasMinRole('admin') | admin | authenticated | OK |

### Deep Links (1 routes)

| Route | Methods | Current Auth | Min Role | Recommended | Notes |
|-------|---------|-------------|----------|-------------|-------|
| /api/deep-links/qr | GET | getServerSession | authenticated | authenticated | OK |

### Timer Display (1 routes)

| Route | Methods | Current Auth | Min Role | Recommended | Notes |
|-------|---------|-------------|----------|-------------|-------|
| /api/timer-display/[token] | GET | none | public (token-based) | public (token-based) | Token-based access |

### Check-in (1 routes)

| Route | Methods | Current Auth | Min Role | Recommended | Notes |
|-------|---------|-------------|----------|-------------|-------|
| /api/checkin/[token] | GET, POST | none | public (token-based) | public (token-based) | Token-based access |

### Error Logging (1 routes)

| Route | Methods | Current Auth | Min Role | Recommended | Notes |
|-------|---------|-------------|----------|-------------|-------|
| /api/errors/log | POST | getServerSession | authenticated | authenticated | OK |

### Guest (1 routes)

| Route | Methods | Auth Method | Notes |
|-------|---------|------------|-------|
| /api/guest/login | POST | none | OK - public endpoint |

### Auth (1 routes)

| Route | Methods | Auth Method | Notes |
|-------|---------|------------|-------|
| /api/auth/[...nextauth] | GET, POST | none | OK - public endpoint |

### Config (1 routes)

| Route | Methods | Auth Method | Notes |
|-------|---------|------------|-------|
| /api/config/public | GET | none | OK - public endpoint |

### Cron/Automated (11 routes)

| Route | Methods | Auth Method | Notes |
|-------|---------|------------|-------|
| /api/cron/affiliation-expiry | GET | CRON_SECRET | OK - cron job |
| /api/cron/attendance-alerts | GET | CRON_SECRET | OK - cron job |
| /api/cron/availability-reminders | GET | CRON_SECRET | OK - cron job |
| /api/cron/cert-expiry | GET | CRON_SECRET | OK - cron job |
| /api/cron/clinical-hours-reminder | GET | CRON_SECRET | OK - cron job |
| /api/cron/compliance-expiry | GET | CRON_SECRET | OK - cron job |
| /api/cron/daily-digest | GET | CRON_SECRET | OK - cron job |
| /api/cron/internship-milestones | GET | CRON_SECRET | OK - cron job |
| /api/cron/lab-reminder | GET | CRON_SECRET | OK - cron job |
| /api/cron/scheduled-exports | GET | CRON_SECRET | OK - cron job |
| /api/cron/system-health | GET | CRON_SECRET | OK - cron job |

### Other (15 routes)

| Route | Methods | Current Auth | Min Role | Recommended | Notes |
|-------|---------|-------------|----------|-------------|-------|
| /api/access-requests | GET, POST | getServerSession | authenticated | authenticated | OK |
| /api/announcements | GET, POST, PUT, DELETE | getServerSession, hasMinRole('admin') | admin | authenticated | OK |
| /api/compliance | GET, POST, PUT | getServerSession, hasMinRole('instructor'), hasMinRole('admin') | admin | authenticated | OK |
| /api/deep-links | GET, POST, PATCH, DELETE | getServerSession, hasMinRole('admin') | admin | authenticated | OK |
| /api/feedback | GET, POST, PATCH | getServerSession | authenticated | authenticated | OK |
| /api/notifications | GET, POST, DELETE | getServerSession, superadmin_check, admin_check | superadmin | authenticated | OK |
| /api/peer-evaluations | GET, POST | getServerSession, hasMinRole('instructor') | instructor | authenticated | OK |
| /api/polls | POST, GET, DELETE | getServerSession | authenticated | authenticated | OK |
| /api/resources | GET, POST, PUT, DELETE | getServerSession, hasMinRole('instructor'), hasMinRole('admin') | admin | authenticated | OK |
| /api/search | GET | getServerSession | authenticated | authenticated | OK |
| /api/skill-sheets | GET | getServerSession, hasMinRole('instructor') | instructor | authenticated | OK |
| /api/students | GET | getServerSession | authenticated | authenticated | OK |
| /api/submissions | POST, GET | getServerSession, requireAuth | authenticated | authenticated | OK |
| /api/tasks | GET, POST | getServerSession | authenticated | authenticated | OK |
| /api/timer-display | GET, POST, PATCH, DELETE | getServerSession | authenticated | authenticated | OK |

## Security Gaps

Routes that may need additional access controls:

1. **/api/lab-management/scenario-library/favorites** (POST, DELETE) - No authentication detected. Recommended: instructor

### Admin Routes With Only Session Check (No Role Enforcement)

These routes are under `/api/admin/` but only check for a valid session without verifying the user's role is admin or higher:

1. **/api/admin/alumni/[id]** (GET, PUT, DELETE) - Has: getServerSession. Recommended: admin
2. **/api/admin/alumni** (GET, POST) - Has: getServerSession. Recommended: admin
3. **/api/admin/attendance-appeals/[id]** (PUT) - Has: getServerSession. Recommended: admin
4. **/api/admin/attendance-appeals** (GET) - Has: getServerSession. Recommended: admin
5. **/api/admin/broadcast/history** (GET) - Has: getServerSession. Recommended: admin
6. **/api/admin/broadcast** (POST, GET) - Has: getServerSession. Recommended: admin
7. **/api/admin/bulk-operations/[id]/rollback** (POST) - Has: getServerSession. Recommended: admin
8. **/api/admin/bulk-operations** (GET, POST) - Has: getServerSession. Recommended: admin
9. **/api/admin/certification-compliance** (GET) - Has: getServerSession. Recommended: admin
10. **/api/admin/certifications/import** (POST) - Has: getServerSession. Recommended: admin
11. **/api/admin/certifications** (GET) - Has: getServerSession. Recommended: admin
12. **/api/admin/certifications/verify** (PUT) - Has: getServerSession. Recommended: admin
13. **/api/admin/config** (GET, PUT) - Has: getServerSession. Recommended: admin
14. **/api/admin/data-export** (GET, POST) - Has: getServerSession. Recommended: admin
15. **/api/admin/document-requests/[id]** (PUT) - Has: getServerSession. Recommended: admin
16. **/api/admin/document-requests** (GET, POST) - Has: getServerSession. Recommended: admin
17. **/api/admin/email-templates** (GET, PUT, DELETE) - Has: getServerSession. Recommended: admin
18. **/api/admin/email-templates/test** (POST) - Has: getServerSession. Recommended: admin
19. **/api/admin/equipment/checkout** (GET, POST, PUT) - Has: getServerSession. Recommended: admin
20. **/api/admin/equipment/maintenance/[id]** (PUT, DELETE) - Has: getServerSession. Recommended: admin
21. **/api/admin/equipment/maintenance** (GET, POST) - Has: getServerSession. Recommended: admin
22. **/api/admin/equipment** (GET, POST, PATCH, DELETE) - Has: getServerSession. Recommended: admin
23. **/api/admin/guests** (GET, POST, PATCH, DELETE) - Has: getServerSession. Recommended: admin
24. **/api/admin/incidents/[id]** (GET, PUT) - Has: getServerSession. Recommended: admin
25. **/api/admin/incidents** (GET, POST) - Has: getServerSession. Recommended: admin
26. **/api/admin/lab-templates/apply** (POST) - Has: getServerSession. Recommended: admin
27. **/api/admin/lab-templates/import** (POST) - Has: getServerSession. Recommended: admin
28. **/api/admin/lab-templates/seed** (POST) - Has: getServerSession. Recommended: admin
29. **/api/admin/lab-templates/update-from-lab** (POST) - Has: getServerSession. Recommended: admin
30. **/api/admin/rubrics/[id]** (GET, PUT, DELETE) - Has: getServerSession. Recommended: admin
31. **/api/admin/rubrics** (GET, POST) - Has: getServerSession. Recommended: admin
32. **/api/admin/scenarios/audit** (GET) - Has: getServerSession. Recommended: admin
33. **/api/admin/scenarios/transform** (GET, POST) - Has: getServerSession. Recommended: admin
34. **/api/admin/scheduled-exports/[id]** (PUT, DELETE) - Has: getServerSession. Recommended: admin
35. **/api/admin/scheduled-exports** (GET, POST) - Has: getServerSession. Recommended: admin
36. **/api/admin/skill-drills/seed** (POST) - Has: getServerSession. Recommended: admin
37. **/api/admin/skill-sheets/counts** (GET) - Has: getServerSession. Recommended: admin
38. **/api/admin/skill-sheets/import** (POST) - Has: getServerSession. Recommended: admin
39. **/api/admin/skill-sheets/seed-aliases** (POST) - Has: getServerSession. Recommended: admin
40. **/api/admin/skill-sheets/seed-canonical** (POST) - Has: getServerSession. Recommended: admin
41. **/api/admin/system-alerts** (GET, PATCH) - Has: getServerSession. Recommended: admin
42. **/api/admin/user-activity/log** (POST) - Has: getServerSession. Recommended: admin
43. **/api/admin/user-activity** (GET) - Has: getServerSession. Recommended: admin
44. **/api/admin/webhooks/[id]/logs** (GET) - Has: getServerSession. Recommended: admin
45. **/api/admin/webhooks/[id]** (GET, PUT, DELETE) - Has: getServerSession. Recommended: admin
46. **/api/admin/webhooks/[id]/test** (POST) - Has: getServerSession. Recommended: admin
47. **/api/admin/webhooks** (GET, POST) - Has: getServerSession. Recommended: admin

### Token-Based Public Routes

These routes use URL tokens for authentication instead of sessions:

- **/api/checkin/[token]** (GET, POST)
- **/api/clinical/preceptor-eval/[token]** (GET, POST)
- **/api/timer-display/[token]** (GET)

## Methodology

This audit was generated by scanning all `route.ts` files under `app/api/` for:
- `getServerSession` - NextAuth session verification
- `hasMinRole(session, 'role')` - Role hierarchy check from `lib/permissions.ts`
- `isSuperadmin` - Superadmin-only check
- `canAccessClinical` / `canManageClinical` - Clinical permission helpers
- `CRON_SECRET` - Cron job token verification
- `requireAuth` / `requireRole` - Auth middleware patterns
- Direct role string comparisons (e.g., `role === 'admin'`)

### Role Hierarchy

`superadmin` > `admin` > `lead_instructor` > `instructor` > `user` > `guest`

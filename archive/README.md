# Archive

Pages and API routes moved here outside `app/` are **excluded from the Next.js build**
entirely (the App Router only picks up routes inside `app/`), not just unlinked from
nav. `tsconfig.json` and `eslint.config.mjs` already exclude `archive/` from
type-checking and linting. No database tables or rows were touched by any of these
moves.

Two directories predate this file and are unrelated to the list below:
`ai-scenario-generator/` and `pals-hub-page.tsx`.

## TRIM 3/5 — 2026-10-20

Moved every page the [TRIM 1b dependency/layout table](https://app.notion.com/p/3fe5cd1cbc9b81b3835bf7db6e4bf36c)
classified `CLEAN-REMOVE`, except four Ben held out in the TRIM 3/5 card
([3fa5cd1c-bc9b-81ba-93b1-e44b0125fc3d](https://app.notion.com/p/3fa5cd1cbc9b81ba93b1e44b0125fc3d)):
`osce-evaluator-signup` (OSCE CAL 1-4 is live work on that signup flow),
`admin/osce-tokens` (same reason), `cases/leaderboard` and `cases/session`
(1b classified both MUST-PARK with the `cases` module, not CLEAN-REMOVE — they
were never eligible for this move in the first place).

Moved with each page: its only-used-here API routes (an API route moved only if
**nothing else in the live app** calls it — several sibling routes under the same
parent directory, e.g. `/api/admin/equipment` and `/api/admin/database-tools`,
stayed live because another page or widget still calls them) and any page-local
component file that lived inside the page's own folder (`CertList.tsx` and
`CETracker.tsx` under `labs/my-certifications`). No shared `components/` file
turned out to be used only by a moved page. `lib/tucked-away-features.ts` moved
too — its only consumer was `/admin/tools`, one of the moved pages.

~50 dangling hub/nav/widget links and 2 orphaned API callers were fixed in the
same commit — see `docs/CHANGELOG.md` and `docs/DEAD_CODE_REPORT.md` for the
list. One nav gap was prevented, not just fixed: `/admin/tools` was the only
entry point for admins/mentors into `/onboarding` (a page that stays — the home
widget is gated to the viewer's own assignment), so a direct "Instructor
Onboarding" card was added to the Admin hub before archiving `/admin/tools`.

### Pages (43)

| Moved | To revert |
|---|---|
| `app/admin/alumni` | `git mv archive/app/admin/alumni app/admin/alumni` |
| `app/admin/announcements` | `git mv archive/app/admin/announcements app/admin/announcements` |
| `app/admin/attendance-appeals` | `git mv archive/app/admin/attendance-appeals app/admin/attendance-appeals` |
| `app/admin/broadcast` | `git mv archive/app/admin/broadcast app/admin/broadcast` |
| `app/admin/bulk-operations` | `git mv archive/app/admin/bulk-operations app/admin/bulk-operations` |
| `app/admin/certifications` | `git mv archive/app/admin/certifications app/admin/certifications` |
| `app/admin/compliance` | `git mv archive/app/admin/compliance app/admin/compliance` |
| `app/admin/database-tools` | `git mv archive/app/admin/database-tools app/admin/database-tools` |
| `app/admin/deep-links` | `git mv archive/app/admin/deep-links app/admin/deep-links` |
| `app/admin/email-templates` | `git mv archive/app/admin/email-templates app/admin/email-templates` |
| `app/admin/equipment` | `git mv archive/app/admin/equipment app/admin/equipment` |
| `app/admin/external-access` | `git mv archive/app/admin/external-access app/admin/external-access` |
| `app/admin/incidents` | `git mv archive/app/admin/incidents app/admin/incidents` |
| `app/admin/program-requirements` | `git mv archive/app/admin/program-requirements app/admin/program-requirements` |
| `app/admin/qa-checklist` | `git mv archive/app/admin/qa-checklist app/admin/qa-checklist` |
| `app/admin/rubrics` | `git mv archive/app/admin/rubrics app/admin/rubrics` |
| `app/admin/system-alerts` | `git mv archive/app/admin/system-alerts app/admin/system-alerts` |
| `app/admin/system-health` | `git mv archive/app/admin/system-health app/admin/system-health` |
| `app/admin/time-clock` | `git mv archive/app/admin/time-clock app/admin/time-clock` |
| `app/admin/tools` | `git mv archive/app/admin/tools app/admin/tools` |
| `app/cases/new` | `git mv archive/app/cases/new app/cases/new` |
| `app/instructor/ce` | `git mv archive/app/instructor/ce app/instructor/ce` |
| `app/instructor/certifications` | `git mv archive/app/instructor/certifications app/instructor/certifications` |
| `app/instructor/email-history` | `git mv archive/app/instructor/email-history app/instructor/email-history` |
| `app/instructor/history` | `git mv archive/app/instructor/history app/instructor/history` |
| `app/instructor/teaching` | `git mv archive/app/instructor/teaching app/instructor/teaching` |
| `app/instructor/time-clock` | `git mv archive/app/instructor/time-clock app/instructor/time-clock` |
| `app/labs/ekg-warmup` | `git mv archive/app/labs/ekg-warmup app/labs/ekg-warmup` |
| `app/labs/mentorship` | `git mv archive/app/labs/mentorship app/labs/mentorship` |
| `app/labs/my-certifications` | `git mv archive/app/labs/my-certifications app/labs/my-certifications` |
| `app/labs/peer-evals` | `git mv archive/app/labs/peer-evals app/labs/peer-evals` |
| `app/reports/attendance` | `git mv archive/app/reports/attendance app/reports/attendance` |
| `app/reports/closeout-surveys` | `git mv archive/app/reports/closeout-surveys app/reports/closeout-surveys` |
| `app/reports/gradebook` | `git mv archive/app/reports/gradebook app/reports/gradebook` |
| `app/reports/instructor-analytics` | `git mv archive/app/reports/instructor-analytics app/reports/instructor-analytics` |
| `app/reports/lab-costs` | `git mv archive/app/reports/lab-costs app/reports/lab-costs` |
| `app/reports/program-outcomes` | `git mv archive/app/reports/program-outcomes app/reports/program-outcomes` |
| `app/scheduling/resource-bookings` | `git mv archive/app/scheduling/resource-bookings app/scheduling/resource-bookings` |
| `app/scheduling/substitute-requests` | `git mv archive/app/scheduling/substitute-requests app/scheduling/substitute-requests` |
| `app/settings/sessions` | `git mv archive/app/settings/sessions app/settings/sessions` |
| `app/student/attendance-appeals` | `git mv archive/app/student/attendance-appeals app/student/attendance-appeals` |
| `app/student/documents` | `git mv archive/app/student/documents app/student/documents` |
| `app/students/[id]` | `git mv archive/app/students/[id] app/students/[id]` |

### API routes (37)

| Moved | To revert |
|---|---|
| `app/api/admin/alumni` | `git mv archive/app/api/admin/alumni app/api/admin/alumni` |
| `app/api/admin/attendance-appeals` | `git mv archive/app/api/admin/attendance-appeals app/api/admin/attendance-appeals` |
| `app/api/admin/broadcast` | `git mv archive/app/api/admin/broadcast app/api/admin/broadcast` |
| `app/api/admin/bulk-operations` | `git mv archive/app/api/admin/bulk-operations app/api/admin/bulk-operations` |
| `app/api/admin/certification-compliance` | `git mv archive/app/api/admin/certification-compliance app/api/admin/certification-compliance` |
| `app/api/admin/certifications` | `git mv archive/app/api/admin/certifications app/api/admin/certifications` |
| `app/api/admin/compliance` | `git mv archive/app/api/admin/compliance app/api/admin/compliance` |
| `app/api/admin/database-tools` | `git mv archive/app/api/admin/database-tools app/api/admin/database-tools` |
| `app/api/admin/email-stats` | `git mv archive/app/api/admin/email-stats app/api/admin/email-stats` |
| `app/api/admin/email-templates` | `git mv archive/app/api/admin/email-templates app/api/admin/email-templates` |
| `app/api/admin/equipment` | `git mv archive/app/api/admin/equipment app/api/admin/equipment` |
| `app/api/admin/external-access` | `git mv archive/app/api/admin/external-access app/api/admin/external-access` |
| `app/api/admin/incidents` | `git mv archive/app/api/admin/incidents app/api/admin/incidents` |
| `app/api/admin/program-requirements` | `git mv archive/app/api/admin/program-requirements app/api/admin/program-requirements` |
| `app/api/admin/rubrics` | `git mv archive/app/api/admin/rubrics app/api/admin/rubrics` |
| `app/api/admin/system-alerts` | `git mv archive/app/api/admin/system-alerts app/api/admin/system-alerts` |
| `app/api/admin/system-health` | `git mv archive/app/api/admin/system-health app/api/admin/system-health` |
| `app/api/instructor/ce-records` | `git mv archive/app/api/instructor/ce-records app/api/instructor/ce-records` |
| `app/api/instructor/email-history` | `git mv archive/app/api/instructor/email-history app/api/instructor/email-history` |
| `app/api/instructor/history` | `git mv archive/app/api/instructor/history app/api/instructor/history` |
| `app/api/instructor/teaching-log` | `git mv archive/app/api/instructor/teaching-log app/api/instructor/teaching-log` |
| `app/api/instructor/time-clock` | `git mv archive/app/api/instructor/time-clock app/api/instructor/time-clock` |
| `app/api/lab-management/ce-records` | `git mv archive/app/api/lab-management/ce-records app/api/lab-management/ce-records` |
| `app/api/lab-management/ce-requirements` | `git mv archive/app/api/lab-management/ce-requirements app/api/lab-management/ce-requirements` |
| `app/api/lab-management/mentorship` | `git mv archive/app/api/lab-management/mentorship app/api/lab-management/mentorship` |
| `app/api/peer-evaluations/aggregate` | `git mv archive/app/api/peer-evaluations/aggregate app/api/peer-evaluations/aggregate` |
| `app/api/reports/attendance` | `git mv archive/app/api/reports/attendance app/api/reports/attendance` |
| `app/api/reports/closeout-surveys` | `git mv archive/app/api/reports/closeout-surveys app/api/reports/closeout-surveys` |
| `app/api/reports/gradebook` | `git mv archive/app/api/reports/gradebook app/api/reports/gradebook` |
| `app/api/reports/instructor-analytics` | `git mv archive/app/api/reports/instructor-analytics app/api/reports/instructor-analytics` |
| `app/api/reports/program-outcomes` | `git mv archive/app/api/reports/program-outcomes app/api/reports/program-outcomes` |
| `app/api/scheduling/resource-bookings` | `git mv archive/app/api/scheduling/resource-bookings app/api/scheduling/resource-bookings` |
| `app/api/scheduling/substitute-requests` | `git mv archive/app/api/scheduling/substitute-requests app/api/scheduling/substitute-requests` |
| `app/api/settings/sessions` | `git mv archive/app/api/settings/sessions app/api/settings/sessions` |
| `app/api/student/attendance-appeals` | `git mv archive/app/api/student/attendance-appeals app/api/student/attendance-appeals` |
| `app/api/student/documents` | `git mv archive/app/api/student/documents app/api/student/documents` |
| `app/api/tracking/ekg-scores` | `git mv archive/app/api/tracking/ekg-scores app/api/tracking/ekg-scores` |

### Other (1)

| Moved | To revert |
|---|---|
| `lib/tucked-away-features.ts` | `git mv archive/lib/tucked-away-features.ts lib/tucked-away-features.ts` |

After reverting any entry above, also re-check the dangling-link fixes listed in
`docs/CHANGELOG.md` for that same commit — several were edited (not just
deleted), so bringing a page back usually means re-adding its hub card / nav
entry / widget link too, not only moving the file back.

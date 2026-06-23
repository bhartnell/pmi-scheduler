# Desktop-First Layout Audit (to-do / punch-list)

Read-only audit run 2026-06-23 against the **UI Layout Rule (HARD REQUIREMENT)**
in `CLAUDE.md` (desktop-first / wide, not mobile-first).

**Scanned:** ~280 `app/**/page.tsx` · **Flagged:** 39 (38 HIGH, 1 MED) ·
**Already compliant:** ~240.

## What "flagged" means here (read before fixing)

All 39 flags are the **mobile-first grid idiom**: base `grid-cols-1` that scales
**up** via `sm:`/`md:`/`lg:` prefixes. Because of the `lg:`/`xl:` steps, **most
already render multi-column on a desktop** — so this is a **consistency/correctness
pass to match the rule**, not a set of pages broken/narrow on desktop. No pages
were found stuck in a narrow `max-w` container or single-column-only on wide
screens (those came back clean). Prioritize by traffic.

**The fix pattern** (per page): make the BASE classes the wide layout and collapse
DOWN with `max-*:` — e.g. `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` →
`grid-cols-3 max-lg:grid-cols-2 max-sm:grid-cols-1`. Verify with `tsc` + build.

---

## HIGH — primary management/data pages (38)

### Labs (highest traffic — do first) (10)
- [ ] `app/labs/acls-hub/page.tsx` — `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` → `grid-cols-3 max-lg:grid-cols-2 max-sm:grid-cols-1`
- [ ] `app/labs/schedule/page.tsx` — `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` → `grid-cols-3 max-lg:grid-cols-2 max-sm:grid-cols-1`
- [ ] `app/labs/scenarios/page.tsx` — `grid-cols-1 sm:grid-cols-3` → `grid-cols-3 max-sm:grid-cols-1`
- [ ] `app/labs/scenario-library/page.tsx` — `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` → `grid-cols-3 max-lg:grid-cols-2 max-sm:grid-cols-1`
- [ ] `app/labs/templates/page.tsx` — `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` → `grid-cols-3 max-lg:grid-cols-2 max-sm:grid-cols-1`
- [ ] `app/labs/groups/page.tsx` — `grid-cols-1 md:grid-cols-2 lg:grid-cols-3` → `grid-cols-3 max-lg:grid-cols-2 max-md:grid-cols-1`
- [ ] `app/labs/peer-evals/page.tsx` — `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` → `grid-cols-3 max-lg:grid-cols-2 max-sm:grid-cols-1`
- [ ] `app/labs/protocol-tracking/page.tsx` — `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` → `grid-cols-3 max-lg:grid-cols-2 max-sm:grid-cols-1`
- [ ] `app/labs/mentorship/page.tsx` — `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` → `grid-cols-3 max-lg:grid-cols-2 max-sm:grid-cols-1`
- [ ] `app/labs/debrief-review/page.tsx` — `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` → `grid-cols-3 max-lg:grid-cols-2 max-sm:grid-cols-1`

### Reports (8)
- [ ] `app/reports/builder/page.tsx` — `grid-cols-1 sm:grid-cols-3` → `grid-cols-3 max-sm:grid-cols-1`
- [ ] `app/reports/clinical-placements/page.tsx` — `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` → `grid-cols-3 max-lg:grid-cols-2 max-sm:grid-cols-1`
- [ ] `app/reports/cohort-comparison/page.tsx` — `grid-cols-1 sm:grid-cols-2` → `grid-cols-2 max-sm:grid-cols-1`
- [ ] `app/reports/instructor-analytics/page.tsx` — `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` → `grid-cols-3 max-lg:grid-cols-2 max-sm:grid-cols-1`
- [ ] `app/reports/program-outcomes/page.tsx` — same → `grid-cols-3 max-lg:grid-cols-2 max-sm:grid-cols-1`
- [ ] `app/reports/program-overview/page.tsx` — same → `grid-cols-3 max-lg:grid-cols-2 max-sm:grid-cols-1`
- [ ] `app/reports/scenario-usage-overview/page.tsx` — same → `grid-cols-3 max-lg:grid-cols-2 max-sm:grid-cols-1`
- [ ] `app/reports/skill-trends/page.tsx` — same → `grid-cols-3 max-lg:grid-cols-2 max-sm:grid-cols-1`

### Admin (15)
- [ ] `app/admin/audit-log/page.tsx` — `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6` → `grid-cols-6 max-lg:grid-cols-3 max-sm:grid-cols-1`
- [ ] `app/admin/equipment/page.tsx` — `…xl:grid-cols-4` → `grid-cols-4 max-lg:grid-cols-3 max-sm:grid-cols-1`
- [ ] `app/admin/osce-tokens/page.tsx` — `…lg:grid-cols-4` → `grid-cols-4 max-lg:grid-cols-2 max-sm:grid-cols-1`
- [ ] `app/admin/seed-availability/page.tsx` — `…lg:grid-cols-4` → `grid-cols-4 max-lg:grid-cols-2 max-sm:grid-cols-1`
- [ ] `app/admin/user-activity/page.tsx` — `…lg:grid-cols-4` → `grid-cols-4 max-lg:grid-cols-2 max-sm:grid-cols-1`
- [ ] `app/admin/lab-templates/page.tsx` — `…lg:grid-cols-3` → `grid-cols-3 max-lg:grid-cols-2 max-sm:grid-cols-1`
- [ ] `app/admin/program-requirements/page.tsx` — `…lg:grid-cols-3` → `grid-cols-3 max-lg:grid-cols-2 max-sm:grid-cols-1`
- [ ] `app/admin/system-health/page.tsx` — `…lg:grid-cols-3` → `grid-cols-3 max-lg:grid-cols-2 max-sm:grid-cols-1`
- [ ] `app/admin/osce-events/page.tsx` — `grid-cols-1 sm:grid-cols-3` → `grid-cols-3 max-sm:grid-cols-1`
- [ ] `app/admin/deep-links/page.tsx` — `grid-cols-1 sm:grid-cols-3` → `grid-cols-3 max-sm:grid-cols-1`
- [ ] `app/admin/semesters/page.tsx` — `grid-cols-1 sm:grid-cols-3` → `grid-cols-3 max-sm:grid-cols-1`
- [ ] `app/admin/calendar-sync/page.tsx` — `grid-cols-1 sm:grid-cols-2` → `grid-cols-2 max-sm:grid-cols-1`
- [ ] `app/admin/data-export/page.tsx` — `grid-cols-1 sm:grid-cols-2` → `grid-cols-2 max-sm:grid-cols-1`
- [ ] `app/admin/incidents/page.tsx` — `grid-cols-1 sm:grid-cols-2` → `grid-cols-2 max-sm:grid-cols-1`
- [ ] `app/admin/time-clock/page.tsx` — `grid-cols-1 sm:grid-cols-2` → `grid-cols-2 max-sm:grid-cols-1`

### Academics (3)
- [ ] `app/academics/students/page.tsx` — `…xl:grid-cols-4` → `grid-cols-4 max-lg:grid-cols-3 max-sm:grid-cols-1`
- [ ] `app/academics/cohorts/page.tsx` — `grid-cols-1 sm:grid-cols-2 md:grid-cols-5` → `grid-cols-5 max-md:grid-cols-2 max-sm:grid-cols-1`
- [ ] `app/academics/skill-sheets/page.tsx` — `grid-cols-1 sm:grid-cols-3` / `sm:grid-cols-12` → wide base + `max-sm:grid-cols-1`

### Clinical (2)
- [ ] `app/clinical/hours/page.tsx` — `grid-cols-1 sm:grid-cols-2 xl:grid-cols-4` → `grid-cols-4 max-xl:grid-cols-2 max-sm:grid-cols-1`
- [ ] `app/clinical/internships/page.tsx` — `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` → `grid-cols-3 max-lg:grid-cols-2 max-sm:grid-cols-1`

## MED (1)
- [ ] `app/onboarding/page.tsx` — `flex-col md:flex-row` → `flex-row max-md:flex-col`

---

## Method / caveats
- Heuristic = grep for base `grid-cols-1` + min-width scaling, then read the layout lines.
  Excluded auth/sign-in, simple forms, token/checkin, and single-record detail pages
  (narrow is acceptable there).
- Each fix is a small className change; batch by area, verify `tsc` + clean build per batch.
- Check items off as pages are brought in line.

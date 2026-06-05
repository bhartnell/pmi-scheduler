-- cohorts.is_external_program — marks a cohort as a one-off / partner
-- program (e.g. LVFR AEMT) that should be excluded from generic
-- "all active cohorts" sweeps in the main app.
--
-- Why a flag instead of filtering on program.abbreviation:
--   - Abbreviation filters are fragile if a second AEMT cohort
--     comes through that IS a normal in-house cohort.
--   - The flag is explicit operator intent: "this cohort runs its
--     own playbook; don't apply EMT/PM workflows to it."
--
-- Generic sweeps that should opt in to filtering on this flag
-- (audit + retrofit as needed):
--   - admin/lab-templates/update-existing
--   - scripts/audit-lab-day-dow-mismatch.js
--   - any reports that aggregate "all cohorts"
--   - clinical-hours-reminder / internship-milestones crons
--     (LVFR AEMT students don't go through PMI's clinical pipeline)
--
-- Calendar-facing surfaces (master /calendar, ICS feeds) should
-- KEEP including external cohorts — the operator explicitly wants
-- LVFR dates/times to flow to the rest of the site. Only filter
-- this flag in workflows that would apply generic-cohort behavior
-- INTO the external cohort.

ALTER TABLE cohorts
  ADD COLUMN IF NOT EXISTS is_external_program boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN cohorts.is_external_program IS
  'Marks a one-off / partner cohort whose data lives in dedicated tables (e.g. lvfr_*) and which should be excluded from generic "all active cohorts" sweeps. Calendar/date surfaces should still include these cohorts.';

-- Mark the LVFR AEMT G2 cohort.
UPDATE cohorts
SET is_external_program = true
WHERE id = '6796e139-3add-4bdd-84da-52963ae4eb21';

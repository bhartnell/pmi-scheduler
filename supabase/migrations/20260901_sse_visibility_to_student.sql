-- NREMT setup task, sub-item 3 (Task Handoff Queue): re-enable student-facing
-- progress views for STANDARD lab results, decoupled from email_status.
--
-- ROOT CAUSE (Ben GO 2026-08-07): email_status is overloaded as both the
-- delivery-tracking flag AND the in-app visibility gate for
-- /api/student/skill-evaluations. Every final_competency evaluation defaults
-- to email_status='do_not_send' (see app/api/skill-sheets/[id]/evaluate/route.ts),
-- so results have been silently invisible to students since the original
-- build whenever a result wasn't emailed — independent of the NREMT/cert
-- guards that email_status was actually meant to gate.
--
-- FIX: a new visibility_to_student flag, decoupled from email_status.
-- Defaults true (visible) for standard-lab rows. Purely additive — no
-- backfill needed: as of 2026-09-01 all 480 existing rows in this table are
-- NREMT rows (skill_sheets.is_nremt = true), and per Ben's 2026-08-07
-- clarification NREMT/cert-exam results must be categorically excluded from
-- student view regardless of this flag (they're delivered via the Pima
-- Portal/SNHD, never in-app) — so the read path (app/api/student/
-- skill-evaluations/route.ts) ANDs this column with `NOT skill_sheet.is_nremt`
-- rather than relying on this column alone. That keeps every existing row
-- correctly hidden today even though the column itself defaults true, and
-- keeps future NREMT rows hidden even if a write path forgets to touch this
-- column.

ALTER TABLE student_skill_evaluations
  ADD COLUMN IF NOT EXISTS visibility_to_student boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN student_skill_evaluations.visibility_to_student IS 'Whether this evaluation is visible to the student in-app, decoupled from email_status (which only tracks email delivery). Defaults true for standard-lab rows. NREMT/cert-exam rows are additionally hard-excluded at read time via skill_sheets.is_nremt, regardless of this column, per Ben 2026-08-07 (those results are Portal/SNHD-delivered, never in-app).';

-- ROLLBACK:
--   ALTER TABLE student_skill_evaluations DROP COLUMN IF EXISTS visibility_to_student;

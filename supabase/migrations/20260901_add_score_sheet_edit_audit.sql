-- Director-level score-sheet editing: audit columns on student_skill_evaluations
-- (Task Handoff Queue, Ben Hartnell's directive — director-level score-sheet
-- editing, 2026-09-01).
--
-- Adds the columns needed to record who corrected an already-submitted
-- evaluation in place (via the new PATCH /api/skill-sheets/[id]/evaluations
-- endpoint) and why. No existing columns are touched.
--
-- Build-in-branch, HOLD MERGE until Ben's safe-window go (live grading data,
-- timing-sensitive) — this migration is NOT run against the database as
-- part of this change. Apply with:
--   node scripts/run-migration.js supabase/migrations/20260901_add_score_sheet_edit_audit.sql
--
-- Additive, nullable, reversible.

ALTER TABLE student_skill_evaluations
  ADD COLUMN IF NOT EXISTS edited_by uuid REFERENCES lab_users(id);

ALTER TABLE student_skill_evaluations
  ADD COLUMN IF NOT EXISTS edited_at timestamptz;

ALTER TABLE student_skill_evaluations
  ADD COLUMN IF NOT EXISTS edit_reason text;

COMMENT ON COLUMN student_skill_evaluations.edited_by IS
  'lab_users.id of the director who corrected this score sheet in place (PATCH /api/skill-sheets/[id]/evaluations). NULL for evaluations never corrected. Added 2026-09-01.';

COMMENT ON COLUMN student_skill_evaluations.edited_at IS
  'Timestamp of the most recent director correction. NULL for evaluations never corrected. Added 2026-09-01.';

COMMENT ON COLUMN student_skill_evaluations.edit_reason IS
  'Director-supplied reason for the correction. NULL for evaluations never corrected. Added 2026-09-01.';

-- ROLLBACK:
-- ALTER TABLE student_skill_evaluations DROP COLUMN IF EXISTS edit_reason;
-- ALTER TABLE student_skill_evaluations DROP COLUMN IF EXISTS edited_at;
-- ALTER TABLE student_skill_evaluations DROP COLUMN IF EXISTS edited_by;

-- Below-minimum NREMT pass: examiner must give a reason; stored with the evaluation.
-- Additive, idempotent. Who = evaluator_id, when = created_at (already on the row).
ALTER TABLE student_skill_evaluations
  ADD COLUMN IF NOT EXISTS below_min_pass_reason text;

-- ROLLBACK:
-- ALTER TABLE student_skill_evaluations DROP COLUMN IF EXISTS below_min_pass_reason;  -- loses the stored reasons only

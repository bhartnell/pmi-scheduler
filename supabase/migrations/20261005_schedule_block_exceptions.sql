-- EVENT-EDIT 1/5: per-instance exception against a recurring schedule block.
-- Additive + idempotent. New table only; no existing table or block is touched,
-- so a block with no exception behaves exactly as before. No UI/sync yet (2/5-5/5).
-- Cohort-scoped via program_schedule_id (pmi_program_schedules.cohort_id).
CREATE TABLE IF NOT EXISTS pmi_schedule_block_exceptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recurring_group_id uuid NOT NULL,
  program_schedule_id uuid REFERENCES pmi_program_schedules(id) ON DELETE SET NULL,
  instance_date date NOT NULL,
  overrides jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_cancelled boolean NOT NULL DEFAULT false,
  note text,
  created_by uuid REFERENCES lab_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pmi_schedule_block_exceptions_unique UNIQUE (recurring_group_id, instance_date)
);

CREATE INDEX IF NOT EXISTS idx_psbe_program_schedule ON pmi_schedule_block_exceptions (program_schedule_id);
CREATE INDEX IF NOT EXISTS idx_psbe_instance_date ON pmi_schedule_block_exceptions (instance_date);

ALTER TABLE pmi_schedule_block_exceptions ENABLE ROW LEVEL SECURITY;
-- Service-role only (app reads via API routes), matching the app's deny-by-default contract.

-- ROLLBACK:
-- DROP TABLE IF EXISTS pmi_schedule_block_exceptions;

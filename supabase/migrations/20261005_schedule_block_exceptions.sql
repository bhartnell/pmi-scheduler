-- EVENT-EDIT 1/5: per-instance exception against a recurring schedule block.
-- Additive + idempotent. NEW table only; no existing table or row is touched,
-- so a block with no exception behaves exactly as before. No UI/sync reads this yet.
-- Cohort-scoped via program_schedule_id (-> pmi_program_schedules.cohort_id); not keyed to any one program.
CREATE TABLE IF NOT EXISTS pmi_schedule_block_exceptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recurring_group_id uuid NOT NULL,                    -- the series (pmi_schedule_blocks.recurring_group_id)
  instance_date date NOT NULL,                         -- which occurrence of the series this overrides
  program_schedule_id uuid REFERENCES pmi_program_schedules(id) ON DELETE RESTRICT,
  overrides jsonb NOT NULL DEFAULT '{}'::jsonb,        -- only the fields that differ from the series (e.g. start_time, instructor_id)
  is_cancelled boolean NOT NULL DEFAULT false,         -- instance skipped for this date (archive-don't-delete)
  reason text,
  created_by uuid REFERENCES lab_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pmi_schedule_block_exceptions_unique_instance UNIQUE (recurring_group_id, instance_date)
);

CREATE INDEX IF NOT EXISTS idx_psbe_program_schedule ON pmi_schedule_block_exceptions (program_schedule_id);
CREATE INDEX IF NOT EXISTS idx_psbe_instance_date ON pmi_schedule_block_exceptions (instance_date);

ALTER TABLE pmi_schedule_block_exceptions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'pmi_schedule_block_exceptions' AND policyname = 'Authenticated users can read pmi_schedule_block_exceptions') THEN
    CREATE POLICY "Authenticated users can read pmi_schedule_block_exceptions" ON pmi_schedule_block_exceptions FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'pmi_schedule_block_exceptions' AND policyname = 'Service role bypass for pmi_schedule_block_exceptions') THEN
    CREATE POLICY "Service role bypass for pmi_schedule_block_exceptions" ON pmi_schedule_block_exceptions FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ROLLBACK:
-- DROP TABLE IF EXISTS pmi_schedule_block_exceptions;  -- new/empty table, nothing else depends on it

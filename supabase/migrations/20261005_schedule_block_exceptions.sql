-- EVENT-EDIT 1/5: per-instance exception against a recurring schedule block.
-- Strictly additive: new table only, no existing table/column touched. A block
-- with no row here behaves exactly as before. No code reads this table yet
-- (editor = 3/5, sync = 2/5).
--
-- Series key = pmi_schedule_blocks.recurring_group_id; the instance is the
-- series member dated instance_date. program_schedule_id scopes the exception
-- to a cohort's schedule (repeatable per cohort, not a one-off).
-- `overrides` holds only the fields that differ, keyed by pmi_schedule_blocks
-- column name (e.g. {"instructor_id": "...", "start_time": "13:00"}).
-- is_cancelled = true means "this instance does not happen".

CREATE TABLE IF NOT EXISTS schedule_block_exceptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recurring_group_id uuid NOT NULL,
  instance_date date NOT NULL,
  program_schedule_id uuid REFERENCES pmi_program_schedules(id) ON DELETE CASCADE,
  overrides jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_cancelled boolean NOT NULL DEFAULT false,
  note text,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT schedule_block_exceptions_instance_key UNIQUE (recurring_group_id, instance_date)
);

CREATE INDEX IF NOT EXISTS idx_sbe_group ON schedule_block_exceptions (recurring_group_id);
CREATE INDEX IF NOT EXISTS idx_sbe_program_schedule ON schedule_block_exceptions (program_schedule_id);

ALTER TABLE schedule_block_exceptions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'schedule_block_exceptions' AND policyname = 'Authenticated users can read schedule_block_exceptions') THEN
    CREATE POLICY "Authenticated users can read schedule_block_exceptions" ON schedule_block_exceptions FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'schedule_block_exceptions' AND policyname = 'Service role bypass for schedule_block_exceptions') THEN
    CREATE POLICY "Service role bypass for schedule_block_exceptions" ON schedule_block_exceptions FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ROLLBACK:
-- DROP TABLE IF EXISTS schedule_block_exceptions;  -- new empty table, nothing else depends on it

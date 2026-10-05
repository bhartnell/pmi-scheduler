-- EVENT-EDIT 1/5: per-instance exception against a recurring schedule block.
-- Additive + idempotent + nullable-by-design. Nothing reads this table yet, so
-- every existing block behaves exactly as before. Cohort-scoped via
-- program_schedule_id (-> pmi_program_schedules.cohort_id); not keyed to any
-- one program. One exception per (series, date).
CREATE TABLE IF NOT EXISTS pmi_schedule_block_exceptions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_schedule_id uuid REFERENCES pmi_program_schedules(id) ON DELETE CASCADE,
  recurring_group_id  uuid NOT NULL,        -- the series (pmi_schedule_blocks.recurring_group_id)
  instance_date       date NOT NULL,        -- which occurrence differs
  overrides           jsonb NOT NULL DEFAULT '{}'::jsonb,  -- only the fields that differ (start_time, end_time, title, room_id, instructor_id, ...)
  is_cancelled        boolean NOT NULL DEFAULT false,
  note                text,
  created_by          text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pmi_schedule_block_exceptions_series_date_key UNIQUE (recurring_group_id, instance_date)
);

CREATE INDEX IF NOT EXISTS idx_schedule_block_exceptions_program
  ON pmi_schedule_block_exceptions (program_schedule_id);
CREATE INDEX IF NOT EXISTS idx_schedule_block_exceptions_date
  ON pmi_schedule_block_exceptions (instance_date);

ALTER TABLE pmi_schedule_block_exceptions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'pmi_schedule_block_exceptions' AND policyname = 'Authenticated users can read pmi_schedule_block_exceptions') THEN
    CREATE POLICY "Authenticated users can read pmi_schedule_block_exceptions"
      ON pmi_schedule_block_exceptions FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'pmi_schedule_block_exceptions' AND policyname = 'Service role bypass for pmi_schedule_block_exceptions') THEN
    CREATE POLICY "Service role bypass for pmi_schedule_block_exceptions"
      ON pmi_schedule_block_exceptions FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ROLLBACK:
-- DROP TABLE IF EXISTS pmi_schedule_block_exceptions;  -- new, unread table; no existing data depends on it

-- CAL 2/3a: retry queue for day-level lab event re-plans.
-- When the shared-calendar writer's token is missing/expired (or a sync fails),
-- the (cohort, date) is queued here instead of dropping guests or falling back
-- to another user's token. Additive and idempotent.

CREATE TABLE IF NOT EXISTS "lab_day_event_replan_queue" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id uuid NOT NULL,
  date date NOT NULL,
  reason text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done')),
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- One pending row per (cohort, date); repeated triggers collapse into it.
CREATE UNIQUE INDEX IF NOT EXISTS uq_lab_day_event_replan_pending
  ON "lab_day_event_replan_queue" (cohort_id, date) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_lab_day_event_replan_status
  ON "lab_day_event_replan_queue" (status, created_at);

ALTER TABLE "lab_day_event_replan_queue" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access" ON "lab_day_event_replan_queue";
CREATE POLICY "Service role full access" ON "lab_day_event_replan_queue"
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ROLLBACK: DROP TABLE IF EXISTS "lab_day_event_replan_queue";  (queue rows are transient retry markers; no business data)

-- Snapshot table for /api/lvfr-aemt/planner/reseed's confirm-guard.
--
-- Task Handoff Queue: "[DATA-SAFETY GUARD] Guard planner/reseed/route.ts:
-- it DELETES+reinserts ALL plan_placements from hardcoded data = a
-- placement-wipe hazard." Ben approved guarding the existing reseed route
-- (not de-hardcoding it — that's the separate post-launch consolidation).
--
-- The reseed route now snapshots every existing placement row for the
-- instance into this table (as JSON) before it deletes them, and refuses
-- to run at all unless the caller passes confirm=true. This gives a
-- reversible path: SELECT placements FROM lvfr_aemt_plan_placements_backups
-- WHERE id = '<id>' and re-insert.
--
-- Additive + idempotent.

CREATE TABLE IF NOT EXISTS lvfr_aemt_plan_placements_backups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  instance_id UUID NOT NULL,
  row_count INTEGER NOT NULL,
  placements JSONB NOT NULL,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE lvfr_aemt_plan_placements_backups ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'plan_placements_backups_service' AND tablename = 'lvfr_aemt_plan_placements_backups') THEN
    CREATE POLICY "plan_placements_backups_service" ON lvfr_aemt_plan_placements_backups FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_plan_placements_backups_instance ON lvfr_aemt_plan_placements_backups(instance_id, created_at DESC);

-- ROLLBACK:
-- DROP TABLE IF EXISTS lvfr_aemt_plan_placements_backups;

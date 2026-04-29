-- One-off data fix: ensure Michael Gannon is flagged as a part-time
-- instructor so he shows up in the coordinator calendar's default
-- 'Part-timers' scope (Scheduling Overhaul #2 follow-up).
--
-- The migration is idempotent: it logs the current state, flips the
-- flag only when it's currently false, and prints what changed.
-- Re-running is a no-op once the flag is set.

DO $$
DECLARE
  r RECORD;
  fixed INTEGER := 0;
BEGIN
  FOR r IN
    SELECT id, email, name, is_part_time
    FROM lab_users
    WHERE email ILIKE '%gannon%'
  LOOP
    RAISE NOTICE 'Found: % (% — %) is_part_time=%',
      r.email, r.name, r.id, r.is_part_time;
    IF r.is_part_time IS NOT TRUE THEN
      UPDATE lab_users SET is_part_time = TRUE WHERE id = r.id;
      fixed := fixed + 1;
      RAISE NOTICE '  → set is_part_time=true';
    ELSE
      RAISE NOTICE '  → already part-time, no change';
    END IF;
  END LOOP;
  IF fixed = 0 THEN
    RAISE NOTICE 'No Gannon rows needed updating.';
  ELSE
    RAISE NOTICE 'Updated % Gannon row(s).', fixed;
  END IF;
END $$;

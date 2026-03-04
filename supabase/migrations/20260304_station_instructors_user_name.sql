-- Fix station_instructors: add user_name column if missing
-- The CREATE TABLE IF NOT EXISTS in the original migration doesn't alter
-- an already-existing table, so this column may be absent.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'station_instructors' AND column_name = 'user_name'
  ) THEN
    ALTER TABLE station_instructors ADD COLUMN user_name TEXT;
  END IF;
END $$;

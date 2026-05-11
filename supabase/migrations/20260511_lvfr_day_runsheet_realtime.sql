-- LVFR runsheet realtime — enable Supabase Realtime postgres_changes
-- on lvfr_schedule_items + lvfr_day_schedule so the day runsheet UI
-- can show live multi-instructor checkoffs.
--
-- The Realtime WebSocket authenticates as the `anon` role (NextAuth
-- does not flow a JWT into the supabase-js client), so we need:
--   1. RLS enabled on the tables
--   2. an anon SELECT policy so the WebSocket can observe changes
--   3. the tables added to the supabase_realtime publication
--
-- Write access is unaffected — all mutations go through API routes
-- that use the service-role client, which bypasses RLS. The page
-- itself is already gated by /lvfr-aemt/layout.tsx (canAccessLVFR),
-- so anon-read at the DB layer is acceptable.
--
-- Mirrors the pattern set by 20260414_lab_day_chat_realtime_rls.sql.

ALTER TABLE lvfr_schedule_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE lvfr_day_schedule   ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'lvfr_schedule_items'
      AND policyname = 'realtime anon can read items'
  ) THEN
    CREATE POLICY "realtime anon can read items"
      ON lvfr_schedule_items FOR SELECT TO anon USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'lvfr_day_schedule'
      AND policyname = 'realtime anon can read day schedule'
  ) THEN
    CREATE POLICY "realtime anon can read day schedule"
      ON lvfr_day_schedule FOR SELECT TO anon USING (true);
  END IF;
END $$;

-- supabase-js authenticated role also needs to read, since the
-- coordinator's session-mode client (not just realtime) reads from
-- these tables. Keep parity with the items table for both reads.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'lvfr_schedule_items'
      AND policyname = 'authenticated can read items'
  ) THEN
    CREATE POLICY "authenticated can read items"
      ON lvfr_schedule_items FOR SELECT TO authenticated USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'lvfr_day_schedule'
      AND policyname = 'authenticated can read day schedule'
  ) THEN
    CREATE POLICY "authenticated can read day schedule"
      ON lvfr_day_schedule FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

-- Add to supabase_realtime publication so postgres_changes fires.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'lvfr_schedule_items'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE lvfr_schedule_items;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'lvfr_day_schedule'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE lvfr_day_schedule;
  END IF;
END $$;

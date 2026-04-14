-- Lab day chat Realtime fix
--
-- The lab day chat subscribes to postgres_changes on lab_day_messages via
-- the Supabase anon key (NextAuth does not flow a JWT into the Supabase
-- client, so the Realtime WebSocket authenticates as `anon`). Realtime
-- evaluates RLS against that role, so without an anon SELECT policy every
-- subscription silently receives zero rows and presence connects cannot
-- complete, which is exactly the "0 connected" symptom we saw on NREMT
-- day. We allow SELECT for anon with `using (true)` because:
--   1. The chat UI is already gated by NextAuth session / volunteer token
--      checks at the page level, and the write path stays locked down
--      (INSERT still requires authenticated + application checks via the
--      API route).
--   2. Realtime only broadcasts rows that pass SELECT RLS — we have to
--      allow anon to SELECT for the WebSocket to see inserts.
--
-- Safe to re-run: IF NOT EXISTS guards the policy creation.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'lab_day_messages'
      AND policyname = 'realtime anon can read messages'
  ) THEN
    CREATE POLICY "realtime anon can read messages"
      ON lab_day_messages
      FOR SELECT
      TO anon
      USING (true);
  END IF;
END $$;

-- Ensure the table is in the supabase_realtime publication (idempotent —
-- ALTER PUBLICATION errors if the table is already a member, so we check
-- first).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND tablename = 'lab_day_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE lab_day_messages;
  END IF;
END $$;

-- Lab timer state Realtime fix
--
-- GlobalTimerBanner discovers a newly-started timer via a 60s poll (kept
-- deliberately slow after the 2026-05-26 lab incident, where a shorter
-- discovery interval hammered the backend across every open tab). Ben
-- wants other graders to see a started timer within seconds, not up to a
-- minute. Rather than shortening the poll again (same class of regression),
-- this adds a Supabase Realtime subscription on lab_timer_state alongside
-- the existing (unchanged) poll, which remains as a safety-net fallback.
--
-- Same reasoning as 20260414_lab_day_chat_realtime_rls.sql: NextAuth does
-- not flow a JWT into the Supabase client, so the Realtime WebSocket
-- authenticates as `anon`. Realtime evaluates RLS against that role, so
-- without an anon SELECT policy every subscription silently receives zero
-- rows. The write path is unaffected — INSERT/UPDATE/DELETE stay locked to
-- `authenticated` (see baseline policies), only SELECT is opened to anon so
-- Realtime can broadcast row changes to the banner.
--
-- Safe to re-run: IF NOT EXISTS guards both the policy and publication add.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'lab_timer_state'
      AND policyname = 'realtime anon can read timer state'
  ) THEN
    CREATE POLICY "realtime anon can read timer state"
      ON lab_timer_state
      FOR SELECT
      TO anon
      USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND tablename = 'lab_timer_state'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE lab_timer_state;
  END IF;
END $$;

-- ROLLBACK:
-- DROP POLICY IF EXISTS "realtime anon can read timer state" ON lab_timer_state;
-- ALTER PUBLICATION supabase_realtime DROP TABLE lab_timer_state;

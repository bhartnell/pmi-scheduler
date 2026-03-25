-- Add RLS policies to OSCE observer tables
-- Tables already exist from 20260305_osce_observers.sql + 20260306_osce_events.sql
-- This migration adds the missing RLS policies

-- osce_observers: public insert (signup form), service-role read
ALTER TABLE osce_observers ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'osce_observers' AND policyname = 'osce_observers_public_insert') THEN
    CREATE POLICY "osce_observers_public_insert" ON osce_observers FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'osce_observers' AND policyname = 'osce_observers_service_read') THEN
    CREATE POLICY "osce_observers_service_read" ON osce_observers FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'osce_observers' AND policyname = 'osce_observers_service_all') THEN
    CREATE POLICY "osce_observers_service_all" ON osce_observers FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- osce_time_blocks: public read, service-role write
ALTER TABLE osce_time_blocks ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'osce_time_blocks' AND policyname = 'osce_time_blocks_public_read') THEN
    CREATE POLICY "osce_time_blocks_public_read" ON osce_time_blocks FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'osce_time_blocks' AND policyname = 'osce_time_blocks_service_all') THEN
    CREATE POLICY "osce_time_blocks_service_all" ON osce_time_blocks FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- osce_observer_blocks: public insert (signup form), service-role read
ALTER TABLE osce_observer_blocks ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'osce_observer_blocks' AND policyname = 'osce_observer_blocks_public_insert') THEN
    CREATE POLICY "osce_observer_blocks_public_insert" ON osce_observer_blocks FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'osce_observer_blocks' AND policyname = 'osce_observer_blocks_service_read') THEN
    CREATE POLICY "osce_observer_blocks_service_read" ON osce_observer_blocks FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'osce_observer_blocks' AND policyname = 'osce_observer_blocks_service_all') THEN
    CREATE POLICY "osce_observer_blocks_service_all" ON osce_observer_blocks FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

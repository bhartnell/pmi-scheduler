-- OSCE Events: Make the observer signup system reusable per semester
-- Creates a parent osce_events table and links all child tables via event_id

-- 1. Create osce_events table
CREATE TABLE IF NOT EXISTS osce_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  subtitle TEXT,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  location TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  max_observers_per_block INTEGER DEFAULT 4,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'open', 'closed', 'archived')),
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_osce_events_slug ON osce_events(slug);
CREATE INDEX IF NOT EXISTS idx_osce_events_status ON osce_events(status);

-- RLS
ALTER TABLE osce_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'osce_events_service_role') THEN
    CREATE POLICY "osce_events_service_role" ON osce_events FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 2. Seed the Spring 2026 event for existing data
INSERT INTO osce_events (title, subtitle, slug, description, location, start_date, end_date, max_observers_per_block, status, created_by)
VALUES (
  'Clinical Capstone Spring 2026',
  'Paramedic OSCE',
  'spring-2026',
  'Join our Medical Directors and faculty as an evaluator for the Spring 2026 Paramedic Clinical Capstone assessment.',
  'PMI Paramedic Lab — Las Vegas Campus',
  '2026-03-30',
  '2026-03-31',
  4,
  'open',
  'bhartnell@pmi.edu'
) ON CONFLICT (slug) DO NOTHING;

-- 3. Add event_id column to child tables
ALTER TABLE osce_time_blocks ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES osce_events(id) ON DELETE CASCADE;
ALTER TABLE osce_observers ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES osce_events(id) ON DELETE CASCADE;
ALTER TABLE osce_student_agencies ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES osce_events(id) ON DELETE CASCADE;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'osce_student_schedule') THEN
    EXECUTE 'ALTER TABLE osce_student_schedule ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES osce_events(id) ON DELETE CASCADE';
  END IF;
END $$;

-- 4. Backfill existing records to Spring 2026 event
DO $$
DECLARE
  spring_event_id UUID;
BEGIN
  SELECT id INTO spring_event_id FROM osce_events WHERE slug = 'spring-2026';
  IF spring_event_id IS NOT NULL THEN
    UPDATE osce_time_blocks SET event_id = spring_event_id WHERE event_id IS NULL;
    UPDATE osce_observers SET event_id = spring_event_id WHERE event_id IS NULL;
    UPDATE osce_student_agencies SET event_id = spring_event_id WHERE event_id IS NULL;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'osce_student_schedule') THEN
      EXECUTE format('UPDATE osce_student_schedule SET event_id = %L WHERE event_id IS NULL', spring_event_id);
    END IF;
  END IF;
END $$;

-- 5. Make event_id NOT NULL after backfill
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM osce_time_blocks WHERE event_id IS NULL) THEN
    ALTER TABLE osce_time_blocks ALTER COLUMN event_id SET NOT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM osce_observers WHERE event_id IS NULL) THEN
    ALTER TABLE osce_observers ALTER COLUMN event_id SET NOT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM osce_student_agencies WHERE event_id IS NULL) THEN
    ALTER TABLE osce_student_agencies ALTER COLUMN event_id SET NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'osce_student_schedule') THEN
    IF NOT EXISTS (SELECT 1 FROM osce_student_schedule WHERE event_id IS NULL) THEN
      ALTER TABLE osce_student_schedule ALTER COLUMN event_id SET NOT NULL;
    END IF;
  END IF;
END $$;

-- 6. Update unique constraint: email alone → (event_id, email)
ALTER TABLE osce_observers DROP CONSTRAINT IF EXISTS osce_observers_email_key;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'osce_observers_event_email_unique'
  ) THEN
    ALTER TABLE osce_observers ADD CONSTRAINT osce_observers_event_email_unique UNIQUE (event_id, email);
  END IF;
END $$;

-- 7. Indexes on event_id
CREATE INDEX IF NOT EXISTS idx_osce_time_blocks_event ON osce_time_blocks(event_id);
CREATE INDEX IF NOT EXISTS idx_osce_observers_event ON osce_observers(event_id);
CREATE INDEX IF NOT EXISTS idx_osce_student_agencies_event ON osce_student_agencies(event_id);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'osce_student_schedule') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_osce_student_schedule_event ON osce_student_schedule(event_id)';
  END IF;
END $$;

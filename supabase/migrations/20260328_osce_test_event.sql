-- OSCE Test Event: Add event_id to assessments and create dry-run test data
-- This does NOT touch the real Spring 2026 event or its data

-- 1. Add event_id column to osce_assessments (links assessments to events)
ALTER TABLE osce_assessments ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES osce_events(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_osce_assessments_event ON osce_assessments(event_id);

-- 2. Backfill existing assessments to the Spring 2026 event
DO $$
DECLARE
  spring_event_id UUID;
BEGIN
  SELECT id INTO spring_event_id FROM osce_events WHERE slug = 'spring-2026';
  IF spring_event_id IS NOT NULL THEN
    UPDATE osce_assessments SET event_id = spring_event_id WHERE event_id IS NULL;
  END IF;
END $$;

-- 3. Create the test event
INSERT INTO osce_events (title, subtitle, slug, description, location, start_date, end_date, max_observers_per_block, status, event_pin, created_by)
VALUES (
  'OSCE Test Event — DRY RUN',
  'Practice scoring (test data only)',
  'test-dry-run-2026',
  'Dry-run practice event for testing the OSCE scoring workflow. Scores here do NOT affect real assessments.',
  'PMI Paramedic Lab — Test',
  '2026-03-28',
  '2026-03-28',
  4,
  'open',
  'TEST2026',
  'bhartnell@pmi.edu'
) ON CONFLICT (slug) DO NOTHING;

-- 4. Seed test student assessments
DO $$
DECLARE
  test_event_id UUID;
BEGIN
  SELECT id INTO test_event_id FROM osce_events WHERE slug = 'test-dry-run-2026';
  IF test_event_id IS NULL THEN
    RAISE NOTICE 'Test event not found, skipping assessment seed';
    RETURN;
  END IF;

  -- Only insert if no assessments exist for this event yet
  IF NOT EXISTS (SELECT 1 FROM osce_assessments WHERE event_id = test_event_id) THEN
    INSERT INTO osce_assessments (student_name, scenario, slot_number, day_number, assessment_date, event_id)
    VALUES
      ('Test Student Alpha', 'A', 1, 1, '2026-03-28', test_event_id),
      ('Test Student Bravo', 'B', 2, 1, '2026-03-28', test_event_id),
      ('Test Student Charlie', 'D', 3, 1, '2026-03-28', test_event_id);
  END IF;

  -- Create a test time block
  IF NOT EXISTS (SELECT 1 FROM osce_time_blocks WHERE event_id = test_event_id) THEN
    INSERT INTO osce_time_blocks (day_number, label, date, start_time, end_time, max_observers, event_id)
    VALUES (1, 'Test Block AM', '2026-03-28', '09:00', '12:00', 4, test_event_id);
  END IF;
END $$;

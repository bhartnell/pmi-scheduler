-- OSCE Test Event: Seed test evaluators, observers, and guest tokens
-- This does NOT touch the real Spring 2026 event or its data

-- 1. Add event_id column to osce_guest_tokens (links tokens to events)
ALTER TABLE osce_guest_tokens ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES osce_events(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_osce_guest_tokens_event ON osce_guest_tokens(event_id);

-- 2. Add test observers for the test event
DO $$
DECLARE
  test_event_id UUID;
BEGIN
  SELECT id INTO test_event_id FROM osce_events WHERE event_pin = 'TEST2026';
  IF test_event_id IS NULL THEN
    RAISE NOTICE 'Test event not found, skipping observer seed';
    RETURN;
  END IF;

  -- Only insert if observers don't already exist for this event
  IF NOT EXISTS (SELECT 1 FROM osce_observers WHERE event_id = test_event_id AND name = 'Ben Hartnell (Test)') THEN
    INSERT INTO osce_observers (name, title, agency, email, event_id)
    VALUES ('Ben Hartnell (Test)', 'Program Director', 'PMI', 'bhartnell@pmi.edu', test_event_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM osce_observers WHERE event_id = test_event_id AND name = 'Test MD Alpha') THEN
    INSERT INTO osce_observers (name, title, agency, email, event_id, role)
    VALUES ('Test MD Alpha', 'Medical Director', 'Test Agency', 'testmd@test.com', test_event_id, 'md');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM osce_observers WHERE event_id = test_event_id AND name = 'Test Observer Bravo') THEN
    INSERT INTO osce_observers (name, title, agency, email, event_id, role)
    VALUES ('Test Observer Bravo', 'Battalion Chief', 'Test Fire Dept', 'testobs@test.com', test_event_id, 'agency');
  END IF;
END $$;

-- 3. Add test guest tokens
DO $$
DECLARE
  test_event_id UUID;
BEGIN
  SELECT id INTO test_event_id FROM osce_events WHERE event_pin = 'TEST2026';
  IF test_event_id IS NULL THEN
    RAISE NOTICE 'Test event not found, skipping token seed';
    RETURN;
  END IF;

  -- Token for Ben Hartnell (Test)
  IF NOT EXISTS (SELECT 1 FROM osce_guest_tokens WHERE token = 'test-token-ben') THEN
    INSERT INTO osce_guest_tokens (evaluator_name, evaluator_role, event_id, token, valid_until)
    VALUES ('Ben Hartnell (Test)', 'faculty', test_event_id, 'test-token-ben', '2026-12-31T23:59:59Z');
  END IF;

  -- Token for Test MD Alpha
  IF NOT EXISTS (SELECT 1 FROM osce_guest_tokens WHERE token = 'test-token-md') THEN
    INSERT INTO osce_guest_tokens (evaluator_name, evaluator_role, event_id, token, valid_until)
    VALUES ('Test MD Alpha', 'md', test_event_id, 'test-token-md', '2026-12-31T23:59:59Z');
  END IF;

  -- Token for Test Observer Bravo
  IF NOT EXISTS (SELECT 1 FROM osce_guest_tokens WHERE token = 'test-token-obs') THEN
    INSERT INTO osce_guest_tokens (evaluator_name, evaluator_role, event_id, token, valid_until)
    VALUES ('Test Observer Bravo', 'agency', test_event_id, 'test-token-obs', '2026-12-31T23:59:59Z');
  END IF;
END $$;

-- Migration: Critical Bug Fixes — March 14-15
-- Fixes: #3 (lab_day_equipment columns), #4 (ryyoung role), #1 (flatten critical_actions)

-- Fix 4: Ensure ryyoung has admin role (may have been changed to guest/pending)
UPDATE lab_users SET role = 'admin' WHERE email = 'ryyoung@pmi.edu' AND role != 'admin';

-- Fix 4: Clear stale dashboard preferences so he gets fresh admin defaults
DELETE FROM user_preferences WHERE user_email = 'ryyoung@pmi.edu';

-- Fix 3: Ensure lab_day_equipment has all required columns for checkout tracking
ALTER TABLE lab_day_equipment ADD COLUMN IF NOT EXISTS checked_out_by TEXT;
ALTER TABLE lab_day_equipment ADD COLUMN IF NOT EXISTS checked_out_at TIMESTAMPTZ;
ALTER TABLE lab_day_equipment ADD COLUMN IF NOT EXISTS checked_out_by_name TEXT;
ALTER TABLE lab_day_equipment ADD COLUMN IF NOT EXISTS returned_at TIMESTAMPTZ;

-- Fix 1: Flatten critical_actions in scenarios from JSON object strings to plain strings
-- The critical_actions column is text[] — items may be JSON strings like '{"id":"...","description":"..."}'
-- Extract just the description value from any such items
UPDATE scenarios
SET critical_actions = (
  SELECT array_agg(
    CASE
      WHEN elem LIKE '{%"description"%'
        THEN (elem::jsonb)->>'description'
      ELSE elem
    END
  )
  FROM unnest(critical_actions) AS elem
)
WHERE critical_actions IS NOT NULL
  AND array_to_string(critical_actions, ' ') LIKE '%"description"%';

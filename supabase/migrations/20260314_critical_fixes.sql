-- Migration: Critical Bug Fixes — March 14-15
-- Fixes: #3 (lab_day_equipment columns), #4 (ryyoung role)

-- Fix 4: Ensure ryyoung has admin role (may have been changed to guest/pending)
UPDATE lab_users SET role = 'admin' WHERE email = 'ryyoung@pmi.edu' AND role != 'admin';

-- Fix 4: Clear stale dashboard preferences so he gets fresh admin defaults
DELETE FROM user_preferences WHERE user_email = 'ryyoung@pmi.edu';

-- Fix 3: Ensure lab_day_equipment has all required columns for checkout tracking
ALTER TABLE lab_day_equipment ADD COLUMN IF NOT EXISTS checked_out_by TEXT;
ALTER TABLE lab_day_equipment ADD COLUMN IF NOT EXISTS checked_out_at TIMESTAMPTZ;
ALTER TABLE lab_day_equipment ADD COLUMN IF NOT EXISTS checked_out_by_name TEXT;
ALTER TABLE lab_day_equipment ADD COLUMN IF NOT EXISTS returned_at TIMESTAMPTZ;

-- Fix 1: Flatten critical_actions in scenarios from objects to strings
-- Update any scenarios where critical_actions contains [{id, description}] objects
-- to just contain ["description"] strings
UPDATE scenarios
SET critical_actions = (
  SELECT jsonb_agg(
    CASE
      WHEN jsonb_typeof(elem) = 'object' AND elem ? 'description'
        THEN elem->>'description'
      ELSE elem
    END
  )
  FROM jsonb_array_elements(critical_actions::jsonb) AS elem
)
WHERE critical_actions IS NOT NULL
  AND critical_actions::text LIKE '%"description"%'
  AND jsonb_typeof(critical_actions::jsonb) = 'array';

-- Add tour tracking columns to user_preferences
-- These store whether the user has completed the onboarding tour and their last step

ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS tour_completed BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS tour_step INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tour_completed_at TIMESTAMPTZ;

COMMENT ON COLUMN user_preferences.tour_completed IS 'Whether the user has completed (or skipped) the onboarding tour';
COMMENT ON COLUMN user_preferences.tour_step IS 'Last step the user reached in the tour (0 = not started)';
COMMENT ON COLUMN user_preferences.tour_completed_at IS 'Timestamp when the tour was marked complete or skipped';

NOTIFY pgrst, 'reload schema';

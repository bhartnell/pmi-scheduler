-- Add a per-user "dismissed" flag for the home-page Google Calendar
-- connect prompt. Lets instructors X out the banner without it
-- coming back next visit. Resetting to false (e.g. after disconnect)
-- is intentionally not automated — admin can run a one-off update
-- if a campaign needs to re-prompt.

ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS dismissed_calendar_banner boolean DEFAULT false;

COMMENT ON COLUMN user_preferences.dismissed_calendar_banner IS
  'When true, the home-page "Connect your Google Calendar" banner stays hidden for this user even when google_calendar_connected=false.';

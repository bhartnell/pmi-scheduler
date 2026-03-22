-- Granular Notification Preferences
-- Extends notification_settings JSONB in user_preferences to support:
--   - Per-category in_app + email toggles
--   - Quiet hours (start/end time + enabled flag)
--   - Weekly digest toggle
--   - Mute all toggle
--
-- No schema change required; all fields live inside the existing
-- notification_settings JSONB column.  This migration ensures the column
-- exists with a sane default and documents the expected shape.

-- Ensure the notification_settings column exists (already created in
-- 20260203_user_notifications_preferences.sql, guard added for safety)
ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS notification_settings JSONB DEFAULT '{}'::jsonb;

-- Back-fill any rows that have a NULL value so the shape is consistent
UPDATE user_preferences
SET notification_settings = '{}'::jsonb
WHERE notification_settings IS NULL;

-- The canonical shape stored under notification_settings.granular_prefs:
--
-- {
--   "categories": {
--     "labs":       { "in_app": true,  "email": true  },
--     "tasks":      { "in_app": true,  "email": false },
--     "clinical":   { "in_app": true,  "email": true  },
--     "system":     { "in_app": true,  "email": false },
--     "scheduling": { "in_app": true,  "email": true  },
--     "feedback":   { "in_app": true,  "email": false }
--   },
--   "quiet_hours": {
--     "enabled": false,
--     "start":   "22:00",
--     "end":     "07:00"
--   },
--   "weekly_digest": false,
--   "mute_all":      false
-- }

COMMENT ON COLUMN user_preferences.notification_settings IS
  'User notification preferences. Supports legacy keys (email_lab_assignments, etc.) plus '
  'granular_prefs sub-key with per-category in_app/email toggles, quiet_hours, weekly_digest, and mute_all.';

-- Opt-in flag for "notify me when a new lab day is created".
--
-- Context: Gannon will sign up for the occasional lab when his
-- schedule allows, but nothing currently pings him when a new one
-- lands. We add a per-user preference so he (and anyone else we
-- flag) gets an in-app notification; everyone else stays quiet.

ALTER TABLE lab_users
  ADD COLUMN IF NOT EXISTS notify_lab_availability boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN lab_users.notify_lab_availability IS
  'If true, this user receives a notification each time a new lab day is created. Opt-in, defaults false — set by admin via the part-timer admin UI.';

-- Backfill Gannon so the feature is live for him immediately.
UPDATE lab_users
SET notify_lab_availability = true
WHERE email = 'mgannon@pmi.edu';

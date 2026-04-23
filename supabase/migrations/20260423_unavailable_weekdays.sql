-- Per-user unavailable-weekdays for the part-timer scheduling flows.
--
-- Context: Gannon Michael is unavailable Tue + Wed because of his
-- full-time job. His recurring class block has to be logged against
-- whichever weekday is the cohort's Day 1 (Thursday for PM14, Monday
-- for the May cohort) — so hardcoding a weekday doesn't work. The
-- Log Hours modal needs to flag any date that falls on one of these
-- weekdays so we don't accidentally book him on a day he can't work.
--
-- Storage: integer array of weekday numbers 0=Sun, 1=Mon, ..., 6=Sat,
-- matching JS Date#getDay(). NULL/empty = no restriction.

ALTER TABLE lab_users
  ADD COLUMN IF NOT EXISTS unavailable_weekdays integer[];

COMMENT ON COLUMN lab_users.unavailable_weekdays IS
  'Days of the week the user is never available to work, using JS Date#getDay() (0=Sun, 6=Sat). Used by the Log Hours modal to flag conflicts and by the part-timer table to display a badge. NULL / empty = no restriction.';

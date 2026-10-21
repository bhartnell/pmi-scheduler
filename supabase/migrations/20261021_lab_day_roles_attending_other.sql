-- Lab day "Who's coming" block: one list of who is on a lab day.
--
-- Adds (both additive, existing rows untouched):
--   1. role 'attending' to lab_day_roles_role_check, for an instructor who is
--      simply on the day with no lead/roamer/observer/coordinator duty.
--   2. nullable lab_day_roles.other_name, the free-text name for an
--      "Other" attendee who has no lab_users row. Those rows carry a NULL
--      instructor_id (already nullable) and never create a calendar event
--      (no email to invite).
--
-- Unique key (lab_day_id, instructor_id, role) allows many NULL-instructor
-- rows because NULLs are distinct, so several "Other" names can share a day.

ALTER TABLE lab_day_roles
  ADD COLUMN IF NOT EXISTS other_name text;

ALTER TABLE lab_day_roles
  DROP CONSTRAINT IF EXISTS lab_day_roles_role_check;

ALTER TABLE lab_day_roles
  ADD CONSTRAINT lab_day_roles_role_check
  CHECK (role = ANY (ARRAY[
    'lab_lead'::text,
    'roamer'::text,
    'observer'::text,
    'coordinator'::text,
    'attending'::text
  ]));

COMMENT ON COLUMN lab_day_roles.other_name IS
  'Free-text name for an "Other" attendee with no lab_users row (instructor_id NULL). Set only by the lab day Who''s coming block.';

-- ROLLBACK:
-- DELETE FROM lab_day_roles WHERE role = 'attending';  -- only if any exist; snapshot first
-- ALTER TABLE lab_day_roles DROP CONSTRAINT IF EXISTS lab_day_roles_role_check;
-- ALTER TABLE lab_day_roles ADD CONSTRAINT lab_day_roles_role_check
--   CHECK (role = ANY (ARRAY['lab_lead'::text,'roamer'::text,'observer'::text,'coordinator'::text]));
-- ALTER TABLE lab_day_roles DROP COLUMN IF EXISTS other_name;

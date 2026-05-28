-- Add 'coordinator' to lab_day_roles.role CHECK constraint
--
-- Original constraint only allowed lab_lead/roamer/observer for
-- per-lab-day instructor roles. 2026-05-28: adding 'coordinator'
-- so we can bulk-assign a program coordinator (e.g. Hartnell for
-- the PM G14 / PM G15 / EMT G5 summer block) without it competing
-- with the actual lab_lead designation per day. A coordinator is
-- "logistical owner / contact" rather than "instructor running
-- this room", which is the semantic gap the existing three roles
-- couldn't fill.
--
-- Forward-only — there's no historical data to migrate. The new
-- value is purely additive; existing rows are untouched.

ALTER TABLE lab_day_roles
  DROP CONSTRAINT IF EXISTS lab_day_roles_role_check;

ALTER TABLE lab_day_roles
  ADD CONSTRAINT lab_day_roles_role_check
  CHECK (role = ANY (ARRAY[
    'lab_lead'::text,
    'roamer'::text,
    'observer'::text,
    'coordinator'::text
  ]));

COMMENT ON COLUMN lab_day_roles.role IS
  'Per-lab-day role: lab_lead (runs the lab), roamer (floats), observer (shadowing), coordinator (logistical owner / contact, no teaching slot).';

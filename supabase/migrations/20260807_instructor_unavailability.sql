-- Instructor unavailability — foundation for the [AVAILABILITY SYSTEM]
-- self-edit + recurring-rules task and its first use case, Josh
-- Lomonaco's schedule (Task Handoff Queue, both queued 2026-07/08,
-- Ben GO via Cowork 2026-08-07).
--
-- instructor_availability / recurring_availability_templates store
-- POSITIVE availability only. There is currently no way to mark a
-- full-timer unavailable that beats the "full-time = default
-- available" rule in app/api/lab-management/instructor-availability
-- (confirmed live 2026-07-27: deleting availability rows does nothing
-- for a full-timer, since that endpoint doesn't gate full-timers on
-- explicit rows at all — see route.ts). These two tables are the
-- override records that endpoint will need to check.
--
-- This migration is schema-only and additive: nothing reads from
-- these tables yet, so applying it changes no live behavior. Wiring
-- them into the instructor-availability picker (and removing/
-- reworking the separate hardcoded RT-only exclusion list in
-- lib/rt-only-instructors.ts, which does a full hide rather than the
-- "assignable but not default" Ben now wants) is a deliberately
-- separate, held checkpoint — that part touches every instructor's
-- visible availability and needs its own canary/verify pass.

-- ─── Specific-date / date-range unavailability blocks ──────────────────
-- e.g. Josh's 8/24-8/28 Touro week, or a single OSCE day.
CREATE TABLE IF NOT EXISTS instructor_unavailability (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_id      uuid        NOT NULL REFERENCES lab_users(id) ON DELETE CASCADE,
  created_by         uuid                 REFERENCES lab_users(id) ON DELETE SET NULL,
  start_date         date        NOT NULL,
  end_date           date        NOT NULL,
  start_time         time,
  end_time           time,
  is_all_day         boolean     NOT NULL DEFAULT true,
  reason             text,
  notes              text,
  source_template_id uuid,       -- FK added below, after the template table exists
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date),
  CHECK (is_all_day OR (start_time IS NOT NULL AND end_time IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_instructor_unavailability_instructor_dates
  ON instructor_unavailability (instructor_id, start_date, end_date);

COMMENT ON TABLE instructor_unavailability IS
  'Specific-date/range unavailability blocks that override the full-timer default-available rule. Empty until the recurring-unavailability mechanism + picker wiring checkpoint lands; Josh Lomonaco data-load is separately gated pending Ben confirm on the 9/23->9/8 trade + 10/23 conditional make-up.';

-- ─── Recurring unavailability rules ─────────────────────────────────────
-- Mirrors recurring_availability_templates, but end_date is NULLABLE to
-- support Ben's "open-ended, until I turn it off" flavor (recurring_
-- availability_templates requires a bound; unavailability doesn't).
-- Count-bounded rules ("unavailable for 15 Thursdays") are expected to
-- be resolved to a concrete end_date client-side at creation time rather
-- than tracked as an occurrence counter here, mirroring how the existing
-- availability template resolves to explicit dates on expansion.
CREATE TABLE IF NOT EXISTS recurring_unavailability_templates (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_id  uuid        NOT NULL REFERENCES lab_users(id) ON DELETE CASCADE,
  created_by     uuid                 REFERENCES lab_users(id) ON DELETE SET NULL,
  weekdays       integer[]   NOT NULL,
  start_time     time,
  end_time       time,
  is_all_day     boolean     NOT NULL DEFAULT true,
  frequency      text        NOT NULL DEFAULT 'weekly'
                             CHECK (frequency IN ('weekly','biweekly')),
  start_date     date        NOT NULL,
  end_date       date,       -- NULL = open-ended, active until is_active is turned off
  reason         text,
  notes          text,
  is_active      boolean     NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date IS NULL OR end_date >= start_date),
  CHECK (is_all_day OR (start_time IS NOT NULL AND end_time IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_recurring_unavailability_instructor
  ON recurring_unavailability_templates (instructor_id)
  WHERE is_active = true;

ALTER TABLE instructor_unavailability
  ADD CONSTRAINT instructor_unavailability_source_template_id_fkey
  FOREIGN KEY (source_template_id)
  REFERENCES recurring_unavailability_templates(id) ON DELETE SET NULL;

COMMENT ON TABLE recurring_unavailability_templates IS
  'Weekly/biweekly unavailability patterns per instructor (Josh Touro Mon/Wed, Ryan masters-program days, etc). end_date NULL = open-ended until deactivated. Expands to instructor_unavailability rows on save, mirroring recurring_availability_templates.';

-- RLS mirrors recurring_availability_templates exactly (same read/write
-- role bands). Self-edit scoping (an instructor editing only their own
-- rows) is enforced in the API route layer, not here — same pattern the
-- existing availability tables use, since all current writes go through
-- getSupabaseAdmin() service-role routes.
ALTER TABLE instructor_unavailability ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_unavailability_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read instructor unavailability" ON instructor_unavailability;
CREATE POLICY "read instructor unavailability"
  ON instructor_unavailability FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM lab_users lu
      WHERE lower(lu.email) = lower(auth.jwt() ->> 'email')
        AND lu.role IN ('instructor','lead_instructor','admin','superadmin')
    )
  );

DROP POLICY IF EXISTS "write instructor unavailability" ON instructor_unavailability;
CREATE POLICY "write instructor unavailability"
  ON instructor_unavailability FOR ALL
  USING (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM lab_users lu
      WHERE lower(lu.email) = lower(auth.jwt() ->> 'email')
        AND lu.role IN ('instructor','lead_instructor','admin','superadmin')
    )
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM lab_users lu
      WHERE lower(lu.email) = lower(auth.jwt() ->> 'email')
        AND lu.role IN ('instructor','lead_instructor','admin','superadmin')
    )
  );

DROP POLICY IF EXISTS "read recurring unavailability templates" ON recurring_unavailability_templates;
CREATE POLICY "read recurring unavailability templates"
  ON recurring_unavailability_templates FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM lab_users lu
      WHERE lower(lu.email) = lower(auth.jwt() ->> 'email')
        AND lu.role IN ('instructor','lead_instructor','admin','superadmin')
    )
  );

DROP POLICY IF EXISTS "write recurring unavailability templates" ON recurring_unavailability_templates;
CREATE POLICY "write recurring unavailability templates"
  ON recurring_unavailability_templates FOR ALL
  USING (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM lab_users lu
      WHERE lower(lu.email) = lower(auth.jwt() ->> 'email')
        AND lu.role IN ('instructor','lead_instructor','admin','superadmin')
    )
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM lab_users lu
      WHERE lower(lu.email) = lower(auth.jwt() ->> 'email')
        AND lu.role IN ('instructor','lead_instructor','admin','superadmin')
    )
  );

-- ─── Per-instructor paramedic-lab default flag ──────────────────────────
-- Ben 2026-08-07: some full-time lab_users are NOT paramedic-lab pool
-- staff (RT/respiratory-therapy instructors who help on ACLS only) and
-- must not default-available for paramedic labs, but must stay
-- assignable to specific events. Default TRUE preserves today's actual
-- behavior for every instructor not explicitly listed below (today,
-- literally every full-timer is default-available) — only the 5 named
-- RT instructors are flipped false. This column is additive/unread by
-- any code yet; the picker-wiring checkpoint (separate, held) will also
-- need to replace the hardcoded full-hide in lib/rt-only-instructors.ts,
-- which currently fully excludes 3 of these 5 names rather than the
-- "assignable but not default" behavior Ben now wants, and doesn't
-- exclude the other 2 (Michelle Adams, Tamra Kankoski) at all today.
ALTER TABLE lab_users
  ADD COLUMN IF NOT EXISTS paramedic_lab_default boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN lab_users.paramedic_lab_default IS
  'Whether this instructor should be included in paramedic-lab default-available classification. FALSE for RT/other-program full-timers who still need to be assignable but not default-available (Ben 2026-08-07). Not yet read by any endpoint — see instructor-availability picker wiring checkpoint.';

UPDATE lab_users SET paramedic_lab_default = false
WHERE email IN (
  'chooshmand@pmi.edu', -- Christopher Hooshmand
  'dridgell@pmi.edu',   -- Denise Ridgell
  'madams@pmi.edu',     -- Michelle Adams
  'tkankoski@pmi.edu',  -- Tamra Kankoski
  'tmate@pmi.edu'       -- Tiffany M. Mate
);

-- ROLLBACK:
-- UPDATE lab_users SET paramedic_lab_default = true WHERE email IN (
--   'chooshmand@pmi.edu','dridgell@pmi.edu','madams@pmi.edu','tkankoski@pmi.edu','tmate@pmi.edu'
-- );
-- ALTER TABLE lab_users DROP COLUMN IF EXISTS paramedic_lab_default;
-- ALTER TABLE instructor_unavailability DROP CONSTRAINT IF EXISTS instructor_unavailability_source_template_id_fkey;
-- DROP TABLE IF EXISTS instructor_unavailability;
-- DROP TABLE IF EXISTS recurring_unavailability_templates;

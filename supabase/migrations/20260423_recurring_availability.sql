-- Recurring availability templates — April 23 batch item #6.
--
-- Trevor-style patterns: "I'm always available Thursday + Friday, plus
-- every other Wednesday". Admins enter one template; the server
-- expands to explicit instructor_availability rows. Keeping the
-- template table around (vs just creating the rows) lets us
-- re-generate if dates shift and makes it obvious what the intent was.

CREATE TABLE IF NOT EXISTS recurring_availability_templates (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_id    uuid        NOT NULL REFERENCES lab_users(id) ON DELETE CASCADE,
  created_by       uuid                 REFERENCES lab_users(id) ON DELETE SET NULL,
  -- JS Date#getDay() semantics: 0=Sun, 6=Sat. Empty array = 0 expansions
  -- (server rejects empty on create).
  weekdays         integer[]   NOT NULL,
  start_time       time        NOT NULL,
  end_time         time        NOT NULL,
  is_all_day       boolean     NOT NULL DEFAULT false,
  frequency        text        NOT NULL DEFAULT 'weekly'
                               CHECK (frequency IN ('weekly','biweekly')),
  start_date       date        NOT NULL,
  end_date         date        NOT NULL,
  notes            text,
  is_active        boolean     NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_recurring_availability_instructor
  ON recurring_availability_templates (instructor_id)
  WHERE is_active = true;

ALTER TABLE recurring_availability_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read recurring availability templates"
  ON recurring_availability_templates;
CREATE POLICY "read recurring availability templates"
  ON recurring_availability_templates FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM lab_users lu
      WHERE lower(lu.email) = lower(auth.jwt() ->> 'email')
        AND lu.role IN ('instructor','lead_instructor','admin','superadmin')
    )
  );

DROP POLICY IF EXISTS "write recurring availability templates"
  ON recurring_availability_templates;
CREATE POLICY "write recurring availability templates"
  ON recurring_availability_templates FOR ALL
  USING (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM lab_users lu
      WHERE lower(lu.email) = lower(auth.jwt() ->> 'email')
        AND lu.role IN ('lead_instructor','admin','superadmin')
    )
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM lab_users lu
      WHERE lower(lu.email) = lower(auth.jwt() ->> 'email')
        AND lu.role IN ('lead_instructor','admin','superadmin')
    )
  );

-- Optional linkage so expanded availability rows can be traced back to
-- their source template (and deleted together if the template is
-- deactivated later).
ALTER TABLE instructor_availability
  ADD COLUMN IF NOT EXISTS source_template_id uuid
    REFERENCES recurring_availability_templates(id) ON DELETE SET NULL;

COMMENT ON TABLE recurring_availability_templates IS
  'Weekly/biweekly availability patterns per instructor. Expands to instructor_availability rows on save; source_template_id back-links for cleanup.';

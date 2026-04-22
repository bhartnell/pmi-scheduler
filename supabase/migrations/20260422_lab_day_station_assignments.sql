-- Lab Day Station Assignments — Checkoff Day Part 2 (Friday 2026-04-24).
--
-- Pre-assigns students to org stations on a lab day so Ryan (coordinator)
-- can see "Daniel Nixon is at Station 2 — Ambulance Org" when he's
-- pulling students for the intubation checkoff. This is different from
-- lab_day_student_queue (runtime throughput) and from lab_group_members
-- (permanent cohort grouping) — it's a per-lab-day seating chart.
--
-- Checkoff stations themselves do NOT get pre-assignments; students
-- rotate through those dynamically. The UI filters to non-checkoff
-- stations (i.e., stations where metadata.skill_sheet_id !=
-- lab_days.checkoff_skill_sheet_id) when building the assignment panel.

CREATE TABLE IF NOT EXISTS lab_day_station_assignments (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_day_id   uuid        NOT NULL REFERENCES lab_days(id)     ON DELETE CASCADE,
  station_id   uuid        NOT NULL REFERENCES lab_stations(id) ON DELETE CASCADE,
  student_id   uuid        NOT NULL REFERENCES students(id)     ON DELETE CASCADE,
  assigned_by  text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  -- One station per student per lab day. Moving a student = update
  -- this row (upsert via ON CONFLICT), not insert a new one.
  UNIQUE (lab_day_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_lab_day_station_assignments_lab_day
  ON lab_day_station_assignments (lab_day_id);
CREATE INDEX IF NOT EXISTS idx_lab_day_station_assignments_station
  ON lab_day_station_assignments (station_id);

ALTER TABLE lab_day_station_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "instructors read station assignments"
  ON lab_day_station_assignments;
CREATE POLICY "instructors read station assignments"
  ON lab_day_station_assignments FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM lab_users lu
      WHERE lower(lu.email) = lower(auth.jwt() ->> 'email')
        AND lu.role IN ('instructor','lead_instructor','admin','superadmin')
    )
  );

DROP POLICY IF EXISTS "instructors write station assignments"
  ON lab_day_station_assignments;
CREATE POLICY "instructors write station assignments"
  ON lab_day_station_assignments FOR ALL
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

COMMENT ON TABLE lab_day_station_assignments IS
  'Pre-assigned seating chart per lab day. One station per student. Checkoff stations are excluded client-side — students rotate through those.';

-- ============================================
-- SEMESTER SCHEDULING PLANNER
-- Tables for managing room allocation and program scheduling across semesters
-- ============================================

-- 1. pmi_semesters — Academic semester periods
CREATE TABLE IF NOT EXISTS pmi_semesters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE pmi_semesters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role bypass for pmi_semesters" ON pmi_semesters FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can read pmi_semesters" ON pmi_semesters FOR SELECT TO authenticated USING (true);

-- 2. pmi_rooms — Physical rooms at the facility
CREATE TABLE IF NOT EXISTS pmi_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  room_type TEXT NOT NULL CHECK (room_type IN ('classroom', 'lab', 'computer_lab', 'commons', 'other')),
  capacity INTEGER,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE pmi_rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role bypass for pmi_rooms" ON pmi_rooms FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can read pmi_rooms" ON pmi_rooms FOR SELECT TO authenticated USING (true);

-- 3. pmi_room_availability — Per-room availability rules/constraints
CREATE TABLE IF NOT EXISTS pmi_room_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES pmi_rooms(id) ON DELETE CASCADE,
  day_of_week INTEGER CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time TIME,
  end_time TIME,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('available', 'blocked', 'shared')),
  label TEXT,
  semester_id UUID REFERENCES pmi_semesters(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE pmi_room_availability ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role bypass for pmi_room_availability" ON pmi_room_availability FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can read pmi_room_availability" ON pmi_room_availability FOR SELECT TO authenticated USING (true);

-- 4. pmi_program_schedules — Active program groups with class days per semester
CREATE TABLE IF NOT EXISTS pmi_program_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  semester_id UUID NOT NULL REFERENCES pmi_semesters(id) ON DELETE CASCADE,
  cohort_id UUID NOT NULL REFERENCES cohorts(id) ON DELETE CASCADE,
  class_days INTEGER[] NOT NULL,
  color TEXT DEFAULT '#3B82F6',
  label TEXT,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(semester_id, cohort_id)
);

ALTER TABLE pmi_program_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role bypass for pmi_program_schedules" ON pmi_program_schedules FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can read pmi_program_schedules" ON pmi_program_schedules FOR SELECT TO authenticated USING (true);

-- 5. pmi_schedule_blocks — Individual time blocks (program in room at day/time)
CREATE TABLE IF NOT EXISTS pmi_schedule_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_schedule_id UUID NOT NULL REFERENCES pmi_program_schedules(id) ON DELETE CASCADE,
  room_id UUID NOT NULL REFERENCES pmi_rooms(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  block_type TEXT DEFAULT 'class' CHECK (block_type IN ('class', 'lab', 'exam', 'meeting', 'other')),
  title TEXT,
  is_recurring BOOLEAN DEFAULT true,
  specific_date DATE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE pmi_schedule_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role bypass for pmi_schedule_blocks" ON pmi_schedule_blocks FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can read pmi_schedule_blocks" ON pmi_schedule_blocks FOR SELECT TO authenticated USING (true);

-- 6. pmi_block_instructors — Instructor assignments to schedule blocks
CREATE TABLE IF NOT EXISTS pmi_block_instructors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_block_id UUID NOT NULL REFERENCES pmi_schedule_blocks(id) ON DELETE CASCADE,
  instructor_id UUID NOT NULL REFERENCES lab_users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'primary' CHECK (role IN ('primary', 'secondary', 'observer')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(schedule_block_id, instructor_id)
);

ALTER TABLE pmi_block_instructors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role bypass for pmi_block_instructors" ON pmi_block_instructors FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can read pmi_block_instructors" ON pmi_block_instructors FOR SELECT TO authenticated USING (true);

-- 7. pmi_instructor_workload — Weekly workload summary per instructor
CREATE TABLE IF NOT EXISTS pmi_instructor_workload (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  semester_id UUID NOT NULL REFERENCES pmi_semesters(id) ON DELETE CASCADE,
  instructor_id UUID NOT NULL REFERENCES lab_users(id) ON DELETE CASCADE,
  week_number INTEGER NOT NULL,
  week_start_date DATE NOT NULL,
  total_hours NUMERIC(5,2) DEFAULT 0,
  block_count INTEGER DEFAULT 0,
  programs TEXT[],
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(semester_id, instructor_id, week_number)
);

ALTER TABLE pmi_instructor_workload ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role bypass for pmi_instructor_workload" ON pmi_instructor_workload FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can read pmi_instructor_workload" ON pmi_instructor_workload FOR SELECT TO authenticated USING (true);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_schedule_blocks_room ON pmi_schedule_blocks(room_id, day_of_week);
CREATE INDEX IF NOT EXISTS idx_schedule_blocks_program ON pmi_schedule_blocks(program_schedule_id);
CREATE INDEX IF NOT EXISTS idx_block_instructors_block ON pmi_block_instructors(schedule_block_id);
CREATE INDEX IF NOT EXISTS idx_block_instructors_instr ON pmi_block_instructors(instructor_id);
CREATE INDEX IF NOT EXISTS idx_program_schedules_sem ON pmi_program_schedules(semester_id);
CREATE INDEX IF NOT EXISTS idx_room_availability_room ON pmi_room_availability(room_id);
CREATE INDEX IF NOT EXISTS idx_instructor_workload_sem ON pmi_instructor_workload(semester_id, instructor_id);

-- ============================================
-- VIEW: Conflict Detection
-- ============================================

CREATE OR REPLACE VIEW pmi_schedule_conflicts AS
SELECT
  a.id AS block_a_id,
  b.id AS block_b_id,
  a.room_id,
  r.name AS room_name,
  a.day_of_week,
  a.start_time AS a_start,
  a.end_time AS a_end,
  b.start_time AS b_start,
  b.end_time AS b_end,
  ps_a.semester_id
FROM pmi_schedule_blocks a
JOIN pmi_schedule_blocks b
  ON a.room_id = b.room_id
  AND a.day_of_week = b.day_of_week
  AND a.id < b.id
  AND a.start_time < b.end_time
  AND b.start_time < a.end_time
JOIN pmi_program_schedules ps_a ON a.program_schedule_id = ps_a.id
JOIN pmi_program_schedules ps_b ON b.program_schedule_id = ps_b.id
  AND ps_a.semester_id = ps_b.semester_id
JOIN pmi_rooms r ON a.room_id = r.id
WHERE ps_a.is_active AND ps_b.is_active;

-- ============================================
-- VERIFICATION
-- ============================================

DO $$
DECLARE
  tbl TEXT;
  cnt INTEGER;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['pmi_semesters', 'pmi_rooms', 'pmi_room_availability', 'pmi_program_schedules', 'pmi_schedule_blocks', 'pmi_block_instructors', 'pmi_instructor_workload']
  LOOP
    EXECUTE format('SELECT count(*) FROM %I', tbl) INTO cnt;
    RAISE NOTICE '% exists (% rows)', tbl, cnt;
  END LOOP;
  RAISE NOTICE 'pmi_schedule_conflicts view exists';
END $$;

NOTIFY pgrst, 'reload schema';

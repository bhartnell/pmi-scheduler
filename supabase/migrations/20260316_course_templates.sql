-- Migration: Course Templates for Semester Auto-Generation
-- Creates pmi_course_templates table and seeds with Paramedic S1-S4, EMT, and AEMT templates

-- ── Table ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pmi_course_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  program_type TEXT NOT NULL CHECK (program_type IN ('paramedic','emt','aemt','other')),
  semester_number INTEGER,  -- 1-4 for paramedic, NULL for EMT/AEMT
  course_code TEXT NOT NULL,
  course_name TEXT NOT NULL,
  duration_type TEXT DEFAULT 'full' CHECK (duration_type IN ('full','first_half','second_half')),
  day_index INTEGER NOT NULL,  -- 1 = first class day, 2 = second class day
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  block_type TEXT DEFAULT 'lecture',
  is_online BOOLEAN DEFAULT false,
  replaces_course_id UUID REFERENCES pmi_course_templates(id),
  color TEXT,
  notes TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_course_templates_program ON pmi_course_templates(program_type, semester_number);
CREATE INDEX IF NOT EXISTS idx_course_templates_replaces ON pmi_course_templates(replaces_course_id) WHERE replaces_course_id IS NOT NULL;

-- RLS
ALTER TABLE pmi_course_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read course templates"
  ON pmi_course_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Lead instructors can manage course templates"
  ON pmi_course_templates FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- ── Seed Data ─────────────────────────────────────────────────────────────────

-- Helper: we need to insert first_half courses first, then reference them for second_half

-- ═══════════════════════════════════════════════════════════════════════════════
-- PARAMEDIC SEMESTER 1 (2 days/week)
-- ═══════════════════════════════════════════════════════════════════════════════

-- Day 1
INSERT INTO pmi_course_templates (program_type, semester_number, course_code, course_name, duration_type, day_index, start_time, end_time, block_type, is_online, color, sort_order)
VALUES ('paramedic', 1, 'EMS 141', 'Patient Assessment & Diagnostics', 'full', 1, '08:30', '10:30', 'lecture', false, '#3B82F6', 10);

INSERT INTO pmi_course_templates (id, program_type, semester_number, course_code, course_name, duration_type, day_index, start_time, end_time, block_type, is_online, color, sort_order)
VALUES ('a0000001-0001-0001-0001-000000000001', 'paramedic', 1, 'EMS 111', 'Intro to Paramedic', 'first_half', 1, '10:00', '12:00', 'lecture', false, '#3B82F6', 20);

INSERT INTO pmi_course_templates (program_type, semester_number, course_code, course_name, duration_type, day_index, start_time, end_time, block_type, is_online, replaces_course_id, color, sort_order)
VALUES ('paramedic', 1, 'EMS 131', 'Airway Management', 'second_half', 1, '10:00', '12:00', 'lecture', false, 'a0000001-0001-0001-0001-000000000001', '#3B82F6', 25);

INSERT INTO pmi_course_templates (program_type, semester_number, course_code, course_name, duration_type, day_index, start_time, end_time, block_type, is_online, color, sort_order)
VALUES ('paramedic', 1, 'MTH 142', 'College Algebra', 'full', 1, '13:00', '14:30', 'lecture', false, '#3B82F6', 30);

INSERT INTO pmi_course_templates (program_type, semester_number, course_code, course_name, duration_type, day_index, start_time, end_time, block_type, is_online, color, sort_order)
VALUES ('paramedic', 1, 'EMS 121', 'Pharmacology', 'full', 1, '14:40', '17:00', 'lecture', false, '#3B82F6', 40);

INSERT INTO pmi_course_templates (program_type, semester_number, course_code, course_name, duration_type, day_index, start_time, end_time, block_type, is_online, color, sort_order)
VALUES ('paramedic', 1, 'BIO 143', 'Anatomy & Physiology', 'full', 1, '00:00', '00:00', 'class', true, '#8B5CF6', 50);

-- Day 2
INSERT INTO pmi_course_templates (program_type, semester_number, course_code, course_name, duration_type, day_index, start_time, end_time, block_type, is_online, color, sort_order)
VALUES ('paramedic', 1, 'EMS 141', 'Patient Assessment & Diagnostics', 'full', 2, '08:30', '10:00', 'lecture', false, '#3B82F6', 10);

INSERT INTO pmi_course_templates (id, program_type, semester_number, course_code, course_name, duration_type, day_index, start_time, end_time, block_type, is_online, color, sort_order)
VALUES ('a0000001-0001-0001-0002-000000000001', 'paramedic', 1, 'EMS 111', 'Intro to Paramedic', 'first_half', 2, '10:00', '12:00', 'lecture', false, '#3B82F6', 20);

INSERT INTO pmi_course_templates (program_type, semester_number, course_code, course_name, duration_type, day_index, start_time, end_time, block_type, is_online, replaces_course_id, color, sort_order)
VALUES ('paramedic', 1, 'EMS 131', 'Airway Management', 'second_half', 2, '10:00', '12:00', 'lecture', false, 'a0000001-0001-0001-0002-000000000001', '#3B82F6', 25);

INSERT INTO pmi_course_templates (program_type, semester_number, course_code, course_name, duration_type, day_index, start_time, end_time, block_type, is_online, color, sort_order)
VALUES ('paramedic', 1, 'MTH 142', 'College Algebra', 'full', 2, '13:00', '14:30', 'lecture', false, '#3B82F6', 30);

INSERT INTO pmi_course_templates (program_type, semester_number, course_code, course_name, duration_type, day_index, start_time, end_time, block_type, is_online, color, sort_order)
VALUES ('paramedic', 1, 'EMS 121', 'Lab', 'full', 2, '14:40', '17:30', 'lab', false, '#3B82F6', 40);

-- ═══════════════════════════════════════════════════════════════════════════════
-- PARAMEDIC SEMESTER 2 (2 days/week)
-- ═══════════════════════════════════════════════════════════════════════════════

-- Day 1
INSERT INTO pmi_course_templates (program_type, semester_number, course_code, course_name, duration_type, day_index, start_time, end_time, block_type, is_online, color, sort_order)
VALUES ('paramedic', 2, 'EMS 172', 'Medical Emergencies', 'full', 1, '08:30', '10:00', 'lecture', false, '#3B82F6', 10);

INSERT INTO pmi_course_templates (id, program_type, semester_number, course_code, course_name, duration_type, day_index, start_time, end_time, block_type, is_online, color, sort_order)
VALUES ('a0000002-0001-0001-0001-000000000001', 'paramedic', 2, 'EMS 152', 'Cardiology', 'first_half', 1, '10:00', '12:00', 'lecture', false, '#3B82F6', 20);

INSERT INTO pmi_course_templates (program_type, semester_number, course_code, course_name, duration_type, day_index, start_time, end_time, block_type, is_online, replaces_course_id, color, sort_order)
VALUES ('paramedic', 2, 'EMS 182', 'Pediatrics', 'second_half', 1, '10:00', '12:00', 'lecture', false, 'a0000002-0001-0001-0001-000000000001', '#3B82F6', 25);

INSERT INTO pmi_course_templates (program_type, semester_number, course_code, course_name, duration_type, day_index, start_time, end_time, block_type, is_online, color, sort_order)
VALUES ('paramedic', 2, 'EMS 192', 'Trauma', 'full', 1, '13:20', '14:50', 'lecture', false, '#3B82F6', 30);

INSERT INTO pmi_course_templates (program_type, semester_number, course_code, course_name, duration_type, day_index, start_time, end_time, block_type, is_online, color, sort_order)
VALUES ('paramedic', 2, 'EMS Lab', 'EMS Lab', 'full', 1, '15:00', '17:00', 'lab', false, '#3B82F6', 40);

INSERT INTO pmi_course_templates (program_type, semester_number, course_code, course_name, duration_type, day_index, start_time, end_time, block_type, is_online, color, sort_order)
VALUES ('paramedic', 2, 'EMS 162', 'ECG Interpretation', 'full', 1, '00:00', '00:00', 'class', true, '#8B5CF6', 50);

-- Day 2
INSERT INTO pmi_course_templates (program_type, semester_number, course_code, course_name, duration_type, day_index, start_time, end_time, block_type, is_online, color, sort_order)
VALUES ('paramedic', 2, 'EMS 172', 'Medical Emergencies', 'full', 2, '08:30', '10:00', 'lecture', false, '#3B82F6', 10);

INSERT INTO pmi_course_templates (id, program_type, semester_number, course_code, course_name, duration_type, day_index, start_time, end_time, block_type, is_online, color, sort_order)
VALUES ('a0000002-0001-0001-0002-000000000001', 'paramedic', 2, 'EMS 152', 'Cardiology', 'first_half', 2, '10:00', '12:00', 'lecture', false, '#3B82F6', 20);

INSERT INTO pmi_course_templates (program_type, semester_number, course_code, course_name, duration_type, day_index, start_time, end_time, block_type, is_online, replaces_course_id, color, sort_order)
VALUES ('paramedic', 2, 'EMS 182', 'Pediatrics', 'second_half', 2, '10:00', '12:00', 'lecture', false, 'a0000002-0001-0001-0002-000000000001', '#3B82F6', 25);

INSERT INTO pmi_course_templates (program_type, semester_number, course_code, course_name, duration_type, day_index, start_time, end_time, block_type, is_online, color, sort_order)
VALUES ('paramedic', 2, 'EMS Lab', 'EMS Lab', 'full', 2, '15:00', '17:30', 'lab', false, '#3B82F6', 40);

-- ═══════════════════════════════════════════════════════════════════════════════
-- PARAMEDIC SEMESTER 3 (1 day/week)
-- ═══════════════════════════════════════════════════════════════════════════════

INSERT INTO pmi_course_templates (program_type, semester_number, course_code, course_name, duration_type, day_index, start_time, end_time, block_type, is_online, color, sort_order)
VALUES ('paramedic', 3, 'EMS 211', 'Advanced Medical', 'full', 1, '08:30', '10:00', 'lecture', false, '#3B82F6', 10);

INSERT INTO pmi_course_templates (program_type, semester_number, course_code, course_name, duration_type, day_index, start_time, end_time, block_type, is_online, color, sort_order)
VALUES ('paramedic', 3, 'EMS 221', 'ALS Operations', 'full', 1, '10:00', '12:30', 'lecture', false, '#3B82F6', 20);

INSERT INTO pmi_course_templates (program_type, semester_number, course_code, course_name, duration_type, day_index, start_time, end_time, block_type, is_online, color, sort_order)
VALUES ('paramedic', 3, 'HST 205', 'Nevada History', 'full', 1, '13:30', '15:30', 'lecture', false, '#3B82F6', 30);

INSERT INTO pmi_course_templates (program_type, semester_number, course_code, course_name, duration_type, day_index, start_time, end_time, block_type, is_online, color, sort_order)
VALUES ('paramedic', 3, 'CLE 144', 'Medical Law & Ethics', 'full', 1, '00:00', '00:00', 'class', true, '#8B5CF6', 40);

INSERT INTO pmi_course_templates (program_type, semester_number, course_code, course_name, duration_type, day_index, start_time, end_time, block_type, is_online, color, sort_order)
VALUES ('paramedic', 3, 'EMS 202', 'Clinical Externship', 'full', 1, '00:00', '00:00', 'clinical', true, '#8B5CF6', 50);

-- ═══════════════════════════════════════════════════════════════════════════════
-- PARAMEDIC SEMESTER 4 (all online/tracking)
-- ═══════════════════════════════════════════════════════════════════════════════

INSERT INTO pmi_course_templates (program_type, semester_number, course_code, course_name, duration_type, day_index, start_time, end_time, block_type, is_online, color, sort_order)
VALUES ('paramedic', 4, 'EMS 232', 'NREMT Review', 'full', 1, '00:00', '00:00', 'class', true, '#8B5CF6', 10);

INSERT INTO pmi_course_templates (program_type, semester_number, course_code, course_name, duration_type, day_index, start_time, end_time, block_type, is_online, color, sort_order)
VALUES ('paramedic', 4, 'EMS 242', 'Field Internship', 'full', 1, '00:00', '00:00', 'clinical', true, '#8B5CF6', 20);

-- ═══════════════════════════════════════════════════════════════════════════════
-- EMT (4 days/week, 15 weeks)
-- ═══════════════════════════════════════════════════════════════════════════════

INSERT INTO pmi_course_templates (program_type, semester_number, course_code, course_name, duration_type, day_index, start_time, end_time, block_type, is_online, color, sort_order)
VALUES
  ('emt', NULL, 'EMT', 'EMT Lecture', 'full', 1, '09:00', '12:00', 'lecture', false, '#22C55E', 10),
  ('emt', NULL, 'EMT', 'EMT Lecture', 'full', 2, '09:00', '12:00', 'lecture', false, '#22C55E', 20),
  ('emt', NULL, 'EMT', 'EMT Lab', 'full', 3, '09:00', '12:00', 'lab', false, '#22C55E', 30),
  ('emt', NULL, 'EMT', 'EMT Lecture', 'full', 4, '09:00', '12:00', 'lecture', false, '#22C55E', 40);

-- ═══════════════════════════════════════════════════════════════════════════════
-- AEMT (2 days/week, 15 weeks)
-- ═══════════════════════════════════════════════════════════════════════════════

INSERT INTO pmi_course_templates (program_type, semester_number, course_code, course_name, duration_type, day_index, start_time, end_time, block_type, is_online, color, sort_order)
VALUES
  ('aemt', NULL, 'AEMT', 'AEMT Didactic', 'full', 1, '08:30', '12:00', 'lecture', false, '#EAB308', 10),
  ('aemt', NULL, 'AEMT', 'AEMT Clinical/Lab', 'full', 1, '13:00', '17:00', 'lab', false, '#EAB308', 20),
  ('aemt', NULL, 'AEMT', 'AEMT Didactic', 'full', 2, '08:30', '12:00', 'lecture', false, '#EAB308', 30),
  ('aemt', NULL, 'AEMT', 'AEMT Clinical/Lab', 'full', 2, '13:00', '17:00', 'lab', false, '#EAB308', 40);

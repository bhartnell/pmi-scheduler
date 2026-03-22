-- Migration: Replace generic quiz blocks with 42 per-chapter quiz blocks
-- Date: 2026-03-12
--
-- Old blocks: quiz-daily (30 min, 10 questions), quiz-daily-20 (40 min, 20 questions)
-- New blocks: quiz-ch01 through quiz-ch42 with specific durations per chapter
-- Formula: 1.5 min/question quiz + 0.5 min/question review = 2.0 min/question total

-- Step 1: Delete any existing placements that reference old quiz blocks
DELETE FROM lvfr_aemt_plan_placements
WHERE content_block_id IN ('quiz-daily', 'quiz-daily-20');

-- Step 2: Delete any existing prerequisites referencing old quiz blocks
DELETE FROM lvfr_aemt_prerequisites
WHERE block_id IN ('quiz-daily', 'quiz-daily-20')
   OR requires_block_id IN ('quiz-daily', 'quiz-daily-20');

-- Step 3: Delete old generic quiz blocks
DELETE FROM lvfr_aemt_content_blocks
WHERE id IN ('quiz-daily', 'quiz-daily-20');

-- Step 4: Insert 42 per-chapter quiz blocks
-- Using ON CONFLICT to make idempotent
INSERT INTO lvfr_aemt_content_blocks (id, name, duration_min, block_type, chapter_id, notes, color)
VALUES
  ('quiz-ch01', 'Ch 1: EMS Systems Quiz', 20, 'quiz', 'ch01', '10 questions. Quiz 15 min, Review 5 min.', '#f59e0b'),
  ('quiz-ch02', 'Ch 2: Workforce Safety Quiz', 20, 'quiz', 'ch02', '10 questions. Quiz 15 min, Review 5 min.', '#f59e0b'),
  ('quiz-ch03', 'Ch 3: Legal/Ethics Quiz', 20, 'quiz', 'ch03', '10 questions. Quiz 15 min, Review 5 min.', '#f59e0b'),
  ('quiz-ch04', 'Ch 4: Communications Quiz', 40, 'quiz', 'ch04', '20 questions. Quiz 30 min, Review 10 min.', '#f59e0b'),
  ('quiz-ch05', 'Ch 5: Medical Terminology Quiz', 30, 'quiz', 'ch05', '15 questions. Quiz 23 min, Review 8 min.', '#f59e0b'),
  ('quiz-ch06', 'Ch 6: Lifting & Moving Quiz', 20, 'quiz', 'ch06', '10 questions. Quiz 15 min, Review 5 min.', '#f59e0b'),
  ('quiz-ch07', 'Ch 7: Human Body (A&P) Quiz', 40, 'quiz', 'ch07', '20 questions. Quiz 30 min, Review 10 min.', '#f59e0b'),
  ('quiz-ch08', 'Ch 8: Pathophysiology Quiz', 40, 'quiz', 'ch08', '20 questions. Quiz 30 min, Review 10 min.', '#f59e0b'),
  ('quiz-ch09', 'Ch 9: Life Span Development Quiz', 40, 'quiz', 'ch09', '20 questions. Quiz 30 min, Review 10 min.', '#f59e0b'),
  ('quiz-ch10', 'Ch 10: Patient Assessment Quiz', 40, 'quiz', 'ch10', '20 questions. Quiz 30 min, Review 10 min.', '#f59e0b'),
  ('quiz-ch11', 'Ch 11: Airway Management Quiz', 40, 'quiz', 'ch11', '20 questions. Quiz 30 min, Review 10 min.', '#f59e0b'),
  ('quiz-ch12', 'Ch 12: Pharmacology Quiz', 40, 'quiz', 'ch12', '20 questions. Quiz 30 min, Review 10 min.', '#f59e0b'),
  ('quiz-ch13', 'Ch 13: Vascular Access Quiz', 40, 'quiz', 'ch13', '20 questions. Quiz 30 min, Review 10 min.', '#f59e0b'),
  ('quiz-ch14', 'Ch 14: Shock Quiz', 40, 'quiz', 'ch14', '20 questions. Quiz 30 min, Review 10 min.', '#f59e0b'),
  ('quiz-ch15', 'Ch 15: BLS Resuscitation Quiz', 40, 'quiz', 'ch15', '20 questions. Quiz 30 min, Review 10 min.', '#f59e0b'),
  ('quiz-ch16', 'Ch 16: Medical Overview Quiz', 20, 'quiz', 'ch16', '10 questions. Quiz 15 min, Review 5 min.', '#f59e0b'),
  ('quiz-ch17', 'Ch 17: Respiratory Quiz', 40, 'quiz', 'ch17', '20 questions. Quiz 30 min, Review 10 min.', '#f59e0b'),
  ('quiz-ch18', 'Ch 18: Cardiovascular Quiz', 40, 'quiz', 'ch18', '20 questions. Quiz 30 min, Review 10 min.', '#f59e0b'),
  ('quiz-ch19', 'Ch 19: Neurologic Quiz', 30, 'quiz', 'ch19', '15 questions. Quiz 23 min, Review 8 min.', '#f59e0b'),
  ('quiz-ch20', 'Ch 20: GI/Urologic Quiz', 40, 'quiz', 'ch20', '20 questions. Quiz 30 min, Review 10 min.', '#f59e0b'),
  ('quiz-ch21', 'Ch 21: Endocrine/Hematologic Quiz', 40, 'quiz', 'ch21', '20 questions. Quiz 30 min, Review 10 min.', '#f59e0b'),
  ('quiz-ch22', 'Ch 22: Immunologic Quiz', 40, 'quiz', 'ch22', '20 questions. Quiz 30 min, Review 10 min.', '#f59e0b'),
  ('quiz-ch23', 'Ch 23: Toxicology Quiz', 40, 'quiz', 'ch23', '20 questions. Quiz 30 min, Review 10 min.', '#f59e0b'),
  ('quiz-ch24', 'Ch 24: Psychiatric Quiz', 30, 'quiz', 'ch24', '15 questions. Quiz 23 min, Review 8 min.', '#f59e0b'),
  ('quiz-ch25', 'Ch 25: Gynecologic Quiz', 20, 'quiz', 'ch25', '10 questions. Quiz 15 min, Review 5 min.', '#f59e0b'),
  ('quiz-ch26', 'Ch 26: Trauma Overview Quiz', 20, 'quiz', 'ch26', '10 questions. Quiz 15 min, Review 5 min.', '#f59e0b'),
  ('quiz-ch27', 'Ch 27: Bleeding Quiz', 40, 'quiz', 'ch27', '20 questions. Quiz 30 min, Review 10 min.', '#f59e0b'),
  ('quiz-ch28', 'Ch 28: Soft-Tissue Quiz', 30, 'quiz', 'ch28', '15 questions. Quiz 23 min, Review 8 min.', '#f59e0b'),
  ('quiz-ch29', 'Ch 29: Face & Neck Quiz', 40, 'quiz', 'ch29', '20 questions. Quiz 30 min, Review 10 min.', '#f59e0b'),
  ('quiz-ch30', 'Ch 30: Head & Spine Quiz', 40, 'quiz', 'ch30', '20 questions. Quiz 30 min, Review 10 min.', '#f59e0b'),
  ('quiz-ch31', 'Ch 31: Chest Injuries Quiz', 40, 'quiz', 'ch31', '20 questions. Quiz 30 min, Review 10 min.', '#f59e0b'),
  ('quiz-ch32', 'Ch 32: Abdominal/GU Quiz', 30, 'quiz', 'ch32', '15 questions. Quiz 23 min, Review 8 min.', '#f59e0b'),
  ('quiz-ch33', 'Ch 33: Orthopaedic Quiz', 30, 'quiz', 'ch33', '15 questions. Quiz 23 min, Review 8 min.', '#f59e0b'),
  ('quiz-ch34', 'Ch 34: Environmental Quiz', 30, 'quiz', 'ch34', '15 questions. Quiz 23 min, Review 8 min.', '#f59e0b'),
  ('quiz-ch35', 'Ch 35: OB/Neonatal Quiz', 40, 'quiz', 'ch35', '20 questions. Quiz 30 min, Review 10 min.', '#f59e0b'),
  ('quiz-ch36', 'Ch 36: Pediatrics Quiz', 60, 'quiz', 'ch36', '30 questions. Quiz 45 min, Review 15 min.', '#f59e0b'),
  ('quiz-ch37', 'Ch 37: Geriatrics Quiz', 40, 'quiz', 'ch37', '20 questions. Quiz 30 min, Review 10 min.', '#f59e0b'),
  ('quiz-ch38', 'Ch 38: Special Challenges Quiz', 30, 'quiz', 'ch38', '15 questions. Quiz 23 min, Review 8 min.', '#f59e0b'),
  ('quiz-ch39', 'Ch 39: Transport Ops Quiz', 40, 'quiz', 'ch39', '20 questions. Quiz 30 min, Review 10 min.', '#f59e0b'),
  ('quiz-ch40', 'Ch 40: Extrication/Hazmat Quiz', 40, 'quiz', 'ch40', '20 questions. Quiz 30 min, Review 10 min.', '#f59e0b'),
  ('quiz-ch41', 'Ch 41: Incident Management Quiz', 40, 'quiz', 'ch41', '20 questions. Quiz 30 min, Review 10 min.', '#f59e0b'),
  ('quiz-ch42', 'Ch 42: Terrorism/Disaster Quiz', 40, 'quiz', 'ch42', '20 questions. Quiz 30 min, Review 10 min.', '#f59e0b')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  duration_min = EXCLUDED.duration_min,
  block_type = EXCLUDED.block_type,
  chapter_id = EXCLUDED.chapter_id,
  notes = EXCLUDED.notes,
  color = EXCLUDED.color;

-- Step 5: Insert prerequisite rules (each quiz requires its chapter lecture)
-- Using ON CONFLICT to make idempotent
INSERT INTO lvfr_aemt_prerequisites (block_id, requires_block_id, rule_type)
VALUES
  ('quiz-ch01', 'lec-ch01', 'must_precede'),
  ('quiz-ch02', 'lec-ch02', 'must_precede'),
  ('quiz-ch03', 'lec-ch03', 'must_precede'),
  ('quiz-ch04', 'lec-ch04', 'must_precede'),
  ('quiz-ch05', 'lec-ch05', 'must_precede'),
  ('quiz-ch06', 'lec-ch06', 'must_precede'),
  ('quiz-ch07', 'lec-ch07', 'must_precede'),
  ('quiz-ch08', 'lec-ch08', 'must_precede'),
  ('quiz-ch09', 'lec-ch09', 'must_precede'),
  ('quiz-ch10', 'lec-ch10', 'must_precede'),
  ('quiz-ch11', 'lec-ch11', 'must_precede'),
  ('quiz-ch12', 'lec-ch12', 'must_precede'),
  ('quiz-ch13', 'lec-ch13', 'must_precede'),
  ('quiz-ch14', 'lec-ch14', 'must_precede'),
  ('quiz-ch15', 'lec-ch15', 'must_precede'),
  ('quiz-ch16', 'lec-ch16', 'must_precede'),
  ('quiz-ch17', 'lec-ch17', 'must_precede'),
  ('quiz-ch18', 'lec-ch18', 'must_precede'),
  ('quiz-ch19', 'lec-ch19', 'must_precede'),
  ('quiz-ch20', 'lec-ch20', 'must_precede'),
  ('quiz-ch21', 'lec-ch21', 'must_precede'),
  ('quiz-ch22', 'lec-ch22', 'must_precede'),
  ('quiz-ch23', 'lec-ch23', 'must_precede'),
  ('quiz-ch24', 'lec-ch24', 'must_precede'),
  ('quiz-ch25', 'lec-ch25', 'must_precede'),
  ('quiz-ch26', 'lec-ch26', 'must_precede'),
  ('quiz-ch27', 'lec-ch27', 'must_precede'),
  ('quiz-ch28', 'lec-ch28', 'must_precede'),
  ('quiz-ch29', 'lec-ch29', 'must_precede'),
  ('quiz-ch30', 'lec-ch30', 'must_precede'),
  ('quiz-ch31', 'lec-ch31', 'must_precede'),
  ('quiz-ch32', 'lec-ch32', 'must_precede'),
  ('quiz-ch33', 'lec-ch33', 'must_precede'),
  ('quiz-ch34', 'lec-ch34', 'must_precede'),
  ('quiz-ch35', 'lec-ch35', 'must_precede'),
  ('quiz-ch36', 'lec-ch36', 'must_precede'),
  ('quiz-ch37', 'lec-ch37', 'must_precede'),
  ('quiz-ch38', 'lec-ch38', 'must_precede'),
  ('quiz-ch39', 'lec-ch39', 'must_precede'),
  ('quiz-ch40', 'lec-ch40', 'must_precede'),
  ('quiz-ch41', 'lec-ch41', 'must_precede'),
  ('quiz-ch42', 'lec-ch42', 'must_precede')
ON CONFLICT (block_id, requires_block_id, rule_type) DO NOTHING;

-- Verify
DO $$
DECLARE
  quiz_count INTEGER;
  prereq_count INTEGER;
BEGIN
  SELECT count(*) INTO quiz_count FROM lvfr_aemt_content_blocks WHERE id LIKE 'quiz-ch%';
  SELECT count(*) INTO prereq_count FROM lvfr_aemt_prerequisites WHERE block_id LIKE 'quiz-ch%';
  RAISE NOTICE 'Per-chapter quiz blocks: % (expected 42)', quiz_count;
  RAISE NOTICE 'Quiz prerequisites: % (expected 42)', prereq_count;
END $$;

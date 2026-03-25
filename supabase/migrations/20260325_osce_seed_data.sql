-- Seed OSCE assessment records for Spring 2026 Clinical Capstone
-- Day 1: March 30, 2026 | Day 2: March 31, 2026

-- Day 1 Morning (Slots 1-6)
INSERT INTO osce_assessments (student_name, scenario, slot_number, day_number, assessment_date)
VALUES
  ('PORFIRIO', 'A', 1, 1, '2026-03-30'),
  ('GIFFORD', 'B', 2, 1, '2026-03-30'),
  ('JOHNSON', 'C', 3, 1, '2026-03-30'),
  ('SOLARI', 'D', 4, 1, '2026-03-30'),
  ('MIRANDA', 'E', 5, 1, '2026-03-30'),
  ('BILHARZ', 'F', 6, 1, '2026-03-30')
ON CONFLICT DO NOTHING;

-- Day 1 Early Afternoon (Slots 7-8)
INSERT INTO osce_assessments (student_name, scenario, slot_number, day_number, assessment_date)
VALUES
  ('NIXON', 'A', 7, 1, '2026-03-30'),
  ('GRAHOVAC', 'B', 8, 1, '2026-03-30')
ON CONFLICT DO NOTHING;

-- Day 1 Late Afternoon (Slots 9-13)
INSERT INTO osce_assessments (student_name, scenario, slot_number, day_number, assessment_date)
VALUES
  ('COTTRELL', 'C', 9, 1, '2026-03-30'),
  ('RUIZ', 'D', 10, 1, '2026-03-30'),
  ('ACOSTA', 'E', 11, 1, '2026-03-30'),
  ('ZENTEK', 'F', 12, 1, '2026-03-30'),
  ('JAKICEVIC', 'A', 13, 1, '2026-03-30')
ON CONFLICT DO NOTHING;

-- Day 2 Afternoon (Slots 14-19)
INSERT INTO osce_assessments (student_name, scenario, slot_number, day_number, assessment_date)
VALUES
  ('SARELLANO LOPEZ', 'B', 14, 2, '2026-03-31'),
  ('SULLIVAN', 'C', 15, 2, '2026-03-31'),
  ('CAHA', 'D', 16, 2, '2026-03-31'),
  ('SMITH', 'E', 17, 2, '2026-03-31'),
  ('KENNEDY', 'F', 18, 2, '2026-03-31'),
  ('WILLIAMS', 'A', 19, 2, '2026-03-31')
ON CONFLICT DO NOTHING;

-- Pre-generate evaluator tokens
-- Dr. Kat (MD, both days) — valid from March 30 through March 31
INSERT INTO osce_guest_tokens (evaluator_name, evaluator_role, valid_from, valid_until)
VALUES ('Dr. Kat', 'md', '2026-03-30 06:00:00-07', '2026-04-01 00:00:00-07')
ON CONFLICT DO NOTHING;

-- Dr. Barnum (MD, Day 1 afternoon + Day 2) — valid from March 30 noon through March 31
INSERT INTO osce_guest_tokens (evaluator_name, evaluator_role, valid_from, valid_until)
VALUES ('Dr. Barnum', 'md', '2026-03-30 11:00:00-07', '2026-04-01 00:00:00-07')
ON CONFLICT DO NOTHING;

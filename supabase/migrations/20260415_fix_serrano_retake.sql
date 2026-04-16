-- Fix Serrano's E201 retake flag: second attempt (attempt_number=6) at 00:06 UTC
-- is a retake of the first attempt (attempt_number=5) which failed at 20:33 UTC.
-- Lab day: a74f07a9-653e-4da9-b185-040cd7b12a3d

UPDATE student_skill_evaluations
SET is_retake = true,
    original_evaluation_id = (
      SELECT id FROM student_skill_evaluations
      WHERE lab_day_id = 'a74f07a9-653e-4da9-b185-040cd7b12a3d'
      AND student_id = (SELECT id FROM students WHERE last_name = 'Serrano' AND first_name = 'Brandon' LIMIT 1)
      AND skill_sheet_id = 'd96b38ae-0288-42c3-85a6-c4d2aa696037'
      AND attempt_number = 5
      LIMIT 1
    )
WHERE lab_day_id = 'a74f07a9-653e-4da9-b185-040cd7b12a3d'
AND student_id = (SELECT id FROM students WHERE last_name = 'Serrano' AND first_name = 'Brandon' LIMIT 1)
AND skill_sheet_id = 'd96b38ae-0288-42c3-85a6-c4d2aa696037'
AND attempt_number = 6;

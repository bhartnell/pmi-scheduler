-- Fix FK constraint on lab_day_student_queue.evaluation_id
-- The existing FK blocks deletion of student_skill_evaluations.
-- Change to ON DELETE SET NULL so deleting an evaluation clears the reference.

ALTER TABLE lab_day_student_queue
  DROP CONSTRAINT IF EXISTS lab_day_student_queue_evaluation_id_fkey;

ALTER TABLE lab_day_student_queue
  ADD CONSTRAINT lab_day_student_queue_evaluation_id_fkey
  FOREIGN KEY (evaluation_id) REFERENCES student_skill_evaluations(id)
  ON DELETE SET NULL;

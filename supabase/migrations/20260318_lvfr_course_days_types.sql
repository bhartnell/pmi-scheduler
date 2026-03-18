-- Add missing day_type values to lvfr_aemt_course_days
-- Needed: exam_and_practice, review_practice, exam_and_review

ALTER TABLE lvfr_aemt_course_days
  DROP CONSTRAINT IF EXISTS lvfr_aemt_course_days_day_type_check;

ALTER TABLE lvfr_aemt_course_days
  ADD CONSTRAINT lvfr_aemt_course_days_day_type_check
  CHECK (day_type IN (
    'new_content', 'lab_day', 'lab_review', 'exam_and_content',
    'content_and_exam', 'exam_and_practice', 'review_practice',
    'exam_and_review', 'final_exam', 'supplementary'
  ));

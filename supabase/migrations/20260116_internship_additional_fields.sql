-- Add additional fields for internship tracking based on Rae's feedback
-- Written and Psychomotor Exam tracking
ALTER TABLE student_internships ADD COLUMN IF NOT EXISTS written_exam_date DATE;
ALTER TABLE student_internships ADD COLUMN IF NOT EXISTS written_exam_passed BOOLEAN DEFAULT false;
ALTER TABLE student_internships ADD COLUMN IF NOT EXISTS psychomotor_exam_date DATE;
ALTER TABLE student_internships ADD COLUMN IF NOT EXISTS psychomotor_exam_passed BOOLEAN DEFAULT false;

-- Meeting scheduler poll IDs and scheduled dates
ALTER TABLE student_internships ADD COLUMN IF NOT EXISTS phase_1_meeting_poll_id TEXT;
ALTER TABLE student_internships ADD COLUMN IF NOT EXISTS phase_1_meeting_scheduled DATE;
ALTER TABLE student_internships ADD COLUMN IF NOT EXISTS phase_2_meeting_poll_id TEXT;
ALTER TABLE student_internships ADD COLUMN IF NOT EXISTS phase_2_meeting_scheduled DATE;
ALTER TABLE student_internships ADD COLUMN IF NOT EXISTS final_exam_poll_id TEXT;
ALTER TABLE student_internships ADD COLUMN IF NOT EXISTS final_exam_scheduled DATE;

-- Course completion date
ALTER TABLE student_internships ADD COLUMN IF NOT EXISTS course_completion_date DATE;

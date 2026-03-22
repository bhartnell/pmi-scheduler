-- 3. Student profile fields
ALTER TABLE students ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS emergency_contact_relationship TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS student_number TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS enrollment_date DATE;
NOTIFY pgrst, 'reload schema';

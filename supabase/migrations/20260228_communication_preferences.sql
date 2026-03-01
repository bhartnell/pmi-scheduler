-- 4. Student Communication Preferences
ALTER TABLE students ADD COLUMN IF NOT EXISTS preferred_contact_method TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS best_contact_times TEXT[];
ALTER TABLE students ADD COLUMN IF NOT EXISTS language_preference TEXT DEFAULT 'en';
ALTER TABLE students ADD COLUMN IF NOT EXISTS opt_out_non_essential BOOLEAN DEFAULT false;
NOTIFY pgrst, 'reload schema';

-- Migration: Add communication preferences columns to students table
-- Date: 2026-02-28

-- preferred_contact_method: how the student prefers to be reached
ALTER TABLE students
  ADD COLUMN IF NOT EXISTS preferred_contact_method TEXT DEFAULT 'email'
    CHECK (preferred_contact_method IN ('email', 'phone', 'text', 'in_person'));

-- best_contact_times: free-text field (e.g. "mornings", "after 3pm")
ALTER TABLE students
  ADD COLUMN IF NOT EXISTS best_contact_times TEXT;

-- language_preference: ISO 639-1 language code, defaults to English
ALTER TABLE students
  ADD COLUMN IF NOT EXISTS language_preference TEXT DEFAULT 'en';

-- contact_opt_out: student has opted out of non-essential contact
ALTER TABLE students
  ADD COLUMN IF NOT EXISTS contact_opt_out BOOLEAN DEFAULT false;

-- Notify PostgREST to reload the schema cache so the new columns are visible
NOTIFY pgrst, 'reload schema';

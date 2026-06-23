-- AHA instructor credentials on lab_users — powers the AHA Results Export
-- signature line (Instructor Initials / Instructor Number / Date) and the
-- per-form instructor selection. Additive + nullable; existing lab_users RLS
-- policies already cover these columns (no new policy needed). Idempotent.

ALTER TABLE lab_users ADD COLUMN IF NOT EXISTS aha_instructor_number text;
-- PNG data URL of a drawn or uploaded signature; NULL when kind = 'auto'
-- (the form then renders the instructor's name in a script font as a fallback).
ALTER TABLE lab_users ADD COLUMN IF NOT EXISTS signature_data text;
-- 'drawn' | 'uploaded' | 'auto'  (how signature_data was produced / fallback)
ALTER TABLE lab_users ADD COLUMN IF NOT EXISTS signature_kind text;

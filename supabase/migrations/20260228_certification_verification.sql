-- 5. Certification Verification
ALTER TABLE instructor_certifications ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'pending';
ALTER TABLE instructor_certifications ADD COLUMN IF NOT EXISTS verified_by TEXT;
ALTER TABLE instructor_certifications ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
ALTER TABLE instructor_certifications ADD COLUMN IF NOT EXISTS verification_notes TEXT;
ALTER TABLE instructor_certifications ADD COLUMN IF NOT EXISTS document_url TEXT;
NOTIFY pgrst, 'reload schema';

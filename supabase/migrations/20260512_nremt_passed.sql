-- NREMT passed + certificate received — single closeout flag.
--
-- The student_internships table already tracks "cleared for NREMT"
-- (cleared_for_nremt + nremt_clearance_date), which means "we have
-- signed off and the student is eligible to test." This pair adds
-- the next milestone: the student actually passed and we received
-- the certificate.
--
-- Kept deliberately simple per the spec — boolean + auto-stamped
-- date, no scheduling, no result detail. The user explicitly asked
-- for "simple records confirmation" not a full test-tracking system.

ALTER TABLE student_internships
  ADD COLUMN IF NOT EXISTS nremt_passed boolean NOT NULL DEFAULT false;

ALTER TABLE student_internships
  ADD COLUMN IF NOT EXISTS nremt_passed_date date;

COMMENT ON COLUMN student_internships.nremt_passed IS
  'Set to true when the program receives the NREMT certificate from the student. Distinct from cleared_for_nremt (we approved them to test) — this means the test was passed and the cert is on file.';
COMMENT ON COLUMN student_internships.nremt_passed_date IS
  'Date the certificate was received / passing was confirmed. Auto-stamped to today when nremt_passed flips true via the closeout UI; editable thereafter.';

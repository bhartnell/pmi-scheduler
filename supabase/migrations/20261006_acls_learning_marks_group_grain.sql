-- ACLS learning station: group-grain rows (one submit = one group at one station).
-- Mirrors adv_cert_test_attempts (lab_group_id, team_lead_id, cert_course).
-- Ben's go: 2026-10-05 23:55Z comment on the learning-station card.
-- Snapshot taken first: _backup_acls_learning_marks_20261006_pre_group (82 rows).

ALTER TABLE acls_learning_marks ADD COLUMN IF NOT EXISTS lab_group_id uuid REFERENCES lab_groups(id);
ALTER TABLE acls_learning_marks ADD COLUMN IF NOT EXISTS team_lead_id uuid REFERENCES students(id);
ALTER TABLE acls_learning_marks ADD COLUMN IF NOT EXISTS cert_course text NOT NULL DEFAULT 'acls';

-- Catalog-only; no row is read or rewritten.
ALTER TABLE acls_learning_marks ALTER COLUMN student_id DROP NOT NULL;

ALTER TABLE acls_learning_marks DROP CONSTRAINT IF EXISTS acls_learning_marks_station_id_student_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS acls_learning_marks_station_student_uq
  ON acls_learning_marks (station_id, student_id) WHERE student_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS acls_learning_marks_station_group_uq
  ON acls_learning_marks (station_id, lab_group_id) WHERE lab_group_id IS NOT NULL;

-- ROLLBACK (only valid before any NULL-student row is written):
-- DROP INDEX IF EXISTS acls_learning_marks_station_group_uq;
-- DROP INDEX IF EXISTS acls_learning_marks_station_student_uq;
-- ALTER TABLE acls_learning_marks ADD CONSTRAINT acls_learning_marks_station_id_student_id_key UNIQUE (station_id, student_id);
-- ALTER TABLE acls_learning_marks ALTER COLUMN student_id SET NOT NULL;
-- ALTER TABLE acls_learning_marks DROP COLUMN cert_course, DROP COLUMN team_lead_id, DROP COLUMN lab_group_id;

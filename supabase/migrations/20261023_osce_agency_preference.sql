-- OSCE evaluator agency preference (Task Handoff Queue: "Evaluator student/agency preference at signup").
-- Additive and idempotent. students.agency is NOT rewritten; this alias map is read at match time only.

CREATE TABLE IF NOT EXISTS agency_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alias text NOT NULL,
  canonical text NOT NULL,
  created_at timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS agency_aliases_alias_key ON agency_aliases (lower(btrim(alias)));
ALTER TABLE agency_aliases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS agency_aliases_service_role ON agency_aliases;
CREATE POLICY agency_aliases_service_role ON agency_aliases FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Seed: the map in the card's 2026-10-14 triage note, built from live distinct students.agency values.
-- Canonical 'AMR/MedicWest' = dual-employed (matches an evaluator asking for either). 'None' = no agency.
INSERT INTO agency_aliases (alias, canonical) VALUES
  ('AMR', 'AMR'), ('AMR Las Vegas', 'AMR'),
  ('MWA', 'MedicWest'), ('MedicWest Ambulance', 'MedicWest'), ('MedicWest', 'MedicWest'),
  ('AMR/MWA', 'AMR/MedicWest'), ('AMR/MWA?', 'AMR/MedicWest'),
  ('CA', 'Community Ambulance'), ('Community Ambulance', 'Community Ambulance'),
  ('LVFR', 'LVFR'), ('HCA', 'HCA'), ('N/A', 'None')
ON CONFLICT DO NOTHING;

ALTER TABLE osce_observers ADD COLUMN IF NOT EXISTS preferred_agency text;
ALTER TABLE osce_observers ADD COLUMN IF NOT EXISTS preferred_student_name text;

-- ROLLBACK:
-- ALTER TABLE osce_observers DROP COLUMN IF EXISTS preferred_student_name;
-- ALTER TABLE osce_observers DROP COLUMN IF EXISTS preferred_agency;
-- DROP TABLE IF EXISTS agency_aliases;  -- seed rows only unless Ben added aliases; snapshot first if so

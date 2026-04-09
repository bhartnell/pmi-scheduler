-- Seed standard certification types into ce_requirements
-- 20260409_seed_cert_types.sql

-- Add a unique constraint on cert_type so we can use ON CONFLICT DO NOTHING
DO $$ BEGIN
  ALTER TABLE ce_requirements ADD CONSTRAINT ce_requirements_cert_type_key UNIQUE (cert_type);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;

INSERT INTO ce_requirements (cert_type, display_name, issuing_body, cycle_years, total_hours_required)
VALUES
  ('nremt_emt',          'NREMT-EMT',               'NREMT',            2, 30),
  ('nremt_aemt',         'NREMT-AEMT',              'NREMT',            2, 30),
  ('nremt_paramedic',    'NREMT-Paramedic',         'NREMT',            2, 30),
  ('bls_provider',       'BLS Provider',            'AHA',              2,  0),
  ('acls_provider',      'ACLS Provider',           'AHA',              2,  0),
  ('pals_provider',      'PALS Provider',           'AHA',              2,  0),
  ('nv_emt_license',     'Nevada EMT License',      'State of Nevada',  2,  0),
  ('nv_paramedic_license','Nevada Paramedic License','State of Nevada', 2,  0),
  ('instructor_1',       'Instructor 1',            'NAEMSE',           4,  0),
  ('instructor_2',       'Instructor 2',            'NAEMSE',           4,  0),
  ('cpr_instructor',     'CPR Instructor',          'AHA',              2,  0)
ON CONFLICT (cert_type) DO NOTHING;

-- Add missing foundational skills to the catalog so EMT SMC rows
-- (and any future AEMT/PM rows for the same skills) can link cleanly.
--
-- Source: EMT SMC list provided 2026-04-18 had 22 rows the fuzzy matcher
-- couldn't link to existing skills. These are the concepts the catalog
-- was missing. After this migration, re-running scripts/seed-emt-aemt-smc.js
-- will link those rows automatically.
--
-- certification_levels distinguishes genuinely shared skills (assessment,
-- airway basics, OB, etc.) from EMT-specific Platinum variants and
-- "report to ALS" (AEMT/PM ARE ALS, they don't report to one).
--
-- Safe to rerun: the WHERE NOT EXISTS guard prevents duplicates since
-- the skills table has no unique constraint on name.

INSERT INTO skills (name, category, certification_levels, cert_levels, is_active)
SELECT v.name, v.category, v.certification_levels, v.cert_levels, true
FROM (VALUES
  -- Assessment primitives (shared across all three levels)
  ('Blood pressure by auscultation',              'Assessment', ARRAY['EMT','AEMT','Paramedic'], ARRAY['PM']),
  ('Blood pressure by palpation',                  'Assessment', ARRAY['EMT','AEMT','Paramedic'], ARRAY['PM']),
  ('Automated blood pressure',                     'Assessment', ARRAY['EMT','AEMT','Paramedic'], ARRAY['PM']),
  ('Level of consciousness (LOC)',                 'Assessment', ARRAY['EMT','AEMT','Paramedic'], ARRAY['PM']),
  ('Pulses assessment',                            'Assessment', ARRAY['EMT','AEMT','Paramedic'], ARRAY['PM']),
  ('Pupils assessment',                            'Assessment', ARRAY['EMT','AEMT','Paramedic'], ARRAY['PM']),
  ('Skin signs assessment',                        'Assessment', ARRAY['EMT','AEMT','Paramedic'], ARRAY['PM']),
  -- Airway
  ('Oxygen tank assembly/operation',               'Airway',     ARRAY['EMT','AEMT','Paramedic'], ARRAY['PM']),
  ('Rigid catheter suctioning',                    'Airway',     ARRAY['EMT','AEMT','Paramedic'], ARRAY['PM']),
  ('Humidified oxygen delivery',                   'Airway',     ARRAY['EMT','AEMT','Paramedic'], ARRAY['PM']),
  -- Cardiac
  ('CPR — infant (one-rescuer)',                   'Cardiac',    ARRAY['EMT','AEMT','Paramedic'], ARRAY['PM']),
  -- EMT-specific Platinum variant — PM has its own Cardiac Arrest/AED entry
  ('Cardiac Arrest Management / AED (EMT)',        'Cardiac',    ARRAY['EMT'],                    ARRAY['PM']),
  -- BLS
  -- EMT-specific Platinum variant
  ('Bleeding control and shock management (EMT)',  'BLS',        ARRAY['EMT'],                    ARRAY['PM']),
  ('Auto-injector administration',                 'BLS',        ARRAY['EMT','AEMT','Paramedic'], ARRAY['PM']),
  ('Nebulized medication administration',          'BLS',        ARRAY['EMT','AEMT','Paramedic'], ARRAY['PM']),
  -- OB
  ('Childbirth — normal delivery',                 'OB',         ARRAY['EMT','AEMT','Paramedic'], ARRAY['PM']),
  -- Other
  ('Patient lifting and moving techniques',        'Other',      ARRAY['EMT','AEMT','Paramedic'], ARRAY['PM']),
  ('Patient report to receiving facility',         'Other',      ARRAY['EMT','AEMT','Paramedic'], ARRAY['PM']),
  -- EMT-only: higher levels ARE ALS
  ('Patient report to ALS provider',               'Other',      ARRAY['EMT'],                    ARRAY['PM'])
) AS v(name, category, certification_levels, cert_levels)
WHERE NOT EXISTS (
  SELECT 1 FROM skills s WHERE s.name = v.name
);

-- Add AEMT-specific catalog entries so the 3 remaining unlinked AEMT
-- SMC rows link cleanly after re-running seed-emt-aemt-smc.js.
--
-- "Intraosseous medication administration" — distinct from the
--   existing IV bolus / IM injection entries. AEMT-and-up.
-- "Perform PPV with BVM" — semantically overlaps with PM's
--   "BVM Ventilation of an Apneic Adult Patient" but AEMT CoAEMSP
--   tracks it as its own skill for simulation counting, so it gets
--   its own entry.

INSERT INTO skills (name, category, certification_levels, cert_levels, is_active)
SELECT v.name, v.category, v.certification_levels, v.cert_levels, true
FROM (VALUES
  ('Intraosseous medication administration', 'Medication', ARRAY['AEMT','Paramedic'], ARRAY['PM']),
  ('Perform PPV with BVM',                   'Airway',     ARRAY['EMT','AEMT','Paramedic'], ARRAY['PM'])
) AS v(name, category, certification_levels, cert_levels)
WHERE NOT EXISTS (
  SELECT 1 FROM skills s WHERE s.name = v.name
);

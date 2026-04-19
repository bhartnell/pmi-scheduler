-- Add "Perform chest compressions" as a standalone catalog entry so
-- the AEMT + PM CoAEMSP SMC rows link cleanly. The existing CPR-*
-- entries bundle compressions + ventilation + AED into a sequence;
-- CoAEMSP tracks the compressions component separately for counting.
INSERT INTO skills (name, category, certification_levels, cert_levels, is_active)
SELECT v.name, v.category, v.certification_levels, v.cert_levels, true
FROM (VALUES
  ('Perform chest compressions', 'Cardiac', ARRAY['EMT','AEMT','Paramedic'], ARRAY['PM'])
) AS v(name, category, certification_levels, cert_levels)
WHERE NOT EXISTS (
  SELECT 1 FROM skills s WHERE s.name = v.name
);

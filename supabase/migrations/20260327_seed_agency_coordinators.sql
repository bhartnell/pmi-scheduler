-- Seed agency clinical coordinator contacts

-- AMR / American Medical Response
UPDATE agencies SET
  clinical_coordinator_name = 'Aaron Goldstein',
  clinical_coordinator_email = 'Aaron.Goldstein@gmr.net'
WHERE name ILIKE '%AMR%' OR name ILIKE '%American Medical%';

-- MedicWest / MWA
UPDATE agencies SET
  clinical_coordinator_name = 'Kady Dabash-Meininger',
  clinical_coordinator_email = 'kady.Dabash-Meininger@gmr.net'
WHERE name ILIKE '%MedicWest%' OR name ILIKE '%MWA%';

-- Community Ambulance
UPDATE agencies SET
  clinical_coordinator_name = 'John Osborn',
  clinical_coordinator_email = 'JOsborn@communityambulance.com'
WHERE name ILIKE '%Community%';

-- LVFR / Las Vegas Fire & Rescue
UPDATE agencies SET
  clinical_coordinator_name = 'Sun Kang',
  clinical_coordinator_email = 'skang@lasvegasnevada.gov'
WHERE name ILIKE '%LVFR%' OR name ILIKE '%Las Vegas Fire%';

-- Canonical lab-location picker (Task Handoff Queue [ROOMS], Ben directive 2026-10-01).
-- pmi_rooms becomes the single source for lab-station locations:
--   * is_lab_location flags the 8 pickable options (class-only rooms such as
--     Computer Lab 1/2 and Old Suite Classroom stay active for class scheduling).
--   * lab_stations.room_id references pmi_rooms; the free-text `room` column is kept
--     (still written by the app, still readable for anything that does not map).
--   * The Hospital is retired (is_active=false), never deleted, so past lab days read as before.
-- Names are display strings; pmi_schedule_blocks references rooms by id, so renames are safe.
-- Backup taken before this ran: _backup_lab_stations_room_id_20261001.

ALTER TABLE pmi_rooms ADD COLUMN IF NOT EXISTS is_lab_location boolean NOT NULL DEFAULT false;
ALTER TABLE lab_stations ADD COLUMN IF NOT EXISTS room_id uuid REFERENCES pmi_rooms(id);
CREATE INDEX IF NOT EXISTS idx_lab_stations_room_id ON lab_stations(room_id);

-- Canonical names (rename in place, same ids)
UPDATE pmi_rooms SET name = 'Classroom 1 (EMT)',        display_order = 1, is_lab_location = true WHERE name = 'Classroom 1';
UPDATE pmi_rooms SET name = 'Classroom 2 (Paramedic)',  display_order = 2, is_lab_location = true WHERE name = 'Classroom 2';
UPDATE pmi_rooms SET name = 'Lab Room 1 (Big)',         display_order = 3, is_lab_location = true,
  notes = 'Hospital-type setup: bed, manikin, monitor' WHERE name = 'Large Lab Room';
UPDATE pmi_rooms SET name = 'Lab Room 2 (Small)',       display_order = 4, is_lab_location = true,
  notes = 'Hospital-type setup: bed, manikin, monitor' WHERE name = 'Small Lab Room';
UPDATE pmi_rooms SET name = 'Common Area',              display_order = 6, is_lab_location = true WHERE name = 'Student Commons';

-- Retire (flag, do not erase)
UPDATE pmi_rooms SET is_active = false, is_lab_location = false,
  notes = 'Retired 2026-10-01: replaced by Ambulance' WHERE name = 'The Hospital';

-- New options
INSERT INTO pmi_rooms (name, room_type, notes, is_active, display_order, is_lab_location) VALUES
  ('Ambulance', 'lab',   'The SimRig, added the week of 2026-09-22', true, 5, true),
  ('Outside',   'other', NULL, true, 7, true),
  ('Other',     'other', 'Put the real location in the lab notes', true, 8, true)
ON CONFLICT (name) DO NOTHING;

-- Backfill room_id from the existing free text: exact, known mappings only.
-- Anything else (Supply Closet, Suite 1, Back Lab Area, typos, ...) keeps room_id NULL and its text.
UPDATE lab_stations s SET room_id = r.id
FROM pmi_rooms r
WHERE s.room_id IS NULL AND s.room IS NOT NULL AND r.name = CASE btrim(s.room)
  WHEN 'EMT Classroom'        THEN 'Classroom 1 (EMT)'
  WHEN 'Classroom 1'          THEN 'Classroom 1 (EMT)'
  WHEN 'Paramedic Classroom'  THEN 'Classroom 2 (Paramedic)'
  WHEN 'Classroom 2'          THEN 'Classroom 2 (Paramedic)'
  WHEN 'Big Lab Room'         THEN 'Lab Room 1 (Big)'
  WHEN 'Lab Room 1'           THEN 'Lab Room 1 (Big)'
  WHEN 'Small Lab Room'       THEN 'Lab Room 2 (Small)'
  WHEN 'Lab Room 2'           THEN 'Lab Room 2 (Small)'
  WHEN 'Common Area'          THEN 'Common Area'
  WHEN 'Ambulance'            THEN 'Ambulance'
  WHEN 'Outside'              THEN 'Outside'
  WHEN 'Hospital'             THEN 'The Hospital'
END;

-- ROLLBACK:
-- UPDATE lab_stations SET room_id = NULL;
-- ALTER TABLE lab_stations DROP COLUMN IF EXISTS room_id;
-- UPDATE pmi_rooms SET is_active = true, notes = 'Flexible overflow space' WHERE name = 'The Hospital';
-- UPDATE pmi_rooms SET name='Classroom 1' WHERE name='Classroom 1 (EMT)';
-- UPDATE pmi_rooms SET name='Classroom 2' WHERE name='Classroom 2 (Paramedic)';
-- UPDATE pmi_rooms SET name='Large Lab Room', notes='Bedroom-sized, manikins' WHERE name='Lab Room 1 (Big)';
-- UPDATE pmi_rooms SET name='Small Lab Room', notes='Bedroom-sized, manikins' WHERE name='Lab Room 2 (Small)';
-- UPDATE pmi_rooms SET name='Student Commons' WHERE name='Common Area';
-- DELETE FROM pmi_rooms WHERE name IN ('Ambulance','Outside','Other');  -- only if no references
-- ALTER TABLE pmi_rooms DROP COLUMN IF EXISTS is_lab_location;

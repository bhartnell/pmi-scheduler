-- Restore station 8 (Medical retake overflow) to "Acute Asthma Attack"
-- The auto-rotate changed it to Anaphylaxis. User wants retake Medical
-- to be Asthma (different from original station 2's Chest Pains/MI).
UPDATE lab_stations
SET metadata = COALESCE(metadata, '{}'::jsonb) || '{"selected_scenario_id": "f53437e1-9049-4099-88a6-0e721299557f"}'::jsonb
WHERE id IN (
  SELECT id FROM lab_stations
  WHERE lab_day_id = 'a74f07a9-653e-4da9-b185-040cd7b12a3d'
  AND station_number = 8
);

-- Assign "Industrial Fall -- 20 Feet" scenario to Station 9 (Trauma retake overflow)
-- for lab day a74f07a9-653e-4da9-b185-040cd7b12a3d (2026-04-15 NREMT day).
-- Station 9 was created via "Open Additional Station" but had no scenario assigned,
-- causing retake students to see wrong/missing content.

UPDATE lab_stations
SET metadata = COALESCE(metadata, '{}'::jsonb) || '{"selected_scenario_id": "96880bd7-cca0-414b-9d84-9a3acc69e525"}'::jsonb
WHERE id = 'b077a1e3-f50c-4df1-8bc0-dcee69306b66';

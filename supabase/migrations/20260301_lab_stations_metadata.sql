-- Add metadata JSONB column to lab_stations for preserving
-- rich template data (equipment, roles, instructor_tiering, tracking, etc.)
-- when templates are applied to create lab day stations.
ALTER TABLE lab_stations ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

COMMENT ON COLUMN lab_stations.metadata IS 'Template-sourced metadata: equipment[], roles[], instructor_tiering{}, tracking{}, stress_layers[], common_errors[], scenario_cards[], available_stations[]';

CREATE INDEX IF NOT EXISTS idx_lab_stations_metadata ON lab_stations USING GIN (metadata);

NOTIFY pgrst, 'reload schema';

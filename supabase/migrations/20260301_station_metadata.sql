-- Add metadata JSONB column to lab_template_stations for storing
-- extended station properties (duration, time_block, equipment, tracking, etc.)
-- from richer template files like Paramedic S3.
ALTER TABLE lab_template_stations ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

COMMENT ON COLUMN lab_template_stations.metadata IS 'Extended station properties: duration_minutes, time_block, equipment[], tracking{}, roles, stress_layers, etc.';

NOTIFY pgrst, 'reload schema';

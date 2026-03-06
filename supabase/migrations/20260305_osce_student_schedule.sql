-- OSCE Student Schedule - assigns students to time blocks with slot ordering
CREATE TABLE IF NOT EXISTS osce_student_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  time_block_id UUID NOT NULL REFERENCES osce_time_blocks(id) ON DELETE CASCADE,
  student_name TEXT NOT NULL,
  slot_number INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(time_block_id, slot_number)
);

CREATE INDEX IF NOT EXISTS idx_osce_student_schedule_block ON osce_student_schedule(time_block_id);

-- Seed student assignments
-- First get block IDs by label
DO $$
DECLARE
  morning_id UUID;
  early_aft_id UUID;
  late_aft_id UUID;
  day2_aft_id UUID;
BEGIN
  SELECT id INTO morning_id FROM osce_time_blocks WHERE label = 'Morning' AND day_number = 1;
  SELECT id INTO early_aft_id FROM osce_time_blocks WHERE label = 'Early Afternoon' AND day_number = 1;
  SELECT id INTO late_aft_id FROM osce_time_blocks WHERE label = 'Late Afternoon' AND day_number = 1;
  SELECT id INTO day2_aft_id FROM osce_time_blocks WHERE label = 'Afternoon' AND day_number = 2;

  -- Day 1 Morning
  INSERT INTO osce_student_schedule (time_block_id, student_name, slot_number) VALUES
    (morning_id, 'PORFIRIO', 1),
    (morning_id, 'GIFFORD', 2),
    (morning_id, 'JOHNSON', 3),
    (morning_id, 'SOLARI', 4),
    (morning_id, 'MIRANDA', 5),
    (morning_id, 'BILHARZ', 6)
  ON CONFLICT DO NOTHING;

  -- Day 1 Early Afternoon
  INSERT INTO osce_student_schedule (time_block_id, student_name, slot_number) VALUES
    (early_aft_id, 'NIXON', 1),
    (early_aft_id, 'GRAHOVAC', 2)
  ON CONFLICT DO NOTHING;

  -- Day 1 Late Afternoon
  INSERT INTO osce_student_schedule (time_block_id, student_name, slot_number) VALUES
    (late_aft_id, 'COTTRELL', 1),
    (late_aft_id, 'RUIZ', 2),
    (late_aft_id, 'ACOSTA', 3),
    (late_aft_id, 'ZENTEK', 4),
    (late_aft_id, 'JAKICEVIC', 5)
  ON CONFLICT DO NOTHING;

  -- Day 2 Afternoon
  INSERT INTO osce_student_schedule (time_block_id, student_name, slot_number) VALUES
    (day2_aft_id, 'SARELLANO LOPEZ', 1),
    (day2_aft_id, 'SULLIVAN', 2),
    (day2_aft_id, 'CAHA', 3),
    (day2_aft_id, 'SMITH', 4),
    (day2_aft_id, 'KENNEDY', 5),
    (day2_aft_id, 'WILLIAMS', 6)
  ON CONFLICT DO NOTHING;
END $$;

-- Skill Drills Library
-- A curated database of quick practice exercises for skill_drill station type

CREATE TABLE IF NOT EXISTS skill_drills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  estimated_duration INTEGER DEFAULT 15,
  equipment_needed TEXT[],
  instructions TEXT,
  created_by TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_skill_drills_category ON skill_drills(category);
CREATE INDEX IF NOT EXISTS idx_skill_drills_active ON skill_drills(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_skill_drills_created_by ON skill_drills(created_by);

ALTER TABLE skill_drills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view skill drills"
  ON skill_drills FOR SELECT USING (true);

CREATE POLICY "Instructors can manage skill drills"
  ON skill_drills FOR ALL USING (true);

-- Seed data: 10 common EMS skill drills
INSERT INTO skill_drills (name, description, category, estimated_duration, equipment_needed, instructions, created_by) VALUES
  (
    'IV Start Practice',
    'Practice peripheral IV insertion technique on training arm',
    'vascular_access',
    15,
    ARRAY['IV training arm', 'IV start kit', 'gloves', 'tourniquet', 'tape', 'gauze'],
    'Students rotate through IV starts on the training arm. Focus on site selection, flash visualization, and securing the line. Aim for two successful starts per rotation.',
    'system'
  ),
  (
    'Airway Management Drill',
    'Practice BVM ventilation and insertion of airway adjuncts (OPA/NPA)',
    'airway',
    20,
    ARRAY['BVM mask', 'OPA set (multiple sizes)', 'NPA set with lube', 'mannequin head', 'suction unit'],
    'Students practice sizing and inserting OPA/NPA adjuncts, then demonstrate effective 2-person BVM ventilation with a seal check. Coach students on jaw-thrust technique.',
    'system'
  ),
  (
    'Endotracheal Intubation',
    'Endotracheal intubation skill drill on intubation mannequin',
    'airway',
    20,
    ARRAY['Intubation mannequin', 'Laryngoscope with blades (Mac 3/4, Miller 2/3)', 'ET tubes (7.0, 7.5, 8.0)', 'Stylet', '10cc syringe', 'BVM', 'Colorimetric ETCO2', 'Tape/holder'],
    'Each student performs one intubation attempt. Verify tube placement with 5-point auscultation and colorimetric ETCO2. Time each attempt and debrief technique.',
    'system'
  ),
  (
    '12-Lead ECG Placement',
    'Practice proper 12-lead electrode placement and acquisition',
    'cardiac',
    10,
    ARRAY['12-lead ECG machine or trainer', 'Electrodes (10 per student)', 'Mannequin or willing partner', 'Razor/prep pads'],
    'Students practice rapid, accurate electrode placement using anatomical landmarks. Time placement from equipment-out to strip acquired. Review proper skin prep.',
    'system'
  ),
  (
    'Medication Calculation and Draw-Up',
    'Practice calculating doses and drawing up medications accurately',
    'pharmacology',
    15,
    ARRAY['Medication vials (saline/water for injection)', 'Various syringe sizes (1cc, 3cc, 10cc)', 'Needles', 'Sharps container', 'Calculation worksheets', 'Gloves'],
    'Students receive weight-based dosing scenarios and must calculate correct dose, select appropriate syringe, and draw up the exact volume. Instructor verifies each draw.',
    'system'
  ),
  (
    'Splinting Techniques',
    'Practice traction, rigid, and soft splinting for extremity injuries',
    'trauma',
    15,
    ARRAY['Traction splint', 'SAM splints (multiple sizes)', 'Soft splints', 'Roller gauze', 'Medical tape', 'Padding/blanket'],
    'Rotate through: traction splint for femur fracture, SAM splint for forearm fracture, and improvised soft splint. Check CMS (circulation, motor, sensation) before and after each.',
    'system'
  ),
  (
    'Needle Chest Decompression',
    'Needle decompression technique for tension pneumothorax',
    'trauma',
    10,
    ARRAY['Chest decompression trainer or torso mannequin', '14ga 3.25" angiocath', 'Gloves', 'Tape measure', 'Markers'],
    'Students identify proper landmarks (2nd ICS MCL or 4th/5th ICS MAL), demonstrate proper technique, and verbalize assessment findings that indicate tension pneumothorax.',
    'system'
  ),
  (
    'Spinal Motion Restriction',
    'C-spine immobilization and backboard application',
    'trauma',
    20,
    ARRAY['Long backboard', 'C-collar set (small/medium/large)', 'Head blocks and straps', 'Spider straps or roller gauze', 'Partner for patient role'],
    'Teams of 3 practice manual in-line stabilization, C-collar sizing and application, and full backboard packaging with a 90-second target. Verbalize sizing rationale.',
    'system'
  ),
  (
    'IO Access Placement',
    'Intraosseous access using EZ-IO drill',
    'vascular_access',
    15,
    ARRAY['EZ-IO drill', 'IO needles (15mm, 25mm, 45mm)', 'IO training leg or bone model', 'EZ-IO stabilizer', 'IV tubing and fluid', 'Gloves', 'Pressure bag'],
    'Students identify proximal tibial landmark, select appropriate needle length, insert IO, confirm placement with aspiration/flush, and secure with stabilizer. Verbalize indication criteria.',
    'system'
  ),
  (
    'Primary and Secondary Assessment',
    'Systematic head-to-toe patient assessment drill',
    'assessment',
    20,
    ARRAY['Stethoscope', 'BP cuff (manual)', 'Penlight', 'Pulse oximeter', 'Assessment documentation form', 'Partner for patient role'],
    'Students perform a timed primary and secondary assessment on a partner playing a responsive patient. Instructor assigns a chief complaint. Target: complete assessment in under 5 minutes with accurate findings documented.',
    'system'
  )
ON CONFLICT DO NOTHING;

-- Add drill_ids column to lab_stations to store selected skill drill references
ALTER TABLE lab_stations ADD COLUMN IF NOT EXISTS drill_ids UUID[] DEFAULT '{}';

COMMENT ON COLUMN lab_stations.drill_ids IS 'Array of skill_drills.id references for skill_drill type stations';

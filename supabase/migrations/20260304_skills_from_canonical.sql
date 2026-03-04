-- Populate the skills picker table with entries derived from canonical_skills
-- plus additional common station names (KED, Short Board, etc.)
-- Uses ON CONFLICT DO NOTHING so it is idempotent.

-- First ensure the skills table has a unique constraint on name for idempotent inserts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'skills_name_unique'
  ) THEN
    -- Only add if no duplicate names exist
    IF (SELECT COUNT(*) FROM (SELECT name FROM skills GROUP BY name HAVING COUNT(*) > 1) dupes) = 0 THEN
      ALTER TABLE skills ADD CONSTRAINT skills_name_unique UNIQUE (name);
    END IF;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not add unique constraint on skills.name: %', SQLERRM;
END $$;

-- ── IMMOBILIZATION ──
INSERT INTO skills (name, category, description, certification_levels, required_count, display_order, is_active)
VALUES
  ('KED / Short Board', 'Immobilization', 'KED or vest-type short board device for seated spinal immobilization', ARRAY['EMT','AEMT','Paramedic'], 1, 0, true),
  ('Seated Spinal Immobilization', 'Immobilization', 'Seated patient spinal immobilization using KED or vest device', ARRAY['EMT','AEMT','Paramedic'], 1, 0, true),
  ('Spinal Immobilization — Supine', 'Immobilization', 'Supine patient spinal immobilization with backboard', ARRAY['EMT','AEMT','Paramedic'], 1, 0, true),
  ('Spinal Immobilization — Seated', 'Immobilization', 'Seated patient spinal immobilization with KED/vest device', ARRAY['EMT','AEMT','Paramedic'], 1, 0, true),
  ('Cervical Collar Application', 'Immobilization', 'Sizing and application of cervical collar', ARRAY['EMT','AEMT','Paramedic'], 1, 0, true),
  ('Long Bone Immobilization', 'Immobilization', 'Rigid splint for long bone fractures; traction splint for femur', ARRAY['EMT','AEMT','Paramedic'], 1, 0, true),
  ('Joint Immobilization', 'Immobilization', 'Padded splint for joint injuries; immobilize as found', ARRAY['EMT','AEMT','Paramedic'], 1, 0, true),
  ('Spine Motion Restriction', 'Immobilization', 'Spine motion restriction techniques', ARRAY['EMT','AEMT','Paramedic'], 1, 0, true)
ON CONFLICT (name) DO NOTHING;

-- ── AIRWAY ──
INSERT INTO skills (name, category, description, certification_levels, required_count, display_order, is_active)
VALUES
  ('OPA Insertion', 'Airway', 'Oropharyngeal airway insertion', ARRAY['AEMT','Paramedic'], 1, 0, true),
  ('NPA Insertion', 'Airway', 'Nasopharyngeal airway insertion', ARRAY['AEMT','Paramedic'], 1, 0, true),
  ('BVM Ventilation', 'Airway', 'Bag-valve-mask ventilation of apneic patient', ARRAY['EMT','AEMT','Paramedic'], 1, 0, true),
  ('Oxygen Administration', 'Airway', 'Oxygen delivery via NRB mask, nasal cannula, or face mask', ARRAY['EMT','AEMT','Paramedic'], 1, 0, true),
  ('Supraglottic Airway', 'Airway', 'SGA insertion (King LT, LMA, i-gel)', ARRAY['AEMT','Paramedic'], 1, 0, true),
  ('CPAP Application', 'Airway', 'Continuous positive airway pressure device application', ARRAY['AEMT','Paramedic'], 1, 0, true),
  ('Oral Suctioning', 'Airway', 'Oropharyngeal suctioning technique', ARRAY['EMT','AEMT','Paramedic'], 1, 0, true),
  ('Endotracheal Suctioning', 'Airway', 'In-line ETT or SGA suctioning', ARRAY['AEMT','Paramedic'], 1, 0, true),
  ('Endotracheal Intubation', 'Airway', 'Oral endotracheal intubation', ARRAY['Paramedic'], 1, 0, true),
  ('Cricothyrotomy', 'Airway', 'Surgical or needle cricothyrotomy', ARRAY['Paramedic'], 1, 0, true),
  ('FBAO — Adult', 'Airway', 'Foreign body airway obstruction management — adult', ARRAY['EMT','AEMT','Paramedic'], 1, 0, true),
  ('FBAO — Infant', 'Airway', 'Foreign body airway obstruction management — infant', ARRAY['AEMT','Paramedic'], 1, 0, true)
ON CONFLICT (name) DO NOTHING;

-- ── VASCULAR ACCESS ──
INSERT INTO skills (name, category, description, certification_levels, required_count, display_order, is_active)
VALUES
  ('IV Access', 'Vascular Access', 'Peripheral intravenous catheter insertion', ARRAY['AEMT','Paramedic'], 1, 0, true),
  ('IO Access', 'Vascular Access', 'Intraosseous access via EZ-IO or similar device', ARRAY['AEMT','Paramedic'], 1, 0, true)
ON CONFLICT (name) DO NOTHING;

-- ── MEDICATION ──
INSERT INTO skills (name, category, description, certification_levels, required_count, display_order, is_active)
VALUES
  ('IM Injection', 'Medication', 'Intramuscular injection technique', ARRAY['AEMT','Paramedic'], 1, 0, true),
  ('IV Bolus Medication', 'Medication', 'IV push medication administration', ARRAY['AEMT','Paramedic'], 1, 0, true),
  ('IV Infusion Setup', 'Medication', 'Spiking bag, priming tubing, drip rate calculation', ARRAY['AEMT','Paramedic'], 1, 0, true),
  ('Intranasal Medication', 'Medication', 'MAD device medication administration', ARRAY['AEMT','Paramedic'], 1, 0, true),
  ('Nebulizer Treatment', 'Medication', 'Small-volume nebulizer or MDI assist', ARRAY['AEMT','Paramedic'], 1, 0, true)
ON CONFLICT (name) DO NOTHING;

-- ── ASSESSMENT ──
INSERT INTO skills (name, category, description, certification_levels, required_count, display_order, is_active)
VALUES
  ('Patient Assessment — Trauma', 'Assessment', 'Systematic trauma patient assessment', ARRAY['EMT','AEMT','Paramedic'], 1, 0, true),
  ('Patient Assessment — Medical', 'Assessment', 'Systematic medical patient assessment', ARRAY['EMT','AEMT','Paramedic'], 1, 0, true),
  ('Vital Signs', 'Assessment', 'Blood pressure, pulse, respirations, SpO2', ARRAY['EMT','AEMT','Paramedic'], 1, 0, true),
  ('Blood Glucose Monitoring', 'Assessment', 'Glucometer blood glucose check', ARRAY['AEMT','Paramedic'], 1, 0, true),
  ('12-Lead ECG', 'Assessment', '12-Lead ECG acquisition and placement', ARRAY['AEMT','Paramedic'], 1, 0, true)
ON CONFLICT (name) DO NOTHING;

-- ── CARDIAC ──
INSERT INTO skills (name, category, description, certification_levels, required_count, display_order, is_active)
VALUES
  ('CPR — Adult', 'Cardiac', 'Adult CPR with high-quality compressions', ARRAY['EMT','AEMT','Paramedic'], 1, 0, true),
  ('AED / Defibrillation', 'Cardiac', 'AED application and defibrillation', ARRAY['EMT','AEMT','Paramedic'], 1, 0, true),
  ('Synchronized Cardioversion', 'Cardiac', 'Synchronized cardioversion for unstable tachydysrhythmia', ARRAY['Paramedic'], 1, 0, true),
  ('Transcutaneous Pacing', 'Cardiac', 'External pacing for symptomatic bradycardia', ARRAY['Paramedic'], 1, 0, true)
ON CONFLICT (name) DO NOTHING;

-- ── TRAUMA ──
INSERT INTO skills (name, category, description, certification_levels, required_count, display_order, is_active)
VALUES
  ('Hemorrhage Control', 'Trauma', 'Bleeding control including tourniquet, wound packing, direct pressure', ARRAY['EMT','AEMT','Paramedic'], 1, 0, true),
  ('Needle Decompression', 'Trauma', 'Needle decompression of tension pneumothorax', ARRAY['Paramedic'], 1, 0, true),
  ('Wound Packing', 'Trauma', 'Hemostatic wound packing technique', ARRAY['EMT','AEMT','Paramedic'], 1, 0, true)
ON CONFLICT (name) DO NOTHING;

-- ── OBSTETRICS ──
INSERT INTO skills (name, category, description, certification_levels, required_count, display_order, is_active)
VALUES
  ('OB Delivery', 'Obstetrics', 'Normal uncomplicated delivery', ARRAY['AEMT','Paramedic'], 1, 0, true)
ON CONFLICT (name) DO NOTHING;

NOTIFY pgrst, 'reload schema';

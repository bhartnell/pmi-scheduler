-- NREMT scenario library for Medical (E202) and Trauma (E201) stations
-- Stores reference scenarios that proctors can assign to a station and view
-- during grading (NOT read aloud to the candidate).

CREATE TABLE IF NOT EXISTS nremt_scenarios (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  skill_code text NOT NULL,
  title text NOT NULL,
  scenario_data jsonb NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nremt_scenarios_skill_code
  ON nremt_scenarios (skill_code) WHERE is_active = true;

-- RLS: readable by any authenticated user, writable only by admins via API
ALTER TABLE nremt_scenarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS nremt_scenarios_read ON nremt_scenarios;
CREATE POLICY nremt_scenarios_read ON nremt_scenarios
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS nremt_scenarios_service_write ON nremt_scenarios;
CREATE POLICY nremt_scenarios_service_write ON nremt_scenarios
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ─── Seed data ──────────────────────────────────────────────────────────────
-- Use idempotent inserts keyed on (skill_code, title)

-- MEDICAL (E202)
INSERT INTO nremt_scenarios (skill_code, title, scenario_data)
SELECT 'E202', 'Acute Asthma Attack', $json$
{
  "dispatch": "Respond to a residence for a 34-year-old female with difficulty breathing.",
  "chief_complaint": "I can't breathe. My inhaler isn't working.",
  "history": {
    "onset": "Started 20 minutes ago after mowing the lawn",
    "provocation": "Worse with activity, slightly better sitting upright",
    "quality": "Tight feeling in chest, can't get air in",
    "radiation": "No",
    "severity": "8/10",
    "time": "20 minutes",
    "interventions": "Used albuterol inhaler twice with no relief"
  },
  "medical_history": "Asthma since childhood, seasonal allergies",
  "medications": ["Albuterol inhaler", "Flovent daily"],
  "allergies": "Penicillin",
  "initial_vitals": {
    "bp": "148/92",
    "pulse": "116 and regular",
    "respirations": "28 and labored with audible wheezing",
    "spo2": "91% on room air",
    "skin": "Pale, diaphoretic",
    "pupils": "Equal and reactive"
  },
  "vitals_with_treatment": {
    "bp": "142/88",
    "pulse": "108",
    "respirations": "22",
    "spo2": "96%",
    "skin": "Improved color"
  },
  "vitals_without_treatment": {
    "bp": "160/98",
    "pulse": "128",
    "respirations": "36 and labored",
    "spo2": "87%"
  },
  "physical_findings": "Tripod position, accessory muscle use, bilateral expiratory wheezing, prolonged expiratory phase",
  "proctor_notes": "Patient is anxious and short of breath. Speak in short sentences. If candidate administers oxygen and assists ventilation, improve vitals accordingly."
}
$json$::jsonb
WHERE NOT EXISTS (SELECT 1 FROM nremt_scenarios WHERE skill_code='E202' AND title='Acute Asthma Attack');

INSERT INTO nremt_scenarios (skill_code, title, scenario_data)
SELECT 'E202', 'Hypoglycemic Emergency', $json$
{
  "dispatch": "Respond to an office building for a 52-year-old male found unresponsive by coworkers.",
  "chief_complaint": "Patient is confused and diaphoretic, unable to provide history",
  "bystander_info": "He was acting strange, sweating, then became unresponsive. He's diabetic.",
  "history": {
    "onset": "Coworkers noticed confusion 30 minutes ago",
    "interventions": "None prior to EMS arrival"
  },
  "medical_history": "Type 1 Diabetes, hypertension",
  "medications": ["Insulin (long and short acting)", "Lisinopril"],
  "allergies": "None known",
  "last_meal": "Breakfast at 7 AM, skipped lunch — it is now 2 PM",
  "initial_vitals": {
    "bp": "138/86",
    "pulse": "108 and regular",
    "respirations": "18 and adequate",
    "spo2": "97% on room air",
    "skin": "Pale, cool, diaphoretic",
    "pupils": "Equal and reactive",
    "blood_glucose": "42 mg/dL if checked"
  },
  "vitals_with_treatment": {
    "bp": "132/82",
    "pulse": "88",
    "respirations": "16",
    "skin": "Improving, less diaphoretic",
    "mentation": "Becoming more alert with oral glucose or dextrose"
  },
  "vitals_without_treatment": {
    "bp": "130/84",
    "pulse": "118",
    "mentation": "Deteriorating, moving toward unresponsive"
  },
  "physical_findings": "GCS 12 (E3V4M5), moves all extremities, no focal deficits, medic alert bracelet present on left wrist",
  "proctor_notes": "Patient responds to painful stimuli, moans to questions. If blood glucose checked, report 42 mg/dL. If oral glucose administered and patient can swallow, improve mental status gradually."
}
$json$::jsonb
WHERE NOT EXISTS (SELECT 1 FROM nremt_scenarios WHERE skill_code='E202' AND title='Hypoglycemic Emergency');

INSERT INTO nremt_scenarios (skill_code, title, scenario_data)
SELECT 'E202', 'Acute Myocardial Infarction', $json$
{
  "dispatch": "Respond to a residence for a 67-year-old male with chest pain.",
  "chief_complaint": "I have this crushing pressure in my chest. It started about 45 minutes ago.",
  "history": {
    "onset": "45 minutes ago while watching television at rest",
    "provocation": "Nothing makes it better, antacids did not help",
    "quality": "Crushing pressure, like an elephant on my chest",
    "radiation": "Radiates to left arm and jaw",
    "severity": "9/10",
    "time": "45 minutes, constant",
    "interventions": "Took 2 antacids with no relief"
  },
  "medical_history": "Hypertension, high cholesterol, Type 2 diabetes",
  "medications": ["Metoprolol", "Atorvastatin", "Metformin", "Aspirin 81mg daily"],
  "allergies": "None known",
  "initial_vitals": {
    "bp": "158/96",
    "pulse": "88 and regular",
    "respirations": "18 and adequate",
    "spo2": "95% on room air",
    "skin": "Pale, cool, diaphoretic",
    "pupils": "Equal and reactive"
  },
  "vitals_with_treatment": {
    "bp": "150/90",
    "pulse": "82",
    "respirations": "16",
    "spo2": "99% on O2",
    "skin": "Slightly improved"
  },
  "vitals_without_treatment": {
    "bp": "162/100",
    "pulse": "96",
    "respirations": "20",
    "spo2": "93%"
  },
  "physical_findings": "Patient sitting in recliner, clutching chest, diaphoretic. Lungs clear bilaterally. No JVD. Pedal edema absent.",
  "proctor_notes": "Patient is anxious and in obvious distress. If candidate administers oxygen and aspirin (verbalizes), acknowledge the interventions. Transport decision should not be delayed."
}
$json$::jsonb
WHERE NOT EXISTS (SELECT 1 FROM nremt_scenarios WHERE skill_code='E202' AND title='Acute Myocardial Infarction');

INSERT INTO nremt_scenarios (skill_code, title, scenario_data)
SELECT 'E202', 'Anaphylaxis — Bee Sting', $json$
{
  "dispatch": "Respond to a park for a 28-year-old female stung by bees.",
  "chief_complaint": "I got stung and now my throat feels like it's closing. I can't breathe well.",
  "history": {
    "onset": "5 minutes ago, stung by multiple bees",
    "provocation": "Nothing making it better, getting worse",
    "quality": "Throat tightening, skin itching everywhere",
    "severity": "9/10 — very scared",
    "time": "5 minutes and worsening rapidly",
    "interventions": "No epi-pen available"
  },
  "medical_history": "Known bee allergy, previous mild reaction 3 years ago",
  "medications": ["Benadryl as needed", "No epi-pen currently"],
  "allergies": "Bee stings — anaphylaxis",
  "initial_vitals": {
    "bp": "88/60",
    "pulse": "128 and weak",
    "respirations": "28 and labored with stridor",
    "spo2": "92% on room air",
    "skin": "Flushed, hives covering arms and trunk, lip swelling",
    "pupils": "Equal and reactive"
  },
  "vitals_with_treatment": {
    "bp": "104/72",
    "pulse": "108",
    "respirations": "22",
    "spo2": "96%",
    "skin": "Hives persisting but swelling slightly improved"
  },
  "vitals_without_treatment": {
    "bp": "76/50",
    "pulse": "140 and thready",
    "respirations": "36 with increasing stridor",
    "spo2": "88%",
    "skin": "Cyanosis developing"
  },
  "physical_findings": "Audible stridor, urticaria (hives) over trunk and extremities, angioedema of lips and tongue, anxious and tripoding",
  "proctor_notes": "This patient is deteriorating rapidly. Stress the urgency. If epinephrine is verbalized and administered, improve vitals. If no treatment, deteriorate aggressively toward respiratory arrest."
}
$json$::jsonb
WHERE NOT EXISTS (SELECT 1 FROM nremt_scenarios WHERE skill_code='E202' AND title='Anaphylaxis — Bee Sting');

-- TRAUMA (E201)
INSERT INTO nremt_scenarios (skill_code, title, scenario_data)
SELECT 'E201', 'Motor Vehicle Crash — Ejected Occupant', $json$
{
  "dispatch": "Respond to highway for a single vehicle rollover with ejection.",
  "mechanism": "You arrive to find a 24-year-old male ejected approximately 30 feet from a rolled vehicle traveling at highway speed. He is lying supine on the roadside.",
  "scene_safety": "Scene is safe. One patient.",
  "initial_presentation": "Patient moans to pain, does not open eyes spontaneously",
  "injuries": [
    "Right-sided flail chest with paradoxical movement",
    "Decreased breath sounds on the right",
    "Pale, cool, moist skin",
    "Weak, rapid carotid pulse",
    "Pupils equal and sluggish",
    "Pelvis stable",
    "Closed angulated deformity right lower leg",
    "Multiple abrasions and lacerations"
  ],
  "initial_vitals": {
    "bp": "72/60",
    "pulse": "138 and weak",
    "respirations": "28 and labored",
    "spo2": "No reading",
    "gcs": "8 (E2V2M4)",
    "skin": "Pale, cool, diaphoretic"
  },
  "vitals_with_treatment": {
    "bp": "92/74",
    "pulse": "118",
    "respirations": "22",
    "spo2": "93%"
  },
  "vitals_without_treatment": {
    "bp": "68/48",
    "pulse": "142",
    "respirations": "38",
    "spo2": "No reading"
  },
  "proctor_notes": "Patient responds to deep painful stimuli only. Mechanism suggests multisystem trauma requiring rapid transport. Do not delay transport for extended scene assessment. If candidate stabilizes airway and manages shock, improve vitals."
}
$json$::jsonb
WHERE NOT EXISTS (SELECT 1 FROM nremt_scenarios WHERE skill_code='E201' AND title='Motor Vehicle Crash — Ejected Occupant');

INSERT INTO nremt_scenarios (skill_code, title, scenario_data)
SELECT 'E201', 'Industrial Fall — 20 Feet', $json$
{
  "dispatch": "Respond to a construction site for a worker who fell from scaffolding.",
  "mechanism": "You arrive to find a 38-year-old male who fell approximately 20 feet from scaffolding onto a concrete surface. Coworkers state he was unconscious briefly then became responsive.",
  "scene_safety": "Scene is safe. Hard hats required — provided. One patient.",
  "initial_presentation": "Patient is conscious and alert but confused, complaining of back and abdominal pain",
  "injuries": [
    "Contusion and tenderness to thoracic and lumbar spine",
    "Abdominal rigidity and tenderness diffusely",
    "Left lower rib tenderness with crepitus",
    "Femur deformity mid-shaft left leg",
    "Laceration to back of head with moderate bleeding",
    "GCS 14 (E4V4M6)"
  ],
  "initial_vitals": {
    "bp": "104/78",
    "pulse": "112 and regular",
    "respirations": "22 and adequate",
    "spo2": "96% on room air",
    "skin": "Pale and cool",
    "pupils": "Equal and reactive but sluggish"
  },
  "vitals_with_treatment": {
    "bp": "112/80",
    "pulse": "104",
    "respirations": "20",
    "spo2": "98% on O2"
  },
  "vitals_without_treatment": {
    "bp": "92/68",
    "pulse": "126",
    "respirations": "24",
    "spo2": "94%"
  },
  "proctor_notes": "Patient is anxious and in pain. Spinal precautions should be maintained throughout. Abdominal rigidity suggests internal injury — transport should not be delayed. If candidate manages airway, hemorrhage, and immobilizes spine, improve vitals."
}
$json$::jsonb
WHERE NOT EXISTS (SELECT 1 FROM nremt_scenarios WHERE skill_code='E201' AND title='Industrial Fall — 20 Feet');

INSERT INTO nremt_scenarios (skill_code, title, scenario_data)
SELECT 'E201', 'Stabbing — Abdominal Wound', $json$
{
  "dispatch": "Respond to a parking lot for a stabbing.",
  "mechanism": "You arrive to find a 31-year-old male with a stab wound to the right upper abdomen. Bystanders state he was stabbed once with a knife approximately 8 minutes ago.",
  "scene_safety": "Scene is safe. Police on scene. One patient. Knife is secured.",
  "initial_presentation": "Patient is conscious, alert, and anxious. Holding right side.",
  "injuries": [
    "2-inch penetrating wound right upper quadrant abdomen",
    "Moderate bleeding from wound site",
    "Abdominal guarding and rigidity on right side",
    "No evisceration",
    "No other obvious injuries"
  ],
  "initial_vitals": {
    "bp": "108/74",
    "pulse": "116 and regular",
    "respirations": "20 and adequate",
    "spo2": "97% on room air",
    "skin": "Pale and diaphoretic",
    "pupils": "Equal and reactive"
  },
  "vitals_with_treatment": {
    "bp": "114/78",
    "pulse": "108",
    "respirations": "18",
    "spo2": "99% on O2"
  },
  "vitals_without_treatment": {
    "bp": "90/62",
    "pulse": "132",
    "respirations": "24",
    "spo2": "95%"
  },
  "proctor_notes": "Patient is scared and in pain. Cover wound with moist sterile dressing and occlusive dressing. Do not remove impaled object (knife is already removed per scenario). Rapid transport indicated. If wound managed and O2 applied, stabilize vitals."
}
$json$::jsonb
WHERE NOT EXISTS (SELECT 1 FROM nremt_scenarios WHERE skill_code='E201' AND title='Stabbing — Abdominal Wound');

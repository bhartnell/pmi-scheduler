# ACLS Converter → Importer Schema (by case_code, into existing cert records)

Target schema for the scenario converter. Output a JSON file shaped like this;
I import it with `node scripts/import-acls-seed.js <file>` which matches each entry
by **`(case_code, cert_course)`** and updates the EXISTING cert-tagged record —
no UI upload, stays out of the standard bank, structural tags/segments preserved.

## Wrapper
```jsonc
{
  "cert_course": "acls",          // default applied if an entry omits it
  "scenarios": [ /* one entry per case, see below */ ]
}
```

## Per-scenario entry
REQUIRED for matching: `case_code` (+ `cert_course:"acls"`). Everything else is
content; **omit any field you don't have — omitted = left unchanged** (the importer
COALESCEs identity/tags and only writes content fields you provide). Do NOT invent
`segments` — the rubric/segments are already loaded; leave them out.

```jsonc
{
  "case_code": "CASE_48",         // REQUIRED — the match key (must already exist)
  "cert_course": "acls",          // REQUIRED

  // ── flat text fields ──
  "chief_complaint": "Choking → respiratory arrest",
  "patient_presentation": "You are a paramedic and arrive to find a man in respiratory arrest at a restaurant after choking on dinner.",  // the lead-in
  "history": "Free-text case narrative / progression (the running story). Newlines OK.",
  "instructor_notes": "Instructor-facing notes (shown READ-FIRST). Newlines OK.",
  "environment_notes": "OOH — restaurant",
  "dispatch_time": "1830",
  "dispatch_location": "Restaurant",
  "dispatch_notes": "Reported choking, now unresponsive",
  "patient_name": "John Doe",     // optional
  "patient_sex": "male",
  "patient_weight": "85 kg",
  "allergies": "NKDA",            // plain string (NOT an array)
  "general_impression": "Cyanotic, apneic",
  "avpu": "U",
  "gcs": "3",                     // text
  "pupils": "Equal, sluggish",

  // ── primary assessment XABCDE (each a text string) ──
  "assessment_x": "No major hemorrhage",
  "assessment_a": "Obstructed → cleared; OPA placed",
  "assessment_b": "Apneic; BVM ventilation",
  "assessment_c": "Weak central pulse",
  "assessment_d": "Unresponsive",
  "assessment_e": "Warm, dry",

  // ── integer ──
  "patient_age": 82,

  // ── string arrays (JSON arrays of strings) ──
  "medical_history": ["HTN", "CAD"],
  "medications": ["Aspirin 81mg", "Metoprolol"],
  "learning_objectives": ["Recognize peri-arrest", "Manage VF → asystole"],
  "critical_actions": ["High-quality CPR", "Defibrillate VF", "Epi per algorithm", "Identify ROSC"],
  "debrief_points": ["What drove the arrest?", "CPR fraction?"],

  // ── JSONB objects (exact key names below) ──
  "initial_vitals": { "bp": "—", "hr": "140", "rr": "0", "spo2": "88", "temp": "", "bgl": "", "gcs": "3", "etco2": "" },
  "ekg_findings": { "rhythm": "Narrow-complex tachycardia", "rate": "140", "interpretation": "", "twelve_lead": "" },
  "opqrst": { "onset": "", "provocation": "", "quality": "", "radiation": "", "severity": "", "time_onset": "" },
  "sample_history": { "signs_symptoms": "Choking then apnea", "last_oral_intake": "Dinner", "events_leading": "Choked on food" },
  "secondary_survey": { "head": "", "neck": "", "chest": "", "abdomen": "", "back": "", "pelvis": "", "extremities": "" },

  // ── phases: the rhythm progression as ordered structured entries ──
  "phases": [
    {
      "name": "Initial — SVT (peri-arrest)",
      "onset": "on arrival",
      "presentation_notes": "Apneic post-choking; narrow-complex tachy on monitor",
      "vitals": { "bp": "—", "hr": "140", "rr": "0", "spo2": "88", "temp": "", "bgl": "", "gcs": "3", "etco2": "", "ekg_rhythm": "SVT" },
      "expected_actions": ["BVM ventilation", "O2", "IV/IO", "Address hypoxia"]
    },
    { "name": "VF", "onset": "deteriorates", "vitals": { "ekg_rhythm": "VF" }, "expected_actions": ["CPR", "Defibrillate", "Epi", "Amiodarone"] },
    { "name": "Asystole", "vitals": { "ekg_rhythm": "Asystole" }, "expected_actions": ["CPR", "Epi", "H's & T's"] },
    { "name": "ROSC", "vitals": { "bp": "100/60", "hr": "90", "ekg_rhythm": "Sinus" }, "expected_actions": ["Post-arrest care", "12-lead", "TTM"] }
  ]
}
```

## Exact key names that MUST match (the display reads these literally)
- `initial_vitals` / phase `vitals` keys: **`bp, hr, rr, spo2, temp, bgl, gcs, etco2`**, and for the rhythm use **`ekg_rhythm`** (phases) — strings. (Don't add `%`/units; the display adds them.)
- `ekg_findings`: **`rhythm, rate, interpretation, twelve_lead`**.
- `opqrst`: **`onset, provocation, quality, radiation, severity, time_onset`**.
- `sample_history`: **`signs_symptoms, last_oral_intake, events_leading`** (the A/M/P of SAMPLE come from `allergies` / `medications` / `medical_history`).
- `secondary_survey`: **`head, neck, chest, abdomen, back, pelvis, extremities`**.
- phase object: **`name, onset, presentation_notes, vitals{}, expected_actions[], instructor_cues`** (all optional except give it a `name`).

## Notes
- **Learning cases** (CASE_16/17/26/27/34/36/39/40): same schema; `phases` usually a single entry (one rhythm) or omitted; focus on `patient_presentation`, `initial_vitals`, `history`, `critical_actions`. They show in the standard structured view (empty sections auto-collapse).
- **Megacode cases** (CASE_48–55, MEGACODE_TEST_1/2/3/4): use the multi-phase `phases` array for the rhythm progression.
- Blanks are fine — empty sections collapse in the display. Omit rather than send `""` where you can.
- `allergies` is a single TEXT string ("NKDA"), not an array.
- Re-import anytime — idempotent by case_code; safe to refine and re-run.

## After you deliver the file
`node scripts/import-acls-seed.js <file> --dry-run`  → review "(N with narrative content)" → then run without `--dry-run`. The structured panel (megacode grader + learning-station grader) then shows the full content for all 20.

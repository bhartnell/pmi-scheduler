-- PALS per-case step lists (card: PALS STEP LISTS, Ben approved 2026-10-30)
-- Source: AHA PALS Debriefing Tool, Action column. 15 cases, 152 steps, AHA wording.
-- Additive + idempotent: each case gets its own pals_checklists row (checklist_key
-- case_<case_code lowercased>) and scenarios.pals_checklist_id is repointed for those
-- 15 cases only. Subtype checklists stay active and untouched so every other PALS case
-- and every existing attempt (pals_test_attempts.checklist_id) keeps resolving.
-- category / subtype / pass_rule / content_version are copied from the case's CURRENT checklist.

-- 1. Restore points (RLS on, a backup without RLS is readable through the public API)
CREATE TABLE IF NOT EXISTS _backup_pals_checklists_20261030 AS SELECT * FROM pals_checklists;
CREATE TABLE IF NOT EXISTS _backup_pals_checklist_criteria_20261030 AS SELECT * FROM pals_checklist_criteria;
CREATE TABLE IF NOT EXISTS _backup_scenarios_pals_20261030 AS
  SELECT id, case_code, pals_checklist_id FROM scenarios WHERE case_code LIKE 'PALS\_%';
ALTER TABLE _backup_pals_checklists_20261030 ENABLE ROW LEVEL SECURITY;
ALTER TABLE _backup_pals_checklist_criteria_20261030 ENABLE ROW LEVEL SECURITY;
ALTER TABLE _backup_scenarios_pals_20261030 ENABLE ROW LEVEL SECURITY;

DO $do$
DECLARE
  src jsonb := $j$[
{"code":"PALS_PRACTICE_04","steps":[
"Directs assessment of ABCDE and vital signs",
"Administers 100% oxygen",
"Applies cardiac monitor and pulse oximeter",
"Recognizes signs of severe upper airway obstruction",
"Provides appropriate initial management: positions the child and opens the airway, suctions the nares, provides oxygen, gives nebulized epinephrine and dexamethasone",
"Reassesses the child frequently and evaluates response to interventions, watching closely for signs of deterioration",
"Identifies the need for early expert consultation to plan care if the child deteriorates further, including possible advanced airway",
"Arranges transfer to ICU (if not already in ICU)"]},
{"code":"PALS_PRACTICE_03","steps":[
"Directs assessment of ABCDE and vital signs",
"Directs administration of 100% oxygen",
"Applies cardiac monitor and pulse oximeter",
"Recognizes signs and symptoms of lower airway obstruction",
"Initiates therapy for asthma: continued oxygen, nebulized albuterol, corticosteroids",
"Directs establishment of IV or IO access",
"Directs reassessment of the patient in response to each intervention",
"Summarizes additional therapy if indicated (continuous nebulized albuterol, nebulized ipratropium bromide, consider magnesium sulfate)",
"States the importance of early consultation with an expert in the care of children with status asthmaticus"]},
{"code":"PALS_TEST_CASE_06","steps":[
"Directs assessment of ABCDE and vital signs",
"Directs administration of 100% oxygen via nonrebreathing face mask and evaluates response",
"Applies cardiac monitor and pulse oximeter",
"Identifies respiratory failure",
"Identifies signs of lung tissue disease",
"Evaluates response to 100% oxygen and determines need for additional intervention",
"Provides or directs provision of bag-mask ventilation",
"Describes methods to verify that bag-mask ventilation is effective",
"Directs establishment of intravenous access",
"Performs frequent reassessment of the patient",
"Identifies need for involvement of an advanced care professional with expertise in pediatric intubation and mechanical ventilation",
"Identifies indications for endotracheal intubation"]},
{"code":"PALS_PRACTICE_15","steps":[
"Directs assessment of ABCDE and vital signs",
"Provides or directs bag-mask ventilation with 100% oxygen",
"Applies cardiac monitor and pulse oximeter",
"Identifies respiratory failure",
"Identifies signs of disordered control of breathing",
"Directs establishment of intravenous access",
"Performs frequent reassessment of the patient",
"Describes methods to verify that bag-mask ventilation is effective",
"Identifies the need for an advanced provider with expertise in pediatric intubation and mechanical ventilation",
"Summarizes specific interventions for disordered control of breathing"]},
{"code":"PALS_PRACTICE_02","steps":[
"Assesses ABCDE, including vital signs",
"Administers 100% oxygen",
"Applies cardiac monitor and pulse oximeter",
"Recognizes signs and symptoms of hypovolemic shock",
"Categorizes shock as compensated, then hypovolemic",
"Establishes IV or IO access",
"Directs rapid administration of a fluid bolus of isotonic crystalloid; monitors for signs of heart failure during and after the bolus",
"Reassesses the patient in response to interventions, particularly during and after each fluid bolus",
"Repeats fluid bolus as needed to treat shock",
"Checks glucose with point-of-care testing"]},
{"code":"PALS_PRACTICE_13","steps":[
"Assesses ABCDE, including vital signs",
"Applies cardiac monitor and pulse oximeter",
"Identifies signs and symptoms of obstructive shock",
"Categorizes as hypotensive shock",
"Verbalizes the DOPE mnemonic for an intubated patient who deteriorates",
"Identifies tension pneumothorax",
"Describes performance of needle decompression for tension pneumothorax",
"Reassesses the patient's response to needle decompression"]},
{"code":"PALS_PRACTICE_14","steps":[
"Directs assessment of ABCDE and vital signs",
"Applies cardiac monitor and pulse oximeter",
"Administers 100% oxygen",
"Recognizes signs and symptoms of cardiogenic shock",
"Categorizes shock as hypotensive",
"Directs establishment of IV or IO access",
"Directs administration of a 5 to 10 mL/kg bolus of isotonic crystalloid IV/IO over 10 to 20 minutes",
"Reassesses the patient during and in response to interventions, particularly during and after each fluid bolus",
"Identifies signs of worsening heart failure and stops bolus fluid administration",
"Identifies need for inotropic/vasoactive support; titrates to improve cardiac output and systemic perfusion",
"Obtains expert consultation from a pediatric cardiologist and obtains an echocardiogram or other diagnostic studies as recommended"]},
{"code":"PALS_PRACTICE_08","steps":[
"Directs assessment of ABCDE and vital signs",
"Administers 100% oxygen",
"Applies cardiac monitor and pulse oximeter",
"Identifies signs and symptoms of distributive (septic) shock in an adolescent",
"Categorizes shock as hypotensive",
"Directs establishment of IV or IO access",
"Directs rapid administration of a 10 to 20 mL/kg fluid bolus of balanced/buffered crystalloid",
"Reassesses the patient during and in response to interventions, particularly during and after each fluid bolus; stops the bolus if signs of heart failure develop",
"Repeats the fluid bolus as needed to treat shock with careful reassessment during and after each bolus",
"Checks glucose with POC testing early",
"Directs early (within the first hour after identification of shock signs) administration of antibiotics",
"Directs initiation of vasoactive drug therapy within the first hour if shock fails to respond to fluid boluses",
"Verbalizes therapeutic end points during shock management (normalization of heart rate and blood pressure; improvement in peripheral perfusion, mental status and urine output)"]},
{"code":"PALS_PRACTICE_05","steps":[
"Identifies cardiac arrest",
"Directs immediate initiation of high-quality CPR with a feedback device (if available)",
"Applies monitor leads/pads and activates the monitor",
"Identifies asystole in 2 leads",
"Directs establishment of IV or IO access",
"Directs preparation and administration of epinephrine 0.01 mg/kg (0.1 mL/kg of the 0.1 mg/mL concentration) IV/IO bolus at appropriate intervals",
"Directs rhythm checks approximately every 2 minutes while minimizing interruptions in chest compressions",
"Identifies at least 3 potential reversible causes (H's and T's)",
"Performs appropriate reassessment"]},
{"code":"PALS_PRACTICE_12","steps":[
"Identifies cardiac arrest",
"Directs immediate initiation of high-quality CPR with a feedback device (if available) and monitors quality throughout",
"Directs placement of monitor leads/pads and activation of the monitor",
"Identifies pulseless VT cardiopulmonary arrest",
"Directs safe performance of the first shock at 2 J/kg",
"After each shock, directs immediate resumption of high-quality CPR, beginning with compressions",
"Directs establishment of IV or IO access",
"If pulseless VT persists at the second rhythm check, directs safe delivery of a second shock at 4 J/kg; subsequent shocks 4 J/kg or higher (max 10 J/kg or standard adult dose)",
"Directs preparation and administration of epinephrine 0.01 mg/kg (0.1 mL/kg of 0.1 mg/mL) IV/IO at appropriate intervals",
"If VF/pulseless VT persists at the third rhythm check, directs an antiarrhythmic at the appropriate dose (amiodarone 5 mg/kg or lidocaine 1 mg/kg) when compressions resume",
"Performs appropriate reassessments"]},
{"code":"PALS_PRACTICE_10","steps":[
"Directs assessment of ABCDE and vital signs",
"Applies cardiac monitor and pulse oximeter",
"Directs administration of supplemental oxygen",
"Identifies VT with a pulse and stable perfusion",
"Directs establishment of intravenous access",
"Identifies when it would be appropriate to obtain expert consultation",
"Discusses preparation and administration of adenosine using rapid bolus technique (reasonable in a hemodynamically stable patient with a regular, monomorphic wide-complex tachycardia)",
"Explains the rationale for expert consultation before synchronized cardioversion or antiarrhythmics",
"States why it is important to search for and treat reversible causes of wide-complex tachycardias",
"Performs frequent reassessment"]},
{"code":"PALS_TEST_CASE_14","steps":[
"Directs assessment of ABCDE and vital signs",
"Identifies bradycardia associated with cardiorespiratory compromise/failure",
"Directs initiation of bag-mask ventilation with 100% oxygen",
"Applies cardiac monitor and pulse oximeter",
"Reassesses heart rate and perfusion after initiation of bag-mask ventilation with oxygen",
"Recognizes indications to provide high-quality CPR (chest compressions plus ventilation) for the bradycardic patient",
"Directs establishment of IV or IO access",
"Directs or discusses administration of epinephrine 0.01 mg/kg (0.1 mg/mL concentration; maximum dose 1 mg) IV/IO bolus",
"Discusses preparation for advanced airway placement",
"Performs frequent reassessment"]},
{"code":"PALS_TEST_CASE_07","steps":[
"Directs assessment of ABCDE and vital signs",
"Administers 100% oxygen",
"Applies cardiac monitor and pulse oximeter",
"Identifies signs and symptoms of septic shock in an infant",
"Categorizes shock as compensated",
"Directs establishment of IV or IO access",
"Directs rapid administration of a 10 to 20 mL/kg fluid bolus of balanced/buffered crystalloid",
"Reassesses the patient during and in response to interventions, particularly during and after each fluid bolus; stops the bolus if signs of heart failure develop",
"Repeats the fluid bolus as needed to treat shock, with careful reassessment during and after each bolus",
"Checks glucose with point-of-care testing early in the care of the lethargic infant",
"Directs early (within the first hour after identification of shock) administration of antibiotics",
"Directs initiation of vasoactive drug therapy within the first hour if shock fails to respond to fluid boluses"]},
{"code":"PALS_TEST_CASE_09","steps":[
"Directs assessment of ABCDE and vital signs",
"Applies cardiac monitor and pulse oximeter",
"Directs administration of supplemental oxygen",
"Identifies the rhythm as SVT with poor perfusion and distinguishes it from sinus tachycardia",
"Knows how to perform appropriate vagal maneuvers for an infant",
"Directs establishment of IV/IO access if it will not delay synchronized cardioversion",
"Directs preparation and rapid bolus administration of the appropriate dose of adenosine",
"Directs safe delivery of attempted cardioversion at 0.5 J/kg; if ineffective, increases the dose to 2 J/kg",
"Performs frequent reassessments after each intervention"]},
{"code":"PALS_TEST_CASE_13","steps":[
"Directs assessment of ABCDE and vital signs",
"Provides or directs bag-mask ventilation with 100% oxygen",
"Applies cardiac monitor and pulse oximeter",
"Identifies respiratory failure",
"Identifies signs of disordered control of breathing",
"Directs establishment of intravenous access",
"Performs frequent reassessment of the patient",
"Describes methods to verify that bag-mask ventilation is effective",
"Identifies the need for an advanced provider with expertise in pediatric intubation and mechanical ventilation",
"Summarizes specific interventions for disordered control of breathing"]}
]$j$;
  rec jsonb;
  sc record;
  cur record;
  new_id uuid;
  n_expected int;
BEGIN
  IF jsonb_array_length(src) <> 15 THEN RAISE EXCEPTION 'expected 15 cases'; END IF;
  FOR rec IN SELECT * FROM jsonb_array_elements(src) LOOP
    SELECT id, title, pals_checklist_id INTO sc FROM scenarios WHERE case_code = rec->>'code';
    IF sc.id IS NULL THEN RAISE EXCEPTION 'scenario % not found', rec->>'code'; END IF;
    -- idempotent: skip if this case already has its own checklist
    IF EXISTS (SELECT 1 FROM pals_checklists WHERE checklist_key = 'case_' || lower(rec->>'code')) THEN
      CONTINUE;
    END IF;
    SELECT category, subtype, pass_rule, content_version INTO cur
      FROM pals_checklists WHERE id = sc.pals_checklist_id;
    IF cur.category IS NULL THEN RAISE EXCEPTION 'scenario % has no current checklist', rec->>'code'; END IF;
    INSERT INTO pals_checklists (checklist_key, category, subtype, source_ref, cert_course, content_version, pass_rule, active)
    VALUES ('case_' || lower(rec->>'code'), cur.category, cur.subtype,
            'AHA PALS Debriefing Tool, ' || sc.title, 'pals', cur.content_version, cur.pass_rule, true)
    RETURNING id INTO new_id;
    INSERT INTO pals_checklist_criteria (checklist_id, display_order, text, is_critical, scope_conditional, active)
    SELECT new_id, t.ord::int, t.step, false, false, true
      FROM jsonb_array_elements_text(rec->'steps') WITH ORDINALITY AS t(step, ord);
    UPDATE scenarios SET pals_checklist_id = new_id WHERE id = sc.id;
  END LOOP;
END
$do$;

-- ROLLBACK:
--   UPDATE scenarios s SET pals_checklist_id = b.pals_checklist_id
--     FROM _backup_scenarios_pals_20261030 b WHERE b.id = s.id AND s.case_code IN (...the 15 codes...);
--   UPDATE pals_checklists SET active = false WHERE checklist_key LIKE 'case\_pals\_%';
--   (criteria rows stay, harmless; drop the _backup_*_20261030 tables when no longer needed)

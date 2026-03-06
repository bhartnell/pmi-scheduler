import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { canAccessAdmin } from '@/lib/permissions';
import fs from 'fs';
import path from 'path';
import { requireAuth } from '@/lib/api-auth';

// ---------------------------------------------------------------------------
// Helper – resolve current user
// ---------------------------------------------------------------------------
async function getCurrentUser(email: string) {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('lab_users')
    .select('id, name, email, role')
    .ilike('email', email)
    .single();
  return data;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface NormalizedSheet {
  skill_name: string;
  program: string;
  source: string;
  source_priority: number;
  version?: string;
  equipment?: string[];
  overview?: string;
  critical_criteria?: string[];
  critical_failures?: string[];
  notes?: string;
  platinum_skill_type?: string | null;
  steps: NormalizedStep[];
  assignments: { skill_name: string; program: string | null }[];
}

interface NormalizedStep {
  step_number: number;
  phase: string;
  instruction: string;
  is_critical: boolean;
  detail_notes?: string | null;
}

// ---------------------------------------------------------------------------
// Platinum EMT Competency list (16 sheets tagged as emt_competency)
// ---------------------------------------------------------------------------
const EMT_COMPETENCY_TITLES = new Set([
  'Administer Oxygen by Face Mask',
  'Administer Oxygen by Nasal Cannula',
  'Apply a Cervical Collar',
  'Apply a Tourniquet',
  'Apply an Occlusive Dressing to an Open Wound to the Thorax',
  'Assess Vital Signs',
  'Dress and Bandage a Soft Tissue Injury',
  'Insert NPA',
  'Insert OPA',
  'Lift and Transfer a Patient to the Stretcher',
  'Perform a Comprehensive Physical Assessment',
  'Perform CPR - Adult',
  'Perform CPR - Neonate',
  'Perform CPR - Pediatric',
  'Perform Spine Motion Restriction',
  'Perform Uncomplicated Delivery',
  'Splint a Suspected Joint Injury',
  'Splint a Suspected Long Bone Injury',
  'Stabilize an Impaled Object',
  'Ventilate a Neonate Patient with a BVM',
  'Ventilate a Pediatric Patient with a BVM',
  'Ventilate an Adult Patient with a BVM',
  'Perform FBAO - Adult',
  'Perform FBAO - Infant',
  'Perform Oral Suctioning',
]);

// ---------------------------------------------------------------------------
// Cross-reference map: source skill_name -> canonical_name
// ---------------------------------------------------------------------------

// NREMT (EMT) cross-reference
const NREMT_TO_CANONICAL: Record<string, string> = {
  'Patient assessment and management — trauma': 'Patient Assessment — Trauma',
  'Patient assessment and management — medical': 'Patient Assessment — Medical',
  'BVM ventilation of an apneic adult patient': 'BVM Ventilation — Adult',
  'Oxygen administration by non-rebreather mask': 'Oxygen Administration',
  'Spinal immobilization — seated patient': 'Spinal Immobilization — Seated',
  'Spinal immobilization — supine patient': 'Spinal Immobilization — Supine',
  'Bleeding control and shock management': 'Hemorrhage Control / Tourniquet',
  'Cardiac arrest management with AED': 'AED / Defibrillation',
  'Joint immobilization': 'Joint Immobilization',
  'Long bone immobilization': 'Long Bone Immobilization',
};

// Platinum (Paramedic) cross-reference
const PLATINUM_TO_CANONICAL: Record<string, string> = {
  'Administer IM injection': 'IM Injection',
  'Administer IV bolus medication': 'IV Bolus Medication',
  'Administer IV Infusion Medication': 'IV Infusion Setup',
  'Administer Oxygen by Face Mask': 'Oxygen Administration',
  'Administer Oxygen by Nasal Cannula': 'Oxygen Administration',
  'Apply a Cervical Collar': 'Cervical Collar Application',
  'Apply a Tourniquet': 'Hemorrhage Control / Tourniquet',
  'Apply an Occlusive Dressing to an Open Wound to the Thorax': 'Occlusive Dressing / Soft Tissue',
  'Assess Vital Signs': 'Vital Signs',
  'Dress and Bandage a Soft Tissue Injury': 'Occlusive Dressing / Soft Tissue',
  'Establish IO access': 'IO Access',
  'Establish IV access': 'IV Access',
  'Insert NPA': 'NPA Insertion',
  'Insert OPA': 'OPA Insertion',
  'Insert supraglottic airway': 'Supraglottic Airway',
  'Lift and Transfer a Patient to the Stretcher': 'Patient Lifting and Movement',
  'Perform a Comprehensive Physical Assessment': 'Patient Assessment — Trauma',
  'Perform chest compressions': 'CPR — Adult',
  'Perform CPR - Adult': 'CPR — Adult',
  'Perform CPR - Neonate': 'CPR — Neonate',
  'Perform CPR - Pediatric': 'CPR — Pediatric',
  'Perform cricothyrotomy': 'Cricothyrotomy',
  'Perform defibrillation': 'AED / Defibrillation',
  'Perform endotracheal suctioning': 'Endotracheal Suctioning',
  'Perform FBAO - Adult': 'FBAO — Adult',
  'Perform FBAO - Infant': 'FBAO — Infant',
  'Perform FBAO removal using Magill forceps': 'FBAO — Magill Forceps',
  'Perform needle decompression of the chest': 'Needle Decompression',
  'Perform oral endotracheal intubation': 'Oral Endotracheal Intubation',
  'Perform Oral Suctioning': 'Oral Suctioning',
  'Perform PPV with BVM': 'BVM Ventilation — Adult',
  'Perform Spine Motion Restriction': 'Spinal Immobilization — Supine',
  'Perform synchronized cardioversion': 'Synchronized Cardioversion',
  'Perform transcutaneous pacing': 'Transcutaneous Pacing',
  'Perform Uncomplicated Delivery': 'OB Delivery — Normal',
  'Splint a Suspected Joint Injury': 'Joint Immobilization',
  'Splint a Suspected Long Bone Injury': 'Long Bone Immobilization',
  'Stabilize an Impaled Object': 'Impaled Object Stabilization',
  'Ventilate a Neonate Patient with a BVM': 'BVM Ventilation — Neonate',
  'Ventilate a Pediatric Patient with a BVM': 'BVM Ventilation — Pediatric',
  'Ventilate an Adult Patient with a BVM': 'BVM Ventilation — Adult',
};

// Publisher (AEMT) cross-reference - maps stripped skill_name -> canonical
const PUBLISHER_TO_CANONICAL: Record<string, string> = {
  'Performing the Power Lift': 'Patient Lifting and Movement',
  'Performing a Two-Person Body Drag': 'Patient Lifting and Movement',
  'Performing the Diamond Carry': 'Patient Lifting and Movement',
  'Performing the One-Handed Carry': 'Patient Lifting and Movement',
  'One-Person Technique for': 'Patient Lifting and Movement',
  'Performing the Rapid Ex trication Techniq ue': 'Patient Lifting and Movement',
  'Performing a Rapid Full-Body Scan': 'Patient Assessment — Trauma',
  'Direct Ground Lift': 'Patient Lifting and Movement',
  'Extremity Lift': 'Patient Lifting and Movement',
  'Direct Carry': 'Patient Lifting and Movement',
  'Draw Sheet Method': 'Patient Lifting and Movement',
  'Using a Scoop Stretcher': 'Patient Lifting and Movement',
  'Lifting a Patient From the Ground': 'Patient Lifting and Movement',
  'Moving a Patient From a Chair to a Stair Chair': 'Patient Lifting and Movement',
  'Loading a Stretcher Into an Ambulance': 'Patient Lifting and Movement',
  'Using a Stair Chair': 'Patient Lifting and Movement',
  'Carrying a Patient on Stairs': 'Patient Lifting and Movement',
  'Assessing Blood Glucose Level': 'Blood Glucose Monitoring',
  'Performing the Full-Body Exam': 'Patient Assessment — Medical',
  'Obtaining Blood Pressure by Auscultation': 'Vital Signs',
  'Obtaining Blood Pressure by Palpation': 'Vital Signs',
  'Positioning an Unresponsive Patient': 'Patient Lifting and Movement',
  "Suctioning a Patient's Airway": 'Oral Suctioning',
  'Inserting an Oral Airway Into an Adult': 'OPA Insertion',
  'Inserting an Oral Airway With a 90° Rotation': 'OPA Insertion',
  'Inserting a Nasal Airway': 'NPA Insertion',
  'Placing an Oxygen Cylinder Into Service': 'Oxygen Administration',
  'Mouth-to-Mask Ventilation': 'BVM Ventilation — Adult',
  'Using CPAP': 'CPAP Application',
  'Suctioning of a Stoma': 'Stoma / Tracheostomy Care',
  'Ventilating Through a Stoma Using a': 'Stoma / Tracheostomy Care',
  'Ventilating a Stoma With a Bag-Mask Device': 'Stoma / Tracheostomy Care',
  'Insertion of a King LT Airway': 'Supraglottic Airway',
  'LMA Insertion': 'Supraglottic Airway',
  'Inserting an i-gel Supraglottic Airway': 'Supraglottic Airway',
  'Spiking the Bag': 'IV Infusion Setup',
  'Obtaining Vascular Access': 'IV Access',
  'Gaining IO Access With an': 'IO Access',
  'Drawing Medication From an Ampule': 'IV Bolus Medication',
  'Drawing Medication From a Vial': 'IV Bolus Medication',
  'Administering Medication': 'IM Injection',
  'Assisting a Patient With a Metered-Dose Inhaler': 'Inhaled Medication (MDI / Nebulizer)',
  'Administering a Medication': 'Inhaled Medication (MDI / Nebulizer)',
  'Performing Chest Compressions': 'CPR — Adult',
  'Performing One-Rescuer Adult CPR': 'CPR — Adult',
  'Performing Two-Rescuer Adult CPR': 'CPR — Adult',
  'Performing Infant Chest Compressions': 'CPR — Pediatric',
  'Performing CPR on a Child': 'CPR — Pediatric',
  'Removing a Foreign Body Airway Obstruction': 'FBAO — Adult',
  'Administering Nitroglycerin': 'Sublingual Medication',
  'AED and CPR': 'AED / Defibrillation',
  'Performing Cardiac Monitoring': '12-Lead ECG Acquisition',
  'Using an EpiPen Auto-injector': 'IM Injection',
  'Managing External Hemorrhage': 'Hemorrhage Control / Tourniquet',
  'P acking aW ound': 'Hemorrhage Control / Tourniquet',
  'Applying a Commercial Tourniquet': 'Hemorrhage Control / Tourniquet',
  'Managing Internal Hemorrhage': 'Hemorrhage Control / Tourniquet',
  'Stabilizing an Impaled Object': 'Impaled Object Stabilization',
  'Caring for Burns': 'Occlusive Dressing / Soft Tissue',
  'Controlling Bleeding From a Neck Injury': 'Occlusive Dressing / Soft Tissue',
  'Performing Manual In-Line Stabilization': 'Spinal Immobilization — Supine',
  'Application of a Cervical Collar': 'Cervical Collar Application',
  'Performing S R M': 'Spinal Immobilization — Supine',
  'Performing Immobilization': 'Spinal Immobilization — Seated',
  'Removing a Helmet': 'Helmet Removal',
  'Assessing Neurovascular Status': 'Long Bone Immobilization',
  'Applying a Hare Traction Splint': 'Long Bone Immobilization',
  'Applying a Sager Traction Splint': 'Long Bone Immobilization',
  'Applying a Rigid Splint': 'Long Bone Immobilization',
  'Applying a Vacuum Splint': 'Joint Immobilization',
  'Delivering a Newborn': 'OB Delivery — Normal',
  'Positioning the Airway in a Pediatric Patient': 'OPA Insertion — Pediatric',
  'Inserting an Oropharyngeal Airway in a': 'OPA Insertion — Pediatric',
  'Inserting a Nasopharyngeal Airway in a': 'NPA Insertion — Pediatric',
  'One-Person Bag-Mask Device Ventilation': 'BVM Ventilation — Pediatric',
  'Pediatric IO Access and Infusion': 'IO Access — Pediatric',
  'Immobilizing a Pediatric Patient': 'Spinal Immobilization — Supine',
  'Immobilizing a Patient Found in a Car Seat': 'Spinal Immobilization — Supine',
  'Suctioning and Cleaning a Tracheostomy Tube': 'Stoma / Tracheostomy Care',
};

// ---------------------------------------------------------------------------
// Phase mapping helpers
// ---------------------------------------------------------------------------

function mapPlatinumSectionToPhase(section: string | null): string {
  if (section === null) return 'preparation';

  const s = section.toLowerCase();

  // Preparation patterns
  if (s.includes('selects') || s.includes('checks') || s.includes('assembles')) return 'preparation';
  if (s.includes('spikes')) return 'preparation';
  if (s.startsWith('prepares')) return 'preparation';

  // Procedure patterns
  if (s.startsWith('administers')) return 'procedure';
  if (s.startsWith('performs')) return 'procedure';
  if (s.startsWith('intubates')) return 'procedure';
  if (s.startsWith('manages')) return 'procedure';

  // Assessment patterns
  if (s.startsWith('assesses')) return 'assessment';
  if (s.startsWith('verifies')) return 'assessment';
  if (s.startsWith('confirms')) return 'assessment';

  // Packaging patterns
  if (s.startsWith('secures')) return 'packaging';
  if (s.startsWith('reassesses')) return 'packaging';

  return 'procedure';
}

function mapPublisherStepToPhase(text: string): string {
  const t = text.toLowerCase();

  // Preparation
  if (/\b(bsi|ppe|scene|equipment|gather|select|prepare|position patient|explain)\b/.test(t)) {
    return 'preparation';
  }

  // Assessment
  if (/\b(assess|auscultate|monitor|evaluate|verify|confirm|check|inspect|palpate)\b/.test(t)) {
    return 'assessment';
  }

  // Packaging
  if (/\b(secure|reassess|document|transport|dispose|label)\b/.test(t)) {
    return 'packaging';
  }

  return 'procedure';
}

function isCriticalByKeyword(text: string): boolean {
  const t = text.toLowerCase();
  return /\b(failure|inability|does not|endangers)\b/.test(t);
}

function isCriticalFailure(text: string): boolean {
  const t = text.toLowerCase();
  return (
    t.startsWith('failure to') ||
    t.startsWith('inability to') ||
    t.startsWith('endangers') ||
    t.startsWith('recaps needle') ||
    t.startsWith('interrupts cpr')
  );
}

// ---------------------------------------------------------------------------
// Transform functions
// ---------------------------------------------------------------------------

function transformNremt(sheet: Record<string, unknown>): NormalizedSheet {
  const steps = (sheet.steps as Array<Record<string, unknown>> || []).map((s) => ({
    step_number: s.step_number as number,
    phase: s.phase as string,
    instruction: s.instruction as string,
    is_critical: (s.is_critical as boolean) || false,
    detail_notes: (s.detail_notes as string) || null,
  }));

  const skillName = sheet.skill_name as string;
  const canonicalName = NREMT_TO_CANONICAL[skillName];

  const assignments: { skill_name: string; program: string | null }[] = [];
  if (canonicalName) {
    assignments.push({ skill_name: canonicalName, program: 'emt' });
  }

  // Also include any assignments from the source file itself
  const sourceAssignments = sheet.skill_sheet_assignments as Array<{ skill_name: string; program?: string }> | undefined;
  if (sourceAssignments) {
    for (const sa of sourceAssignments) {
      if (!assignments.find(a => a.skill_name === sa.skill_name && a.program === (sa.program || null))) {
        assignments.push({ skill_name: sa.skill_name, program: sa.program || null });
      }
    }
  }

  return {
    skill_name: skillName,
    program: sheet.program as string,
    source: 'nremt',
    source_priority: 1,
    version: sheet.version as string | undefined,
    equipment: sheet.equipment as string[] | undefined,
    overview: sheet.overview as string | undefined,
    critical_criteria: sheet.critical_criteria as string[] | undefined,
    critical_failures: sheet.critical_failures as string[] | undefined,
    notes: sheet.notes as string | undefined,
    platinum_skill_type: null,
    steps,
    assignments,
  };
}

function transformPlatinum(sheet: Record<string, unknown>): NormalizedSheet {
  const title = sheet.title as string;
  const sections = sheet.sections as Record<string, unknown>;
  const assessmentSteps = (sections.assessment_steps as Array<{ text: string; section: string | null }>) || [];
  const sourceCriteria = (sections.critical_criteria as string[]) || [];

  // Map steps (skip affective)
  const steps: NormalizedStep[] = assessmentSteps.map((s, i) => ({
    step_number: i + 1,
    phase: mapPlatinumSectionToPhase(s.section),
    instruction: s.text,
    is_critical: isCriticalByKeyword(s.text),
    detail_notes: null,
  }));

  // Extract equipment from "Selects, checks, assembles equipment" section items
  const equipment: string[] = assessmentSteps
    .filter(s => s.section && s.section.toLowerCase().includes('selects'))
    .map(s => s.text);

  // Split critical_criteria into criteria vs failures
  const criticalFailures: string[] = [];
  const criticalCriteria: string[] = [];
  for (const item of sourceCriteria) {
    if (isCriticalFailure(item)) {
      criticalFailures.push(item);
    } else {
      criticalCriteria.push(item);
    }
  }

  // Determine platinum_skill_type
  const platinumSkillType = EMT_COMPETENCY_TITLES.has(title) ? 'emt_competency' : 'individual';

  // Build assignments from canonical cross-reference
  const canonicalName = PLATINUM_TO_CANONICAL[title];
  const assignments: { skill_name: string; program: string | null }[] = [];
  if (canonicalName) {
    assignments.push({ skill_name: canonicalName, program: 'paramedic' });
  }

  return {
    skill_name: title,
    program: 'paramedic',
    source: 'platinum',
    source_priority: 2,
    equipment: equipment.length > 0 ? equipment : undefined,
    overview: undefined,
    critical_criteria: criticalCriteria.length > 0 ? criticalCriteria : undefined,
    critical_failures: criticalFailures.length > 0 ? criticalFailures : undefined,
    notes: undefined,
    platinum_skill_type: platinumSkillType,
    steps,
    assignments,
  };
}

function transformPublisher(sheet: Record<string, unknown>): NormalizedSheet {
  const rawName = sheet.name as string;
  // Strip "Skill Drill XX-X: " prefix
  const skillName = rawName.replace(/^Skill Drill \d+-\d+:\s*/, '');

  const sourceSteps = (sheet.steps as Array<{ step_number: number; text: string }>) || [];

  const steps: NormalizedStep[] = sourceSteps.map((s) => ({
    step_number: s.step_number,
    phase: mapPublisherStepToPhase(s.text),
    instruction: s.text,
    is_critical: false, // Publisher doesn't mark critical steps
    detail_notes: null,
  }));

  // Build assignments from canonical cross-reference
  const canonicalName = PUBLISHER_TO_CANONICAL[skillName];
  const assignments: { skill_name: string; program: string | null }[] = [];
  if (canonicalName) {
    assignments.push({ skill_name: canonicalName, program: 'aemt' });
  }

  return {
    skill_name: skillName,
    program: 'aemt',
    source: 'publisher',
    source_priority: 3,
    equipment: undefined,
    overview: undefined,
    critical_criteria: undefined,
    critical_failures: undefined,
    notes: undefined,
    platinum_skill_type: null,
    steps,
    assignments,
  };
}

// ---------------------------------------------------------------------------
// File paths for bundled JSON
// ---------------------------------------------------------------------------
const SOURCE_FILES: Record<string, string> = {
  nremt: 'nremt_emt_skill_sheets.json',
  platinum: 'paramedic_platinum_complete.json',
  publisher: 'aemt_publisher_skill_sheets_raw.json',
};

// ---------------------------------------------------------------------------
// POST /api/admin/skill-sheets/import
//
// Accepts { source: 'nremt' | 'platinum' | 'publisher', data?: any[] }
// If data is not provided, reads from bundled JSON files.
// Requires admin+ role.
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const currentUser = await getCurrentUser(user.email);
  if (!currentUser || !canAccessAdmin(user.role)) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  let body: { source: string; data?: unknown[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { source, data } = body;

  if (!source || !['nremt', 'platinum', 'publisher'].includes(source)) {
    return NextResponse.json({ error: 'Invalid source. Must be nremt, platinum, or publisher.' }, { status: 400 });
  }

  // Load data from file if not provided
  let sheets: unknown[];
  if (data && Array.isArray(data) && data.length > 0) {
    sheets = data;
  } else {
    const fileName = SOURCE_FILES[source];
    const filePath = path.join(process.cwd(), 'data', 'skill-sheets', fileName);
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: `Source file not found: ${fileName}` }, { status: 404 });
    }
    const raw = fs.readFileSync(filePath, 'utf-8');
    sheets = JSON.parse(raw);
  }

  if (!Array.isArray(sheets) || sheets.length === 0) {
    return NextResponse.json({ error: 'No sheets to import' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  // Load canonical skills for FK linking
  const { data: canonicalSkills } = await supabase
    .from('canonical_skills')
    .select('id, canonical_name');

  const canonicalMap = new Map<string, string>();
  if (canonicalSkills) {
    for (const cs of canonicalSkills) {
      canonicalMap.set(cs.canonical_name, cs.id);
      // Also add lowercase version for fuzzy matching
      canonicalMap.set(cs.canonical_name.toLowerCase().replace(/[^a-z0-9]/g, ''), cs.id);
    }
  }

  // Select transform function
  const transform = source === 'nremt'
    ? transformNremt
    : source === 'platinum'
      ? transformPlatinum
      : transformPublisher;

  let imported = 0;
  let updated = 0;
  let linked = 0;
  const errors: string[] = [];

  for (const rawSheet of sheets) {
    try {
      const normalized = transform(rawSheet as Record<string, unknown>);

      // Upsert skill_sheet (unique on skill_name + program + source)
      const { data: existing } = await supabase
        .from('skill_sheets')
        .select('id')
        .eq('skill_name', normalized.skill_name)
        .eq('program', normalized.program)
        .eq('source', normalized.source)
        .maybeSingle();

      let sheetId: string;

      if (existing) {
        const { error } = await supabase
          .from('skill_sheets')
          .update({
            source_priority: normalized.source_priority,
            version: normalized.version || null,
            equipment: normalized.equipment || null,
            overview: normalized.overview || null,
            critical_criteria: normalized.critical_criteria || null,
            critical_failures: normalized.critical_failures || null,
            notes: normalized.notes || null,
            platinum_skill_type: normalized.platinum_skill_type || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
        if (error) throw error;
        sheetId = existing.id;
        updated++;
      } else {
        const { data: inserted, error } = await supabase
          .from('skill_sheets')
          .insert({
            skill_name: normalized.skill_name,
            program: normalized.program,
            source: normalized.source,
            source_priority: normalized.source_priority,
            version: normalized.version || null,
            equipment: normalized.equipment || null,
            overview: normalized.overview || null,
            critical_criteria: normalized.critical_criteria || null,
            critical_failures: normalized.critical_failures || null,
            notes: normalized.notes || null,
            platinum_skill_type: normalized.platinum_skill_type || null,
          })
          .select('id')
          .single();
        if (error) throw error;
        sheetId = inserted.id;
        imported++;
      }

      // Delete + re-insert steps
      await supabase
        .from('skill_sheet_steps')
        .delete()
        .eq('skill_sheet_id', sheetId);

      if (normalized.steps.length > 0) {
        const stepsToInsert = normalized.steps.map(step => ({
          skill_sheet_id: sheetId,
          step_number: step.step_number,
          phase: step.phase,
          instruction: step.instruction,
          is_critical: step.is_critical,
          detail_notes: step.detail_notes || null,
        }));

        // Insert in batches of 50 to avoid payload limits
        for (let i = 0; i < stepsToInsert.length; i += 50) {
          const batch = stepsToInsert.slice(i, i + 50);
          const { error } = await supabase
            .from('skill_sheet_steps')
            .insert(batch);
          if (error) throw error;
        }
      }

      // Upsert assignments
      for (const assignment of normalized.assignments) {
        const { error } = await supabase
          .from('skill_sheet_assignments')
          .upsert(
            {
              skill_sheet_id: sheetId,
              skill_name: assignment.skill_name,
              program: assignment.program,
            },
            { onConflict: 'skill_sheet_id,skill_name,program' }
          );
        if (error && !error.message.includes('duplicate')) {
          // Ignore duplicate key errors from upsert race conditions
          throw error;
        }
      }

      // Link to canonical skill
      let canonicalId: string | undefined;

      // First try the cross-reference map based on source
      const crossRefMap = source === 'nremt'
        ? NREMT_TO_CANONICAL
        : source === 'platinum'
          ? PLATINUM_TO_CANONICAL
          : PUBLISHER_TO_CANONICAL;

      const mappedCanonicalName = crossRefMap[normalized.skill_name];
      if (mappedCanonicalName) {
        canonicalId = canonicalMap.get(mappedCanonicalName);
      }

      // Fallback: fuzzy match
      if (!canonicalId) {
        const fuzzyKey = normalized.skill_name.toLowerCase().replace(/[^a-z0-9]/g, '');
        canonicalId = canonicalMap.get(fuzzyKey);
      }

      if (canonicalId) {
        const { error } = await supabase
          .from('skill_sheets')
          .update({ canonical_skill_id: canonicalId })
          .eq('id', sheetId);
        if (error) throw error;
        linked++;
      }
    } catch (err: unknown) {
      const sheetName = (rawSheet as Record<string, unknown>).skill_name
        || (rawSheet as Record<string, unknown>).title
        || (rawSheet as Record<string, unknown>).name
        || 'unknown';
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${sheetName}: ${msg}`);
    }
  }

  return NextResponse.json({
    success: true,
    source,
    imported,
    updated,
    linked,
    total: sheets.length,
    unmatched: sheets.length - linked,
    errors: errors.length > 0 ? errors : undefined,
  });
}

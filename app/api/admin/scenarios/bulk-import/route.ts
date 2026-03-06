import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase';

// ---------------------------------------------------------------------------
// Types for imported scenario data
// ---------------------------------------------------------------------------
interface ImportedPhase {
  name?: string;
  trigger?: string;
  duration_minutes?: number;
  presentation_notes?: string;
  expected_actions?: string | string[];
  general_impression?: string;
  vitals?: Record<string, string | string[]>;
  onset?: string;
  provocation?: string;
  quality?: string;
  radiation?: string;
  severity?: string;
  time_onset?: string;
}

interface ImportedScenario {
  title?: string;
  category?: string;
  subcategory?: string;
  difficulty?: string;
  estimated_duration?: number;
  applicable_programs?: string[];
  dispatch_time?: string;
  dispatch_location?: string;
  chief_complaint?: string;
  dispatch_notes?: string;
  dispatch?: string; // alias for dispatch_notes
  patient_name?: string;
  patient_age?: string;
  patient_sex?: string;
  patient_weight?: string;
  medical_history?: string | string[];
  medications?: string | string[];
  allergies?: string;
  signs_symptoms?: string;
  last_oral_intake?: string;
  events_leading?: string;
  instructor_notes?: string;
  learning_objectives?: string | string[];
  phases?: ImportedPhase[];
  critical_actions?: string | string[];
  debrief_points?: string | string[];
  // SAMPLE history as nested object (alternative format)
  sample_history?: {
    signs_symptoms?: string;
    allergies?: string;
    medications?: string;
    past_history?: string;
    last_intake?: string;
    events?: string;
  };
}

interface ParsedScenario {
  title: string;
  category: string | null;
  subcategory: string | null;
  difficulty: string;
  estimated_duration: number | null;
  applicable_programs: string[];
  dispatch_time: string | null;
  dispatch_location: string | null;
  chief_complaint: string | null;
  dispatch_notes: string | null;
  patient_name: string | null;
  patient_age: string | null;
  patient_sex: string | null;
  patient_weight: string | null;
  medical_history: string[];
  medications: string[];
  allergies: string | null;
  sample_history: Record<string, string>;
  instructor_notes: string | null;
  learning_objectives: string[];
  phases: Record<string, unknown>[];
  critical_actions: { id: string; description: string }[];
  debrief_points: string[];
  initial_vitals: Record<string, string> | null;
  general_impression: string | null;
  ekg_findings: { rhythm: string | null; twelve_lead: string | null } | null;
  is_active: boolean;
}

export interface PreviewScenario {
  index: number;
  title: string;
  category: string | null;
  difficulty: string;
  phaseCount: number;
  criticalActionCount: number;
  valid: boolean;
  errors: string[];
  warnings: string[];
  parsed: ParsedScenario | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function toArray(val: string | string[] | undefined | null): string[] {
  if (!val) return [];
  if (Array.isArray(val)) return val.map(s => String(s).trim()).filter(Boolean);
  return String(val).split(',').map(s => s.trim()).filter(Boolean);
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter(line => line.trim());
  if (lines.length < 2) return [];

  // Parse header
  const headers = parseCSVLine(lines[0]);
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.every(v => !v.trim())) continue; // skip empty rows
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      const key = headers[j].trim().toLowerCase().replace(/\s+/g, '_');
      row[key] = (values[j] || '').trim();
    }
    rows.push(row);
  }

  return rows;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

function buildPhases(imported: ImportedScenario): Record<string, unknown>[] {
  return (imported.phases || []).map((phase, index) => ({
    id: `phase-import-${Date.now()}-${index}`,
    name: phase.name || (index === 0 ? 'Initial Presentation' : `Phase ${index + 1}`),
    trigger: phase.trigger || (index === 0 ? 'On arrival' : ''),
    presentation_notes: phase.presentation_notes || '',
    expected_actions: Array.isArray(phase.expected_actions)
      ? phase.expected_actions.join('\n')
      : (phase.expected_actions || ''),
    general_impression: phase.general_impression || '',
    display_order: index,
    vitals: {
      bp: phase.vitals?.bp || '',
      hr: phase.vitals?.hr || '',
      rr: phase.vitals?.rr || '',
      spo2: phase.vitals?.spo2 || '',
      temp: phase.vitals?.temp || '',
      gcs_total: phase.vitals?.gcs_total || '',
      gcs_e: phase.vitals?.gcs_e || '',
      gcs_v: phase.vitals?.gcs_v || '',
      gcs_m: phase.vitals?.gcs_m || '',
      pupils: phase.vitals?.pupils || '',
      loc: phase.vitals?.loc || '',
      pain: phase.vitals?.pain || '',
      ekg_rhythm: phase.vitals?.ekg_rhythm || '',
      etco2: phase.vitals?.etco2 || '',
      lung_sounds: phase.vitals?.lung_sounds || '',
      lung_notes: phase.vitals?.lung_notes || '',
      skin: phase.vitals?.skin || '',
      blood_glucose: phase.vitals?.blood_glucose || '',
      twelve_lead_notes: phase.vitals?.twelve_lead_notes || '',
      hemorrhage_control: phase.vitals?.hemorrhage_control || '',
      airway_status: phase.vitals?.airway_status || '',
      expose_findings: phase.vitals?.expose_findings || '',
      jvd: phase.vitals?.jvd || '',
      edema: phase.vitals?.edema || '',
      capillary_refill: phase.vitals?.capillary_refill || '',
      pulse_quality: phase.vitals?.pulse_quality || '',
      other_findings: phase.vitals?.other_findings || [],
    },
    onset: phase.onset || '',
    provocation: phase.provocation || '',
    quality: phase.quality || '',
    radiation: phase.radiation || '',
    severity: phase.severity || '',
    time_onset: phase.time_onset || '',
  }));
}

function parseScenario(imported: ImportedScenario, index: number): PreviewScenario {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate required fields
  if (!imported.title?.trim()) {
    errors.push('Title is required');
  }

  // Validate difficulty
  const validDifficulties = ['beginner', 'intermediate', 'advanced', 'expert'];
  const difficulty = (imported.difficulty || 'intermediate').toLowerCase();
  if (!validDifficulties.includes(difficulty)) {
    warnings.push(`Unknown difficulty "${imported.difficulty}" - defaulting to "intermediate"`);
  }

  // Check for useful content
  if (!imported.chief_complaint && !imported.dispatch && !imported.dispatch_notes) {
    warnings.push('Missing chief complaint or dispatch info');
  }
  if (!imported.phases || imported.phases.length === 0) {
    warnings.push('No phases defined - scenario will have no vitals or actions');
  }
  if (!imported.critical_actions || (Array.isArray(imported.critical_actions) && imported.critical_actions.length === 0)) {
    warnings.push('No critical actions defined');
  }

  // Build phases
  const phases = buildPhases(imported);

  // Build critical actions
  const criticalActionsRaw = toArray(imported.critical_actions);
  const criticalActions = criticalActionsRaw.map((desc, i) => ({
    id: `critical-import-${Date.now()}-${i}`,
    description: desc,
  }));

  // Build SAMPLE history
  const sampleHistory: Record<string, string> = {};
  if (imported.sample_history) {
    sampleHistory.signs_symptoms = imported.sample_history.signs_symptoms || imported.signs_symptoms || '';
    sampleHistory.last_oral_intake = imported.sample_history.last_intake || imported.last_oral_intake || '';
    sampleHistory.events_leading = imported.sample_history.events || imported.events_leading || '';
  } else {
    sampleHistory.signs_symptoms = imported.signs_symptoms || '';
    sampleHistory.last_oral_intake = imported.last_oral_intake || '';
    sampleHistory.events_leading = imported.events_leading || '';
  }

  // Merge allergies from sample_history if present
  const allergies = imported.allergies || imported.sample_history?.allergies || null;
  const medications = toArray(imported.medications || imported.sample_history?.medications);
  const medicalHistory = toArray(imported.medical_history || imported.sample_history?.past_history);

  // Build parsed scenario
  const phaseVitals = phases[0]?.vitals as Record<string, string> | undefined;
  const parsed: ParsedScenario = {
    title: (imported.title || '').trim(),
    category: imported.category || null,
    subcategory: imported.subcategory || null,
    difficulty: validDifficulties.includes(difficulty) ? difficulty : 'intermediate',
    estimated_duration: imported.estimated_duration || null,
    applicable_programs: imported.applicable_programs || ['EMT', 'AEMT', 'Paramedic'],
    dispatch_time: imported.dispatch_time || null,
    dispatch_location: imported.dispatch_location || null,
    chief_complaint: imported.chief_complaint || null,
    dispatch_notes: imported.dispatch_notes || imported.dispatch || null,
    patient_name: imported.patient_name || null,
    patient_age: imported.patient_age || null,
    patient_sex: imported.patient_sex || null,
    patient_weight: imported.patient_weight || null,
    medical_history: medicalHistory,
    medications: medications,
    allergies: allergies,
    sample_history: sampleHistory,
    instructor_notes: imported.instructor_notes || null,
    learning_objectives: toArray(imported.learning_objectives),
    phases: phases,
    critical_actions: criticalActions,
    debrief_points: toArray(imported.debrief_points),
    initial_vitals: phaseVitals || null,
    general_impression: (phases[0] as Record<string, unknown>)?.presentation_notes as string || null,
    ekg_findings: (() => {
      if (phaseVitals && (phaseVitals.ekg_rhythm || phaseVitals.twelve_lead_notes)) {
        return {
          rhythm: phaseVitals.ekg_rhythm || null,
          twelve_lead: phaseVitals.twelve_lead_notes || null,
        };
      }
      return null;
    })(),
    is_active: true,
  };

  return {
    index,
    title: parsed.title || `(Row ${index + 1})`,
    category: parsed.category,
    difficulty: parsed.difficulty,
    phaseCount: phases.length,
    criticalActionCount: criticalActions.length,
    valid: errors.length === 0,
    errors,
    warnings,
    parsed: errors.length === 0 ? parsed : null,
  };
}

function csvRowToScenario(row: Record<string, string>): ImportedScenario {
  return {
    title: row.title || '',
    category: row.category || undefined,
    subcategory: row.subcategory || undefined,
    difficulty: row.difficulty || undefined,
    estimated_duration: row.estimated_duration ? parseInt(row.estimated_duration) : undefined,
    chief_complaint: row.chief_complaint || undefined,
    dispatch_notes: row.dispatch_notes || row.dispatch || undefined,
    dispatch_location: row.dispatch_location || undefined,
    dispatch_time: row.dispatch_time || undefined,
    patient_name: row.patient_name || undefined,
    patient_age: row.patient_age || undefined,
    patient_sex: row.patient_sex || undefined,
    patient_weight: row.patient_weight || undefined,
    allergies: row.allergies || undefined,
    medications: row.medications || undefined,
    medical_history: row.medical_history || undefined,
    signs_symptoms: row.signs_symptoms || undefined,
    last_oral_intake: row.last_oral_intake || undefined,
    events_leading: row.events_leading || undefined,
    instructor_notes: row.instructor_notes || undefined,
    learning_objectives: row.learning_objectives || undefined,
    critical_actions: row.critical_actions || undefined,
    debrief_points: row.debrief_points || undefined,
    applicable_programs: row.applicable_programs
      ? row.applicable_programs.split(';').map(s => s.trim()).filter(Boolean)
      : undefined,
  };
}

// ---------------------------------------------------------------------------
// POST /api/admin/scenarios/bulk-import
//
// Accepts a JSON or CSV file, parses and validates scenarios, returns preview.
// Does NOT insert into the database.
// Requires admin+ role.
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth('admin');
    if (auth instanceof NextResponse) return auth;
    const { user } = auth;

    const contentType = request.headers.get('content-type') || '';

    let scenarios: ImportedScenario[] = [];
    let format: 'json' | 'csv' = 'json';

    if (contentType.includes('multipart/form-data')) {
      // File upload
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      const formatParam = formData.get('format') as string | null;

      if (!file) {
        return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
      }

      const text = await file.text();
      format = formatParam === 'csv' ? 'csv' : 'json';

      // Auto-detect format from file extension
      if (!formatParam && file.name) {
        if (file.name.endsWith('.csv')) format = 'csv';
        else if (file.name.endsWith('.json')) format = 'json';
      }

      if (format === 'csv') {
        const rows = parseCSV(text);
        if (rows.length === 0) {
          return NextResponse.json({ error: 'CSV file is empty or has no data rows' }, { status: 400 });
        }
        scenarios = rows.map(csvRowToScenario);
      } else {
        try {
          const parsed = JSON.parse(text);
          scenarios = Array.isArray(parsed) ? parsed : [parsed];
        } catch {
          return NextResponse.json({ error: 'Invalid JSON file' }, { status: 400 });
        }
      }
    } else if (contentType.includes('application/json')) {
      // Direct JSON body
      const body = await request.json();
      scenarios = Array.isArray(body.scenarios) ? body.scenarios : Array.isArray(body) ? body : [body];
      format = body.format === 'csv' ? 'csv' : 'json';
    } else {
      return NextResponse.json({ error: 'Unsupported content type. Use multipart/form-data or application/json.' }, { status: 400 });
    }

    if (scenarios.length === 0) {
      return NextResponse.json({ error: 'No scenarios found in file' }, { status: 400 });
    }

    if (scenarios.length > 200) {
      return NextResponse.json({ error: `Too many scenarios (${scenarios.length}). Maximum is 200 per import.` }, { status: 400 });
    }

    // Parse and validate each scenario
    const preview: PreviewScenario[] = scenarios.map((s, i) => parseScenario(s, i));

    const validCount = preview.filter(p => p.valid).length;
    const invalidCount = preview.filter(p => !p.valid).length;

    return NextResponse.json({
      success: true,
      format,
      total: preview.length,
      valid: validCount,
      invalid: invalidCount,
      scenarios: preview,
    });
  } catch (error: unknown) {
    console.error('Error parsing bulk import:', error);
    const message = error instanceof Error ? error.message : 'Failed to parse import file';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
